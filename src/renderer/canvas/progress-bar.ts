import { SceneLayerComponentData } from "@bladesk/cf-scene-builder";
import Konva from "konva";
import type { RectConfig } from "konva/lib/shapes/Rect";

class ProgressBar {
    elementGroup: Konva.Group | null = null;
    progressGroup: Konva.Group | null = null;
    // stage: Konva.Stage;
    layer: Konva.Layer;

    constructor(
        private component: SceneLayerComponentData,
        sceneWidth: number,
        sceneHeight: number
    ) {
        this.component = component;
        // @ts-ignore
        // this.stage = new Konva.Stage({
        //     width: sceneWidth,
        //     height: sceneHeight,
        //     listening: false,
        // });
        this.layer = new Konva.Layer();
        // this.stage.add(this.layer);
        this.init();
    }

    init() {
        const { x, y, width, height } = this.component.element.config;
        // const progressType =
        //     this.component.element.config.progressType || "linear";
        const progressType = "linear";
        const backdropEnabled =
            this.component.element.config.backdropEnabled || false;
        const backdropFill =
            this.component.element.config.backdropFill || "rgba(0,0,0,1)";

        this.elementGroup = new Konva.Group({
            x,
            y,
            width,
            height,
            id: this.component.id,
        });

        this.progressGroup = new Konva.Group({
            id: this.component.id + "_progress",
            x: 0,
            y: 0,
            width,
            height,
            clipX: 0,
            clipY: 0,
            clipWidth: 0,
            clipHeight: progressType == "linear" ? height : 0,
        });

        const config = this.component.element.config as RectConfig;
        const rect = new Konva.Rect({
            ...config,
            x: 0,
            y: 0,
        });
        this.progressGroup.add(rect);

        if (backdropEnabled) {
            const backdrop = new Konva.Rect({
                x: 0,
                y: 0,
                width,
                height,
                fill: backdropFill,
            });
            this.elementGroup.add(backdrop);
        }

        this.elementGroup.add(this.progressGroup);
        this.layer.add(this.elementGroup);
    }

    updateProgress(progress: number) {
        if (!this.progressGroup) return;

        const component = this.component;

        // const progressType = component.element.config.progressType || "linear";
        const progressType = "linear";
        const fullWidth = component.element.config.width;
        const fullHeight = component.element.config.height;
        const duration = component.end_at - component.start_at;
        const maxFrame = duration * 30;
        const progressWidth = Math.round(progress * fullWidth);
        const progressHeight = Math.round(progress * fullHeight);

        this.progressGroup.clipWidth(progressWidth);
        this.progressGroup.clipHeight(
            progressType == "linear" ? fullHeight : progressHeight
        );
        this.progressGroup.opacity(1);
        this.layer.batchDraw();
    }

    toJSON() {
        return JSON.parse(this.layer.toJSON());
    }
}

export default ProgressBar;
