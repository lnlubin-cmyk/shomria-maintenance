import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getStoreView } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import DocViewer from "@/components/DocViewer";

/**
 * מכולת — the grocery info the admin configured: either free text (e.g. opening
 * hours) or an uploaded PDF, per the chosen mode. Login-gated like the other
 * "מידע לתושב" pages.
 */
export default async function GroceryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/grocery");

  const store = await getStoreView();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            🛒
          </span>
          <h1 className="text-2xl font-bold text-gray-900">{store.label}</h1>
        </header>

        {!store.configured ? (
          <div className="card text-center text-gray-600">המידע יעודכן בקרוב.</div>
        ) : store.mode === "pdf" && store.url ? (
          <>
            <div className="mb-4 flex justify-end">
              <a href={store.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                {store.kind === "image" ? "פתח / הורד תמונה" : "פתח / הורד PDF"}
              </a>
            </div>
            <DocViewer url={store.url} kind={store.kind} />
          </>
        ) : (
          <div className="card whitespace-pre-line text-base leading-relaxed text-gray-800">{store.body}</div>
        )}
      </main>
    </div>
  );
}
