import { chromium, Browser, firefox } from "playwright";
import { SceneShape } from "@bladesk/cf-pixi-scene-builder";
import fs from "fs";
import sharp from "sharp";
import { Readable } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";

import {
    SceneDataJson,
    Subtitle,
    FontType,
} from "@bladesk/cf-pixi-scene-builder";

class BrowserSceneRenderer {
    private browser!: Browser;
    private scene!: SceneDataJson;
    private subtitles!: { [key: string]: Subtitle[] };
    private fonts!: FontType[];
    private renderMode!: "server" | "client";
    private debug!: boolean;
    private renderOnSeek!: boolean;
    private renderFrameFormat!: "jpg" | "png";
    private renderFrameQuality!: number;
    private concurrency = 1;
    private headless = false;
    private fromFrame: number;
    private toFrame: number;
    private browserType: "firefox" | "chrome" = "firefox";
    private workdir: string;
    private outputVideoPath: string;
    private browserArgs: string[] = [];
    private framesFrom: "base64" | "screenshot" = "base64";

    constructor(data: any) {
        const shape = SceneShape.safeParse(data.scene);
        if (!shape.success) {
            console.log("error checking scene", "shape.error", data.scene);
            throw new Error("error checking scene");
        }

        this.scene = shape.data as SceneDataJson;
        this.subtitles = data.subtitles || {};
        this.fonts = data.fonts || [];

        this.renderMode = data.renderMode || "server";
        this.debug = data.debug || false;
        this.renderOnSeek = data.renderOnSeek || true;
        this.renderFrameFormat = data.renderFrameFormat || "jpg";
        this.renderFrameQuality = data.renderFrameQuality || 0.8;
        this.concurrency = data.concurrency || 1;
        this.browserType = data.browserType || "firefox";
        this.headless = data.headless || false;
        this.browserArgs = data.browserArgs || [];
        const extension = this.renderFrameFormat === "png" ? "mkv" : "mp4";
        this.outputVideoPath =
            data.outputVideoPath || `output_${Date.now()}.${extension}`;
        this.framesFrom = data.framesFrom || "base64";
        const WORKDIR = process.env.RESOURCES_DIR + `/render/${this.scene.id}`;
        if (!fs.existsSync(WORKDIR)) {
            fs.mkdirSync(WORKDIR, { recursive: true });
        }
        if (!fs.existsSync(WORKDIR + "/tmp")) {
            fs.mkdirSync(WORKDIR + "/tmp", { recursive: true });
        }
        this.workdir = WORKDIR;

        this.fromFrame = data.fromFrame || 1;
        this.toFrame =
            data.toFrame || Math.round(this.scene.duration * this.scene.fps);
    }

    setConcurrency(concurrency: number) {
        this.concurrency = concurrency;
    }

    private createReadableStream(frames: Buffer[]): Readable {
        return new Readable({
            read() {
                const frame = frames.shift();
                this.push(frame || null);
            },
        });
    }

    async startBrowser(headless: boolean = false) {
        if (this.browser) {
            return;
        }
        const type = this.browserType;

        // args: [
        //     "-no-remote",
        //     "-foreground",
        //     "-width " + this.scene.width,
        //     "-height " + this.scene.height,
        //     // "-profile /tmp/firefox_profile",
        //     "-purgecaches",
        //     "-MOZ_WEBRENDER=1",
        //     "-MOZ_ACCELERATED=1",
        // ],

        const browser: Browser =
            type == "firefox"
                ? await firefox.launch({
                      headless: this.headless,
                      //   firefoxUserPrefs: {
                      //       "security.fileuri.strict_origin_policy": false,
                      //       "webgl.force-enabled": true,
                      //       "layers.acceleration.force-enabled": true,
                      //       "gfx.webrender.all": true,
                      //       "gfx.webrender.enabled": true,
                      //       "gfx.canvas.azure.accelerated": true,
                      //       "media.hardware-video-decoding.force-enabled": true,
                      //   },
                  })
                : await chromium.launch({
                      channel: type,
                      headless: this.headless,
                      args: this.browserArgs || [],
                  });
        this.browser = browser;
    }

