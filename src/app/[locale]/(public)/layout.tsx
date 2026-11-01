import { JobseekerShell } from "@/components/shell/jobseeker-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <JobseekerShell>{children}</JobseekerShell>;
}
