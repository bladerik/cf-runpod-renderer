import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import stream from "stream";
import { promisify } from "util";
import ffmpeg from "fluent-ffmpeg";

const pipeline = promisify(stream.pipeline);

const cleanExt = (ext: string) => {
    return ext.split("?")[0].replace(".", "").toLowerCase();
};

export const isFile = (path: string): boolean => {
    try {
        // Use fs.statSync() to get stats about the file at the given path
        const stats = fs.statSync(path);

        // Return true if it's a file, false otherwise
        return stats.isFile();
    } catch (error) {
        // If an error occurs (for example, the file does not exist), return false
        return false;
    }
};

export const isOk = (
    filepath: string,
    useFfprobe = false
): Promise<boolean> => {
    console.log("Checking file...", filepath);
    return new Promise((resolve) => {
        try {
            // Check if file exists
            if (!fs.existsSync(filepath)) return resolve(false);

            // Check if file is readable (not corrupted)
            fs.accessSync(filepath, fs.constants.R_OK);

            // Check if file has non-zero size
            const stats = fs.statSync(filepath);
            if (stats.size === 0) return resolve(false);

            if (useFfprobe) {
                // Use ffprobe to retrieve metadata about the file
                ffmpeg.ffprobe(filepath, (err, metadata) => {
                    if (err) {
                        // ffprobe failed to retrieve metadata, the file is likely not a valid media file
                        resolve(false);
                    } else {
                        // ffprobe succeeded, the file is likely a valid media file
                        resolve(true);
                    }
                });
            } else {
                resolve(true);
            }

            return resolve(true);
        } catch (e) {
            // If any of the checks above throw an error, consider the file as not okay
            return resolve(false);
        }
    });
};

export const detectFileExtension = (filepath: string) => {
    if (filepath.startsWith("http")) {
        filepath = filepath.split("?")[0];
        console.log("-- detectFileExtension", filepath);
        const url = new URL(filepath);
        const filename = path.basename(url.pathname);
        const output = cleanExt(path.extname(filename));
        console.log(filename, output);
        return output;
    }

    console.log("-- detectFileExtension (no url)", filepath);
    return cleanExt(path.extname(filepath));
};

export const createDirForFile = (filepath: string) => {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return dir;
};

export const urlDownload = async (
    url: string,
    path: string
): Promise<string> => {
    createDirForFile(path);

    const downloadPath = path + ".download";

    if (fs.existsSync(downloadPath)) {
        let previousSize = fs.statSync(downloadPath).size;

        const intervalId = setInterval(() => {
            if (!fs.existsSync(downloadPath)) {
                // File has been downloaded, stop checking
                clearInterval(intervalId);
                return;
            }
            const currentSize = fs.statSync(downloadPath).size;

            if (currentSize === previousSize) {
                // File size is not increasing, delete .download file and trigger download again
                fs.unlinkSync(downloadPath);
                urlDownload(url, path);
            }

            previousSize = currentSize;
        }, 5000); // Check every 5 seconds

        return new Promise((resolve, reject) => {
            fs.watchFile(downloadPath, (curr) => {
                if (!fs.existsSync(downloadPath)) {
                    fs.unwatchFile(downloadPath);
                    clearInterval(intervalId);
                    resolve(path);
                }
            });
        });
    }

    // Create an empty .download file indicating that this file is being downloaded
    fs.closeSync(fs.openSync(downloadPath, "w"));

    const response = await fetch(url);

    if (!response.ok)
        throw new Error(`unexpected response ${response.statusText}`);

    if (!response.body) {
        throw new Error("No response body");
    }

    await pipeline(response.body, fs.createWriteStream(path));

    // Delete .download file after download is complete
    if (fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
    }

    return path;
};

// export const urlDownload = async (
//     url: string,
//     path: string
// ): Promise<string> => {
//     createDirForFile(path);

//     // create an empty file indicating that this file is being downloaded

//     const response = await fetch(url);

//     if (!response.ok)
//         throw new Error(`unexpected response ${response.statusText}`);

//     if (!response.body) {
//         throw new Error("No response body");
//     }

//     await pipeline(response.body, fs.createWriteStream(path));
//     return path;
// };

export const getLocalpath = (renderDir: string, signedPath: string) => {
    const url = new URL(signedPath);
    const filename = path.basename(url.pathname);
    const localpath = path.join(renderDir, filename);
    return localpath;
};
