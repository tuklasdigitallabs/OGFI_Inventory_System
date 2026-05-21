declare module "altcha-lib" {
  export function createChallenge(
    options: Record<string, unknown>,
  ): Promise<unknown>;
  export function verifySolution(options: Record<string, unknown>): Promise<{
    verified: boolean;
  }>;
}

declare module "altcha-lib/algorithms/pbkdf2" {
  export function deriveKey(...args: unknown[]): Promise<unknown>;
}
