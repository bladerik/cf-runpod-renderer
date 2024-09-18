import sharp from "sharp";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { FilterSpecification } from "fluent-ffmpeg";
import { imageToVideo } from "../utils/video.js";
import { isOk } from "../utils/file.js";
import { InputType } from "../types.js";
import { EventEmitter } from "events";
import md5 from "md5";
import { concatFilesToAudio } from "../utils/video.js";

// s combinerom mozeme mergovat aj transition in + static + transition out

// ffmpeg
//  -i /usr/src/app/resources/99546-252224/video-21s-background.mp4
//  -i /usr/src/app/resources/99546-252224/0.png
//  -i /usr/src/app/resources/99546/user_video-dd9d1b01df9ef38143cd48a149db581b.mp4
//  -i /usr/src/app/resources/99546-252224/2.png
//  -i /usr/src/app/resources/99546-252224/transition-in-3-935x624.mkv
//  -i /usr/src/app/resources/99546-252224/3-935x624.png
//  -i /usr/src/app/resources/99546-252224/transition-out-3-935x624.mkv

//  -i /usr/src/app/resources/99546/user_video-dd9d1b01df9ef38143cd48a149db581b.mp4 // TOTO UZ JE AUDIO
//  -y
//  -filter_complex
//  [1:v]setpts=PTS+0/TB[1v];
//  [0][1v]overlay=x=0:y=0:enable='between(t,0,20.339)'[v1];
//  [2:v]setpts=PTS+0/TB[2v];
//  [v1][2v]overlay=x=0:y=236:enable='between(t,0,20.339)'[v2];
//  [3:v]setpts=PTS+0/TB[3v];
//  [v2][3v]overlay=x=0:y=0:enable='between(t,0,20.34)'[v3];
//  [4:v]setpts=PTS+8.036/TB[4v];
//  [v3][4v]overlay=x=73:y=456:enable='between(t,8.036,9.036)'[v4];
//  [5:v]setpts=PTS+9.036/TB[5v];
//  [v4][5v]overlay=x=73:y=456:enable='between(t,9.036,13.09)'[v5];
//  [6:v]setpts=PTS+13.09/TB[6v];
//  [v5][6v]overlay=x=73:y=456:enable='between(t,13.09,14.09)'[v6];
//  [7:1]volume=1[a0];
//  [a0]amix=inputs=1:duration=longest
//  -preset veryfast
//  -map [v6]
//  -movflags faststart
//  -r 30000/1001
//  -t 20.339
//  -crf 23
//  -b:a 320k
//  /usr/src/app/render/99546-252224.mp4

// -filter_complex [1:v]setpts=PTS+8.692/TB[1v];[0][1v]overlay=x=0:y=0:enable='between(t,8.692,13.192)'[v1];[2:v]setpts=PTS+0/TB[2v];[1:v][2v]overlay=x=0:y=0:enable='between(t,0,8.5)'[v2];[3:v]setpts=PTS+14.955/TB[3v];[2:v][3v]overlay=x=63:y=703:enable='between(t,14.955,21.495)'[v3];[4:v]setpts=PTS+12.717/TB[4v];[3:v][4v]overlay=x=67:y=409:enable='between(t,12.717,19.937)'[v4];[5:v]setpts=PTS+0/TB[5v];[4:v][5v]overlay=x=0:y=0:enable='between(t,0,5)'[v5];[6:v]setpts=PTS+22.692/TB[6v];[5:v][6v]overlay=x=-79:y=193:enable='between(t,22.692,177.792)'[v6];[7:v]setpts=PTS+0/TB[7v];[6:v][7v]overlay=x=0:y=1:enable='between(t,0,155.1)'[v7];[8:v]setpts=PTS+0/TB[8v];[7:v][8v]overlay=x=-48:y=210:enable='between(t,0,20.32)'[v8];[9:v]setpts=PTS+0/TB[9v];[8:v][9v]overlay=x=1:y=270:enable='between(t,0,3.5)'[v9] -preset veryfast -map [v9] -movflags faststart -r 30 -t 30 -crf 23 -b:a 320k /Users/lukasgregor/www/js-packages/cf-scene-renderer/resources/render/cdaeb209985ff32d8a4fb92b2c8305ed/new-scene.mp4

// ffmpeg -stream_loop -1 -r 30
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/2024-05-02/66338be1deb1fefaa0081b62/video-background.mkv
// -i https://dyusyuyveprdn.cloudfront.net/serverless/progress-bar-frames/5641900b-2425-4674-bd78-8b015debef4c-1fc2c6df5a3147683469fd63ac409640/1.png?Expires=1714679568&Key-Pair-Id=K13ODRKCS399MY&Signature=ArVxowU~X4hyc0flByuYpRhOATXsMxacpjnz8mn9A4dssMZQRpWHWifypNrRGaU1JOlUxGztiB7m3FQOizr6uhBr50MTYgWeCE2n984wQjkb87yf8JPOYdV2O5m7yZefGpejZO4Lqer9Wi7JqXX09esKfHSnmYTqgiqTthda3Ctun~arFO~iLU0cPNpSA~hmPvr3PQgEQ-28m~RSZdaJHSvnwYuhKz90InBfzwRUAlLlq~eUxGrnlsNMZbE2jBTCRnyapWp7yuwk8weDCraAUlLfwf~TzcNbNm~v8JjCv8XBEVyJXrh3BNHoUg23J8BjBYJ2cXg0K9aJJaxY86TVRg__
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/video-asset-b09def0efb0936338eed9f18570f029a/b09def0efb0936338eed9f18570f029a.mp4
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/video-asset-6041a3d8e4f340dad54eeef55569e9c4/6041a3d8e4f340dad54eeef55569e9c4.mp4
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/video-asset-234349e0afebb846448a08b06f65a5fc/234349e0afebb846448a08b06f65a5fc.mp4
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/subtitles-asset-id-663387f73c22ff1358001822/subtitles-9a71392dfafba09df320fcc55fd177e8.mkv
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/text-asset-26d43523f99bbcba898933d44900c97c/26d43523f99bbcba898933d44900c97c.mkv
// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/632483cff682ebbf17031ac2/progress-bar-id-8edd0c9f-c02f-4742-aa81-afdf50fc3d30/progress-bar-17cc92f5d4e6b44974b665f2313e55a8.mp4-dur.mkv

