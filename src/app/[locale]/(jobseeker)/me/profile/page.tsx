import { redirect } from "next/navigation";
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

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" aria-hidden />}>
      <Profile />
    </Suspense>
  );
}
