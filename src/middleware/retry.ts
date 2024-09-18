import _ from "lodash";

import { Request, Response } from "express";

type RetryParams = {
    isRetryable: boolean;
    retryUrl: string;
    attempt: number;
};

export const getRetryParamsFromRequest = (req: Request): RetryParams => {
    return _.pick(req.body, ["isRetryable", "retryUrl", "attempt"]);
};

export default async (req: Request, res: Response, next: any) => {
    try {
        let isRetryable = _.has(req, "body.isRetryable")
            ? req.body.isRetryable
            : true;
        let attempt = _.has(req, "body.attempt") ? req.body.attempt : 0;
        const retryUrl = `${req.protocol}://${req.get("host")}${
            req.originalUrl
        }`;

        if (isRetryable) {
            req.body.isRetryable = attempt <= 5;
            req.body.attempt = attempt + 1;
            req.body.retryUrl = retryUrl;

            next();
        } else {
            res.status(401).json({
                error: "Too many failed attempts!",
            });
        }
    } catch {
        res.status(401).json({
            error: "Invalid retry request!",
        });
    }
};
