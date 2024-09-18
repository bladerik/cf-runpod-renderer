import { getSignedUrl } from "@aws-sdk/cloudfront-signer"; // ESM
import fs from "fs";
// const { getSignedUrl } = require("@aws-sdk/cloudfront-signer"); // CJS

const cloudfrontDistributionDomain = process.env.CLOUDFRONT_URL;

function nowPlusHours(hrs = 6) {
    const date = new Date();
    date.setHours(date.getHours() + hrs);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const signS3CloudFront = (s3ObjectKey: string) => {
    if (!process.env.CLOUDFRONT_KEY_SECRET || !process.env.CLOUDFRONT_KEY_ID) {
        throw new Error(
            "CLOUDFRONT_KEY_SECRET or CLOUDFRONT_KEY_ID is not set"
        );
    }

    const url = `${cloudfrontDistributionDomain}/${s3ObjectKey}`;
    const privateKey = process.env.CLOUDFRONT_KEY_SECRET;
    const keyPairId = process.env.CLOUDFRONT_KEY_ID;

    const dateLessThan = nowPlusHours(6); // any Date constructor compatible
    return getSignedUrl({
        url,
        keyPairId,
        dateLessThan,
        privateKey,
    });
};
