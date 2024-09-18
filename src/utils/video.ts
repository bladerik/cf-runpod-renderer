import path from "path";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import md5 from "md5";
import { createDirForFile } from "./file.js";
import fs from "fs";
import Combiner, { CombinerOptions } from "../renderer/combiner.js";
import { InputType } from "../types.js";
import { FilterSpecification } from "fluent-ffmpeg";

export const trimFromToDuration = async function (
    input: string,
    from: number,
    duration: number,
    output: string
) {
    if (fs.existsSync(output)) {
        return output;
    }
    const builder = ffmpeg()
        .input(input)
        .inputOptions(["-ss " + from.toFixed(3)])
        .outputOptions([
            "-t " + duration.toFixed(3),
            "-crf 16",
            "-preset veryfast",
            "-r 30",
        ]);

    // TODO what if input is shorter than duration?
    return await runToOutput(builder, output);
};

export const trimByTimes = async function (
    input: string,
    start_at: number,
    end_at: number,
    output: string
) {
    if (fs.existsSync(output)) {
        return output;
    }

    const duration = end_at - start_at;
    const builder = ffmpeg()
        .input(input)
        .inputOptions(["-ss " + start_at.toFixed(3)])
        .outputOptions([
            "-t " + duration.toFixed(3),
            "-crf 16",
            "-preset veryfast",
        ]);

    // TODO what if input is shorter than duration?
    return await runToOutput(builder, output);
};

export const trimToDuration = async function (
    input: string,
    duration: number,
    output: string,
    transparent = false,
    fps = 30
) {
    const builder = ffmpeg()
        .input(input)
        .outputOption("-t " + duration.toFixed(3));
    if (transparent) {
        builder.outputOption("-c:v png");
    }
    builder.outputOption("-r " + fps);

    // TODO what if input is shorter than duration?
    return await runToOutput(builder, output);
};

export const blurVideo = async function (
    input: string,
    output: string,
    downscale: number | null = 640
) {
    if (fs.existsSync(output)) {
        return output;
    }
    const scaleFilter = downscale ? `scale=${downscale}:-2,` : ""; // make sure to make the height divisible by 2
    const builder = ffmpeg(input).outputOption(
        "-vf " + scaleFilter + "boxblur=10:10"
    );
    // gblur=sigma=20

    // const filter: FilterSpecification[] = [];
    // filter.push({
    //     filter: "boxblur",
    //     options: "10:10",
    //     inputs: blurInput,
    //     outputs: finalInputId,
    // });
    // builder.complexFilter()
    return await runToOutput(builder, output);
};

async function getMediaFileMetadata(filePath: string): Promise<
    ffmpeg.FfprobeData & {
        durationInSeconds: number | undefined;
        width: number | undefined;
        height: number | undefined;
    }
> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const { streams } = metadata;
            const videoStream = streams.find(
                (stream) => stream.codec_type === "video"
            );

            let width = undefined;
            let height = undefined;

            if (videoStream) {
                width = videoStream.width;
                height = videoStream.height;
            }

            const durationInSeconds = metadata.format.duration;
            resolve({
                ...metadata,
                durationInSeconds,
                width,
                height,
            });
        });
    });
}

export const changeLength = async function (
    input: string,
    outputLength: number,
    output: string,
    fpsOutput?: number
): Promise<string> {
    if (fs.existsSync(output)) {
        return output;
    }

    const info = await getMediaFileMetadata(input);
    const inputLength = info.durationInSeconds;
    if (!inputLength) {
        throw new Error("Input video has no duration");
    }
    const slowdown = outputLength / inputLength;
    if (inputLength == outputLength) {
        fs.copyFileSync(input, output);
        return output;
    }

    let ffmpegBuilder = ffmpeg(input);
    // https://superuser.com/questions/1429256/producing-lossless-video-from-set-of-png-images-using-ffmpeg

    let outputOptions = ["-preset veryfast", "-b:a 320k"];

    // fps = (fps / slowdownRate).toFixed(3)
    ffmpegBuilder.videoFilters("setpts=" + slowdown.toFixed(5) + "*PTS");
    outputOptions.push("-vcodec png");

    ffmpegBuilder.withFpsOutput(fpsOutput ?? 30).outputOptions(outputOptions);
    // https://stackoverflow.com/questions/10225403/how-can-i-extract-a-good-quality-jpeg-image-from-an-h264-video-file-with-ffmpeg

    console.log("-- changing video length --", input);
    await runToOutput(ffmpegBuilder, output);
    return output;
};

