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

function processSvg (svg: SVGSVGElement) {
    if (!svg.isConnected) return;
    const signature = signatureOf(svg);
    if (!signature || processedSignature.get(svg) === signature) return;
    svg.querySelectorAll("[data-kahocord-logo]").forEach(node => node.remove());
    svg.querySelectorAll("[data-kahocord-hidden]").forEach(node => node.removeAttribute("data-kahocord-hidden"));
    svg.querySelectorAll("[mask^='url(#kahocord-logo-']").forEach(node => node.removeAttribute("mask"));
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
