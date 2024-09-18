import { z } from "zod";
import renderSceneBrowserHandler from "./processes/render-scene-browser.js";

const EventShape = z.object({
    event: z.string(), // TODO define enum
});
type Event = z.infer<typeof EventShape>;

const respObj = function (statusCode: number) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
        },
    };
};

const handler = async function (event: Event) {
    const res = EventShape.safeParse(event);
    if (!res.success) {
        return {
            success: false,
            message: "Invalid event " + JSON.stringify(event),
        };
    }

    if (event.event === "render") {
        return await renderSceneBrowserHandler(event);
    }

    return {
        success: false,
        message: "Function not implemented " + event.event,
    };
};

export default handler;
