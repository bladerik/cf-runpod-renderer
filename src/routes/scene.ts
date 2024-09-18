import express from "express";
const router = express.Router();

import auth from "../middleware/auth.js";

import {
    // render,
    // renderFrames,
    // renderFrame,
    // renderClip,
    // downloadRawClip,
    renderBrowser,
} from "../controllers/scene.js";

// TODO verify if user has access to scene id, add scene to request if so
// router.post("/render/:id", [auth], render);
// router.post("/render-frames/:id", [auth], renderFrames);
// router.post("/render-frame/:id", [auth], renderFrame);
// router.post("/render-clip/:id/:clipId", [auth], renderClip);
// router.post("/raw-clip/:id/:clipId", [auth], downloadRawClip);

router.post("/render-browser/:id", [], renderBrowser);
router.post("/render-browser-clip/:id/:clipId", [], renderBrowser);

export default router;