// -i /Users/bladesk/Documents/www/cf-scene-renderer/resources/2024-05-02/66338be1deb1fefaa0081b62/ghii-28d7652c7cdffbe41d7624b8750c59df.flac
// -y -filter_complex [1:v]setpts=PTS+0/TB[fps1];[fps1]fps=fps=30[1v];[0][1v]overlay=x=0:y=0:enable='between(t,0,123.948)'[v1];[2:v]scale=w=1080:h=608[2:scaledv];[2:scaledv]setpts=PTS+0/TB[fps2];[fps2]fps=fps=30[2v];[v1][2v]overlay=x=0:y=236:enable='between(t,0,16.967)'[v2];[3:v]scale=w=1918:h=1080[3:scaledv];[3:scaledv]setpts=PTS+0/TB[fps3];[fps3]fps=fps=30[3v];[v2][3v]overlay=x=-813:y=-239:enable='between(t,16.967,43.167)'[v3];[4:v]scale=w=1080:h=608[4:scaledv];[4:scaledv]setpts=PTS+0/TB[fps4];[fps4]fps=fps=30[4v];[v3][4v]overlay=x=0:y=236:enable='between(t,43.167,123.948)'[v4];[5:v]setpts=PTS+0/TB[fps5];[fps5]fps=fps=30[5v];[v4][5v]overlay=x=0:y=0:enable='between(t,0,123.948)'[v5];[6:v]setpts=PTS+0/TB[fps6];[fps6]fps=fps=30[6v];[v5][6v]overlay=x=0:y=0:enable='between(t,0,123.948)'[v6];[7:v]setpts=PTS+0/TB[fps7];[fps7]fps=fps=30[7v];[v6][7v]overlay=x=0:y=0:enable='between(t,0,123.948)'[v7] -map [v7] -r 30 -t 123.948 -b:a 320k -map 8:a -movflags faststart -crf 17 -preset veryfast /Users/bladesk/Documents/www/cf-scene-renderer/resources/render/87a963279c039df5e6fc9631f9fd8eb8/fb-square-video.mp4

export type CombinerOptions = {
    id: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    output: string;
    crf?: number;
    trimms?: { start: number; end: number }[];
};

class Combiner extends EventEmitter {
    id: string;
    inputs: InputType[] = [];
    width: number;
    height: number;
    fps: number;
    duration: number;
    output: string;
    background: string | null = null;
    workDir: string;
    crf: number = 23;
    trimms: { start: number; end: number }[];

    constructor(options: CombinerOptions) {
        super();
        this.id = options.id;
        this.width = options.width;
        this.height = options.height;
        this.fps = options.fps;
        this.duration = options.duration;
        this.output = options.output;
        this.crf = options.crf || 17;
        this.trimms = options.trimms || [];

        // today date in yyyy-mm-dd
        const date = new Date().toISOString().split("T")[0];

        this.workDir = process.env.RESOURCES_DIR + `/${date}/${this.id}`;
        if (!fs.existsSync(this.workDir)) {
            fs.mkdirSync(this.workDir, { recursive: true });
        }
    }

    setBackground(bg: string) {
        this.background = bg;
        // TODO background width and height should be the same as combiner width and height
    }

    addInput(input: InputType) {
        this.inputs.push(input);
        return this;
    }

    addImage() {}

    addVideo() {}

    addAudio() {}

    async _prepareBackground(
        transparent = false,
        color = { r: 255, g: 255, b: 255, alpha: 1 }
    ) {
        // create white background image with sharp
        // save it to tmp folder
        // set background path

        if (!this.background) {
            const bgPath = this.workDir + "/background.png";
            await sharp({
                create: {
                    width: this.width,
                    height: this.height,
                    channels: transparent ? 4 : 3,
                    background: color,
                },
            })
                .png()
                .toFile(bgPath);

            const bgVideoPath = await imageToVideo(
                bgPath,
                5,
                this.fps,
                transparent
            ); // only 5 seconds and loop it
            this.background = bgVideoPath;

            console.log("Background prepared", this.background);
        }
    }

    _makePtsFilter(streamInputId: string, streamOutputId: string, startAt = 0) {
        return {
            filter: "setpts",
            options: `PTS+${startAt}/TB`,
            inputs: streamInputId,
            outputs: streamOutputId,
        };
    }
    _makeOverlayFilter(
        previousStreamInputId: string,
        streamOutputId: string,
        overlayOutputId: string,
        between: string,
        x = 0,
        y = 0
    ) {
        return {
            filter: "overlay",
            options: { x, y, enable: between },
            inputs: [previousStreamInputId, streamOutputId],
            outputs: overlayOutputId,
        };
    }

    _prepareFilter(inputs: InputType[]) {
        const filter: FilterSpecification[] = [];

        if (!this.background) {
            throw new Error("Background is not set");
        }

        // pozadie nevytvara ziadny filter lebo vsetko overlayujeme na nho

        //  [1:v]setpts=PTS+0/TB[1v];
        //  [0][1v]overlay=x=0:y=0:enable='between(t,0,20.339)'[v1];

        let previousStreamInputId = "0";

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const width = input.width
                ? input.width % 2 == 0
                    ? input.width
                    : input.width + 1
                : null;
            const height = input.height
                ? input.height % 2 == 0
                    ? input.height
                    : input.height + 1
                : null;

            const blur = input.blur || false;

            const streamId = i + 1;

            const streamInputId = `${streamId}:v`;
            const streamOutputId = `${streamId}v`;
            const finalInputId =
                width && height ? `${streamId}:scaledv` : streamInputId;
            const blurInput = `blurinput${streamId}`;
            const fpsOutputId = `fps${streamId}`;

            const overlayOutputId = `v${streamId}`;

            const startAt = inputs[i].startAt || 0;
            const endAt = inputs[i].endAt || this.duration;
            const between = "between(t," + startAt + "," + endAt + ")";
            const x = inputs[i].x || 0;
            const y = inputs[i].y || 0;
            const isImage =
                inputs[i].path.endsWith(".png") ||
                inputs[i].path.endsWith(".jpg");

            // THIS for test only
            // if (endAt > this.duration) {
            //     this.duration = endAt;
            // }

            if (width && height) {
                filter.push({
                    filter: "scale",
                    options: {
                        w: width,
                        h: height, // make sure it is divisible by 2
                    },
                    inputs: streamInputId,
                    outputs: blur ? blurInput : finalInputId,
                });
            }

            if (blur) {
                filter.push({
                    filter: "boxblur",
                    options: "10:10",
                    inputs: blurInput,
                    outputs: finalInputId,
                });
            }

            if (!isImage) {
                const startOffset = inputs[i].startOffset || 0;

                let startAt = inputs[i].startAt || 0;
                startAt -= startOffset;
                startAt = startAt < 0 ? 0 : startAt;

                filter.push(
                    this._makePtsFilter(
                        finalInputId,
                        fpsOutputId, //streamOutputId,
                        startAt
                    )
                );

                filter.push({
                    filter: "fps",
                    options: {
                        fps: this.fps || 30,
                    },
                    inputs: fpsOutputId,
                    outputs: streamOutputId,
                });
            }

            filter.push(
                this._makeOverlayFilter(
                    previousStreamInputId,
                    isImage ? finalInputId : streamOutputId,
                    overlayOutputId,
                    between,
                    x,
                    y
                )
            );

            previousStreamInputId = "v" + streamId;
        }

