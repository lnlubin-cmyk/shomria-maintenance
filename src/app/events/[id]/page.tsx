import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getEventForView } from "@/lib/events";
import AppHeader from "@/components/AppHeader";
import DocViewer from "@/components/DocViewer";
import RichText from "@/components/RichText";

/** Full page for one event, reached from the home-page אירועים carousel/menu. */
export default async function EventPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/events/${params.id}`);

  const ev = await getEventForView(params.id);
  const date = ev?.eventDate
    ? new Date(`${ev.eventDate}T00:00:00`).toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {!ev ? (
          <div className="card text-center text-gray-600">האירוע אינו זמין.</div>
        ) : (
          <article className="space-y-5">
            {date && <div className="text-sm font-semibold text-accent-600">{date}</div>}
            <h1 className="text-2xl font-bold text-gray-900">{ev.title}</h1>

            {ev.docUrl ? (
              // A real document (PDF/image) is attached — show it, with a download.
              <>
                <div className="flex justify-end">
                  <a href={ev.docDownloadUrl ?? ev.docUrl} rel="noopener noreferrer" className="btn-secondary">
                    הורד קובץ
                  </a>
                </div>
                <DocViewer url={ev.docUrl} kind={ev.docKind === "image" ? "image" : "pdf"} />
              </>
            ) : (
              ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt="" className="w-full rounded-xl border border-gray-200" />
              )
            )}

            {ev.body && (
              <div className="card text-base leading-relaxed text-gray-800">
                <RichText value={ev.body} />
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
