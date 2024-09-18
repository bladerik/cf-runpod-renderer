import { SceneLayerComponentData } from "@bladesk/cf-scene-builder";
import Konva from "konva";
import { rotationAwareConfig } from "@bladesk/cf-scene-builder";
import { ImageConfig } from "konva/lib/shapes/Image";
import fs from "fs";
import path from "path";
// import { loadImage, Canvas } from "skia-canvas";
import canvas from "canvas";
import { createCanvas, loadImage } from "canvas";

class CanvasImage {
    elementGroup: Konva.Group | null = null;
    progressGroup: Konva.Group | null = null;
    stage: Konva.Stage;
    layer: Konva.Layer;

    constructor(
        private component: SceneLayerComponentData,
        private imagePath: string,
        sceneWidth: number,
        sceneHeight: number
    ) {
        this.component = component;
        this.imagePath = imagePath;

        // @ts-ignore
        this.stage = new Konva.Stage({
            width: sceneWidth,
            height: sceneHeight,
        });
        this.layer = new Konva.Layer();
        this.init();
    }

    base64() {
        const filename = this.imagePath;
        const data = fs.readFileSync(this.imagePath);

        var extname = path.extname(filename).substr(1);
        extname = extname || "png";

        if (extname === "svg") {
            extname = "svg+xml";
        }

        return "data:image/" + extname + ";base64," + data.toString("base64");
    }

    async prepareComponent() {
        const config = this.component.element.config as ImageConfig;

        // let tempImg = await loadImage(this.imagePath);

        const tempImg = new canvas.Image();
        // @ts-ignore
        tempImg.style = {};
        tempImg.src = this.base64();

        const konvaImage = new Konva.Image({
            ...rotationAwareConfig(config),
            id: this.component.id,
            // @ts-ignore
            image: tempImg,
        });
        return konvaImage;
    }

    // async render() {
    //     const stage = this.stage;
    //     const dataUrl = stage.toDataURL();

    //     // canvas
    //     // const image = await canvas.loadImage(dataUrl);

    //     // const cs = canvas.createCanvas(stage.width(), stage.height());
    //     // const ctx = cs.getContext("2d");
    //     // ctx.drawImage(image, 0, 0, stage.width(), stage.height());

    //     // const buffer = cs.toBuffer("image/png");
    //     // return buffer;

    //     let canvas = new Canvas(this.stage.width(), this.stage.height());
    //     const ctx = canvas.getContext("2d");

    //     const image = await loadImage(dataUrl);
    //     ctx.drawImage(image, 0, 0);

    //     const buffer = await canvas.toBuffer("png");
    //     return buffer;
    // }
    async render() {
        const stage = this.stage;
        const dataUrl = stage.toDataURL();

        const canvas = createCanvas(this.stage.width(), this.stage.height());
        const ctx = canvas.getContext("2d");

        const image = await loadImage(dataUrl);
        ctx.drawImage(image, 0, 0);

        const buffer = canvas.toBuffer("image/png");
        return buffer;
    }

    async init() {
        const konvaImage = await this.prepareComponent();
        if (konvaImage) {
            this.stage.add(this.layer);
            this.layer.add(konvaImage as Konva.Image);
            this.layer.batchDraw();
        } else {
            throw new Error(
                "Image is null, possibly unsupported url: " +
                    this.component.element.path
            );
        }
    }

    toJSON() {
        return JSON.parse(this.layer.toJSON());
    }

    getLayer() {
        return this.layer;
    }
}

export default CanvasImage;
