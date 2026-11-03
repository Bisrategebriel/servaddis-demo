import Link from "next/link";
import { EmptyIllustration } from "@/components/empty-state";
import { JobseekerShell } from "@/components/shell/jobseeker-shell";

export default function NotFound() {
  return (
    <JobseekerShell>
      <section className="flex flex-col items-start gap-3 py-10">
        <EmptyIllustration name="jobs" className="h-24 w-30" />
        <p className="text-caption text-text-secondary">404</p>
        <h1 className="text-h1">Page not found · ገጹ አልተገኘም</h1>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-navy-700 underline underline-offset-4"
        >
          Servaddis
        </Link>
      </section>
    </JobseekerShell>
  );
}
