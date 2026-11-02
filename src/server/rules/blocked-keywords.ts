// Scam and adult-service wording that is never allowed (doc 05 §7.1 "blocked-keywords").
// Kept in code rather than a .txt file so it bundles without file-system access. Matching is
// case-insensitive and whitespace-tolerant; Amharic homophone letters are normalised.
// Production moves this to an admin-editable BlockedKeyword table (doc 05 §11).
// Amharic entries are DRAFTS pending native review (D-6).

export const BLOCKED_KEYWORDS = [
  "escort",
  "adult entertainment",
  "happy ending",
  "sugar daddy",
  "massage parlour",
  "guaranteed visa",
  "work abroad guaranteed",
  "bitcoin",
  "crypto investment",
  "pyramid",
  "no interview needed, just pay",
  "ቪዛ ዋስትና",
  "ወደ ውጭ አገር እንልካለን",
] as const;
