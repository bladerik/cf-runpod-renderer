import { r3 } from "./utils.js";
import { htmlToText } from "../renderer/html.js";
import { JSDOM } from "jsdom";

export type SubtitleWord = {
    id: string;
    start_at: number;
    end_at: number;
    text: string;
    position: number;
};

export const dom = new JSDOM();
global.document = dom.window.document;

export const normalizeMultiwordSubtitles = function (
    subtitles: SubtitleWord[]
) {
    const result: SubtitleWord[] = [];
    let position = 0;
    let startAt: number | null = null;

    subtitles.forEach((subtitle) => {
        const words = subtitle.text.trim().split(" ");
        if (words.length == 1) {
            result.push({
                id: subtitle.id,
                start_at: subtitle.start_at,
                end_at: subtitle.end_at,
                text: subtitle.text,
                position: position++,
            });
        } else {
            const charDuration =
                (subtitle.end_at - subtitle.start_at) / words.join("").length;
            if (!startAt) {
                startAt = subtitle.start_at;
            }

            words.forEach((word) => {
                const computedEnd = (startAt || 0) + charDuration * word.length;
                const endAt =
                    computedEnd < subtitle.end_at
                        ? computedEnd
                        : subtitle.end_at;
                result.push({
                    id: subtitle.id + "-" + position,
                    start_at: startAt || 0,
                    end_at: endAt,
                    text: word,
                    position: position++,
                });

                startAt = (startAt || 0) + charDuration * word.length;
            });
        }
    });

    return result;
};

export const computeTimings = function (
    html: string,
    charsPerSecond = 25
): number[] {
    const text = htmlToText(html);
    console.log(text, html);
    const words = text.split(/\s+/);
    const timePerChar = 1 / charsPerSecond;
    let offset = 0;

    return words.map((word) => {
        const wordLength = r3(word.length * timePerChar);
        const wordTime = offset;
        offset += r3(wordLength);
        return r3(wordTime);
    });
};
