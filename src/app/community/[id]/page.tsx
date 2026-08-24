import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getCommunityItemForView } from "@/lib/community";
import { docKind } from "@/lib/doc-files";
import AppHeader from "@/components/AppHeader";
import DocViewer from "@/components/DocViewer";

/**
 * View a "קהילה" item: its PDF rendered inline (PDF.js). Login-gated, and only
 * complete + visible items are reachable (getCommunityItemForView enforces it).
 */
export default async function CommunityItemPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/community/${params.id}`);

  const data = await getCommunityItemForView(params.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {!data ? (
          <div className="card text-center text-gray-600">הפריט אינו זמין.</div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{data.item.subject}</h1>
              <a
                href={`/community/${params.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                {docKind(data.item.file_path) === "image" ? "פתח / הורד תמונה" : "פתח / הורד PDF"}
              </a>
            </div>
            <DocViewer url={data.url} kind={docKind(data.item.file_path)} />
          </>
        )}
      </main>
    </div>
  );
}
