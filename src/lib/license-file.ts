// License upload rules (E-03), shared by the dropzone and the API. The browser's checks are only
// a convenience: sniffMime reads the file's first bytes, so a renamed file can't get through.

export const MAX_LICENSE_BYTES = 5 * 1024 * 1024;

export const LICENSE_MIME_EXT = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type LicenseMime = keyof typeof LICENSE_MIME_EXT;

export const isLicenseMime = (v: string): v is LicenseMime => v in LICENSE_MIME_EXT;

const SIGNATURES: [LicenseMime, number[]][] = [
  ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
];

/** The real type from the magic bytes, or null when it isn't an allowed format. */
export function sniffMime(bytes: Uint8Array): LicenseMime | null {
  for (const [mime, signature] of SIGNATURES) {
    if (signature.every((b, i) => bytes[i] === b)) return mime;
  }
  return null;
}

/** Display name only (the stored key is random): no paths or control characters, 120 chars max. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  return clean.slice(-120) || "license";
}
