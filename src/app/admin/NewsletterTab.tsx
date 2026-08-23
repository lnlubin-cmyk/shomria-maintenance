"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeNewsletter,
  publishNewsletter,
  type AnalyzedPage,
  type PublishSection,
} from "./newsletter-actions";

type SectionKey = "community" | "info" | "torah";
// A per-section target may also be "clinic" (updates the מרפאה panel file).
type TargetKey = SectionKey | "clinic";

const SECTION_LABELS: Record<SectionKey, string> = {
  community: "קהילה",
  info: "מידע לתושב",
  torah: "תורה ותפילה",
};

const TARGET_LABELS: Record<TargetKey, string> = {
  ...SECTION_LABELS,
  clinic: "מרפאה (עדכון הפאנל)",
};

// A crop box the admin is reviewing. Coords are 0..1 within the page preview.
interface Sec {
  id: string;
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  title: string;
  section: TargetKey;
  include: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type DragState =
  | { mode: "move"; id: string; ox: number; oy: number; box: Sec }
  | { mode: "resize"; id: string; corner: "nw" | "ne" | "sw" | "se" }
  | { mode: "draw"; page: number; sx: number; sy: number; id: string };

export default function NewsletterTab({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "analyzing" | "review" | "publishing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [token, setToken] = useState<string>("");
  const [pages, setPages] = useState<AnalyzedPage[]>([]);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);

  const [publishFull, setPublishFull] = useState(false);
  const [fullTitle, setFullTitle] = useState("הידיעון האחרון");
  const [fullSection, setFullSection] = useState<SectionKey>("community");

  const secsRef = useRef<Sec[]>([]);
  secsRef.current = secs;
  const dragRef = useRef<DragState | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));

  async function onAnalyze(fd: FormData) {
    setError(null);
    setNotice(null);
    setPhase("analyzing");
    const res = await analyzeNewsletter(fd);
    if ("error" in res) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setToken(res.token);
    setPages(res.pages);
    setUsedAi(res.aiUsed && res.suggestions.length > 0);
    setSecs(
      res.suggestions.map((s) => ({
        id: newId(),
        page: s.page,
        x0: s.x0,
        y0: s.y0,
        x1: s.x1,
        y1: s.y1,
        title: s.title,
        section: s.section,
        include: true,
      }))
    );
    setPhase("review");
    if (res.suggestions.length === 0) {
      setNotice(
        aiConfigured
          ? "ה-AI לא הציע מקטעים. סמן מקטעים ידנית: גרור מלבן על העמוד."
          : "מנוע ה-AI אינו מוגדר, לכן אין הצעות אוטומטיות. סמן מקטעים ידנית: גרור מלבן על העמוד."
      );
    }
  }

  // ----- pointer interactions on a page -----
  const fracFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const r = rectRef.current!;
    return {
      fx: clamp01((e.clientX - r.left) / r.width),
      fy: clamp01((e.clientY - r.top) / r.height),
    };
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { fx, fy } = fracFromEvent(e);
    if (d.mode === "move") {
      const w = d.box.x1 - d.box.x0;
      const h = d.box.y1 - d.box.y0;
      let nx = clamp01(fx - d.ox);
      let ny = clamp01(fy - d.oy);
      nx = Math.min(nx, 1 - w);
      ny = Math.min(ny, 1 - h);
      setSecs((prev) => prev.map((s) => (s.id === d.id ? { ...s, x0: nx, y0: ny, x1: nx + w, y1: ny + h } : s)));
    } else if (d.mode === "resize") {
      setSecs((prev) =>
        prev.map((s) => {
          if (s.id !== d.id) return s;
          const n = { ...s };
          if (d.corner === "nw") {
            n.x0 = Math.min(fx, s.x1 - 0.02);
            n.y0 = Math.min(fy, s.y1 - 0.02);
          } else if (d.corner === "ne") {
            n.x1 = Math.max(fx, s.x0 + 0.02);
            n.y0 = Math.min(fy, s.y1 - 0.02);
          } else if (d.corner === "sw") {
            n.x0 = Math.min(fx, s.x1 - 0.02);
            n.y1 = Math.max(fy, s.y0 + 0.02);
          } else {
            n.x1 = Math.max(fx, s.x0 + 0.02);
            n.y1 = Math.max(fy, s.y0 + 0.02);
          }
          return n;
        })
      );
    } else if (d.mode === "draw") {
      setSecs((prev) =>
        prev.map((s) =>
          s.id === d.id
            ? {
                ...s,
                x0: Math.min(d.sx, fx),
                y0: Math.min(d.sy, fy),
                x1: Math.max(d.sx, fx),
                y1: Math.max(d.sy, fy),
              }
            : s
        )
      );
    }
  }, []);

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    if (d?.mode === "draw") {
      // discard boxes that are too small to be a real section
      setSecs((prev) => prev.filter((s) => !(s.id === d.id && (s.x1 - s.x0 < 0.03 || s.y1 - s.y0 < 0.02))));
    }
    dragRef.current = null;
  }, [onPointerMove]);

  const beginDrag = (state: DragState, pageEl: HTMLElement) => {
    rectRef.current = pageEl.getBoundingClientRect();
    dragRef.current = state;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  };

  const startBackground = (e: React.PointerEvent, page: number) => {
    if (e.button !== 0) return;
    const pageEl = e.currentTarget as HTMLElement;
    rectRef.current = pageEl.getBoundingClientRect();
    const { fx, fy } = fracFromEvent(e);
    const id = newId();
    setSecs((prev) => [
      ...prev,
      { id, page, x0: fx, y0: fy, x1: fx, y1: fy, title: "", section: "community", include: true },
    ]);
    setSelected(id);
    beginDrag({ mode: "draw", page, sx: fx, sy: fy, id }, pageEl);
  };

  const startMove = (e: React.PointerEvent, s: Sec) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(s.id);
    const pageEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    rectRef.current = pageEl.getBoundingClientRect();
    const { fx, fy } = fracFromEvent(e);
    beginDrag({ mode: "move", id: s.id, ox: fx - s.x0, oy: fy - s.y0, box: s }, pageEl);
  };

  const startResize = (e: React.PointerEvent, s: Sec, corner: "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(s.id);
    const pageEl = ((e.currentTarget as HTMLElement).parentElement as HTMLElement).parentElement as HTMLElement;
    beginDrag({ mode: "resize", id: s.id, corner }, pageEl);
  };

  const updateSec = (id: string, patch: Partial<Sec>) =>
    setSecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSec = (id: string) => setSecs((prev) => prev.filter((s) => s.id !== id));

  async function onPublish() {
    setError(null);
    const chosen = secs.filter((s) => s.include);
    const missingTitle = chosen.some((s) => s.title.trim() === "");
    if (missingTitle) {
      setError("לכל מקטע שנבחר לפרסום יש להזין כותרת.");
      return;
    }
    if (chosen.length === 0 && !publishFull) {
      setError("בחר לפחות מקטע אחד לפרסום, או סמן פרסום הידיעון המלא.");
      return;
    }
    setPhase("publishing");
    const payload: PublishSection[] = chosen.map((s) => ({
      page: s.page,
      x0: s.x0,
      y0: s.y0,
      x1: s.x1,
      y1: s.y1,
      title: s.title.trim(),
      section: s.section,
    }));
    const res = await publishNewsletter({
      token,
      sections: payload,
      publishFull,
      fullTitle,
      fullSection,
    });
    if ("error" in res) {
      setError(res.error);
      setPhase("review");
      return;
    }
    // reset back to idle with a success notice
    setPhase("idle");
    setPages([]);
    setSecs([]);
    setToken("");
    setPublishFull(false);
    setNotice(`פורסמו ${res.count} פריטים לתפריט. אפשר לראות ולערוך אותם בלשונית „קהילה”.`);
    router.refresh();
  }

  function reset() {
    setPhase("idle");
    setPages([]);
    setSecs([]);
    setToken("");
    setSelected(null);
    setError(null);
    setNotice(null);
  }

  const includedCount = secs.filter((s) => s.include).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {notice && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {phase === "idle" && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold">פיצול ידיעון למקטעים</h2>
            <p className="mt-1 text-sm text-gray-600">
              העלה את קובץ הידיעון (PDF). המערכת תחתוך אותו למקטעים — {aiConfigured ? "ה-AI יציע היכן לחתוך," : "סמן ידנית היכן לחתוך,"}{" "}
              ואתה תחליט אילו מקטעים לפרסם ולאיזה מדור. כל מקטע מתפרסם כפריט מסמך בתפריט.
            </p>
            {!aiConfigured && (
              <p className="mt-1 text-xs text-amber-700">
                מנוע ה-AI אינו מוגדר כרגע — עדיין אפשר לחתוך ידנית. להפעלת ההצעות האוטומטיות יש להגדיר מפתח AI ב-Vercel.
              </p>
            )}
          </div>
          <form
            action={async (fd) => {
              await onAnalyze(fd);
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="block text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
            />
            <button type="submit" className="btn-primary">
              נתח ידיעון
            </button>
          </form>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="card text-center text-sm text-gray-600">
          מעבד את הידיעון{aiConfigured ? " ומריץ ניתוח AI" : ""}… זה עשוי לקחת מספר שניות.
        </div>
      )}

      {(phase === "review" || phase === "publishing") && (
        <>
          <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-soft backdrop-blur">
            <div className="text-sm text-gray-700">
              {usedAi ? "ה-AI הציע מקטעים — " : ""}
              נבחרו <span className="font-semibold">{includedCount}</span> מקטעים לפרסום.
              <span className="mr-2 text-xs text-gray-500">גרור מלבן על עמוד כדי להוסיף מקטע; גרור מלבן קיים כדי להזיז; גרור פינה כדי לשנות גודל.</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" onClick={reset} disabled={phase === "publishing"}>
                התחל מחדש
              </button>
              <button className="btn-primary" onClick={onPublish} disabled={phase === "publishing"}>
                {phase === "publishing" ? "מפרסם…" : "פרסם את הנבחרים"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={publishFull} onChange={(e) => setPublishFull(e.target.checked)} />
              פרסם גם את הידיעון המלא (PDF) כפריט נפרד
            </label>
            {publishFull && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="field max-w-xs"
                  value={fullTitle}
                  onChange={(e) => setFullTitle(e.target.value)}
                  placeholder="כותרת הידיעון המלא"
                />
                <select className="field max-w-[10rem]" value={fullSection} onChange={(e) => setFullSection(e.target.value as SectionKey)}>
                  {(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => (
                    <option key={k} value={k}>
                      {SECTION_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {pages.map((pg) => {
              const pageSecs = secs.filter((s) => s.page === pg.index);
              return (
                <div key={pg.index} className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">עמוד {pg.index + 1}</div>
                  <div className="flex flex-col gap-4 lg:flex-row">
                    {/* Page image with crop boxes */}
                    <div
                      dir="ltr"
                      className="relative w-full max-w-xl shrink-0 touch-none select-none overflow-hidden rounded-lg border border-gray-300 bg-white"
                      style={{ aspectRatio: `${pg.w} / ${pg.h}` }}
                      onPointerDown={(e) => startBackground(e, pg.index)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pg.url} alt={`עמוד ${pg.index + 1}`} className="pointer-events-none block w-full" draggable={false} />
                      {pageSecs.map((s) => {
                        const isSel = s.id === selected;
                        return (
                          <div
                            key={s.id}
                            onPointerDown={(e) => startMove(e, s)}
                            className={`absolute cursor-move border-2 ${
                              s.include ? (isSel ? "border-brand-600 bg-brand-500/15" : "border-brand-500/80 bg-brand-500/10") : "border-gray-400 bg-gray-400/10"
                            }`}
                            style={{
                              left: `${s.x0 * 100}%`,
                              top: `${s.y0 * 100}%`,
                              width: `${(s.x1 - s.x0) * 100}%`,
                              height: `${(s.y1 - s.y0) * 100}%`,
                            }}
                          >
                            <span className="absolute -top-0 right-0 max-w-full truncate bg-brand-600 px-1 text-[10px] leading-4 text-white" dir="rtl">
                              {s.title || "ללא כותרת"}
                            </span>
                            {(["nw", "ne", "sw", "se"] as const).map((c) => (
                              <span
                                key={c}
                                onPointerDown={(e) => startResize(e, s, c)}
                                className="absolute h-3 w-3 rounded-full border border-white bg-brand-600"
                                style={{
                                  left: c === "nw" || c === "sw" ? -6 : undefined,
                                  right: c === "ne" || c === "se" ? -6 : undefined,
                                  top: c === "nw" || c === "ne" ? -6 : undefined,
                                  bottom: c === "sw" || c === "se" ? -6 : undefined,
                                  cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                                }}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* This page's sections list */}
                    <div className="flex-1 space-y-2">
                      {pageSecs.length === 0 && (
                        <p className="text-sm text-gray-500">אין מקטעים בעמוד זה. גרור מלבן על התמונה כדי להוסיף.</p>
                      )}
                      {pageSecs.map((s) => (
                        <div
                          key={s.id}
                          className={`rounded-lg border p-2 ${s.id === selected ? "border-brand-400 bg-brand-50" : "border-gray-200"}`}
                          onClick={() => setSelected(s.id)}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={s.include}
                              onChange={(e) => updateSec(s.id, { include: e.target.checked })}
                              title="לכלול בפרסום"
                            />
                            <input
                              className="field flex-1"
                              value={s.title}
                              placeholder="כותרת המקטע (תוצג בתפריט)"
                              onChange={(e) => updateSec(s.id, { title: e.target.value })}
                              onFocus={() => setSelected(s.id)}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-gray-600">מדור:</label>
                            <select
                              className="field max-w-[11rem] py-1 text-sm"
                              value={s.section}
                              onChange={(e) => updateSec(s.id, { section: e.target.value as TargetKey })}
                            >
                              {(Object.keys(TARGET_LABELS) as TargetKey[]).map((k) => (
                                <option key={k} value={k}>
                                  {TARGET_LABELS[k]}
                                </option>
                              ))}
                            </select>
                            <button
                              className="mr-auto text-sm text-red-600 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSec(s.id);
                              }}
                            >
                              מחיקה
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pb-4">
            <button className="btn-secondary" onClick={reset} disabled={phase === "publishing"}>
              התחל מחדש
            </button>
            <button className="btn-primary" onClick={onPublish} disabled={phase === "publishing"}>
              {phase === "publishing" ? "מפרסם…" : "פרסם את הנבחרים"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
