import {
    SFN,
    StartExecutionCommand,
    GetExecutionHistoryCommand,
} from "@aws-sdk/client-sfn";

const region = process.env.S3_REGION || "eu-central-1";
const sfnclient = new SFN({ region });
export const stateMachineArn =
    "arn:aws:states:eu-central-1:036472782805:stateMachine:CFFramesRenderSteps";
export const execArn =
    "arn:aws:states:eu-central-1:036472782805:execution:CFFramesRenderSteps";

type StartExecutionParamsType = {
    input: string;
    name: string;
    stateMachineArn?: string;
};

export const startExecution = async function (
    params: StartExecutionParamsType
) {
    try {
        const stateMachineArnFn = params.stateMachineArn || stateMachineArn;
        const args = {
            ...params,
            stateMachineArn: stateMachineArnFn,
        };
        const command = new StartExecutionCommand(args);
        return await sfnclient.send(command);
    } catch (e) {
        console.log(params);
        // Error while starting execution ValidationException: 1 validation error detected: Value at 'input' failed to satisfy constraint: Member must have size less than or equal to 262144 bytes in UTF-8 encoding
        console.log("Error while starting execution", e);
    }
};

export const checkCommandWasExecuted = async function (
    execName: string,
    arn?: string
) {
    const execArnFn = arn ? arn : execArn;
    const input = {
        // GetExecutionHistoryInput
        executionArn: execArnFn + ":" + execName, // required
    };
    const command = new GetExecutionHistoryCommand(input);
    return new Promise(function (resolve) {
        sfnclient
            .send(command)
            .then((response) => {
                resolve(true);
            })
            .catch((err) => {
                resolve(false);
            });
    });
};

export const getResults = async function (execName: string, arn?: string) {
    // GET EXECUTION RESULTS
    const execArnFn = arn ? arn : execArn;
    try {
        const input = {
            executionArn: execArnFn + ":" + execName,
            maxResults: 1,
            reverseOrder: true,
            includeExecutionData: true,
        };
        const command = new GetExecutionHistoryCommand(input);
        const response = await sfnclient.send(command);

        if (response.events && response.events.length > 0) {
            const res = response.events[0];
            if (
                res.executionSucceededEventDetails &&
                res.executionSucceededEventDetails.output
            ) {
                return {
                    success: true,
                    data: JSON.parse(res.executionSucceededEventDetails.output),
                };
            }

            if (res.executionFailedEventDetails) {
                return {
                    success: false,
                    error: res.executionFailedEventDetails.cause,
                    type: "executionFailedEventDetails",
                };
            }

            if (res.executionAbortedEventDetails) {
                return {
                    success: false,
                    error: res.executionAbortedEventDetails.cause,
                    type: "executionAbortedEventDetails",
                };
            }

            if (res.executionTimedOutEventDetails) {
                return {
                    success: false,
                    error: res.executionTimedOutEventDetails.cause,
                    type: "executionAbortedEventDetails",
                };
            }
        }

        // result not ready yet
        return null;
    } catch (e) {
        console.log("Error while getting results", e);
        return null;
    }
};

export const handleExecutionAndGetResults = async function (
    input: any,
    execName: string,
    stateMachineArn: string,
    execArn: string,
    job?: any
) {
    const params = {
        input: JSON.stringify(input),
        name: execName,
        stateMachineArn,
    };

    const wasExecuted = await checkCommandWasExecuted(execName, execArn);
    if (!wasExecuted) {
        await startExecution(params);
    }

    let results = null;
    let attempts = 0;
    const maxAttempts = 900;
    while (results === null && attempts < maxAttempts) {
        console.log("Waiting for results...", attempts);
        results = await getResults(execName, execArn);
        attempts++;
        const fakeProgress = Math.round((attempts / maxAttempts) * 75);
        if (job) {
            await job.updateProgress(fakeProgress);
        }
        if (results === null) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for 1 second before next attempt
        }
    }

    return results;
};
