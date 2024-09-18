import Konva from "konva";
import { SceneLayerComponentData } from "@bladesk/cf-scene-builder";
import { handleExecutionAndGetResults } from "../utils/stepFunctions.js";

import { signS3CloudFront } from "../utils/signer.js";

// import type {
//     Config,
//     SceneLayer,
//     SceneLayerComponent,
// } from "@bladesk/cf-scene-builder";

// import {
//     builder as SceneBuilder,
//     Scene,
//     SceneLayerCanvasShape,
//     SceneLayerComponentVideo,
// } from "@bladesk/cf-scene-builder";

// import Konva from "konva";
// import ffmpeg from "fluent-ffmpeg";
// import fs from "fs";
// import { JSDOM } from "jsdom";
// import { loadImage, Canvas } from "skia-canvas";
// const { Readable } = require("stream");
// import path from "path";
// const ArrayStream = require("stream-array");

// const canvas = require("skia-canvas");
// canvas.gpu = false;

// const renderScene = async (sceneData: Partial<Scene>) => {
//     if (typeof document === "undefined") {
//         const dom = new JSDOM();
//         global.document = dom.window.document;
//     }

//     const builder = new SceneBuilder(sceneData, document);
//     const scene = builder.getScene();
//     scene.buildScene();

//     for (let i = 0; i < scene.getLayers().length; i++) {
//         const layer = scene.layers[i] as SceneLayer;
//         if (layer.engine == "CANVAS2D") {
//             await renderLayer(layer);
//         }
//     }
// };

// const renderLayer = async (layer: SceneLayer) => {
//     SceneLayerCanvasShape.parse(layer);

//     const assets: string[] = [];
//     for (let i = 0; i < layer.components.length; i++) {
//         const component = layer.components[i];
//         const asset = await renderComponent(component);
//         // assets.push(asset);
//     }

//     // merge assets
// };

// const extractFrames = async function (
//     url: string,
//     workdir: string,
//     ext: "png" | "jpg" = "jpg"
// ): Promise<string[]> {
//     return await new Promise((resolve, reject) => {
//         if (!fs.existsSync(workdir)) {
//             fs.mkdirSync(workdir, { recursive: true });
//         } else {
//             // check if workdir is empty
//             const files = fs.readdirSync(workdir);
//             if (files.length > 0) {
//                 if (workdir.startsWith("/tmp/") || workdir.startsWith("tmp/")) {
//                     // delete all files in workdir
//                     fs.rmdirSync(workdir, { recursive: true });
//                     if (!fs.existsSync(workdir)) {
//                         fs.mkdirSync(workdir, { recursive: true });
//                     }
//                 } else {
//                     reject("Workdir " + workdir + " is not empty");
//                     return;
//                 }
//             }
//         }

//         // let factory = ffmpeg(url).videoFilters([
//         //     { filter: "fps", options: `30` },
//         // ])
//         // .outputOptions("-vcodec", "png")
//         // ;
//         ffmpeg(url)
//             // .outputFormat("image2pipe")
//             // .outputOptions("-vcodec", "png")
//             .videoFilters([{ filter: "fps", options: `30` }])
//             .output(workdir + "/%d." + ext)
//             .outputOptions("-q:v 0")
//             .on("start", (command: string) =>
//                 console.log("Started processing video frames", command)
//             )
//             .on("codecData", (data) => console.log("Input codec data:", data))
//             .on("error", (err) => {
//                 console.error("Error processing video frames:", err);
//                 reject(err);
//             })
//             .on("end", () => {
//                 console.log("Finished processing video frames");

//                 let outputFiles: string[] = [];
//                 const files = fs.readdirSync(workdir);
//                 for (var i = 1; i <= files.length; i += 1) {
//                     outputFiles.push(path.join(workdir, i + "." + ext));
//                 }
//                 console.log("Total frames:", outputFiles.length);

//                 resolve(outputFiles);
//             })
//             .run();
//     });
// };

