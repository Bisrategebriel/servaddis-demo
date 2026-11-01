// Persona switcher targets (App Flow §1.3). Bruk is not seeded: he is created on first use and
// removed by Reset, so the onboarding story always starts from nothing.
export const PERSONAS = [
  { key: "bruk", phone: "+251911000011" },
  { key: "selam", phone: "+251911000001" },
  { key: "yared", phone: "+251911000002" },
  { key: "rahel", phone: "+251911000003" },
  { key: "dawit", phone: "+251922000001" },
  { key: "moderator", phone: "+251911000009" },
] as const;

export type PersonaKey = (typeof PERSONAS)[number]["key"];
export const PERSONA_KEYS = PERSONAS.map((p) => p.key) as [PersonaKey, ...PersonaKey[]];

export type DemoStatus = {
  locked: boolean;
  seedVersion: string;
  resetNeeded: boolean;
};
