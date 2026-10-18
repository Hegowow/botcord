import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { net } from "electron";
import { Request, Response, Router } from "express";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { BrandIconPath, BrandOverridesFolder, loadBrandImages } from "src/AppUtils/BrandAssets";
import { replaceDiscordLogos, SvgElement } from "src/AppUtils/LogoSwap";

const router = Router();
const svgCache = new Map<string, Promise<string>>();

function rebrandSvg (source: string) {
    if (!source.includes("<svg")) return source;
    try {
        const document = new DOMParser({ onError: () => undefined }).parseFromString(source, "image/svg+xml");
        const svg = document.documentElement;
        if (!svg || svg.tagName !== "svg") return source;
        if (!replaceDiscordLogos(svg as unknown as SvgElement, loadBrandImages())) return source;
        return new XMLSerializer().serializeToString(document);
    } catch {
        return source;
    }
}

async function fetchRebrandedSvg (file: string) {
    const response = await net.fetch(`https://canary.discord.com/assets/${file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return rebrandSvg(await response.text());
}

router.get("/assets/:file([0-9a-f]+\\.svg)", async (req: Request<{ file: string }>, res: Response) => {
    const { file } = req.params;
    if (!svgCache.has(file)) {
        svgCache.set(
            file,
            fetchRebrandedSvg(file).catch(error => {
                svgCache.delete(file);
                throw error;
            }),
        );
    }
    try {
        const body = await svgCache.get(file)!;
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.send(body);
    } catch {
        res.status(502).send();
    }
});

router.get("/assets/:file([0-9a-f]+\\.png)", (req: Request<{ file: string }>, res: Response, next) => {
    const override = path.join(BrandOverridesFolder, req.params.file);
    if (!existsSync(override)) return next();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(readFileSync(override));
});

router.get("/assets/favicon.ico", (req, res) => {
    res.setHeader("Content-Type", "image/png");
    res.send(readFileSync(BrandIconPath));
});

export default router;
