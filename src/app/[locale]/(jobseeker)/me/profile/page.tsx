import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ProfileView } from "@/components/jobseeker/profile-view";
import { getCurrentUser } from "@/server/current-user";
import { myProfile } from "@/server/services/profile";

// SCR-J04: the signed-in jobseeker's profile with its completeness meter (J-05).

async function Profile() {
  const user = await getCurrentUser();
  if (user?.platformRole !== "JOBSEEKER") redirect("/login?next=/me/profile");
  return <ProfileView initial={await myProfile(user.id)} />;
}

export default async function ProfilePage() {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<FormSkeleton label={t("loading")} />}>
      <Profile />
    </Suspense>
  );
}
