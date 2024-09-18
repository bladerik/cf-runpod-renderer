import { Request, Response, NextFunction } from "express";
import tokenVerify from "../utils/tokenVerify.js";

export default async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header("authorization")
            ? req.header("authorization")
            : null;

        if (!token) {
            res.status(401).json({
                error: "Invalid token!",
            });
            return;
        }

        let requestUser = await tokenVerify(token);
        if (requestUser) {
            req.body.requestUser = requestUser;
            next();
        } else {
            res.status(401).json({
                error: "Invalid token!",
            });
            return;
        }
    } catch {
        res.status(401).json({
            error: "Invalid request!",
        });
    }
};
