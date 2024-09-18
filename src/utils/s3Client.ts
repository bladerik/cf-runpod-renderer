import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
// Set the AWS Region.
const REGION = process.env.S3_REGION || "eu-central-1";
// Create an Amazon S3 service client object.
const s3Client = new S3Client({ region: REGION });

const upload = async function (key: string, body: Buffer) {
    const command = new PutObjectCommand({
        Key: key,
        Bucket: process.env.S3_BUCKET,
        Body: body,
    });

    await s3Client.send(command);
    return key;
};

const getObject = async function (key: string) {
    try {
        const command = new GetObjectCommand({
            Key: key,
            Bucket: process.env.S3_BUCKET,
        });

        const { Body } = await s3Client.send(command);
        return Body;
    } catch (error) {
        console.log("File not found on s3, or other error: " + key);
        // console.log(error);
        return null;
    }
};

export { s3Client, upload, getObject };