        // if the video has trimms, now we will include filters to trim the video
        if (this.trimms && this.trimms.length) {
            if (this.trimms.length > 1) {
                const outputs: string[] = [];
                this.trimms.forEach((trim, index) => {
                    outputs.push("trim" + index);
                });

                filter.push({
                    filter: "split",
                    options: this.trimms.length,
                    inputs: previousStreamInputId,
                    outputs: outputs,
                });

                const trimStreams: string[] = [];
                this.trimms.forEach((trim, index) => {
                    const trimInput = "trim" + index;
                    const trimOutput = "trim" + index + "output";
                    const trimStream = "trim" + index + "stream";
                    filter.push({
                        filter: "trim",
                        options: {
                            start: trim.start,
                            end: trim.end,
                        },
                        inputs: trimInput,
                        outputs: trimOutput,
                    });
                    filter.push({
                        filter: "setpts",
                        options: "PTS-STARTPTS",
                        inputs: trimOutput,
                        outputs: trimStream,
                    });

                    trimStreams.push(trimStream);
                });

                filter.push({
                    filter: "concat",
                    options: {
                        n: trimStreams.length,
                    },
                    inputs: trimStreams,
                    outputs: "outv",
                });
            } else {
                const trim = this.trimms[0];
                filter.push({
                    filter: "trim",
                    options: {
                        start: trim.start,
                        end: trim.end,
                    },
                    inputs: previousStreamInputId,
                    outputs: "trimmedstream",
                });
                filter.push({
                    filter: "setpts",
                    options: "PTS-STARTPTS",
                    inputs: "trimmedstream",
                    outputs: "outv",
                });
            }
        }

        // [v10]split=3[v11][v12][v13];[v11]trim=start=5:end=10,setpts=PTS-STARTPTS[v10a];[v12]trim=start=20:end=30,setpts=PTS-STARTPTS[v10b];[v13]trim=start=40:end=47.32,setpts=PTS-STARTPTS[v10c];[v10a][v10b][v10c]concat=n=3:v=1:a=0[outv]