export const runToOutput = async function (
    builder: ffmpeg.FfmpegCommand,
    outputPath: string,
    withEvents = true
): Promise<string> {
    builder.output(outputPath);

    return new Promise(function (res, rej) {
        if (withEvents) {
            builder
                .on("start", function (commandLine) {
                    console.log("Spawned Ffmpeg with command: " + commandLine);
                })
                .on("error", function (err) {
                    console.log("An error occurred: " + err.message);
                    rej(err);
                })
                .on("progress", async function (progress) {
                    console.log("... frames: " + progress.frames);
                })
                .on("end", async function () {
                    console.log("render finished", outputPath);
                    res(outputPath);
                });
        }
        builder.run();
    });
};

export const concatSubtitlesWithBackground = async function (
    subtitlesInput: InputType,
    bgInput: InputType,
    options: CombinerOptions
): Promise<string> {
    // TODO - instead of rendering locally, render in chunks on lambda
    const outputPath = options.output;
    const checksum = options.id;
    if (fs.existsSync(outputPath)) {
        return outputPath;
    }

    const renderer = new Combiner({
        ...options,
        id: checksum,
        output: outputPath,
    });

    renderer.addInput(bgInput);
    renderer.addInput(subtitlesInput);

    console.log("Subtitles render initiated");
    const output = (await renderer.render(true)) as string;
    return output;
};

export const concatSubtitlesToVideo = async function (
    paths: string[],
    parts: any[],
    options: CombinerOptions,
    bgLocalpath?: string
): Promise<string> {
    // TODO - instead of rendering locally, render in chunks on lambda
    const outputPath = options.output;
    const checksum = options.id;
    if (fs.existsSync(outputPath)) {
        return outputPath;
    }

    const renderer = new Combiner({
        ...options,
        id: checksum,
        output: outputPath,
    });

    if (bgLocalpath) {
        renderer.setBackground(bgLocalpath);
    }

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const path = paths[i];

        renderer.addInput({
            order: i,
            path,
            startAt: part.start,
            endAt: part.end,
            // x: component.element.config.x, // do not set these values, they are set in the renderer
            // y: component.element.config.y,
        });
    }

    console.log("Subtitles render initiated");
    const output = (await renderer.render(true)) as string;
    return output;
};

export const concatFilesToVideo = async function (
    paths: string[],
    outputPath: string,
    codec?: string
): Promise<string> {
    createDirForFile(outputPath);
    const checksum = md5(paths.join("|"));
    const workdir = path.dirname(outputPath);
    const txtPath = path.join(workdir, checksum + ".txt");
    fs.writeFileSync(txtPath, paths.join("\n"));

    const builder = ffmpeg()
        .input(txtPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOption(codec ? "-c:v " + codec : "-c copy");

    return await runToOutput(builder, outputPath);
};

export const concatFilesToAudio = async function (
    paths: string[],
    outputPath: string,
    codec?: string
): Promise<string> {
    createDirForFile(outputPath);
    const checksum = md5(paths.join("|"));
    const workdir = path.dirname(outputPath);
    const txtPath = path.join(workdir, checksum + ".txt");
    fs.writeFileSync(txtPath, paths.join("\n"));

    const builder = ffmpeg()
        .input(txtPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOption(codec ? "-c:a " + codec : "-c copy");

    return await runToOutput(builder, outputPath);
};

export const imageToVideo = async function (
    imagePath: string,
    duration: number,
    fps = 30,
    transparent = false,
    output?: string
): Promise<string> {
    // https://stackoverflow.com/questions/25891342/creating-a-video-from-a-single-image-for-a-specific-duration-in-ffmpeg
    // ffmpeg -loop 1 -i image.png -t 15 ?-pix_fmt yuv420p? out.mp4

    let dir = path.dirname(imagePath);
    let name = path.basename(imagePath).split(".")[0];
    let outputPath = output ? output : `${dir}/video-${name}.mkv`;

    const builder = ffmpeg(imagePath)
        .inputOption(
            imagePath.toLowerCase().endsWith("mkv")
                ? "-stream_loop 1"
                : "-loop 1"
        )
        .outputOption("-t " + duration.toFixed(3))
        .outputOption("-r " + fps);

    if (transparent) {
        builder.outputOption("-c:v png");
    }
    // .outputOption('-c:v png') // preserve alpha channel support // , '-pix_fmt rgba'

    return await runToOutput(builder, outputPath);
};

export const hasAudio = async function (path: string) {
    try {
        const metadata = await getVideoMetadata(path);
        return !!metadata.streams.find((s) => s.codec_type === "audio");
    } catch (err) {
        console.error(err);
        return false;
    }
};

export const getVideoMetadata = async function (
    path: string
): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(path, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
        });
    });
};

export const getMediaInfo = async function (path: string) {
    const metadata = await getVideoMetadata(path);
    const videoStream = metadata.streams.find((s) => s.codec_type === "video");
    const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
    const appendInfo = videoStream
        ? {
              width: videoStream.width,
              height: videoStream.height,
              fps: videoStream.r_frame_rate,
          }
        : {};
    return {
        duration: metadata.format.duration,
        hasAudio: !!audioStream,
        ...appendInfo,
    };
};
