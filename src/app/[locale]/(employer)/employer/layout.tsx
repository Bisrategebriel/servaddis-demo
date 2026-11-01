import { EmployerShell } from "@/components/shell/employer-shell";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>;
}