        return filter;
    }

    _prepareAudioFilter = (inputs: InputType[]) => {
        const filter: FilterSpecification[] = [];
        let previousStreamInputId = "0";

        let totalAudioStreams = 0;
        let streamOutputId = `a${totalAudioStreams}`;
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (!input.addAudioStream) {
                continue;
            }

            streamOutputId = `a${totalAudioStreams}`;
            filter.push({
                filter: "volume",
                options: 1, // adjust volume here
                inputs: `${i + 1}:a`, // select audio stream from input, TODO - fix if there are more audio streams
                outputs: streamOutputId,
            });

            totalAudioStreams += 1;
        }

        if (totalAudioStreams) {
            filter.push({
                filter: "amix",
                options: {
                    inputs: totalAudioStreams,
                    duration: "longest",
                    normalize: false,
                },
                inputs: streamOutputId,
                outputs: "amixOutput",
            });
        }

        return filter;
    };

    async _prepareAudio(inputs: InputType[]) {
        const chunks: string[] = [];

        // ffmpeg -i input0.mp3 -i input1.mp3 -filter_complex amix=inputs=2:duration=longest output.mp3
        const factory = ffmpeg();
        for (let i = 0; i < inputs.length; i += 1) {
            const input = inputs[i];
            if (!input.addAudioStream) {
                continue;
            }

            const audioChunk = await this._prepareAudioChunk(
                input,
                "-chunk-" + i
            );
            chunks.push("file " + audioChunk);
            factory.input(audioChunk);
        }

        const trimmsChecksum =
            this.trimms && this.trimms.length
                ? md5(JSON.stringify(this.trimms))
                : "";
        const checksum = md5(chunks.join("|")) + "-trims-" + trimmsChecksum;
        const fileName = this.workDir + "/audio-" + checksum + ".flac";
        if (fs.existsSync(fileName)) {
            return fileName;
        }

        if (chunks.length) {
            factory.complexFilter([
                {
                    filter: "amix",
                    options: {
                        inputs: chunks.length,
                        duration: "longest",
                        normalize: false,
                    },
                },
            ]);

            // + "-trimmed.flac"
            const audioFilenameAppend =
                this.trimms && this.trimms.length ? "-preprocess.flac" : "";
            const audioPath = await new Promise<string>((resolve, reject) => {
                factory
                    .on("end", function () {
                        resolve(fileName + audioFilenameAppend);
                    })
                    .on("error", reject)
                    .on("start", (commandLine) => {
                        console.log(
                            "Spawned Ffmpeg _prepareAudio with command: " +
                                commandLine
                        );
                    })
                    .save(fileName + audioFilenameAppend);
            });

            if (audioPath) {
                if (this.trimms && this.trimms.length) {
                    const trimFactory = ffmpeg();
                    trimFactory.input(audioPath);

                    const filters: FilterSpecification[] = [];
                    this.trimms.forEach((trim, index) => {
                        filters.push({
                            filter: "atrim",
                            options: { start: trim.start, end: trim.end },
                            inputs: "0:a",
                            outputs: `trimmed${index}`,
                        });

                        filters.push({
                            filter: "asetpts",
                            options: "PTS-STARTPTS",
                            inputs: `trimmed${index}`,
                            outputs: `resetpts${index}`,
                        });
                    });

                    // Concatenate all trimmed segments
                    filters.push({
                        filter: "concat",
                        options: { n: this.trimms.length, v: 0, a: 1 },
                        inputs: this.trimms.map(
                            (_, index) => `resetpts${index}`
                        ),
                        outputs: "concatenated",
                    });

                    trimFactory.complexFilter(filters);
                    trimFactory.outputOption("-vn");
                    trimFactory.map("concatenated");

                    const trimmedOutput = await new Promise<string>(
                        (resolve, reject) => {
                            trimFactory
                                .on("end", function () {
                                    resolve(fileName);
                                })
                                .on("error", reject)
                                .on("start", (commandLine) => {
                                    console.log(
                                        "Spawned Ffmpeg _prepareAudio with command: " +
                                            commandLine
                                    );
                                })
                                .save(fileName);
                        }
                    );

                    return trimmedOutput;
                }
            }

            return audioPath;
            // return await concatFilesToAudio(chunks, fileName);
        }
        return null;
    }

    async _prepareSilence(
        duration: number,
        outputFile: string,
        channels: number = 1
    ): Promise<string | null> {
        if (!duration) return null;

        return new Promise<string>((resolve, reject) => {
            ffmpeg()
                .input("anullsrc=r=44100:cl=" + channels) // Generate silent audio input
                .inputOptions([
                    "-f lavfi", // Use libavfilter
                    "-t " + duration.toFixed(3), // Set the duration
                ])
                .outputOptions([
                    "-acodec flac", // Set the audio codec to FLAC
                ])
                .output(outputFile)
                .on("end", () => {
                    console.log("Silent FLAC file generated successfully.");
                    resolve(outputFile);
                })
                .on("error", (err) => {
                    console.error("Error generating silent FLAC file:", err);
                    reject(err);
                })
                .on("start", (commandLine) => {
                    console.log(
                        "Spawned Ffmpeg _prepareSilence with command: " +
                            commandLine
                    );
                    this.emit("start", commandLine);
                })
                .run();
        });
    }

    async _prepareAudioChunkPath(
        inputPath: string,
        outputPath: string,
        seekInput: number = 0,
        duration: number | undefined = undefined
    ) {
        const command = ffmpeg();
        command.input(inputPath);
        if (seekInput) {
            command.seekInput(seekInput);
        }

        if (duration) {
            command.duration(duration);
        }

        return new Promise<string>((resolve, reject) => {
            command
                .toFormat("flac")
                .outputOption("-vn") // skip video stream
                .on("end", function () {
                    resolve(outputPath);
                })
                .on("error", reject)
                .on("start", (commandLine) => {
                    console.log(
                        "Spawned Ffmpeg _prepareAudioChunkPath with command: " +
                            commandLine
                    );
                    this.emit("start", commandLine);
                })
                .save(outputPath);
        });
    }

    async _getAudioInfo(filePath: string): Promise<{ channels: number }> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    const channels = metadata.format.nb_streams
                        ? metadata.format.nb_streams > 0
                            ? metadata.streams[0].channels
                            : 2
                        : 2; // Default to stereo if channels info is missing
                    resolve({ channels: channels ? channels : 2 });
                }
            });
        });
    }

    async _prepareAudioChunk(input: InputType, chunk: string) {
        const maxDuration = this.duration;

        const startAt = input.startAt || 0; // where it starts in the final video
        const sourceStartAt = input.startOffset || 0; // where it starts in the resource
        const endAt = input.endAt || maxDuration;
        const duration = endAt
            ? parseFloat((endAt - startAt).toFixed(3))
            : undefined;
        const endSilenceDuration = maxDuration - endAt;

        let silenceStartPath: string | null = null;
        let silenceEndPath: string | null = null;
        const silenceFilePath = this.workDir + "/silence-" + chunk + ".flac";
        const silenceFilePath2 =
            this.workDir + "/silence-end-" + chunk + ".flac";
        const inputAudioInfo = await this._getAudioInfo(input.path);
        const inputChannels = inputAudioInfo.channels;

        silenceStartPath = await this._prepareSilence(
            startAt,
            silenceFilePath,
            inputChannels
        );
        silenceEndPath = await this._prepareSilence(
            endSilenceDuration,
            silenceFilePath2,
            inputChannels
        );

        const chunkFilePath = await this._prepareAudioChunkPath(
            input.path,
            this.workDir + "/audio-" + chunk + ".flac",
            sourceStartAt,
            duration
        );

        return new Promise<string>((resolve, reject) => {
            if (silenceStartPath || silenceEndPath) {
                const factory = ffmpeg();

                if (silenceStartPath) {
                    factory.input(silenceStartPath);
                }
                factory.input(chunkFilePath);
                if (silenceEndPath) {
                    factory.input(silenceEndPath);
                }

                let filterComplex = "[0:a][1:a]concat=n=2:v=0:a=1[out]";
                if (silenceStartPath && silenceEndPath) {
                    filterComplex = "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]";
                }

                factory
                    .outputOptions([
                        "-acodec flac",
                        "-vn",
                        "-filter_complex " + filterComplex,
                        "-map [out]",
                    ])
                    .output(this.workDir + "/merged-" + chunk + ".flac")
                    .on("start", (commandLine) => {
                        console.log(
                            "Spawned Ffmpeg _prepareAudioChunk with command: " +
                                commandLine
                        );
                        this.emit("start", commandLine);
                    })
                    .on("end", () => {
                        resolve(this.workDir + "/merged-" + chunk + ".flac");
                    })
                    .on("error", (err) => {
                        reject(err);
                    })
                    .run();
            } else {
                resolve(chunkFilePath);
            }
        });
    }

    async addInputPath(path: string) {
        const isLocal = fs.existsSync(path);
        if (isLocal) {
            const isFileOk = await isOk(path, true);
            console.log("isFileOk", isFileOk, path);
            if (!isFileOk) {
                fs.unlinkSync(path);
                return false;
            }
        }

        return true;
    }

    preprocessInput(input: InputType) {
        if (input.paths && input.paths.length) {
            const clones = input.paths.map((path, index) => {
                return {
                    ...input,
                    path: path,
                    order: input.order + index,
                };
            });
            return [...clones];
        } else {
            return [input];
        }
    }

    async render(transparent = false) {
        // flatten inputs to expanded inputs if there are paths with multiple files
        const expandedInputs = this.inputs.reduce(
            (acc: InputType[], input: InputType | InputType[]) => {
                if (input instanceof Array) {
                    for (let i = 0; i < input.length; i++) {
                        const data = this.preprocessInput(input[i]);
                        data.forEach((d) => {
                            acc.push(d);
                        });
                    }
                    return acc;
                } else {
                    return [...acc, ...this.preprocessInput(input)];
                }
            },
            []
        );

        // sort inputs by order
        const sortedInputs = expandedInputs.sort((a, b) => a.order - b.order);

        // add background as the first input
        await this._prepareBackground(
            transparent,
            transparent
                ? { r: 0, g: 0, b: 0, alpha: 0 }
                : { r: 255, g: 255, b: 255, alpha: 0 }
        );
        if (!this.background) {
            throw new Error("Background is not set #1");
        }

        const audio = await this._prepareAudio(sortedInputs);
        console.log("-- audio prepared", audio);

        const isBackgroundImage =
            this.background.toLowerCase().endsWith(".png") ||
            this.background.toLowerCase().endsWith(".jpg");
        const factory = ffmpeg(this.background)
            .inputOption(isBackgroundImage ? "-loop 1" : "-stream_loop -1")
            .inputFPS(this.fps);

        let hasCorrupted = false;
        for (const input of sortedInputs) {
            if (input.paths) {
                for (const path of input.paths) {
                    const status = await this.addInputPath(path);
                    if (!status) {
                        hasCorrupted = true;
                    } else {
                        factory.input(path);
                        if (input.inputOptions) {
                            factory.inputOptions(input.inputOptions);
                        }
                    }
                }
            } else {
                const status = await this.addInputPath(input.path);
                if (!status) {
                    hasCorrupted = true;
                } else {
                    factory.input(input.path);
                    // input options should follow after input to be assigned to the right input
                    if (input.inputOptions) {
                        factory.inputOptions(input.inputOptions);
                    }
                }
            }
        }

        if (hasCorrupted) {
            throw new Error("Has corrupted files");
        }

        const filter = this._prepareFilter(sortedInputs);
        console.log("-- last filter --");
        console.log(filter[filter.length - 1]);

        const lastFilterOutput = filter[filter.length - 1].outputs as string;
        // const audioFilter = this._prepareAudioFilter(sortedInputs);
        // const filters = filter.concat(audioFilter);

        factory.complexFilter(filter);
        if (audio) {
            factory.input(audio);
        }

        const outputOptions = [
            //"-map [v" + sortedInputs.length + "]",
            "-map [" + lastFilterOutput + "]",
            "-r " + this.fps,
            // this will prevent issues if there are no cuts so the video ends as expected
            "-t " + this.duration.toFixed(3),
        ];
        if (audio) {
            outputOptions.push("-b:a 320k");
            outputOptions.push("-map " + (sortedInputs.length + 1) + ":a");
        }
        if (!transparent) {
            outputOptions.push("-movflags faststart");
            outputOptions.push("-crf " + this.crf);
            outputOptions.push("-preset veryfast");
        } else {
            outputOptions.push("-c:v png");
        }

        factory.outputOptions(outputOptions);

        factory.output(this.output);
        factory.on("start", (commandLine) => {
            console.log("Spawned Ffmpeg with command: " + commandLine);
            this.emit("start", commandLine);
        });

        const totalFrames = Math.ceil(this.duration * this.fps);
        factory.on("progress", (progress) => {
            const totalProgress = Math.round(
                (progress.frames / totalFrames) * 100
            );
            console.log("... frames: " + progress.frames, totalProgress);
            this.emit("progress", { ...progress, percent: totalProgress });
        });

        return new Promise((resolve, reject) => {
            factory.on("error", (err, stdout, stderr) => {
                console.log("An error occurred: " + err.message);
                reject(err);
                // this.emit("error", err);
            });
            factory.on("end", (stdout, stderr) => {
                console.log("Transcoding succeeded !");
                resolve(this.output);
                this.emit("end", this.output);
            });
            factory.run();
        });
    }
}

