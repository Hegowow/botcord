import { CloudUpload as TCloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { findLazy, findStoreLazy } from "@webpack";

const CloudUpload: typeof TCloudUpload = findLazy(m => m.prototype?.trackUploadFinished);
export const PendingReplyStore = findStoreLazy("PendingReplyStore");

export function uploadFile(channelId: string, filename: string, type: string, blob: Blob): Promise<{ filename: string, uploadedFilename: string }> {
    return new Promise((resolve, reject) => {
        const upload = new CloudUpload({
            file: new File([blob], filename, { type }),
            isThumbnail: false,
            platform: CloudUploadPlatform.WEB,
        }, channelId);

        upload.on("complete", () => {
            resolve({
                filename: upload.filename,
                uploadedFilename: upload.uploadedFilename,
            });
        });
        upload.on("error", () => reject(new Error("Failed to upload file")));

        upload.upload();
    });
}
