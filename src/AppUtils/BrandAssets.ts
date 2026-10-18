import { readFileSync } from "fs";
import path from "path";

import { BrandImage, BrandImages } from "./LogoSwap";

const brandFolder = path.join(__dirname, "..", "..", "assets", "brand");

function loadImage (name: string, ratio: number): BrandImage {
    const read = (file: string) => `data:image/png;base64,${readFileSync(path.join(brandFolder, file)).toString("base64")}`;
    return { dataUri: read(`${name}.png`), cutoutDataUri: read(`${name}-cutout.png`), ratio };
}

let cache: BrandImages | null = null;

export function loadBrandImages (): BrandImages {
    cache ??= {
        wordmark: loadImage("wordmark", 960 / 154),
        mark: loadImage("mark", 1),
    };
    return cache;
}

export const BrandIconPath = path.join(brandFolder, "..", "icon.png");
export const BrandOverridesFolder = path.join(brandFolder, "overrides");
