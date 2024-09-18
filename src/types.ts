import {
    SceneLayerComponentData,
    SceneDataJson,
} from "@bladesk/cf-pixi-scene-builder";

export type Font = {
    id: string;
    family: string;
    source: string;
    variants: string[];
    subsets: string[];
};

export type ResourcesPrepareJobData = {
    component: SceneLayerComponentData;
    scene: SceneDataJson;
    fonts: Font[] | undefined;
    subtitles: any; // TODO: type
    basedir: string;
    order: number;
};

export type DownloadRawClipJobData = {
    id: string;
    clipId: string;
    token: string;
    file_url: string;
    start_at: number;
    end_at: number;
    outputName: string;
};

export type InputType = {
    order: number;
    path: string;
    paths?: string[];
    startAt?: number;
    endAt?: number;
    startOffset?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    addAudioStream?: boolean;
    blur?: boolean;
    inputOptions?: string[];
};

export type ResourcesPrepareJobOutput = InputType | InputType[] | null;
