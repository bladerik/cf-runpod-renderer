export const r3 = (value: number | undefined | null) => {
    if (value === undefined || value === null) {
        return 0;
    }
    return Number(value.toFixed(3));
};