// const renderComponent = async (component: SceneLayerComponent) => {
//     if (component.type == "VIDEO") {
//         // if there is no rotation or filter, we can use ffmpeg to render the video
//         const video = SceneLayerComponentVideo.parse(component);

//         const url = video.element.path;

//         const attrs = video.element.attributes as Config;
//         const config = video.element.config;
//         const metadata = video.metadata.video;
//         const { fps, duration, width, height, has_audio } = metadata;
//         const durationSeconds = duration / 1000;

//         // Process video frames using fluent-ffmpeg
//         // renderVideoFrame(konvaImage, Buffer.from(""), 0);
//         const output = await new Promise(async (resolve, reject) => {
//             const workdir = "/tmp/" + component.asset_id;
//             const componentWorkdir = "/tmp/c-" + component.id;

//             const frames = await extractFrames(url, workdir);

//             const batchSize = 10; // Set batch size to 10 frames
//             const renderChunkSize = 600; // set video render chunk to contain 300 frames
//             let chunkFrames: Buffer[] = [];
//             const chunkFrameFiles: string[] = [];
//             let renderChunkKey = 0;

//             for (let i = 0; i < frames.length; i += batchSize) {
//                 const batchFrames = frames.slice(i, i + batchSize); // Get next batch of frames
//                 const renderPromises = batchFrames.map((frame, j) => {
//                     return renderVideoFrame(
//                         config,
//                         metadata,
//                         fs.readFileSync(frame),
//                         i + j,
//                         componentWorkdir
//                     );
//                 });
//                 const buffers = await Promise.all(renderPromises); // Wait for all frames in batch to be processed

//                 // TODO fix ordering
//                 chunkFrames = chunkFrames.concat(buffers); // Add batch frames to chunk frames
//                 if (chunkFrames.length >= renderChunkSize) {
//                     const chunkfile = await renderChunkFrames(
//                         chunkFrames,
//                         renderChunkKey,
//                         componentWorkdir
//                     );
//                     chunkFrameFiles.push(chunkfile);
//                     chunkFrames = [];
//                     renderChunkKey += 1;
//                 }
//             }

//             // render remaining frames
//             if (chunkFrames.length) {
//                 const chunkfile = await renderChunkFrames(
//                     chunkFrames,
//                     renderChunkKey,
//                     componentWorkdir
//                 );
//                 chunkFrameFiles.push(chunkfile);
//                 chunkFrames = [];
//                 renderChunkKey += 1;
//             }

//             const outputFile =
//                 componentWorkdir + "/component-" + component.id + ".mkv";
//             const result = await concatenateVideos(chunkFrameFiles, outputFile);
//             resolve(result);
//         });

//         return output;
//     }

//     throw new Error("Not implemented");
// };

// const concatenateVideos = async (inputFiles: string[], output: string) => {
//     const mylistContent = inputFiles
//         .map((filePath) => `file '${filePath}'`)
//         .join("\n");

//     fs.writeFileSync(output + "-concat.txt", mylistContent);

//     ffmpeg()
//         .input(output + "-concat.txt")
//         .inputOptions(["-f concat", "-safe 0"])
//         .outputOptions("-c copy")
//         .output(output)
//         .on("start", () => console.log("Started concatenating audio files"))
//         .on("error", (err) =>
//             console.error("Error concatenating audio files:", err)
//         )
//         .on("end", () => console.log("Finished concatenating audio files"))
//         .run();
// };

// const renderChunkFrames = async function (
//     buffers: Buffer[],
//     key: number,
//     workdir: string
// ): Promise<string> {
//     return new Promise(function (resolve, reject) {
//         // Set your desired output video format, framerate, and other options
//         const outputFormat = "mkv";
//         const framerate = "30";
//         const inputStream = ArrayStream(buffers);
//         const outFile = workdir + "/chunk-" + key + "." + outputFormat;

