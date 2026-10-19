type Point = [number, number];

type Segment =
    | { type: "M" | "L"; to: Point }
    | { type: "C"; c1: Point; c2: Point; to: Point }
    | { type: "Q"; c1: Point; to: Point }
    | { type: "A"; rx: number; ry: number; rotation: number; largeArc: number; sweep: number; to: Point }
    | { type: "Z" };

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface SubPath {
    segments: Segment[];
    box: Box;
}

interface PathShape {
    element: SvgElement;
    subPaths: SubPath[];
}

interface ClydeMatch {
    body: SubPath;
    parts: Set<SubPath>;
}

export interface SvgElement {
    tagName: string;
    nodeName?: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    getElementsByTagName(name: string): ArrayLike<SvgElement>;
    appendChild(node: SvgElement): unknown;
    parentNode: SvgElement | null;
    ownerDocument: SvgDocument | null;
}

export interface SvgDocument {
    createElementNS(namespace: string, name: string): SvgElement;
}

export interface BrandImage {
    dataUri: string;
    cutoutDataUri: string;
    ratio: number;
}

export interface BrandImages {
    wordmark: BrandImage;
    mark: BrandImage;
}

const SvgNamespace = "http://www.w3.org/2000/svg";
const CommandPattern = /[MmLlHhVvCcSsQqTtAaZz]/;
const ArgumentCounts: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

const parsedCache = new Map<string, SubPath[]>();
let uniqueCounter = 0;

function tokenize (d: string) {
    const tokens: string[] = [];
    let i = 0;
    while (i < d.length) {
        const char = d[i];
        if (CommandPattern.test(char)) {
            tokens.push(char);
            i++;
            continue;
        }
        if (/[\s,]/.test(char)) {
            i++;
            continue;
        }
        const match = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(d.slice(i));
        if (!match) {
            i++;
            continue;
        }
        tokens.push(match[0]);
        i += match[0].length;
    }
    return tokens;
}

function splitArcFlags (tokens: string[]) {
    const result: string[] = [];
    let command = "";
    let argIndex = 0;
    for (const token of tokens) {
        if (CommandPattern.test(token)) {
            command = token.toUpperCase();
            argIndex = 0;
            result.push(token);
            continue;
        }
        if (command !== "A") {
            result.push(token);
            continue;
        }
        let rest = token;
        while (rest.length) {
            const position = argIndex % 7;
            if ((position === 3 || position === 4) && /^[01]/.test(rest) && rest.length > 1) {
                result.push(rest[0]);
                rest = rest.slice(1);
            } else {
                result.push(rest);
                rest = "";
            }
            argIndex++;
        }
    }
    return result;
}

function arcCenter (from: Point, segment: Extract<Segment, { type: "A" }>) {
    const [x1, y1] = from;
    const [x2, y2] = segment.to;
    let { rx, ry } = segment;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (!rx || !ry) return null;
    const phi = (segment.rotation * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const x1p = cos * dx + sin * dy;
    const y1p = -sin * dx + cos * dy;
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        rx *= Math.sqrt(lambda);
        ry *= Math.sqrt(lambda);
    }
    const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let factor = Math.sqrt(Math.max(0, numerator / denominator));
    if (segment.largeArc === segment.sweep) factor = -factor;
    const cxp = (factor * rx * y1p) / ry;
    const cyp = (-factor * ry * x1p) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const angle = (ux: number, uy: number, vx: number, vy: number) => {
        const sign = ux * vy - uy * vx < 0 ? -1 : 1;
        const dot = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
        return sign * Math.acos(Math.min(1, Math.max(-1, dot)));
    };
    const start = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!segment.sweep && delta > 0) delta -= 2 * Math.PI;
    if (segment.sweep && delta < 0) delta += 2 * Math.PI;
    return { cx, cy, rx, ry, cos, sin, start, delta };
}

