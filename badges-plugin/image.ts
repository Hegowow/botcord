export interface PreparedImage {
    dataUrl: string;
    sourceWidth: number;
    sourceHeight: number;
}

export function prepareBadgeImage (file: File, size: number): Promise<PreparedImage> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) return reject(new Error("Le fichier doit être une image"));
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext("2d")!;
            context.imageSmoothingQuality = "high";
            context.drawImage(
                image,
                (image.naturalWidth - side) / 2,
                (image.naturalHeight - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size,
            );
            URL.revokeObjectURL(url);
            resolve({ dataUrl: canvas.toDataURL("image/png"), sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Image illisible"));
        };
        image.src = url;
    });
}
