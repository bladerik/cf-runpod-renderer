import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
// Set the AWS Region and endpoint for IDrive.
const REGION = process.env.S3_IDRIVE_REGION || "eu-central-1";
const IDRIVE_ENDPOINT = process.env.S3_IDRIVE_ENDPOINT; // Add IDrive endpoint

// Create an Amazon S3 service client object with credentials.
const s3Client = new S3Client({
    region: REGION,
    endpoint: IDRIVE_ENDPOINT, // Set the endpoint for IDrive
    forcePathStyle: true, // Use path-style URLs
    credentials: {
        accessKeyId: process.env.S3_IDRIVE_ACCESS_KEY as string, // Your access key
        secretAccessKey: process.env.S3_IDRIVE_SECRET_KEY as string, // Your secret key
    },
});

const upload = async function (key: string, body: Buffer) {
    const command = new PutObjectCommand({
        Key: key,
        Bucket: process.env.S3_IDRIVE_BUCKET,
        Body: body,
    });

    await s3Client.send(command);
    return key;
};

const getObject = async function (key: string) {
    try {
        const command = new GetObjectCommand({
            Key: key,
            Bucket: process.env.S3_IDRIVE_BUCKET,
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