function samplePoints (from: Point, segment: Segment): Point[] {
    if (segment.type === "Z") return [];
    if (segment.type === "M" || segment.type === "L") return [segment.to];
    const steps = 12;
    const points: Point[] = [];
    if (segment.type === "C" || segment.type === "Q") {
        for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            const u = 1 - t;
            if (segment.type === "C") {
                points.push([
                    u * u * u * from[0] + 3 * u * u * t * segment.c1[0] + 3 * u * t * t * segment.c2[0] + t * t * t * segment.to[0],
                    u * u * u * from[1] + 3 * u * u * t * segment.c1[1] + 3 * u * t * t * segment.c2[1] + t * t * t * segment.to[1],
                ]);
            } else {
                points.push([
                    u * u * from[0] + 2 * u * t * segment.c1[0] + t * t * segment.to[0],
                    u * u * from[1] + 2 * u * t * segment.c1[1] + t * t * segment.to[1],
                ]);
            }
        }
        return points;
    }
    if (segment.type !== "A") return [segment.to];
    const arc = arcCenter(from, segment);
    if (!arc) return [segment.to];
    for (let step = 1; step <= steps; step++) {
        const theta = arc.start + (arc.delta * step) / steps;
        const x = arc.rx * Math.cos(theta);
        const y = arc.ry * Math.sin(theta);
        points.push([arc.cos * x - arc.sin * y + arc.cx, arc.sin * x + arc.cos * y + arc.cy]);
    }
    return points;
}

