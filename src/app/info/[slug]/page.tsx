import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getPanelView, isPanelSlug } from "@/lib/info-panels";
import AppHeader from "@/components/AppHeader";
import DocViewer from "@/components/DocViewer";
import RichText from "@/components/RichText";

/** Header emoji per panel. */
const ICON: Record<string, string> = { store: "🛒", clinic: "🩺" };

/**
 * An info panel (מכולת / מרפאה …): the admin-configured content — free (rich)
 * text or an uploaded file — shown to residents. Login-gated like the other
 * "מידע לתושב" pages.
 */
export default async function InfoPanelPage({ params }: { params: { slug: string } }) {
  if (!isPanelSlug(params.slug)) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=/info/${params.slug}`);

  const panel = await getPanelView(params.slug);
  if (!panel) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            {ICON[params.slug] ?? "📄"}
          </span>
          <h1 className="text-2xl font-bold text-gray-900">{panel.label}</h1>
        </header>

        {!panel.configured ? (
          <div className="card text-center text-gray-600">המידע יעודכן בקרוב.</div>
        ) : panel.mode === "pdf" && panel.url ? (
          <>
            <div className="mb-4 flex justify-end">
              <a href={panel.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                {panel.kind === "image" ? "פתח / הורד תמונה" : "פתח / הורד PDF"}
              </a>
            </div>
            <DocViewer url={panel.url} kind={panel.kind} />
          </>
        ) : (
          <div className="card text-base leading-relaxed text-gray-800">
            <RichText value={panel.body} />
          </div>
        )}
      </main>
    </div>
  );
}
