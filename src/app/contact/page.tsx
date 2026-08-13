import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getVisibleContacts } from "@/lib/contacts";
import AppHeader from "@/components/AppHeader";

export const metadata = { title: "צור קשר — קהילת עצמונה-שומריה" };

/** צור קשר — the kibbutz units (office, etc.) with their email/phone. */
export default async function ContactPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/contact");

  const contacts = await getVisibleContacts();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            ☎️
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">צור קשר</h1>
            <p className="text-sm text-gray-600">אנשי הקשר והיחידות בישוב</p>
          </div>
        </header>

        {contacts.length === 0 ? (
          <div className="card text-center text-gray-600">עדיין לא הוגדרו אנשי קשר.</div>
        ) : (
          <ul className="space-y-3">
            {contacts.map((c) => (
              <li key={c.id} className="card">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <BuildingIcon />
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">{c.name}</h2>
                </div>

                {(c.phone || c.email) && (
                  <div className="mt-3 space-y-2 ps-[3.25rem]">
                    {c.phone && (
                      <a
                        href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                        className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-brand-700"
                      >
                        <PhoneIcon />
                        <span dir="ltr">{c.phone}</span>
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-brand-700"
                      >
                        <MailIcon />
                        <span dir="ltr" className="break-all">{c.email}</span>
                      </a>
                    )}
                  </div>
                )}

                {c.notes && (
                  <p className="mt-3 whitespace-pre-line ps-[3.25rem] text-sm text-gray-500">{c.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function BuildingIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M8 7h1m-1 4h1m-1 4h1m3-8h1m-1 4h1" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}
