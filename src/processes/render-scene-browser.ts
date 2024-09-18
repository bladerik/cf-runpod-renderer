import { ResourcesPrepareJobData, DownloadRawClipJobData } from "../types.js";
import axios from "axios";
import { urlDownload } from "../utils/file.js";
import { trimByTimes } from "../utils/video.js";
import { upload } from "../utils/idriveClient.js";
import fs from "fs";
import BrowserSceneRenderer from "../renderer/browserSceneRenderer.js";

const notify = async function (
    jobId: string,
    data: DownloadRawClipJobData,
    link?: string
) {
    const { id, clipId, token } = data;

    const notify_endpoint = process.env.APP_ENDPOINT
        ? process.env.APP_ENDPOINT +
          "/api/scene-clip/download-raw/" +
          id +
          "/" +
          clipId
        : null;

    if (notify_endpoint) {
        const notifyData = {
            jobId,
            status: link ? "completed" : "in-progress",
            progress: link ? 100 : 0,
            link,
        };
        await axios.post(notify_endpoint, notifyData, {
            headers: {
                Authorization: token,
            },
        });
    }
};

const notifyError = async function (
    jobId: string,
    data: DownloadRawClipJobData,
    errorMessage?: string
) {
    const { id, clipId, token } = data;

    const notify_endpoint = process.env.APP_ENDPOINT
        ? process.env.APP_ENDPOINT +
          "/api/scene-clip/download-raw/" +
          id +
          "/" +
          clipId
        : null;

    if (notify_endpoint) {
        const notifyData = {
            jobId,
            status: "FAILED",
            progress: 0,
            message: errorMessage,
        };
        await axios.post(notify_endpoint, notifyData, {
            headers: {
                Authorization: token,
            },
        });
    }
};

export default async function (job: any) {
    const data = job as any;
    const clipId = "";
    const jobId = job.scene.id + "-" + clipId + "-" + job.id;

    console.log(`Starting render-scene-browser`, new Date().toISOString());
    // await notify(jobId, data);

    try {
        // download and trim the clip
        // get filename from file_url
        // upload video
        // const key =
        //     "resources/raw-download/" +
        //     id +
        //     "/" +
        //     clipId +
        //     "/" +
        //     duration.toFixed(3).replace(".", "-") +
        //     "-" +
        //     outputName;
        // await upload(key, fs.readFileSync(trimmedPath));
        // const link = process.env.IDRIVE_CDN_URL + "/" + key;
        // console.log("Chunk link", link);
        // await notify(jobId, data, link);

        const startTime = Date.now();
        const renderer = new BrowserSceneRenderer(data);
        await renderer.render();
        const endTime = Date.now();
        console.log(`Rendering time: ${(endTime - startTime) / 1000} seconds`);

        return {
            success: true,
            time: (endTime - startTime) / 1000,
            url: "todo",
        };
    } catch (err: any) {
        console.log("render-scene-browser error", err);
        await notifyError(
            jobId,
            data,
            err.message ? err.message : "An error occurred"
        );

        return {
            success: false,
            message: err.message ? err.message : "An error occurred",
        };
    }
}
