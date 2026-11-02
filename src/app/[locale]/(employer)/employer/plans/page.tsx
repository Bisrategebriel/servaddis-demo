import { Suspense } from "react";
import { GatedPlaceholder } from "@/components/employer/gated-placeholder";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GatedPlaceholder perm="billing.manage" titleKey="plans" />
    </Suspense>
  );
}
