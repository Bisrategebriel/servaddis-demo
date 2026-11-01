import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["+251911000001", "+251911000001"],
    ["251911000001", "+251911000001"],
    ["0911000001", "+251911000001"],
    ["911000001", "+251911000001"],
    ["+251 91 100 0001", "+251911000001"],
    ["091-100-0001", "+251911000001"],
    ["0711223344", "+251711223344"], // Safaricom
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0811000001", "+25191100000", "+2519110000011", "+1 415 555 0100", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("maskPhone / formatPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+251922000001")).toBe("+251 92• ••• •01");
  });

  it("never leaks digits from a malformed value", () => {
    expect(maskPhone("+25192")).toBe("+251 ••• ••• •••");
  });

  it("formats a revealed number", () => {
    expect(formatPhone("+251922000001")).toBe("+251 92 200 0001");
  });
});
