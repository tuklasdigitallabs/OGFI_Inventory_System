import { randomBytes } from "crypto";

export function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}

export const maxFailedLoginAttempts = 3;
export const maxDailyRestrictions = 3;
export const restrictionWindowMs = 24 * 60 * 60 * 1000;
