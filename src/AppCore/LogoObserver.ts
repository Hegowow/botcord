import { loadBrandImages } from "src/AppUtils/BrandAssets";
import { replaceDiscordLogos, SvgElement } from "src/AppUtils/LogoSwap";

const processedSignature = new WeakMap<SVGSVGElement, string>();
const pending = new Set<SVGSVGElement>();
let scheduled = false;

function signatureOf (svg: SVGSVGElement) {
    return Array.from(svg.querySelectorAll("path"))
        .map(path => path.getAttribute("d") || "")
        .join("|");
}

function restoreSvg (svg: SVGSVGElement) {
    svg.querySelectorAll("[data-kahocord-logo]").forEach(node => node.remove());
    svg.querySelectorAll("[data-kahocord-hidden]").forEach(node => node.removeAttribute("data-kahocord-hidden"));
    svg.querySelectorAll("[mask^='url(#kahocord-logo-']").forEach(node => node.removeAttribute("mask"));
    svg.querySelectorAll("[data-kahocord-original-d]").forEach(node => {
        if (node.getAttribute("d") === node.getAttribute("data-kahocord-applied-d")) {
            node.setAttribute("d", node.getAttribute("data-kahocord-original-d") || "");
        }
        node.removeAttribute("data-kahocord-original-d");
        node.removeAttribute("data-kahocord-applied-d");
    });
}

function processSvg (svg: SVGSVGElement) {
    if (!svg.isConnected) return;
    const current = signatureOf(svg);
    if (processedSignature.get(svg) === current) return;
    restoreSvg(svg);
    if (!signatureOf(svg)) {
        processedSignature.set(svg, current);
        return;
    }
    replaceDiscordLogos(svg as unknown as SvgElement, loadBrandImages());
    processedSignature.set(svg, signatureOf(svg));
}

function flush () {
    scheduled = false;
    const batch = Array.from(pending);
    pending.clear();
    batch.forEach(processSvg);
}

function enqueue (node: Node | null) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const owner = element.closest("svg");
    if (owner) pending.add(owner as SVGSVGElement);
    element.querySelectorAll("svg").forEach(svg => pending.add(svg));
    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
    }
}

export function startLogoObserver () {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === "attributes") {
                enqueue(mutation.target);
            } else {
                mutation.addedNodes.forEach(enqueue);
            }
        }
    });
    const start = () => {
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["d"] });
        enqueue(document.documentElement);
    };
    if (document.documentElement) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
}