    async renderChunk(from_frame: number, to_frame: number) {
        const page = await this.browser.newPage();

        const frames: Buffer[] = [];

        // how to listen to page console.logs
        const debug = this.debug;
        const scene = this.scene;
        const fps = scene.fps;
        const fonts = this.fonts;
        const subtitles = this.subtitles;
        const width = scene.width;
        const height = scene.height;

        // Set up console log listener
        if (debug) {
            page.on("console", (msg) => {
                const type = msg.type().substr(0, 3).toUpperCase();
                const text = msg.text();
                console.log(`[PAGE ${type}] ${text}`);
            });

            // Optionally, you can also listen for errors and warnings specifically
            page.on("pageerror", (err) => {
                console.error(`[PAGE ERROR] ${err.message}`);
            });

            console.log("Loading scene...");
        }

        await page.goto(
            "https://content.renderfries.com/public/app/scene-pixi.html"
        );

        // create test canvas with webgl to test if webgl is working

        await page.evaluate(
            ({ width, height }) => {
                const canvas = document.createElement("div");
                canvas.id = "cf-canvas";
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
                document.body.appendChild(canvas);
            },
            { width, height }
        );

        console.log("Container ready");

        const browserData = {
            scene: scene,
            fps: fps,
            fonts: fonts,
            subtitles: subtitles,
            renderMode: this.renderMode,
            debug: this.debug,
            renderOnSeek:
                this.framesFrom === "screenshot" ? false : this.renderOnSeek,
            renderFrameFormat: this.renderFrameFormat,
            renderFrameQuality: this.renderFrameQuality,
        };

        const result = await page.evaluate((data) => {
            try {
                (window as any).SCENE = data.scene;
                (window as any).FPS = data.fps;
                (window as any).FONTS = data.fonts;
                (window as any).SUBTITLES = data.subtitles;
                (window as any).RENDER_MODE = data.renderMode;
                (window as any).DEBUG = data.debug;
                (window as any).RENDER_ON_SEEK = data.renderOnSeek;
                (window as any).RENDER_FRAME_FORMAT = data.renderFrameFormat;
                (window as any).RENDER_FRAME_QUALITY = data.renderFrameQuality;
                (window as any).loadScene();
                return {
                    success: true,
                    message: "Data added successfully",
                };
            } catch (error: any) {
                console.error("Error in loadScene:", error);
                return { success: false, error: error.toString() };
            }
        }, browserData);
        console.log("Evaluate result:", result);

        await page.waitForSelector("#cf-animation-loaded", {
            timeout: 50000,
            state: "attached",
        });

        let totalFrames: number = await page.evaluate(
            "window.getTotalFrames()"
        );
        if (!totalFrames) {
            totalFrames = Math.floor(scene.duration * fps);
        }
        const loadTime = Date.now();

        const toFrame = to_frame || totalFrames;

        console.log(`Rendering frames from ${from_frame} to ${toFrame}`);

        const extension = this.renderFrameFormat === "png" ? "mov" : "mp4";
        const chunkOutputPath = `${this.workdir}/chunk_${from_frame}_${to_frame}.${extension}`;

        return new Promise<string>((resolve, reject) => {
            const ffmpegArgs = [
                "-f",
                "image2pipe",
                "-framerate",
                this.scene.fps.toString(),
                "-i",
                "-",
                "-c:v",
                this.renderFrameFormat === "png" ? "png" : "libx264",
            ];

            if (this.renderFrameFormat === "png") {
                // ffmpegArgs.push("-pix_fmt", "rgba");
            } else {
                ffmpegArgs.push("-pix_fmt", "yuv420p");
            }

            ffmpegArgs.push(chunkOutputPath);

            const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

            ffmpegProcess.stderr.on("data", (data: any) => {
                if (this.debug) {
                    console.error(`FFmpeg stderr: ${data}`);
                }
            });

            ffmpegProcess.on("close", (code: number) => {
                if (code === 0) {
                    resolve(chunkOutputPath);
                } else {
                    reject(
                        new Error(`FFmpeg process exited with code ${code}`)
                    );
                }
            });

            (async () => {
                try {
                    for (let i = from_frame; i <= to_frame; i++) {
                        const frameData = await page.evaluate(
                            `window.setFrame(${i})`
                        );

                        let buffer: Buffer;
                        if (this.framesFrom === "screenshot") {
                            buffer = await page.screenshot({
                                clip: {
                                    x: 0,
                                    y: 0,
                                    width: this.scene.width,
                                    height: this.scene.height,
                                },
                                type:
                                    this.renderFrameFormat === "jpg"
                                        ? "jpeg"
                                        : "png",
                                omitBackground:
                                    this.renderFrameFormat === "png",
                                quality:
                                    this.renderFrameFormat === "jpg"
                                        ? Math.round(
                                              this.renderFrameQuality * 100
                                          )
                                        : undefined,
                            });
                        } else if (frameData && this.framesFrom === "base64") {
                            buffer = Buffer.from(
                                (frameData as string).split(",")[1],
                                "base64"
                            );
                        } else {
                            if (this.debug) {
                                console.log(
                                    `Frame ${i} not captured, frameData empty`
                                );
                            }
                            continue;
                        }

                        ffmpegProcess.stdin.write(buffer);

                        if (this.debug) {
                            console.log(`Processed frame ${i}`);
                        }
                    }

                    ffmpegProcess.stdin.end();
                } catch (error) {
                    ffmpegProcess.kill();
                    reject(error);
                } finally {
                    await page.close();
                }
            })();
        });

        // for (let i = from_frame; i <= toFrame; i++) {
        //     const franeDataStart = Date.now();
        //     const frameData = await page.evaluate(`window.setFrame(${i})`);
        //     const franeDataTime = Date.now() - franeDataStart;
        //     if (debug) {
        //         console.log(`Frame data time test ${i}: ${franeDataTime}ms`);
        //     }

        //     if (this.framesFrom === "screenshot") {
        //         const buffer = await page.screenshot({
        //             clip: { x: 0, y: 0, width: width, height: height },
        //             type: this.renderFrameFormat === "jpg" ? "jpeg" : "png",
        //             quality:
        //                 this.renderFrameFormat === "jpg"
        //                     ? Math.round(this.renderFrameQuality * 100)
        //                     : 100,
        //         });
        //         frames.push(buffer);
        //     } else if (frameData && this.framesFrom === "base64") {
        //         const buffer = Buffer.from(
        //             (frameData as string).split(",")[1],
        //             "base64"
        //         );
        //         frames.push(buffer);
        //         // const WORKDIR =
        //         //     process.env.RESOURCES_DIR + `/render/${scene.id}`;

        //         // if (!fs.existsSync(WORKDIR)) {
        //         //     fs.mkdirSync(WORKDIR);
        //         // }
        //         // await sharp(
        //         //     Buffer.from((frameData as string).split(",")[1], "base64")
        //         // ).toFile(`${WORKDIR}/frame-${i}.` + this.renderFrameFormat);

        //         // if (debug) {
        //         //     console.log("saved as", `${WORKDIR}/frame-${i}.jpg`);
        //         // }
        //     } else {
        //         if (debug) {
        //             console.log(`Frame ${i} not captured, frameData empty`);
        //         }
        //     }

        //     // const screenshotStart = Date.now();
        //     // const screenshotBuffer = await page.screenshot({
        //     //     clip: { x: 0, y: 0, width: width, height: height },
        //     //     type: "png",
        //     //     // quality: 100,
        //     // });
        //     // const screenshotTime = Date.now() - screenshotStart;
        //     // console.log(
        //     //     `Screenshot time ${i} - screenshot: ${screenshotTime}ms`
        //     // );
        // }

        await page.close();

        // Render video chunk using fluent-ffmpeg
        // const chunkOutputPath = `${this.workdir}/chunk_${from_frame}_${to_frame}.mp4`;
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(this.createReadableStream(frames))
                .inputFormat("image2pipe")
                .inputFPS(this.scene.fps)
                .videoCodec("libx264")
                .outputOptions("-pix_fmt yuv420p")
                .output(chunkOutputPath)
                .on("end", () => resolve())
                .on("error", (err) => reject(err))
                .run();
        });

        return chunkOutputPath;
    }

    async render() {
        try {
            await this.startBrowser();

            const from_frame = this.fromFrame;
            const to_frame = this.toFrame;
            const total_frames = to_frame - from_frame + 1;

            let chunkPaths: string[] = [];
            let output = "";

            if (this.concurrency > 1 && total_frames > 30) {
                const min_frames_per_chunk = 30;
                const max_workers = Math.min(20, this.concurrency);
                const frames_per_worker = Math.max(
                    min_frames_per_chunk,
                    Math.ceil(total_frames / max_workers)
                );
                const chunks = [];

                for (
                    let start = from_frame;
                    start <= to_frame;
                    start += frames_per_worker
                ) {
                    const end = Math.min(
                        start + frames_per_worker - 1,
                        to_frame
                    );
                    chunks.push({ start, end });
                }

                chunkPaths = await Promise.all(
                    chunks.map((chunk) =>
                        this.renderChunk(chunk.start, chunk.end)
                    )
                );
                output = await this.mergeVideoChunks(chunkPaths);
                chunkPaths.forEach((path) => fs.unlinkSync(path));
            } else {
                const singleChunkPath = await this.renderChunk(
                    from_frame,
                    to_frame
                );

                fs.copyFileSync(
                    singleChunkPath,
                    this.workdir + "/" + this.outputVideoPath
                );
                fs.unlinkSync(singleChunkPath);
                output = this.workdir + "/" + this.outputVideoPath;
            }

            // Merge video chunks
            console.log("-- video rendered! --", output);

            // Clean up temporary chunk files

            return output;
        } catch (error: any) {
            console.error("Error starting browser:", error);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    private async mergeVideoChunks(chunkPaths: string[]): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const command = ffmpeg();

            const fileList = this.workdir + "/filelist.txt";
            fs.writeFileSync(
                fileList,
                chunkPaths.map((path) => `file '${path}'`).join("\n")
            );

            command
                .input(fileList)
                .inputOptions(["-f concat", "-safe 0"])
                .outputOptions(["-c copy", "-movflags +faststart"])
                .on("start", (cmd) => {
                    console.log("Starting video merge", cmd);
                })
                .on("error", (err) => {
                    console.error("Error merging video chunks:", err);
                    fs.unlinkSync(fileList);
                    reject(err);
                })
                .on("end", () => {
                    console.log("Video chunks merged successfully");
                    fs.unlinkSync(fileList);
                    resolve(this.workdir + "/" + this.outputVideoPath);
                })
                .save(this.workdir + "/" + this.outputVideoPath);
        });
    }
}

export default BrowserSceneRenderer;
