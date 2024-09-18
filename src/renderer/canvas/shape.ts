import { SceneLayerComponentData } from "@bladesk/cf-scene-builder";
import Konva from "konva";
import type { StarConfig } from "konva/lib/shapes/Star";
import type { CircleConfig } from "konva/lib/shapes/Circle";
import type { RectConfig } from "konva/lib/shapes/Rect";
import type { RegularPolygonConfig } from "konva/lib/shapes/RegularPolygon";
import { rotationAwareConfig } from "@bladesk/cf-scene-builder";

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
        this.layer = new Konva.Layer();
        this.init();
    }

    prepareComponent() {
        const { type } = this.component.element;

        if (type == "star") {
            const config = this.component.element.config as StarConfig;
            return new Konva.Star({
                ...config,
                id: this.component.id,
                numPoints: 5,
                innerRadius: 30,
                outerRadius: 50,
            });
        }
        if (type == "circle") {
            const config = this.component.element.config as CircleConfig;
            return new Konva.Circle({
                ...config,
                id: this.component.id,
            });
        }
        if (type == "rectangle") {
            const config = this.component.element.config as RectConfig;
            return new Konva.Rect({
                ...rotationAwareConfig(config),
                id: this.component.id,
            });
        }
        if (type == "triangle") {
            const config = this.component.element
                .config as RegularPolygonConfig;
            return new Konva.RegularPolygon({
                ...config,
                id: this.component.id,
            });
        }

        return null;
    }

    init() {
        const shape = this.prepareComponent();
        if (shape) {
            this.layer.add(shape);
            this.layer.batchDraw();
        } else {
            throw new Error(
                "Shape is null, possibly unsupported type: " +
                    this.component.element.type
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

export default ProgressBar;
