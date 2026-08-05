"use client";

import { useRef, useState } from "react";
import { getFaultAdvice, type AdviceTurn } from "./ai-actions";

const INITIAL_ASK = "אנא סכם את היסטוריית התיקונים בבית, והמלץ כיצד לטפל בתקלה הנוכחית.";

/** Read a picked image, scale it down, and return a small JPEG data URL. */
async function downscale(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Staff-only AI advice for a call. Summarises the house's repair history and
 * recommends how to handle the current fault, with optional photo and follow-up
 * questions. Nothing is stored — the thread lives only in this page session.
 */
export default function AiAdvicePanel({
  faultNumber,
  configured,
}: {
  faultNumber: number;
  configured: boolean;
}) {
  const [turns, setTurns] = useState<AdviceTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const started = turns.length > 0;

  async function ask(text: string) {
    if (!text.trim() && started) return;
    setError(null);
    setBusy(true);
    const prev = turns;
    const nextTurns = [...turns, { role: "user" as const, text }];
    setTurns(nextTurns);
    setQuestion("");
    const img = image;
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";

    const res = await getFaultAdvice({ faultNumber, turns: nextTurns, imageDataUrl: img });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      setTurns(prev); // roll back the optimistic user turn so they can retry
      return;
    }
    setTurns([...nextTurns, { role: "assistant", text: res.text }]);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setImage(await downscale(f));
    } catch {
      setError("טעינת התמונה נכשלה");
    }
  }

  if (!configured) {
    return (
      <div className="card border-dashed text-sm text-gray-500">
        🤖 ייעוץ AI יופעל לאחר הגדרת ספק AI ומפתח בהגדרות המערכת.
      </div>
    );
  }

  const AttachRow = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickImage}
        disabled={busy}
        className="block max-w-full text-xs file:ml-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
      />
      {image && (
        <span className="flex items-center gap-1 text-xs text-emerald-700">
          תמונה מצורפת ✓
          <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setImage(null)}>
            ✕
          </button>
        </span>
      )}
    </div>
  );

  return (
    <div className="card space-y-3 border-brand-100 bg-brand-50/30">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h2 className="font-semibold text-gray-900">ייעוץ AI לטיפול בתקלה</h2>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {!started ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            סיכום היסטוריית התיקונים בבית והמלצה לטיפול בתקלה הנוכחית. אפשר לצרף תמונה (למשל של החלק
            התקול) לקבלת ייעוץ מדויק יותר.
          </p>
          {AttachRow}
          <button
            type="button"
            onClick={() => ask(INITIAL_ASK)}
            disabled={busy}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? "מנתח…" : "קבלת סיכום והמלצה"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="ms-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-100 px-3 py-2 text-sm text-gray-800">
                  {t.text}
                </div>
              ) : (
                <div key={i} className="me-auto max-w-[92%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
                  {t.text}
                </div>
              )
            )}
            {busy && <div className="me-auto text-sm text-gray-500">מנתח…</div>}
          </div>

          {/* Follow-up */}
          <div className="space-y-2 border-t border-brand-100 pt-3">
            {AttachRow}
            <div className="flex items-end gap-2">
              <textarea
                className="field flex-1"
                rows={2}
                placeholder="שאלה נוספת ל-AI…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => ask(question)}
                disabled={busy || !question.trim()}
                className="btn-primary disabled:opacity-50"
              >
                שליחה
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="border-t border-brand-100 pt-2 text-xs text-gray-400">
        ההמלצות נוצרות ע״י בינה מלאכותית והן עצה בלבד — אינן תחליף לשיקול דעת מקצועי. עבודות חשמל, גז
        או בנייה מחייבות בעל מקצוע מוסמך. המידע אינו נשמר.
      </p>
    </div>
  );
}
