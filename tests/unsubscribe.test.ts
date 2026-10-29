import { describe, expect, test } from "vitest";
import {
  unsubscribeToken,
  unsubscribeTokenValid,
  unsubscribeUrl,
} from "@/lib/email/unsubscribe";

const SECRET = "a-long-random-string";

describe("unsubscribe links", () => {
  test("the token is stable across case and whitespace in the address", () => {
    expect(unsubscribeToken("Ada@Example.com ", SECRET)).toBe(unsubscribeToken("ada@example.com", SECRET));
  });

  test("a valid token passes and a tampered one fails", () => {
    const token = unsubscribeToken("ada@example.com", SECRET);
    expect(unsubscribeTokenValid("ada@example.com", token, SECRET)).toBe(true);
    expect(unsubscribeTokenValid("bo@example.com", token, SECRET)).toBe(false);
    expect(unsubscribeTokenValid("ada@example.com", token, "other")).toBe(false);
    expect(unsubscribeTokenValid("ada@example.com", "nope", SECRET)).toBe(false);
    expect(unsubscribeTokenValid("ada@example.com", "", SECRET)).toBe(false);
  });

  test("the URL carries the address and token, or is null without a secret", () => {
    const url = unsubscribeUrl("Ada@example.com", "https://benchandtrade.com", SECRET);
    expect(url).toMatch(
      /^https:\/\/benchandtrade\.com\/api\/email\/unsubscribe\?e=ada%40example\.com&t=[0-9a-f]{64}$/,
    );
    expect(unsubscribeUrl("ada@example.com", "https://benchandtrade.com", null)).toBeNull();
  });
});
