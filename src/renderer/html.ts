import {
    SceneDataJson,
    SceneLayerComponentData,
    CSSStylePropsShape,
    PlacableConfigShape,
    SceneLayerComponent,
    Metadata,
} from "@bladesk/cf-scene-builder";
import fs from "fs";
import sanitizeHtml from "sanitize-html";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { cloneDeep } from "lodash-es";
import { handleExecutionAndGetResults } from "../utils/stepFunctions.js";
import { colorSchema } from "@bladesk/cf-scene-builder";
import md5 from "md5";
import { stateMachineArn, execArn } from "../utils/stepFunctions.js";

const DEFAULT_HIGHLIGHTER_1 = {
    color: "#FBC42D",
    background: "rgba(0,0,0,0)",
};
const DEFAULT_HIGHLIGHTER_2 = {
    color: "#214ED7",
    background: "rgba(0,0,0,0)",
};
const DEFAULT_HIGHLIGHTER_3 = {
    color: "#ED213A",
    background: "rgba(0,0,0,0)",
};

const region = process.env.S3_REGION || "eu-central-1";

const client = new LambdaClient({
    region,
    retryMode: "exponential",
    maxAttempts: 3,
});

export const pxUnitProps = [
    "width",
    "height",
    "left",
    "top",
    "x",
    "y",
    "fontSize",
];
import {
    type SceneLayer,
    type Config,
    type CSSConfig,
    createElement,
} from "@bladesk/cf-scene-builder";

type AnimationType = "html-lines" | "html-words" | "html-chars" | "custom";
type AnimationPreset = {
    type: AnimationType;
    id: string;
    config?: Config;
    previewProgress?: number;
    previewText?: string;
    duration?: number;

    activeWordColorEnabled?: boolean;
    activeWordColor?: string;

    css?: {
        container?: CSSConfig;
        item?: CSSConfig;
    };
};

export const renderLayer = (layer: SceneLayer) => {
    throw new Error("Not implemented");
};

export const htmlToText = (html: string) => {
    return sanitizeHtml(html, {
        allowedTags: [],
        parseStyleAttributes: false,
    });
    // const el = document.createElement("div");
    // el.innerHTML = sanitizeText(html).replace(/<br \/>/g, "\n");
    // return el.innerText;
};

