import "envkey";
import "dotenv/config";
import fs from "fs/promises";
import app from "./dist/index.js";

async function main() {
    const inputFilePath = process.argv[2];
    const outputFilePath = process.argv[3];

    if (!inputFilePath || !outputFilePath) {
        console.error(
            "Please provide paths for input and output JSON files as arguments"
        );
        process.exit(1);
    }

    try {
        // Read and parse the input JSON file
        const jsonData = JSON.parse(await fs.readFile(inputFilePath, "utf8"));

        // Call your app function with the parsed data
        const result = await app(jsonData);

        // Write the result to the output file
        await fs.writeFile(outputFilePath, JSON.stringify(result));

        console.log("Processing completed successfully");
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();
