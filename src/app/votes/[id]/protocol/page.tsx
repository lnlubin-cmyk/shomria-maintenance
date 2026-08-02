import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getVoteById, getVoteProtocol } from "@/lib/votes";
import PrintButton from "../../PrintButton";
import { formatDateTime, VOTE_FORMAT_LABELS, VOTE_APPROVAL_STATEMENT } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VoteProtocolPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/votes/${params.id}/protocol`);

  const vote = await getVoteById(params.id);
  if (!vote) notFound();

  const protocol = await getVoteProtocol(vote);

  if (!protocol) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/votes/${vote.id}`} className="text-sm text-brand-600 hover:underline">
          ← חזרה להצבעה
        </Link>
        <div className="card mt-4 text-center text-gray-600">
          הפרוטוקול יהיה זמין לאחר סגירת ההצבעה ואישור ספירת הקולות הידנית (אם קיימת).
        </div>
      </div>
    );
  }

  const isMembership = protocol.format === "membership";
  const closingDate = protocol.closedAt ?? protocol.closesAt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Toolbar — hidden when printing */}
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/votes/${vote.id}`} className="text-sm text-brand-600 hover:underline">
          ← חזרה להצבעה
        </Link>
        <PrintButton />
      </div>

      {/* The protocol document */}
      <article className="rounded-xl border border-gray-300 bg-white p-8 leading-relaxed text-gray-900 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-gray-300 pb-4 text-center">
          <h1 className="text-2xl font-bold">פרוטוקול הצבעה</h1>
          <p className="mt-1 text-sm text-gray-500">קהילת עצמונה-שומריה</p>
        </header>

        <section className="mt-6 space-y-3">
          <Field label="כותרת ההצבעה" value={protocol.title} />
          <Field label="נושא ההצבעה" value={protocol.subject} />
          {protocol.description && <Field label="תיאור" value={protocol.description} />}
          <Field label="סוג ההצבעה" value={VOTE_FORMAT_LABELS[protocol.format]} />
          <Field label="מועד פתיחה" value={formatDateTime(protocol.startAt)} />
          <Field
            label="מועד סגירה"
            value={
              closingDate
                ? formatDateTime(closingDate)
                : "בסגירה ידנית של ועדת הקלפי"
            }
          />
          <Field label="חברי ועדת קלפי" value={protocol.committee.join(", ") || "—"} />
        </section>

        <section className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="mb-2 font-semibold">השתתפות</h2>
          <ul className="space-y-1 text-sm">
            <li>
              סה״כ מצביעים: <span className="font-semibold">{protocol.turnout.total}</span>
            </li>
            <li>
              הצביעו במערכת: <span className="font-semibold">{protocol.turnout.electronic}</span>
            </li>
            <li>
              הצביעו בפתק: <span className="font-semibold">{protocol.turnout.manual}</span>
            </li>
          </ul>
        </section>

        <section className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="mb-3 font-semibold">תוצאות</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-right text-gray-500">
                  <th className="py-2 font-medium">{isMembership ? "מועמד" : "אפשרות"}</th>
                  {isMembership ? (
                    <>
                      <th className="py-2 text-left font-medium">בעד</th>
                      <th className="py-2 text-left font-medium">נגד</th>
                    </>
                  ) : (
                    <th className="py-2 text-left font-medium">קולות</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {protocol.results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{r.label}</td>
                    {isMembership ? (
                      <>
                        <td className="py-2 text-left tabular-nums">{r.accept ?? 0}</td>
                        <td className="py-2 text-left tabular-nums">{r.decline ?? 0}</td>
                      </>
                    ) : (
                      <td className="py-2 text-left tabular-nums">{r.votes ?? 0}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 border-t border-gray-200 pt-4">
          <h2 className="mb-2 font-semibold">אישור ועדת הקלפי</h2>
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">
            {protocol.confirmation || VOTE_APPROVAL_STATEMENT}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            כל חברי ועדת הקלפי אישרו את התוצאות: {protocol.committee.join(", ")}.
          </p>
        </section>

        <footer className="mt-8 border-t border-gray-300 pt-4 text-xs text-gray-500">
          פרוטוקול זה הופק אוטומטית עם אישור התוצאות על ידי ועדת הקלפי
          {protocol.generatedAt ? ` בתאריך ${formatDateTime(protocol.generatedAt)}` : ""}.
        </footer>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="font-semibold text-gray-700">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
