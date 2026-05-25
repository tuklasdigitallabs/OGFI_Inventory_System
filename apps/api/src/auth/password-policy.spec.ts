import { generateTemporaryPassword } from "./password-policy";

describe("password policy", () => {
  it("generates strong one-time temporary passwords", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();

    expect(first).toHaveLength(24);
    expect(first).not.toEqual(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
