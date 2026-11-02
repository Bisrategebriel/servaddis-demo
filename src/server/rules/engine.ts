import { BLOCKED_KEYWORDS } from "./blocked-keywords";
import config from "./rules.json";

// Rules engine (TRD §5.3, doc 05 §7.1): a pure function over the job text. Deterministic and
// explainable: every flag names the rule, the field and the exact phrase it found.
// Any "block" flag stops a submit with 422; "warn" and "info" reach the moderator as context.

export type Severity = "block" | "warn" | "info";

export const TEXT_FIELDS = [
  "titleEn",
  "titleAm",
  "descriptionEn",
  "descriptionAm",
  "requirementsEn",
  "requirementsAm",
  "benefitsEn",
  "benefitsAm",
  "shiftPattern",
] as const;
export type TextField = (typeof TEXT_FIELDS)[number];
export type FlagField = TextField | "salary" | "role";

export type Flag = {
  ruleId: string;
  severity: Severity;
  field: FlagField;
  /** The offending text as the employer wrote it, when the rule matched text. */
  match?: string;
  messageEn: string;
  messageAm: string;
};

export type RuleInput = Record<TextField, string> & { salaryMin: number; salaryMax: number };
export type RuleTemplate = { family: string; salaryHint: { min: number; max: number } } | null;

type RuleConfig = (typeof config.rules)[number] & {
  patterns?: string[];
  regex?: string[];
  families?: string[];
};
const rules = config.rules as RuleConfig[];
const rule = (id: string) => rules.find((r) => r.id === id)!;

// Ethiopic homophone series are written interchangeably (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ). Folding each
// series onto one spelling stops a phrase from slipping past by swapping letters.
const FOLDS: [from: number, to: number][] = [
  [0x1210, 0x1200], // ሐ → ሀ
  [0x1280, 0x1200], // ኀ → ሀ
  [0x1220, 0x1230], // ሠ → ሰ
  [0x12d0, 0x12a0], // ዐ → አ
  [0x1340, 0x1338], // ፀ → ጸ
];

/**
 * Lower-cases, folds homophones and turns every whitespace character into a space. It keeps the
 * text's length, so a match position in the normalised text is the same in the original.
 */
export function normalise(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const code = lower.codePointAt(0)!;
    const fold = FOLDS.find(([from]) => code >= from && code < from + 8);
    const mapped = fold ? String.fromCodePoint(fold[1] + (code - fold[0])) : lower;
    // One output character per input character; a rare multi-character lower-casing keeps the original.
    out += /\s/.test(ch) ? " " : mapped.length === ch.length ? mapped : ch;
  }
  return out;
}

/**
 * Finds a phrase and returns it exactly as the employer wrote it. Spaces in the phrase match any
 * run of whitespace, and English phrases only match whole words ("deposit" ≠ "depositor").
 */
function findPhrase(text: string, phrase: string): string | undefined {
  const target = normalise(phrase).trim().replace(/ +/g, " ");
  const latin = /^[a-z0-9 ,.'-]+$/.test(target);
  const escaped = target
    .split(" ")
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const re = new RegExp(latin ? `(?<![a-z0-9])${escaped}(?![a-z0-9])` : escaped, "u");
  const hit = re.exec(normalise(text));
  return hit ? text.slice(hit.index, hit.index + hit[0].length) : undefined;
}

function textFlags(input: RuleInput, id: string, phrases: readonly string[]): Flag[] {
  const r = rule(id);
  const flags: Flag[] = [];
  for (const field of TEXT_FIELDS) {
    for (const phrase of phrases) {
      const match = findPhrase(input[field], phrase);
      if (match) {
        flags.push({
          ruleId: id,
          severity: r.severity as Severity,
          field,
          match,
          messageEn: r.messageEn,
          messageAm: r.messageAm,
        });
        break; // one flag per field per rule is enough to act on
      }
    }
  }
  return flags;
}

function contactFlags(input: RuleInput): Flag[] {
  const r = rule("offplatform-contact");
  const patterns = r.regex!.map((p) => new RegExp(p, "i"));
  const flags: Flag[] = [];
  for (const field of TEXT_FIELDS) {
    for (const re of patterns) {
      const hit = re.exec(input[field]);
      if (hit) {
        flags.push({
          ruleId: r.id,
          severity: "warn",
          field,
          match: hit[0],
          messageEn: r.messageEn,
          messageAm: r.messageAm,
        });
        break;
      }
    }
  }
  return flags;
}

function single(id: string, field: FlagField): Flag {
  const r = rule(id);
  return {
    ruleId: id,
    severity: r.severity as Severity,
    field,
    messageEn: r.messageEn,
    messageAm: r.messageAm,
  };
}

export function runRules(input: RuleInput, template: RuleTemplate): Flag[] {
  const flags: Flag[] = [
    ...textFlags(input, "no-fee", rule("no-fee").patterns!),
    ...textFlags(input, "blocked-keywords", BLOCKED_KEYWORDS),
  ];
  const { salaryMin, salaryMax } = input;
  if (!(salaryMin > 0 && salaryMax >= salaryMin)) {
    flags.push(single("salary-required", "salary"));
  } else if (
    template &&
    (salaryMax > 3 * template.salaryHint.max || salaryMin < 0.3 * template.salaryHint.min)
  ) {
    flags.push(single("salary-outlier", "salary"));
  }
  flags.push(...contactFlags(input));
  if (template && rule("sensitive-family").families!.includes(template.family)) {
    flags.push(single("sensitive-family", "role"));
  }
  return flags;
}

export const hasBlock = (flags: Flag[]) => flags.some((f) => f.severity === "block");
