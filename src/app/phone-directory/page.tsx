import { redirect } from "next/navigation";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import PhoneDirectory, { type DirectoryEntry } from "./PhoneDirectory";

export const metadata = { title: "חפש מספר טלפון — קהילת עצמונה-שומריה" };

/**
 * Resident phone directory. Only residents who consented to share their phone
 * (share_phone = true) are listed. RLS hides other residents from a normal user,
 * so the consenting set is computed with the service role and only name + phone
 * (no id/email) is sent to the client.
 */
export default async function PhoneDirectoryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/phone-directory");

  const admin = createAdminClient();
  const { data } = await admin
    .from("residents")
    .select("first_name, last_name, phone")
    .eq("share_phone", true)
    .order("last_name")
    .order("first_name");

  const residents = (data ?? []) as DirectoryEntry[];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            📞
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">חפש מספר טלפון</h1>
            <p className="text-sm text-gray-600">ספר טלפונים של חברי הישוב</p>
          </div>
        </header>

        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          רק תושבים שהביעו את הסכמתם לשיתוף מספר הטלפון שלהם יוצגו בחיפוש.
        </div>

        <PhoneDirectory residents={residents} />
      </main>
    </div>
  );
}
