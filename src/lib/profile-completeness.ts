// Jobseeker profile completeness, doc 05 §6.4. Weights sum to 100.
export const COMPLETENESS_WEIGHTS = {
  photo: 15,
  headline: 10,
  skills: 20, // needs at least MIN_SKILLS
  experience: 15,
  languages: 15,
  previousWorkplace: 10,
  availability: 10,
  preferredSubCity: 5,
} as const;

export const MIN_SKILLS = 3;

export type CompletenessInput = {
  photoUrl?: string | null;
  headline?: string | null;
  skillCount: number;
  experienceYears: number;
  languageCount: number;
  previousWorkplaceCount: number;
  availability?: string | null;
  preferredSubCityCount: number;
};

const filled = (s?: string | null) => !!s && s.trim().length > 0;

export function profileCompleteness(p: CompletenessInput): number {
  const w = COMPLETENESS_WEIGHTS;
  const score =
    (filled(p.photoUrl) ? w.photo : 0) +
    (filled(p.headline) ? w.headline : 0) +
    (p.skillCount >= MIN_SKILLS ? w.skills : 0) +
    (p.experienceYears > 0 ? w.experience : 0) +
    (p.languageCount > 0 ? w.languages : 0) +
    (p.previousWorkplaceCount > 0 ? w.previousWorkplace : 0) +
    (filled(p.availability) ? w.availability : 0) +
    (p.preferredSubCityCount > 0 ? w.preferredSubCity : 0);
  return Math.min(100, score);
}