function computeBox (segments: Segment[]): Box {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let current: Point = [0, 0];
    for (const segment of segments) {
        if (segment.type === "Z") continue;
        const points = segment.type === "M" ? [segment.to] : samplePoints(current, segment);
        for (const [x, y] of points) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        current = segment.to;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function parsePath (d: string): SubPath[] {
    const cached = parsedCache.get(d);
    if (cached) return cached;
    const tokens = splitArcFlags(tokenize(d));
    const subPaths: Segment[][] = [];
    let segments: Segment[] = [];
    let current: Point = [0, 0];
    let start: Point = [0, 0];
    let lastControl: Point | null = null;
    let lastCommand = "";
    let i = 0;
    let command = "";
    while (i < tokens.length) {
        if (CommandPattern.test(tokens[i])) {
            command = tokens[i];
            i++;
        } else if (!command) {
            break;
        }
        const upper = command.toUpperCase();
        const relative = command !== upper;
        const count = ArgumentCounts[upper];
        if (upper === "Z") {
            segments.push({ type: "Z" });
            current = start;
            lastControl = null;
            lastCommand = "Z";
            command = "";
            continue;
        }
        const args = tokens.slice(i, i + count).map(Number);
        if (args.length < count || args.some(Number.isNaN)) break;
        i += count;
        const abs = (x: number, y: number): Point => (relative ? [current[0] + x, current[1] + y] : [x, y]);
        let segment: Segment;
        if (upper === "M") {
            if (segments.length) subPaths.push(segments);
            segments = [];
            const to = abs(args[0], args[1]);
            segment = { type: "M", to };
            start = to;
            command = relative ? "l" : "L";
        } else if (upper === "L") {
            segment = { type: "L", to: abs(args[0], args[1]) };
        } else if (upper === "H") {
            segment = { type: "L", to: [relative ? current[0] + args[0] : args[0], current[1]] };
        } else if (upper === "V") {
            segment = { type: "L", to: [current[0], relative ? current[1] + args[0] : args[0]] };
        } else if (upper === "C") {
            segment = { type: "C", c1: abs(args[0], args[1]), c2: abs(args[2], args[3]), to: abs(args[4], args[5]) };
        } else if (upper === "S") {
            const reflected: Point =
                lastControl && /[CS]/.test(lastCommand) ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
            segment = { type: "C", c1: reflected, c2: abs(args[0], args[1]), to: abs(args[2], args[3]) };
        } else if (upper === "Q") {
            segment = { type: "Q", c1: abs(args[0], args[1]), to: abs(args[2], args[3]) };
        } else if (upper === "T") {
            const reflected: Point =
                lastControl && /[QT]/.test(lastCommand) ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
            segment = { type: "Q", c1: reflected, to: abs(args[0], args[1]) };
        } else {
            segment = {
                type: "A",
                rx: args[0],
                ry: args[1],
                rotation: args[2],
                largeArc: args[3] ? 1 : 0,
                sweep: args[4] ? 1 : 0,
                to: abs(args[5], args[6]),
            };
        }
        segments.push(segment);
        lastControl = segment.type === "C" ? segment.c2 : segment.type === "Q" ? segment.c1 : null;
        lastCommand = upper;
        current = segment.to;
    }
    if (segments.length) subPaths.push(segments);
    const result = subPaths
        .filter(list => list.some(segment => segment.type !== "M" && segment.type !== "Z"))
        .map(list => ({ segments: list, box: computeBox(list) }));
    parsedCache.set(d, result);
    return result;
}

function serialize (subPaths: SubPath[]) {
    const n = (value: number) => Number(value.toFixed(3)).toString();
    const p = (point: Point) => `${n(point[0])} ${n(point[1])}`;
    return subPaths
        .flatMap(subPath =>
            subPath.segments.map(segment => {
                switch (segment.type) {
                    case "M":
                        return `M${p(segment.to)}`;
                    case "L":
                        return `L${p(segment.to)}`;
                    case "C":
                        return `C${p(segment.c1)} ${p(segment.c2)} ${p(segment.to)}`;
                    case "Q":
                        return `Q${p(segment.c1)} ${p(segment.to)}`;
                    case "A":
                        return `A${n(segment.rx)} ${n(segment.ry)} ${n(segment.rotation)} ${segment.largeArc} ${segment.sweep} ${p(segment.to)}`;
                    default:
                        return "Z";
                }
            }),
        )
        .join("");
}

const center = (box: Box): Point => [box.x + box.w / 2, box.y + box.h / 2];

const inside = (inner: Box, outer: Box) =>
    inner.x >= outer.x - 0.01 * outer.w &&
    inner.y >= outer.y - 0.01 * outer.h &&
    inner.x + inner.w <= outer.x + outer.w * 1.01 &&
    inner.y + inner.h <= outer.y + outer.h * 1.01;

function isEye (eye: Box, body: Box) {
    const relativeWidth = eye.w / body.w;
    const relativeHeight = eye.h / body.h;
    const [, cy] = center(eye);
    const relativeY = (cy - body.y) / body.h;
    const aspect = eye.w / eye.h;
    return (
        aspect > 0.75 &&
        aspect < 1.02 &&
        relativeWidth > 0.1 &&
        relativeWidth < 0.26 &&
        relativeHeight > 0.14 &&
        relativeHeight < 0.36 &&
        relativeY > 0.45 &&
        relativeY < 0.8 &&
        inside(eye, body)
    );
}

function outlinePoints (subPath: SubPath) {
    const points: Point[] = [];
    let current: Point = [0, 0];
    for (const segment of subPath.segments) {
        if (segment.type === "Z") continue;
        points.push(...(segment.type === "M" ? [segment.to] : samplePoints(current, segment)));
        current = segment.to;
    }
    return points;
}

function hasClydeSilhouette (body: SubPath) {
    const { x, y, w, h } = body.box;
    const cx = x + w / 2;
    const points = outlinePoints(body).map(([px, py]) => [(px - cx) / w, (py - y) / h]);
    const central = points.filter(([px]) => Math.abs(px) < 0.08);
    if (!central.length) return false;
    const centralTop = Math.min(...central.map(([, py]) => py));
    const centralBottom = Math.max(...central.map(([, py]) => py));
    const feet = points.filter(([px, py]) => Math.abs(px) > 0.15 && Math.abs(px) < 0.42 && py > 0.96);
    const leftFoot = feet.some(([px]) => px < 0);
    const rightFoot = feet.some(([px]) => px > 0);
    return centralTop > 0.035 && centralBottom < 0.93 && leftFoot && rightFoot;
}

export function findClyde (subPaths: SubPath[]): ClydeMatch | null {
    for (const body of subPaths) {
        const ratio = body.box.w / body.box.h;
        if (ratio < 1.15 || ratio > 1.45 || body.box.h <= 0) continue;
        if (body.segments.filter(segment => segment.type !== "M" && segment.type !== "Z").length < 8) continue;
        if (!hasClydeSilhouette(body)) continue;
        const eyes = subPaths.filter(candidate => candidate !== body && isEye(candidate.box, body.box));
        const [bodyX] = center(body.box);
        for (const left of eyes) {
            for (const right of eyes) {
                if (left === right) continue;
                const [lx, ly] = center(left.box);
                const [rx, ry] = center(right.box);
                if (lx >= bodyX || rx <= bodyX) continue;
                if (Math.abs(ly - ry) > 0.05 * body.box.h) continue;
                if (Math.abs((lx + rx) / 2 - bodyX) > 0.05 * body.box.w) continue;
                if (Math.abs(left.box.w - right.box.w) > 0.2 * left.box.w) continue;
                const spacing = (rx - lx) / body.box.w;
                if (spacing < 0.25 || spacing > 0.5) continue;
                return { body, parts: new Set([body, left, right]) };
            }
        }
    }
    return null;
}

function collectShapes (svg: SvgElement): PathShape[] {
    return Array.from(svg.getElementsByTagName("path"))
        .filter(element => !isOutsideOwnDrawing(element, svg))
        .map(element => ({ element, subPaths: parsePath(element.getAttribute("d") || "") }));
}

function isOutsideOwnDrawing (element: SvgElement, svg: SvgElement) {
    let node = element.parentNode;
    while (node && node !== svg) {
        const name = (node.tagName || node.nodeName || "").toLowerCase();
        if (["defs", "mask", "clippath", "pattern", "symbol", "svg", "foreignobject"].includes(name)) return true;
        node = node.parentNode;
    }
    return false;
}

function resolveFill (element: SvgElement) {
    let node: SvgElement | null = element;
    while (node && typeof node.getAttribute === "function") {
        const style = node.getAttribute("style") || "";
        const fromStyle = /(?:^|;)\s*fill\s*:\s*([^;]+)/.exec(style);
        if (fromStyle) return fromStyle[1].trim();
        const fill = node.getAttribute("fill");
        if (fill && fill !== "none") return fill;
        node = node.parentNode;
    }
    return "currentColor";
}

function applyPathData (element: SvgElement, d: string) {
    if (element.getAttribute("data-kahocord-original-d") === null) {
        element.setAttribute("data-kahocord-original-d", element.getAttribute("d") || "");
    }
    element.setAttribute("data-kahocord-applied-d", d);
    element.setAttribute("d", d);
}

function hideSubPaths (shape: PathShape, removed: Set<SubPath>) {
    const remaining = shape.subPaths.filter(subPath => !removed.has(subPath));
    if (remaining.length === shape.subPaths.length) return;
    if (!remaining.length) {
        shape.element.setAttribute("data-kahocord-hidden", "");
        applyPathData(shape.element, "");
        return;
    }
    applyPathData(shape.element, serialize(remaining));
}

function fitBox (image: BrandImage, box: Box, align: "center" | "start"): Box {
    let width = box.w;
    let height = width / image.ratio;
    if (height > box.h) {
        height = box.h;
        width = height * image.ratio;
    }
    const x = align === "center" ? box.x + (box.w - width) / 2 : box.x;
    return { x, y: box.y + (box.h - height) / 2, w: width, h: height };
}

function createImage (document: SvgDocument, href: string, box: Box) {
    const picture = document.createElementNS(SvgNamespace, "image");
    picture.setAttribute("href", href);
    picture.setAttribute("x", String(box.x));
    picture.setAttribute("y", String(box.y));
    picture.setAttribute("width", String(box.w));
    picture.setAttribute("height", String(box.h));
    picture.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return picture;
}

function createMask (document: SvgDocument, area: Box) {
    const mask = document.createElementNS(SvgNamespace, "mask");
    const id = `kahocord-logo-${Date.now().toString(36)}-${uniqueCounter++}`;
    mask.setAttribute("id", id);
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("x", String(area.x));
    mask.setAttribute("y", String(area.y));
    mask.setAttribute("width", String(area.w));
    mask.setAttribute("height", String(area.h));
    return { mask, id };
}

function cutBrand (svg: SvgElement, owner: SvgElement, image: BrandImage, logoBox: Box, container: Box) {
    const document = svg.ownerDocument;
    if (!document) return;
    const area = { x: container.x - 1, y: container.y - 1, w: container.w + 2, h: container.h + 2 };
    const { mask, id } = createMask(document, area);
    const background = document.createElementNS(SvgNamespace, "rect");
    background.setAttribute("x", String(area.x));
    background.setAttribute("y", String(area.y));
    background.setAttribute("width", String(area.w));
    background.setAttribute("height", String(area.h));
    background.setAttribute("fill", "#fff");
    mask.appendChild(background);
    mask.appendChild(createImage(document, image.cutoutDataUri, fitBox(image, logoBox, "center")));
    const defs = document.createElementNS(SvgNamespace, "defs");
    defs.setAttribute("data-kahocord-logo", "");
    defs.appendChild(mask);
    svg.appendChild(defs);
    owner.setAttribute("mask", `url(#${id})`);
}

function insertBrand (svg: SvgElement, image: BrandImage, box: Box, color: string, align: "center" | "start") {
    const document = svg.ownerDocument;
    if (!document) return;
    const target = fitBox(image, box, align);
    const { mask, id } = createMask(document, target);
    mask.appendChild(createImage(document, image.dataUri, target));
    const defs = document.createElementNS(SvgNamespace, "defs");
    defs.setAttribute("data-kahocord-logo", "");
    defs.appendChild(mask);
    const rect = document.createElementNS(SvgNamespace, "rect");
    rect.setAttribute("x", String(target.x));
    rect.setAttribute("y", String(target.y));
    rect.setAttribute("width", String(target.w));
    rect.setAttribute("height", String(target.h));
    rect.setAttribute("fill", color);
    rect.setAttribute("mask", `url(#${id})`);
    rect.setAttribute("data-kahocord-logo", "");
    svg.appendChild(defs);
    svg.appendChild(rect);
}

function unionBox (boxes: Box[]): Box {
    const minX = Math.min(...boxes.map(box => box.x));
    const minY = Math.min(...boxes.map(box => box.y));
    const maxX = Math.max(...boxes.map(box => box.x + box.w));
    const maxY = Math.max(...boxes.map(box => box.y + box.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function findWordmarkLetters (shapes: PathShape[], match: ClydeMatch, removed: Set<SubPath>) {
    const body = match.body.box;
    const letters = shapes.flatMap(shape =>
        shape.subPaths.filter(subPath => {
            if (match.parts.has(subPath) || removed.has(subPath)) return false;
            const { box } = subPath;
            const verticalOverlap = Math.min(box.y + box.h, body.y + body.h) - Math.max(box.y, body.y);
            return box.x >= body.x + body.w * 0.95 && verticalOverlap > 0.3 * Math.min(box.h, body.h) && box.h < body.h * 1.2;
        }),
    );
    if (letters.length < 4) return null;
    const extent = unionBox(letters.map(subPath => subPath.box));
    if (extent.x + extent.w < body.x + body.w * 3) return null;
    if (extent.x - (body.x + body.w) > body.w * 0.8) return null;
    return letters;
}

export function replaceDiscordLogos (svg: SvgElement, brand: BrandImages) {
    const shapes = collectShapes(svg);
    const removed = new Set<SubPath>();
    let replaced = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const available = shapes.flatMap(shape => shape.subPaths).filter(subPath => !removed.has(subPath));
        const match = findClyde(available);
        if (!match) break;
        const owner = shapes.find(shape => shape.subPaths.includes(match.body));
        const color = owner ? resolveFill(owner.element) : "currentColor";
        const letters = findWordmarkLetters(shapes, match, removed);
        const logoParts = [...match.parts, ...(letters || [])];
        logoParts.forEach(subPath => removed.add(subPath));
        const container = owner?.subPaths.find(
            subPath => !removed.has(subPath) && subPath.box.w > match.body.box.w && inside(match.body.box, subPath.box),
        );
        if (owner && container && !letters) {
            cutBrand(svg, owner.element, brand.mark, match.body.box, container.box);
        } else if (letters) {
            insertBrand(svg, brand.wordmark, unionBox(logoParts.map(subPath => subPath.box)), color, "start");
        } else {
            insertBrand(svg, brand.mark, match.body.box, color, "center");
        }
        replaced++;
    }
    if (replaced) shapes.forEach(shape => hideSubPaths(shape, removed));
    return replaced;
}