export default Combiner;

// ffmpeg -i /Users/lukasgregor/www/js-packages/cf-scene-renderer/resources/2023-05-11/84ace199-51e7-464b-a8e4-b0964764583d/video-background.mkv -i https://dyusyuyveprdn.cloudfront.net/serverless/4f7c8c7dd41824bf207fd3c4697a590b/output.mkv?Expires=1683821236&Key-Pair-Id=K13ODRKCS399MY&Signature=XOljsfTMsgxAIuAP8gcycPShmAKuVmw4m~AAAtCT339Vz7kFX29k3kf~-IaxPxcWt6DLP5CvwouXX0V2y2WAl9bwpNqBohrES8zlKsW0JIfJTNXbBNpUy9iTDa7XzwUaSu43Mrd~j2XXxlzZG~t~dW0tiEw6zuDGBdQio2C-2X~15VjnRjzm3pWOEcxu4oDr46CCXQmu-YYyibU3T4IGzpTmblX2nlmLvndY~b-UGPs8zvhkyLRXmb6qqoeITDoBYQLKsVs~qNdrECeuNfSUwQ743DDUAPD8NvoHkrA2q7ziJ9s3CiCqhYQMJuGZBRnKBqFJGANv~5XxYnpZW8UxPg__ -i https://dyusyuyveprdn.cloudfront.net/serverless/23bdaa3135d132c24fcbc053fd6681b2/output.mkv?Expires=1683821236&Key-Pair-Id=K13ODRKCS399MY&Signature=VZ0v5JNIj4CRtiPN8L8VcTfe1h9TbeVowL6bOTz6CxhQFsk8uOPyD7iHSYjrsuPxg59sE0pzPm1Iwsd3RsY19sKB3kWAra~SProxjl9i~Eg1Y5~YKyRRUpUZDjomqKf-X7Wx4I2C4e5THq8CLdEH47F5ITYb1~lw~xn0Uq8idjdJ-g6aO4yx-TPMhZBkwnlYQU0lzFc0LcwJlSEy9jFItYqxsDr4vVRjDVJtqUG25eRO0uMTzkO69fcW0cp3ZE6ubP-EB6fv7rDLTfsKD38RjsYC9kIxtSGgbN8fd4mklSj4v-SlAx896SuS2~ScIMjGUpLqTtAoudfmkbOc~A~1NQ__ -i https://dyusyuyveprdn.cloudfront.net/serverless/fa7b66788beb438ad63d803a257a7f1a/output.mkv?Expires=1683821236&Key-Pair-Id=K13ODRKCS399MY&Signature=l4uZoTgF~AHi5dQ8A5YTI-WcHfhtFk3rd~QRKQmAd8lcIpQEgXfYE8PRJmKnNHitYpseNfKLQNlXa3b80oUrkl~OvYs8~X09sn3HHZYsrwmLCUzpWJhj3BZnuMVBx4WLEA5xBrfv~lioYtdRK-su5rg3XVcIoT7xKmNgHq1~Fy3biRWx~~ZVVaLSMUTGmpuzN6m6LTiDAK~uAdX8QTBtAz2nU0GTsBNbnyU5d8ygTgKgger2w5ra0YB0k~il62VE-2tDqMHBGX49jSUw13Jr7CIP7NZm-YYYew-8VHt0jC5tZaMtkbztH02ejkY-FtToPxQQhFkoQGVKVPTYdIx6DA__ -i https://dyusyuyveprdn.cloudfront.net/serverless/824e71fca7baee5b9a5f381907ff2b51/output.mkv?Expires=1683821236&Key-Pair-Id=K13ODRKCS399MY&Signature=opSRgY1TMCPXOXF2f6cdifVd495uhhKgMj80RLFeXCyTxTa4UfxORefrctJszg3I96hl1cmmZfje~tw7OCXX-Nzk7WK29tsWqXDMt6g3Bq539M9e4rTuq6cUr7FEJeHYAuJTgIj3Xxm1wXT8fPlvAYPta2uAkTQqnbQ~F~q~QMPsQSPOQNXLsfZJ7fPhGfW0fGGkNHUNDl0oYBDPO6~XSh7YNuCWm-Zw~bMjhw545ZPmk5QJYkMUw65au85dMI9vRk2A8s5XWhR1hODcvWZ84PELVrHMiboLR2RY5XLYL5mlgO3GmpDmTAavjUWuO2IsoZvZIso~~s8ziBBr39Au~Q__ -i https://dyusyuyveprdn.cloudfront.net/serverless/967ddda35308c9e814f2314a1da2ecab/output.mkv?Expires=1683821237&Key-Pair-Id=K13ODRKCS399MY&Signature=3eD5dwYbYDcbBCAkSJ16OZ32wuq9e9kDe28EFB9oEGmbodu27Pekd0DtfL0aBuVvM9rHj~7o325zYyPIixcMidzyZkBGrjw~vEWv3scmYvBx8ISvo9XUfYdVHumahct-4KTn9pH5Ga~ysThe4b0cLX1OX9IxLlxhQAfHXlrRPBvzQ-9CEnxrOlOdPtpmyo1zJDVMcn9Gi1EqK5UO2agQ-zo4Y3-rDGG0nBMCxuR-xoCN0JlDMsD72s4DtiNf5j2iEGsPmWiayPGBcpQ5-YjyRu7aD502RJW9FGURYTTFCO73qUw17vd63Ao1kV137qJ071~S46UnokeaztYZac35Jg__ -i https://cftb.renderfries.com/content/7f4brlqdb58/0-002-content-fridays-22-contentfries-will-do-all-this-mp4.mp4?token=-b_-n1HLzZfaC9oiu7yjl3mBKMznERfHqq_zM2ftldo&expires=1683802062 -i https://dyusyuyveprdn.cloudfront.net/serverless/99f0f45e2cc10988c500ebf8ab006903/output.mkv?Expires=1683821237&Key-Pair-Id=K13ODRKCS399MY&Signature=Vv8423Oljfx3xiBgVsNRM9UP8zkmAZ7TDHck9Q8HHkSg30bH0op4lDy4kMU2uofzfsswmOjbskbjkB1DX86uDExXTlTSpqw5BTV5aq8hAkv9bfWCGjWNvmL1BvYqNXwlAAtwIyHJDiGWDGA5AlQpcFy6tJOkqcoqMDAOJFd8LIfeP~GcRjjB-5Kh4x781YjhxEyCAbFJA4jh7btir2pc9-WXT7Bal7wNinNCewyh-qHN0XdFeG5c4pp2uHj7KYShyiBUoRqE6ZbwtmmJLIF75ldOfw9o8KSA0wPDWDUqCHNaVlfhater69IbLjWSu6vo8S1PrpZ9pFRQzzmW7XKwbw__ -i https://cftb.renderfries.com/content/bo6dj1872e/IMG_0549.MOV?token=8x14qTyh4_q4Z4kEOsZeWgg95s3GnYO6YteiuXzv-yM&expires=1683802068 -i https://dyusyuyveprdn.cloudfront.net/serverless/31ee59b08a196b5a59636d139bbd92fd/output.mkv?Expires=1683821238&Key-Pair-Id=K13ODRKCS399MY&Signature=m0lu2CIg9yU8OdWGUZ36QI-PNDA9pR0XhmqkXSWcUC0pTd4Q2eQ5QLb3VxcVuTAkbLy0EEkpROm~GBHtHzvaFbtcDPUg7MULLcbB78OqTIFFoqDwPZtVOkXTdn7rtSQRqeXC2QJSSBdUF2Cn-TO0upvpJtJi92PFZzaMgPXJTIsKK1yySu11n~On-NMaQvAF212OfijiR3L5YWz8MhqEJqjmvO8A-v88RQQ-V53hiSeZrx6M2dshSpKCLKctqvYU7nAGCD9syCZ8vhWzeGeAPTAKEua-vsR60wgf9Kv94G8d45wE3~xKXi2ZC-yz4iqODoJxQq~LAqvXxaufWmrXDg__ -y -filter_complex "[1:v]setpts=PTS+8.692/TB[1v];[0][1v]overlay=x=0:y=0:enable='between(t,8.692,13.192)'[v1];[2:v]setpts=PTS+0/TB[2v];[v1][2v]overlay=x=0:y=0:enable='between(t,0,8.5)'[v2];[3:v]setpts=PTS+14.955/TB[3v];[v2][3v]overlay=x=0:y=0:enable='between(t,14.955,21.495)'[v3];[4:v]setpts=PTS+12.717/TB[4v];[v3][4v]overlay=x=0:y=0:enable='between(t,12.717,19.937)'[v4];[5:v]setpts=PTS+0/TB[5v];[v4][5v]overlay=x=0:y=0:enable='between(t,0,5)'[v5];[6:v]setpts=PTS+22.692/TB[6v];[v5][6v]overlay=x=-79:y=193:enable='between(t,22.692,177.792)'[tempv6];[tempv6]scale=w=1238:h=696[v6];[7:v]setpts=PTS+0/TB[7v];[v6][7v]overlay=x=0:y=0:enable='between(t,0,155.1)'[v7];[8:v]setpts=PTS+0/TB[8v];[v7][8v]overlay=x=-48:y=210:enable='between(t,0,20.32)'[tempv8];[tempv8]scale=w=1176:h=662[v8];[9:v]setpts=PTS+0/TB[9v];[v8][9v]overlay=x=0:y=0:enable='between(t,0,3.5)'[v9]" -preset veryfast -map "[v9]" -movflags faststart -r 30 -t 30 -crf 23 -b:a 320k krpipki.mp4

