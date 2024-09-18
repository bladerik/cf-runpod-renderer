import axios from "axios";
import _ from "lodash";

export default async function (token: string) {
    if (token === process.env.HTML_RENDERER_TOKEN) {
        return {
            id: 5,
            type: "admin",
            current_team_id: "unknown-team-id-global-token",
        };
    }
    const url = process.env.APP_ENDPOINT
        ? process.env.APP_ENDPOINT + "/api/me"
        : null;

    if (!url) {
        console.log("APP_ENDPOINT not found");
        return false;
    }

    console.log("verify token", process.env.APP_ENDPOINT);

    let resp = await axios
        .get(url, { headers: { authorization: token } })
        .catch(function (err: any) {
            console.log(err);
            console.log("Token verify error");
        });

    if (resp) {
        return _.has(resp, "data.data.id") ? resp.data.data : false;
    }
    return false;
}
