import { Request, Response } from "express";
import { chromium, Browser, firefox } from "playwright";

import express from "express";
var router = express.Router();

/* GET home page. */
router.get("/", function (req: Request, res: Response) {
    res.render("index", { title: "Express" });
});

router.get("/browser-info", async function (req: Request, res: Response) {
    try {
        const args = [
            "--no-sandbox",
            "--headless=new",
            "--hide-scrollbars",
            "--use-angle=vulkan",
            "--mute-audio",
        ];
        const browser: Browser = await chromium.launch({
            // channel: "chrome", // Use this if you want to use Google Chrome
            channel: (req.query.browser as string) || "chrome",
            headless: true,
            // executablePath: "/usr/bin/google-chrome",
            args: args as string[],
        });
        const page = await browser.newPage();

        // Navigate to a page that exposes GPU information
        await page.goto("chrome://gpu");

        await page.screenshot({ path: process.env.RESOURCES_DIR + "/gpu.png" });

        // Wait for the info-view element to be present
        await page.waitForSelector("#content");

        const pageContent = await page.content();

        res.json({ pageContent });
    } catch (error) {
        console.error("Error fetching browser info:", error);
        res.status(500).json({ error: "Failed to fetch browser information" });
    }
});

export default router;