// ffmpeg
// ffmpeg
// -i /Users/lukasgregor/www/js-packages/cf-scene-renderer/resources/2023-05-11/84ace199-51e7-464b-a8e4-b0964764583d/video-background.mkv
//  -i https://dyusyuyveprdn.cloudfront.net/serverless/4f7c8c7dd41824bf207fd3c4697a590b/output.mkv?Expires=1683814354&Key-Pair-Id=K13ODRKCS399MY&Signature=A-3PmpjcmxgFx-qCURZqZEsIAlGjOg1vOFxUqcCNcwHZDNq0olWMMi5W7e2DgdWVplLogHvSiFPo8fE-mDaqChMST5B334l3gRRwLM924IjOSFI4RtiV~an7M9Sb6IZwEou71FEJUzFgPcQHs8Wd8XNFA734WJhRt9iuHwmOgNKUo7dA66H1IYK1uKnrAP-kKEz2iaVNg92~x3NvBqb8izpljXMJW5URc9UaBjn5eCOk2WDWVEmU9wyaG8BWMHLtm1S6B-EgaOa-ee13yH0O94OZjI1scW8O1dR1spy6BwLuP72CDwW51yVeneHQsrG8HfBKWfv2nW-zGnHr5EeEwg__
//   -i https://dyusyuyveprdn.cloudfront.net/serverless/23bdaa3135d132c24fcbc053fd6681b2/output.mkv?Expires=1683814354&Key-Pair-Id=K13ODRKCS399MY&Signature=WgwPI6AWpAzaKhNWnenhokS7OoCKbS355NbKTASV8VsemTZzsKH0K01LX2gTa175q7-qQVjcSKjjfqTg6HCP-voqvQfX9RC~uVj~Geg3hpuXsUDfJ~B4lwIZRDxmebL0kfh~uEq5dCFvRgAVCuXAJjcCwEp6rYUkDvrqr2cmVu2DpaKIu0jhcpsXYToFexSzM~Tox9JjeqOkjJjApCDlA-rJVHnLWI8WN2lSTrX-xdBQqgm8WTxQnTOQ9hjSJUmo6R19yIIc8xe0~L6lIMSM2BGBm~V0MqWqjPaX0-JnpjDhWwO2BSqrA8w2V2S6J9sWZqqvov3P8lmNxfHt0xesfw__
//    -i https://dyusyuyveprdn.cloudfront.net/serverless/fa7b66788beb438ad63d803a257a7f1a/output.mkv?Expires=1683814355&Key-Pair-Id=K13ODRKCS399MY&Signature=UQPF0DrVdYUGQqxbv~SMogv3yn82R0uS6FRm3DmuvgMxtN4XrfX-svhUr2uoO8~BfQcO0bvk200Xrt27VZzHMYoLDgGZHdgLr45IIfHMqxBQDDeEX3E8iHO2V~YZnl5VDw8RXhimxanuGSecTdqCyS-LrI84OCaEEbMNvAMLFr8sVoESxt3sd9ybc~SB9xbonbr52xjolw9fNBwFbuEgiSFXiir0jyBXjR6htJ61IriSmH-tAPfUfcvgEgYqfMoJWtkIs59-AolKC0s~JUazeYmWqyN~hEM3ZGKh2yqw0jkwVWM7DtT8yrf-vxNB3uOo0TGwcXBdQ3GhroWuhaa1BQ__
//     -i https://dyusyuyveprdn.cloudfront.net/serverless/824e71fca7baee5b9a5f381907ff2b51/output.mkv?Expires=1683814355&Key-Pair-Id=K13ODRKCS399MY&Signature=mzjSUfV5MFw~BVapaGEp5syU~Jsbk9ijkNa9YuT4G5nDzxhyr9AgmzQSz9bef2vL6jUape8v1kjEDrl5EYHezPsjiFBLqmmPMuKH33aRUsjdr1qS2Ew2aceipQv1tlxzLseHwQC5vpgc~NJExgAL3YSuHpjoK9ZfDU8OcUZyj9nwzXWBQzMONRCoYGQeUwvR~lCaw1OkY~362zcdxrwiaB54Ezsq9O6Zcu6E1oGaRAJMThKeRmSgTMMKFeaVaLMxJZ-DMC4Jiqn3ZrQ~9v36PLhPp54lwoyq9M~I9OjZ4oUxoL4IJ~oXLZb1981y3HFU6w767xRK8l~uux6IwbKPDQ__
//      -i https://dyusyuyveprdn.cloudfront.net/serverless/967ddda35308c9e814f2314a1da2ecab/output.mkv?Expires=1683814355&Key-Pair-Id=K13ODRKCS399MY&Signature=BlDLe0sezhtii7jhJLw8dGZgIcIrhDFTtginY32uwgNeKUxmbSZn6lNX0Uq2mzBLEedH~djdUInZ3J8ScNlpZvt6MmLLedageoA6iWb5VUGx0mu4bWMrHg-KqVphPEqlUGT7lQbyMBVxBTQGDzvvkdAqznPFP9yns4XgbLTr2ecGw8uX-dU5dNljvwHkJqED869zEqvrjhStafPtYkhB2uVLew0-ltm1c408IsDTjXh7gTpaLRzWYgfHzJVBAY~027hiDQZRorHH5Yr~JecEhHc5CLs313qMkdw~EpzUXM978G9DltT~p1sAtY~wNp4xVP4lLHkucFSSNa1WnGh46Q__
//       -i https://cftb.renderfries.com/content/7f4brlqdb58/0-002-content-fridays-22-contentfries-will-do-all-this-mp4.mp4?token=YB6bBN4Nd9pZRrtr_Gu1fnTIMKK4cQc7AtyFR3gm5P8&expires=1683795386
//        -i https://dyusyuyveprdn.cloudfront.net/serverless/99f0f45e2cc10988c500ebf8ab006903/output.mkv?Expires=1683814355&Key-Pair-Id=K13ODRKCS399MY&Signature=7b0lvq-5T0GowHLjxdEiu0WCSqv9UVLpw8oHUiaosTVnaqFJeF7QKiqeybTAQCjVXD-ADaZv9pGxeSdyXrFje9FszZ~6QQcSYz3l9FiO5FelEOq9QAn5TS0Eo3kKNMEe2zEWv0PHMQsuNqHH8Av7H2sAqbv01oWDYUXjMNmSg7sfzH-QvZO~upfOkJ6BoYCkfHuSDwb9c4hdTfbV1unPPEe6DMngq75LUOjg6PgQuK2WwVS-DNnCkEu3JySzWOJ8wqyhCW89MUK~vKhwIpbQW~EzYe-C8vX6abbRbdwKTQVPMimZAxtqx1b~filSBh~tJRz~7doF9YWzYPF-s589Ww__
//         -i https://cftb.renderfries.com/content/bo6dj1872e/IMG_0549.MOV?token=dcGqOy1isnjAldPAtySzC22L0VGpQw2mpjKBwwhqnK0&expires=1683795396
//          -i https://dyusyuyveprdn.cloudfront.net/serverless/31ee59b08a196b5a59636d139bbd92fd/output.mkv?Expires=1683814355&Key-Pair-Id=K13ODRKCS399MY&Signature=hclWgXIJJ44lhOyQ2wXYRrnTTdsnRNEfSe6yQkoR~-eJheGl8rTMJncY-3tvNcNHGi15SJORBD46X2cHr0N1h6TpQ~0sRnjIcg3fAYhsi45JYt5ASeYUsMS0LCRfb0Pe0Kt3Ob6B0HB3mf~YkOa~RteejrMqHfVz-3K1LSZXv7AMazfPeCuYIOi45Z2RWS5tpBm0kXsuytrP2o0S49eDpGyRDYAzI9Ys9kcRnQaJKTpLzozlRkYD1ulG3zxq7GVI8iOb~mfUDf228WX0eldaNjH4X9OubB5Q2KCuxDE4TbyJirVRw95dfIeMh4wSi8jx-LhG~lyh-N9NMnf-EMUjxg__
//  -y -filter_complex

