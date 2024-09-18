import { Request, Response } from "express";

import { SceneShape as SceneShapePixi } from "@bladesk/cf-pixi-scene-builder";
import renderSceneBrowserHandler from "../processes/render-scene-browser.js";

export const renderBrowser = async function (req: Request, res: Response) {
    const body = req.body;

    const shape = SceneShapePixi.safeParse(body.scene);
    if (!shape.success) {
        console.log("error checking scene shape pixi", "shape.error", body);
        res.status(400).send({ success: false, error: "shape.error" });
        return;
    }

    try {
        const token = req.header("authorization");

        const jobName = "cf-render-pixi-" + shape.data.id;
        await renderSceneBrowserHandler({
            id: jobName,
            data: body,
        } as any);
        res.send({ success: true, job: "local", counts: {} });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            success: false,
            error: "An error occurred while processing your request.",
        });
        return;
    }
};
