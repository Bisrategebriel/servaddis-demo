import { describe, expect, it } from "vitest";
import { safeFileName, sniffMime } from "@/lib/license-file";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffMime", () => {
  it("recognises the allowed formats by their first bytes", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("rejects everything else", () => {
    expect(sniffMime(new TextEncoder().encode("MZ executable"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffMime(bytes(0x25, 0x50))).toBeNull(); // truncated header
    expect(sniffMime(bytes())).toBeNull();
  });
});

describe("safeFileName", () => {
  it("drops paths and unsafe characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\fake\\license.pdf")).toBe("license.pdf");
    expect(safeFileName('a"b<c>.pdf')).toBe("abc.pdf");
  });

  it("keeps Amharic names and falls back when nothing is left", () => {
    expect(safeFileName("ፈቃድ.pdf")).toBe("ፈቃድ.pdf");
    expect(safeFileName("///")).toBe("license");
  });

  it("limits the length, keeping the extension", () => {
    const name = safeFileName(`${"x".repeat(300)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});
