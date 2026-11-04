// Ethiopian mobile numbers: +251 followed by 9 digits starting with 9 (Ethio telecom) or 7 (Safaricom).
// Shared by the API and the PhoneInput component, so both accept and reject the same inputs.

const MOBILE = /^[79]\d{8}$/;

/** Returns E.164 (+2519XXXXXXXX) or null. Accepts 09…, 9…, 2519…, +251 9… with spaces/dashes. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("251")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return MOBILE.test(local) ? `+251${local}` : null;
}

// Ethiopian fixed lines: +251, a two-digit area code (11 Addis Ababa, 22 Adama, 25 Dire Dawa,
// 33/34 north-east, 46 Hawassa, 47 Jimma, 57 Nekemte, 58 Bahir Dar/Gondar), then 7 digits.
const LANDLINE = /^(11|22|25|33|34|46|47|57|58)\d{7}$/;

/**
 * A venue's public contact number (SCR-E01/E16): mobile or landline, normalised to E.164.
 * Sign-in and invites stay mobile-only (normalizePhone): those numbers receive SMS.
 */
export function normalizeContactPhone(input: string): string | null {
  const mobile = normalizePhone(input);
  if (mobile) return mobile;
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("251") ? digits.slice(3) : digits.replace(/^0/, "");
  return LANDLINE.test(local) ? `+251${local}` : null;
}

/**
 * What employers see before a contact reveal (doc 05 §12): "+251 92• ••• •01".
 * One mask character per hidden digit, so the shape matches a real number.
 */
export function maskPhone(e164: string): string {
  const d = e164.replace(/^\+251/, "");
  if (d.length !== 9) return "+251 ••• ••• •••";
  return `+251 ${d.slice(0, 2)}• ••• •${d.slice(7)}`;
}

/** "+251 92 200 0001" for display after a reveal. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+251/, "");
  if (d.length !== 9) return e164;
  return `+251 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}