//  [1:v]setpts=PTS+0/TB[1v];
//  [0][1v]overlay=x=0:y=0:enable='between(t,0,20.339)'[v1];
//  [2:v]setpts=PTS+0/TB[2v];
//  [v1][2v]overlay=x=0:y=236:enable='between(t,0,20.339)'[v2];
//  [3:v]setpts=PTS+0/TB[3v];
//  [v2][3v]overlay=x=0:y=0:enable='between(t,0,20.34)'[v3];
//  [4:v]setpts=PTS+8.036/TB[4v];
//  [v3][4v]overlay=x=73:y=456:enable='between(t,8.036,9.036)'[v4];
//  [5:v]setpts=PTS+9.036/TB[5v];
//  [v4][5v]overlay=x=73:y=456:enable='between(t,9.036,13.09)'[v5];
//  [6:v]setpts=PTS+13.09/TB[6v];
//  [v5][6v]overlay=x=73:y=456:enable='between(t,13.09,14.09)'[v6];

//  [1:v]setpts=PTS+8.692/TB[1v];
//  [0][1v]overlay=x=0:y=0:enable='between(t,8.692,13.192)'[v1];
//  [2:v]setpts=PTS+0/TB[2v];
//  [1:v][2v]overlay=x=0:y=0:enable='between(t,0,8.5)'[v2];
//  [3:v]setpts=PTS+14.955/TB[3v];
//  [2:v][3v]overlay=x=63:y=703:enable='between(t,14.955,21.495)'[v3];
//  [4:v]setpts=PTS+12.717/TB[4v];
//  [3:v][4v]overlay=x=67:y=409:enable='between(t,12.717,19.937)'[v4];
//  [5:v]setpts=PTS+0/TB[5v];
//  [4:v][5v]overlay=x=0:y=0:enable='between(t,0,5)'[v5];
//  [6:v]setpts=PTS+22.692/TB[6v];
//  [5:v][6v]overlay=x=-79:y=193:enable='between(t,22.692,177.792)'[v6];
//  [7:v]setpts=PTS+0/TB[7v];
//  [6:v][7v]overlay=x=0:y=1:enable='between(t,0,155.1)'[v7];
//  [8:v]setpts=PTS+0/TB[8v];
//  [7:v][8v]overlay=x=-48:y=210:enable='between(t,0,20.32)'[v8];
//  [9:v]setpts=PTS+0/TB[9v];
//  [8:v][9v]overlay=x=1:y=270:enable='between(t,0,3.5)'[v9]
//   -preset veryfast -map [v9] -movflags faststart -r 30 -t 30 -crf 23 -b:a 320k /Users/lukasgregor/www/js-packages/cf-scene-renderer/resources/render/009f8bd3cc69fdb037074ea738cc723d/new-scene.mp4
