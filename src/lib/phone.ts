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