export const prepareComponentCall = (
    scene: SceneDataJson,
    component: SceneLayerComponentData,
    el: HTMLElement
) => {
    const transparent = true;

    const data = {
        function: "JOB_RENDER_SCENE",
        scene: {
            width: scene.width,
            height: scene.height,
            fps: scene.fps,
            transparent,
        },
        component,
        HTML: el.outerHTML,
        fonts: [],
    };
    const debug = process.env.DEBUG || false;
    if (debug) {
        const file =
            process.env.RESOURCES_DIR + `/render/${component.checksum}.json`;
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    return data;
};

export const renderComponent = async (
    scene: SceneDataJson,
    component: SceneLayerComponentData,
    el: HTMLElement,
    attempt = 0,
    job?: any
): Promise<string> => {
    const calls = [];
    const componentCall = prepareComponentCall(scene, component, el);
    calls.push(componentCall);

    const input = {
        calls,
    };

    const dateChecksum = new Date().toISOString().split("T")[0];
    const execKeyHash = md5(
        component.type +
            "-" +
            md5(JSON.stringify(component)) +
            "-" +
            dateChecksum
        // "render-shape-" + component.id + "-" + component.checksum
    );

    console.log(
        "-- renderComponent -- ",
        execKeyHash,
        component.id,
        component.checksum
    );

    const execName = "cf-render-component-" + execKeyHash;
    const results = await handleExecutionAndGetResults(
        input,
        execName,
        stateMachineArn,
        execArn,
        job
    );

    console.log("Render component " + execName + " finished!");

    let loc: string | null = null;
    for (let i = 0; i < results?.data.length; i += 1) {
        const result = results?.data[i];
        if (result.statusCode == 200) {
            loc = result.body.location;
        } else {
            console.log("Unexpected statusCode for result", result);
        }
    }

    if (loc) {
        return loc;
    }
    throw new Error("Failed to render component");

    // return null;

    // TODO we should get fonts out of component config
    // we can set transparent to false only if the component is overlaying the scene and has no animation or keyframes. For now we set it to always true

    // let buffer = Buffer.from(JSON.stringify(data), "utf8");
    // let Payload = new Uint8Array(buffer);

    // const command = new InvokeCommand({
    //     FunctionName: "cf-puppeteer-process-dev-cf-puppeteer-process",
    //     Payload,
    // });

    // const response = await client.send(command);
    // const asciiDecoder = new TextDecoder("ascii");
    // const dataResp = asciiDecoder.decode(response.Payload);
    // const resp = JSON.parse(dataResp);

    // if (!resp.body) {
    //     if (attempt < 3) {
    //         return await renderComponent(scene, component, el, attempt + 1);
    //     } else {
    //         await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    //         console.log({ scene });
    //         console.log({ component });
    //         console.log({ el });
    //         throw new Error("Failed to render component");
    //     }
    // }

    // return resp.body.location;
};

export const sanitizeText = (str: string) => {
    return sanitizeHtml(str, {
        allowedTags: [
            "em",
            "strong",
            "b",
            "i",
            "u",
            "s",
            "br",
            "span",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            // 'p' // schvalne zakazane
        ],
        allowedAttributes: {
            span: ["class", "style"],
        },
        parseStyleAttributes: false,
    });
};

export const buildTextShadowConfig = function (config: CSSConfig) {
    let textShadow = undefined;
    const shadows = [];

    if (config.textOutline) {
        const shadowData = parseShadow(config.textOutline);
        if (shadowData) {
            const unit = config.textOutline.includes("em") ? "em" : "px";
            const outlineShadow = buildTextShadow(
                shadowData.blurRadius,
                shadowData.color,
                "outline",
                unit
            );
            if (outlineShadow && outlineShadow != "none") {
                shadows.push(outlineShadow);
            }
        }
    }

    if (config.textShadow && config.textShadow != "none") {
        shadows.push(config.textShadow);
    }

    if (shadows.length) {
        textShadow = shadows.join(", ");
        config.textShadow = textShadow;
    }

    return config;
};

export const deunitize = (value: string | number) => {
    if (typeof value === "number") {
        return value;
    }

    const val = parseFloat(value);
    return isNaN(val) ? 0 : val;
};

export const getSubtitlesHighlightColor = function (
    comp: SceneLayerComponentData | null,
    color: 1 | 2 | 3
) {
    let defaultColor = DEFAULT_HIGHLIGHTER_1.color;
    let defaultBackground = DEFAULT_HIGHLIGHTER_1.background;
    if (color === 2) {
        defaultColor = DEFAULT_HIGHLIGHTER_2.color;
        defaultBackground = DEFAULT_HIGHLIGHTER_2.background;
    } else if (color === 3) {
        defaultColor = DEFAULT_HIGHLIGHTER_3.color;
        defaultBackground = DEFAULT_HIGHLIGHTER_3.background;
    }

    if (!comp) {
        return {
            color: defaultColor,
            background: defaultBackground,
        };
    }

    const metadata = comp.metadata
        ? (comp.metadata as Metadata)
        : ({} as Metadata);
    const colorKey = `highlightColor${color}`;
    const backgroundKey = `highlightBackground${color}`;

    const colorObj = {
        color: (metadata[colorKey] || defaultColor) as string,
        background: (metadata[backgroundKey] || defaultBackground) as string,
    };

    return colorObj;
};

export const transformVarColorToColor = function (
    varColor: string,
    component: SceneLayerComponentData | null
) {
    const allowedValues = [
        "var(--subtitles-highlight-color-1)",
        "var(--subtitles-highlight-color-2)",
        "var(--subtitles-highlight-color-3)",
        "var(--subtitles-highlight-background-1)",
        "var(--subtitles-highlight-background-2)",
        "var(--subtitles-highlight-background-3)",
    ];

    const isBackground = varColor.includes("background");
    if (allowedValues.includes(varColor)) {
        let color = isBackground
            ? varColor
                  .replace("var(--subtitles-background-color-", "")
                  .replace(")", "")
            : varColor
                  .replace("var(--subtitles-highlight-color-", "")
                  .replace(")", "");
        const colorNumber = parseInt(color, 10);
        const colorObj = getSubtitlesHighlightColor(
            component,
            colorNumber as 1 | 2 | 3
        );

        return isBackground ? colorObj.background : colorObj.color;
    }

    return null;
};

export const parseShadow = (shadow: string) => {
    if (!shadow) {
        return {
            offsetX: 0,
            offsetY: 0,
            blurRadius: 0,
            // spreadRadius: 0,
            color: "#000000",
        };
    }

    const regex =
        /(-?\d+(?:\.\d+)?px)\s(-?\d+(?:\.\d+)?px)\s(-?\d+(?:\.\d+)?(?:px|em))(.*)/;
    const match = shadow.match(regex);

    if (match) {
        const offsetX = match[1];
        const offsetY = match[2];
        const blurRadius = match[3];
        const color = match[4].trim();

        const resp = colorSchema.safeParse(color.trim());

        if (resp.success) {
            return {
                offsetX: deunitize(offsetX),
                offsetY: deunitize(offsetY),
                blurRadius: deunitize(blurRadius),
                color,
            };
        }
    }
    return {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        color: "#000000",
    };
};

export const buildTextShadow = function (
    size: number,
    shadowColor: string,
    type: "outline" | "text-shadow",
    unit: "px" | "em" = "px"
) {
    let shadow = null;
    if (type == "text-shadow" && size > 0) {
        shadow = `0px 0px ${size}px ${shadowColor}`;
    }

    const shadows = [];
    if (shadow) {
        shadows.push(shadow);
    }

    if (type == "outline" && size > 0) {
        const increment = unit == "px" ? 1 : 0.01;
        for (let angle = 0; angle < 2 * Math.PI; angle += increment / size) {
            const x = Math.cos(angle) * size;
            const y = Math.sin(angle) * size;

            shadows.push(`${x}${unit} ${y}${unit} 0 ${shadowColor}`);
        }
    }

    if (shadows.length) {
        return `${shadows.join(", ")}`;
    }
    return "none";
};

export const buildTextElement = (
    component: SceneLayerComponentData,
    document: Document
) => {
    const attrs = component.element.attributes
        ? (component.element.attributes as Config)
        : {};
    const animation = attrs.animation
        ? (attrs.animation as unknown as AnimationPreset)
        : null;
    const isAnimation = animation ? true : false;

    // remove <p> and other dissalowed tags
    const textHtml = component.element.text
        ? sanitizeText(component.element.text.replace("\n", "<br>"))
        : null;
    const html = textHtml ? wrapEmojis(textHtml) : null;
    const isRichText = html ? /<(?!br\b)[^>]+>/i.test(html) : false;
    const innerHTML = isRichText && !isAnimation ? `<p>${html}</p>` : html;

    const config = buildTextShadowConfig(
        configToCSSConfig(component.element.config as Config)
    );
    const elAttrs = {
        style: {
            ...config, //...component.element.config,
            // top: `${component.element.config.y}px`,
            // left: `${component.element.config.x}px`,
            // width: `${component.element.config.width}px`,
            // height: `${component.element.config.height}px`,
        },
        innerHTML,
    };

    const el = createElement(component.element.type, elAttrs, document);
    if (el) {
        const inlineStyle = ObjectToInlineCSS.parse({
            ...config,
            left: `${component.element.config.x}px`,
            top: `${component.element.config.y}px`,
        });
        el.setAttribute("style", inlineStyle);
    }

    if (!el) {
        throw new Error("Element is not an HTMLElement");
    }

    let isSubtitle = false;
    const meta = component.metadata;
    if (meta && meta.isSubtitle) {
        isSubtitle = true;
    }
    if (isSubtitle) {
        // hotfix for subtitles
        const elChild = createElement("div", {}, document);
        if (!elChild) {
            throw new Error("Element Child is not an HTMLElement");
        }
        elChild.id = "elem";
        el.id = "parent-elem";
        elChild.dir = "auto";
        elChild.classList.add("con-el");
        // apply same flex-direction as parent
        elChild.style.flexDirection = el.style.flexDirection;
        if (innerHTML) {
            el.innerHTML = "";
            elChild.innerHTML = innerHTML;
            el.appendChild(elChild);
        }
    } else {
        el.classList.add("con-el");
        el.id = "elem";
    }
    el.classList.add("absolute");
    el.classList.add("flex");
    el.dir = "auto";
    return el;
};

export const configToCSSConfig = (config: Config): CSSConfig => {
    // changing data here might cause side effects
    if (config.backgroundColor === "transparent") {
        config.backgroundColor = undefined;
    }

    if (config.x && config.y && config.width && config.height) {
        const results = PlacableConfigShape.safeParse(config);
        if (!results.success) {
            // log({ config }, results);
            throw new Error("Invalid config");
        }
    }

    const newConfig = cloneDeep(config);
    Object.keys(newConfig).forEach((key) => {
        const isNumber = typeof newConfig[key] === "number";
        if (isNumber) {
            if (pxUnitProps.includes(key)) {
                newConfig[key] = `${newConfig[key]}px`;
            } else {
                newConfig[key] = newConfig[key]?.toString();
            }
        }
    });

    // if (config.debug) {
    // log('configToCSSConfig', { config }, newConfig);
    // }
    return newConfig as CSSConfig;
};

// export const configToCSSConfig = (config: Config): CSSConfig => {
//     if (config.x && config.y && config.width && config.height) {
//         const results = PlacableConfigShape.safeParse(config);
//         if (!results.success) {
//             throw new Error("Invalid config");
//         }
//     }

//     const newConfig = cloneDeep(config);

//     if (newConfig.rotation) {
//         newConfig.transform = `rotate(${newConfig.rotation}deg)`;
//         delete newConfig.rotation;
//     }

//     if (newConfig.textShadow) {
//         // if trimmed textShadow don't starts with a number, delete it
//         const trimmedTextShadow = newConfig.textShadow.trim();
//         if (isNaN(Number(trimmedTextShadow.charAt(0)))) {
//             delete newConfig.textShadow;
//         }
//     }

//     Object.keys(newConfig).forEach((key) => {
//         const isNumber = typeof newConfig[key] === "number";
//         if (isNumber) {
//             if (pxUnitProps.includes(key)) {
//                 newConfig[key] = `${newConfig[key]}px`;
//             } else {
//                 newConfig[key] = newConfig[key]?.toString();
//             }
//         }
//     });

//     return newConfig as unknown as CSSConfig;
// };

export const buildHtmlForComponent = (
    scene: SceneDataJson,
    component: SceneLayerComponentData,
    el: HTMLElement,
    fonts?: string[]
) => {
    const attrs = component.element.attributes
        ? (component.element.attributes as Config)
        : {};
    const animation = attrs.animation
        ? (attrs.animation as unknown as AnimationPreset)
        : null;
    const componentAnimationPreset = animation ? animation.id : null;

    // TODO implement fonts
    const html = `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Text Animation</title>
            <script src="https://cdn.tailwindcss.com"></script>
    
            <style>
                @import url("https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap");
                .cf-emoji {
                    font-family: "Noto Color Emoji", sans-serif;
                    display: inline-block;
                }
    
                .con-el .lines {
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div
                id="scene"
                class="absolute left-0 top-0"
                style="width: ${scene.width}px; height: ${scene.height}px"
            >
                ${el.outerHTML}
            </div>
            <script>
                const FPS = ${scene.fps};
                const ELEMENT_ID = "elem";
                const PRESET = ${componentAnimationPreset};
                const COMPONENT = ${JSON.stringify(component)};

            </script>
            <script src="${process.env.BUNDLE_URL}"></script>
        </body>
    </html>`;
    return html;
};

export const wrapEmojis = function (text: string) {
    const emojiRegex =
        /([\uD800-\uDBFF][\uDC00-\uDFFF](?:[\u200D\uFE0F][\uD800-\uDBFF][\uDC00-\uDFFF]){2,}|\uD83D\uDC69(?:\u200D(?:(?:\uD83D\uDC69\u200D)?\uD83D\uDC67|(?:\uD83D\uDC69\u200D)?\uD83D\uDC66)|\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D(?:\uD83D\uDC69\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]\uFE0F|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC6F\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3C-\uDD3E\uDDD6-\uDDDF])\u200D[\u2640\u2642]\uFE0F|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F\u200D[\u2640\u2642]|(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642])\uFE0F|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\uD83D\uDC69\u200D[\u2695\u2696\u2708]|\uD83D\uDC68(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708]))\uFE0F|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83D\uDC69\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|\uD83D\uDC68(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66\u200D\uD83D\uDC66|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92])|(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]))|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDD1-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\u200D(?:(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC67|(?:(?:\uD83D[\uDC68\uDC69])\u200D)?\uD83D\uDC66)|\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC69\uDC6E\uDC70-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD26\uDD30-\uDD39\uDD3D\uDD3E\uDDD1-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])?|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDEEB\uDEEC\uDEF4-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267B\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])\uFE0F)/gm;

    return text.replace(emojiRegex, '<span class="cf-emoji">$1</span>');
};

