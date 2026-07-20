import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import { ROLE_LABELS } from "@/lib/types";
import { formatIsraeliPhone } from "@/lib/phone";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/profile");

  const resident = session.resident;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">הפרופיל שלי</h1>
        <p className="mb-6 text-sm text-gray-600">פרטים אישיים והגדרות פרטיות.</p>

        <div className="card mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">שם</span>
            <span className="font-medium">{session.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">סוג משתמש</span>
            <span>{ROLE_LABELS[session.user.role]}</span>
          </div>
          {session.user.email && (
            <div className="flex justify-between">
              <span className="text-gray-500">אימייל</span>
              <span dir="ltr">{session.user.email}</span>
            </div>
          )}
          {resident && (
            <div className="flex justify-between">
              <span className="text-gray-500">טלפון</span>
              <span dir="ltr">{formatIsraeliPhone(resident.phone)}</span>
            </div>
          )}
        </div>

        {resident ? (
          <ProfileForm
            initialSharePhone={resident.share_phone}
            initialShareHouse={resident.share_house}
          />
        ) : (
          <div className="card text-sm text-gray-600">
            למשתמש חיצוני אין הגדרות פרטיות (אין בית או טלפון להצגה באתר).
          </div>
        )}
      </main>
    </div>
  );
}
