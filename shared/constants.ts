/** Approximate 6-month threshold in milliseconds (used for newborn/young-stock logic). */
export const NEWBORN_THRESHOLD_MS = 6 * 30.44 * 24 * 60 * 60 * 1000;

/** Same threshold in seconds (for comparing against on-chain Unix timestamps). */
export const NEWBORN_THRESHOLD_S = NEWBORN_THRESHOLD_MS / 1000;