//         ffmpeg()
//             .input(inputStream)
//             // .inputFormat("image2pipe")
//             // .inputOptions(["-vcodec", "png", "-r", "30"])
//             .inputOptions(["-framerate", framerate])
//             // .format(outputFormat)
//             // .outputOptions([
//             //     "-c:v",
//             //     "libvpx-vp9",
//             //     "-pix_fmt",
//             //     "yuva420p",
//             //     "-metadata:s:v:0",
//             //     "alpha_mode=1",
//             //     "-auto-alt-ref",
//             //     "0",
//             //     "-r",
//             //     framerate, // Set the output video framerate
//             // ])
//             // .output(workdir + "/chunk-" + key + ".webm")
//             // .outputOptions(["-c:v png", "-pix_fmt rgba", "-r", framerate]) // Set the output video framerate
//             // .output(workdir + "/chunk-" + key + "." + outputFormat)
//             // .videoFilters([{ filter: "fps", options: `30` }])
//             .outputOptions(["-c:v copy"]) // Set the output video framerate
//             .output(outFile)
//             .on("start", () => console.log("Started processing video"))
//             .on("error", (err) => console.error("Error processing video:", err))
//             .on("end", () => resolve(outFile))
//             .run();
//     });
// };

// const renderVideoFrame = async function (
//     config: any,
//     metadata: any,
//     buffer: Buffer,
//     frame: number,
//     workdir: string
// ): Promise<Buffer> {
//     if (!fs.existsSync(workdir)) {
//         fs.mkdirSync(workdir, { recursive: true });
//     }

//     let canvas = new Canvas(metadata.width, metadata.height),
//         ctx = canvas.getContext("2d");

//     const strength = frame % 100;
//     // ctx.filter = "blur(" + strength + "px)"; //  grayscale(" + strength + "%)

//     let img = await loadImage(buffer);
//     ctx.drawImage(img, 0, 0, metadata.width, metadata.height);

//     // @ts-ignore
//     const stage = new Konva.Stage({
//         width: 1080,
//         height: 1080,
//         listening: false,
//     });

//     const konvalayer = new Konva.Layer();
//     stage.add(konvalayer);

//     // konvalayer.getContext()._context.filter =
//     //     "blur(" + strength + "px) grayscale(" + strength + "%)";

//     const image = new Konva.Image({
//         ...(config as unknown as Konva.ImageConfig),
//     });
//     // @ts-ignore
//     image.image(canvas);

//     konvalayer.add(image);
//     konvalayer.batchDraw();

//     // konva image component
//     // image.rotate(frame * 2);

//     const imgCanvas = stage.toCanvas();
//     // @ts-ignore
//     // await imgCanvas.saveAs(localfile); // save as PNG

//     // @ts-ignore
//     const outputBuffer = await imgCanvas.toBuffer("png");
//     if (frame % 150 == 0) {
//         console.log("Processed frame", frame, image.x(), image.y());
//     }

//     // avoid memory leaks by building and destroying a new stage for each frame
//     stage.destroy();
//     return outputBuffer;
// };

// export const CanvasRenderer = {
//     renderScene,
//     renderLayer,
//     renderComponent,
// };

export const renderStaticLayer = async function (
    layer: Konva.Layer,
    sceneWidth: number,
    sceneHeight: number,
    component: SceneLayerComponentData,
    execName: string,
    job?: any
) {
    const calls = [];
    const renderData = {
        function: "renderLayer",
        layer: JSON.parse(layer.toJSON()),
        sceneProps: {
            width: sceneWidth,
            height: sceneHeight,
        },
        component,
    };

    calls.push(renderData);

    const input = {
        calls,
    };

    const results = await handleExecutionAndGetResults(
        input,
        execName,
        process.env.STATE_MACHINE_RENDER_CANVAS as string,
        process.env.EXEC_RENDER_CANVAS as string,
        job
    );

    console.log("Render static layer " + execName + " finished!");

    let locs: string[] = [];
    for (let i = 0; i < results?.data.length; i += 1) {
        const result = results?.data[i];
        if (result.statusCode == 200) {
            const locsLoop = result.body.locations;
            locs = locs.concat(locsLoop);
        } else {
            console.log("Unexpected statusCode for result", result);
        }
    }

    if (locs.length) {
        return locs[0];
    }
    return null;
};
