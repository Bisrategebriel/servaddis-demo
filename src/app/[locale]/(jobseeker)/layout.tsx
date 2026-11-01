import { JobseekerShell } from "@/components/shell/jobseeker-shell";

export default function JobseekerLayout({ children }: { children: React.ReactNode }) {
  return <JobseekerShell bottomNav>{children}</JobseekerShell>;
}
