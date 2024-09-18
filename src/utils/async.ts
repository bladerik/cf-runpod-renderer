import pRetry, { AbortError } from "p-retry";
import pMap from "p-map";

const run = (task: any): Promise<void> => {
    // Replace this with your task function, which returns a promise
    return Promise.resolve().catch((error) => {
        throw new AbortError(error);
    });
};

export const runTasks = async (tasks: any[], concurrency = 1) => {
    const results = await pMap(tasks, runTask, { concurrency });
    return results;
};

export const runTask = async (task: any) => {
    const result = await pRetry(() => run(task), {
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: Infinity,
    });
    return result;
};
