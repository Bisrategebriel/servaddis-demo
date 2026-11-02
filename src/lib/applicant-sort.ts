// Pipeline order (App Flow §5.1): verified applicants first (Fayda or reliability ≥ 4.0), then
// the chosen sort, then who applied first. Shared by the API and the polling client.

export type ApplicantSort = "completeness" | "experience";
export const APPLICANT_SORTS: ApplicantSort[] = ["completeness", "experience"];

type Sortable = {
  verified: boolean;
  completeness: number;
  experienceYears: number;
  appliedAt: string;
};

export function compareApplicants(sort: ApplicantSort) {
  return (a: Sortable, b: Sortable) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    const key = sort === "experience" ? "experienceYears" : "completeness";
    if (a[key] !== b[key]) return b[key] - a[key];
    return a.appliedAt.localeCompare(b.appliedAt);
  };
}
