/**
 * "Dawit Alemu" → "Dawit A." (doc 04 LiveToast): activity and notifications never show full
 * names. A new account without a name yet gets the caller's fallback.
 */
export function shortName(name: string, fallback = "") {
  const [first, last] = name.trim().split(/\s+/);
  if (!first) return fallback;
  return last ? `${first} ${last[0]}.` : first;
}
