import Link from "next/link";
import { JobseekerShell } from "@/components/shell/jobseeker-shell";

export default function NotFound() {
  return (
    <JobseekerShell>
      <section className="flex flex-col gap-3 py-10">
        <p className="text-caption text-text-secondary">404</p>
        <h1 className="text-h1">Page not found · ገጹ አልተገኘም</h1>
        <Link href="/" className="text-navy-700 underline underline-offset-4">
          Servaddis
        </Link>
      </section>
    </JobseekerShell>
  );
}