export const camelToKebab = function (str: string) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
};

// export const ObjectToInlineCSS = CSSStylePropsShape.transform((styleObject) => {
// 	const cssString = Object.entries(styleObject)
// 		.filter(([, value]) => value !== undefined)
// 		.map(([key, value]) => {
// 			// If the key starts with "Webkit", prefix it with "-"
// 			if (key.startsWith('Webkit')) {
// 				key = '-' + key;
// 			}
// 			return `${camelToKebab(key)}: ${value}`;
// 		})
// 		.join('; ');

// 	// Wrap the CSS string in an HTML element with the `style` attribute
// 	const wrappedCssString = `<div style="${cssString}"></div>`;

// 	const sanitizedHtml = sanitizeHtml(wrappedCssString, {
// 		allowedAttributes: {
// 			div: ['style']
// 		},
// 		parseStyleAttributes: false
// 	});

// 	// Extract the sanitized CSS string from the sanitized HTML
// 	const sanitizedCssString = sanitizedHtml.match(/style="([^"]*)"/)?.[1] ?? '';
// 	return sanitizedCssString;
// });
export const ObjectToInlineCSS = CSSStylePropsShape.transform((styleObject) => {
    const cssString = Object.entries(styleObject)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => {
            // If the key starts with "Webkit", prefix it with "-"
            if (key.startsWith("Webkit")) {
                key = "-" + key;
            }
            return `${camelToKebab(key)}: ${value}`;
        })
        .join("; ");

    // Wrap the CSS string in an HTML element with the `style` attribute
    const wrappedCssString = `<div style="${cssString}"></div>`;
    const kebabCaseKeys = Object.keys(CSSStylePropsShape.shape).map(
        camelToKebab
    );

    // Configure `sanitize-html` to allow only specific style properties
    // const allowedStyles = kebabCaseKeys.reduce(function (acc, item) {
    //     //acc[item] = [/^[a-zA-Z0-9#%.-]+$/]; //[/^.*$/];
    //     acc[item] = [/^.*$/]; //[/^.*$/];
    //     return acc;
    // }, {} as any);

    const sanitizedHtml = sanitizeHtml(wrappedCssString, {
        allowedAttributes: {
            div: ["style"],
        },
        parseStyleAttributes: false,
        // allowedStyles: {
        //     "*": allowedStyles,
        // },
    });

    // Extract the sanitized CSS string from the sanitized HTML
    const sanitizedCssString =
        sanitizedHtml.match(/style="([^"]*)"/)?.[1] ?? "";
    return sanitizedCssString;
});
