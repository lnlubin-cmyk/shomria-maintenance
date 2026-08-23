"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MoveHouse } from "@/lib/houses";
import { applyMoves, type MoveMode, type MoveRow } from "./move-actions";

type Row = { id: number; source: string; mode: MoveMode; target: string; newName: string };

const EMPTY_ROW = (id: number): Row => ({ id, source: "", mode: "existing", target: "", newName: "" });

const houseLabel = (h?: MoveHouse) => (h ? `${h.building_name} (${h.plot_number})` : "");

export default function MoveTab({ houses }: { houses: MoveHouse[] }) {
  const router = useRouter();
  const occupied = useMemo(() => houses.filter((h) => h.occupied), [houses]);
  const byPlot = useMemo(() => new Map(houses.map((h) => [h.plot_number, h])), [houses]);

  const [rows, setRows] = useState<Row[]>([EMPTY_ROW(1)]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const addRow = () => setRows((r) => [...r, EMPTY_ROW(Math.max(0, ...r.map((x) => x.id)) + 1)]);
  const removeRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const patch = (id: number, p: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const preview = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const changes: string[] = [];
    const norm = (s: string) => s.trim().replace(/\s+/g, " ");

    const sourceRows = rows.filter((r) => r.mode !== "arrive" && r.source);
    const arriveRows = rows.filter((r) => r.mode === "arrive" && (r.newName.trim() || r.target));

    const sources = sourceRows.map((r) => r.source);
    if (new Set(sources).size !== sources.length) errors.push("אותו בית מקור נבחר ביותר מפעם אחת.");
    const allTargets = [
      ...sourceRows.filter((r) => r.mode === "existing" && r.target).map((r) => r.target),
      ...arriveRows.filter((r) => r.target).map((r) => r.target),
    ];
    if (new Set(allTargets).size !== allTargets.length) errors.push("אותו בית יעד נבחר ביותר מפעם אחת.");

    rows.forEach((r, i) => {
      if (r.mode === "arrive") {
        if (!(r.newName.trim() || r.target)) return; // untouched row
        if (!r.newName.trim()) errors.push(`שורה ${i + 1}: יש להזין שם למשפחה החדשה.`);
        if (!r.target) errors.push(`שורה ${i + 1}: יש לבחור בית יעד.`);
        if (r.newName.trim() && houses.some((h) => norm(h.building_name) === norm(r.newName))) {
          warnings.push(`השם „${r.newName.trim()}” כבר קיים ברשימת הבתים — אפשר להתעלם או לשנות את השם (למשל להוסיף שמות פרטיים).`);
        }
        return;
      }
      if (!r.source) return;
      if (r.mode === "existing" && !r.target) errors.push(`שורה ${i + 1}: יש לבחור בית יעד.`);
      if (r.mode === "existing" && r.target === r.source) errors.push(`שורה ${i + 1}: מקור ויעד זהים.`);
    });

    const targeted = new Set(allTargets);

    for (const r of sourceRows) {
      const fam = byPlot.get(r.source)?.building_name ?? r.source;
      if (r.mode === "new") changes.push(`משפחת ${fam} → בית חדש (יווצר ללא מיקום; יש למקם במפה)`);
      else if (r.mode === "left") changes.push(`משפחת ${fam} → עזבה את שומריה`);
      else if (r.target) {
        changes.push(`משפחת ${fam} עוברת לבית „${byPlot.get(r.target)?.building_name}”`);
        if (byPlot.get(r.target)?.occupied && !sources.includes(r.target)) {
          warnings.push(`בית היעד „${byPlot.get(r.target)?.building_name}” מאוכלס ואינו עובר דירה בעצמו — המשפחה הקיימת בו תוחלף.`);
        }
      }
    }
    for (const r of arriveRows) {
      if (!r.newName.trim() || !r.target) continue;
      const tgt = byPlot.get(r.target);
      changes.push(`משפחה חדשה „${r.newName.trim()}” → בית „${tgt?.building_name}”`);
      if (tgt?.occupied && !sources.includes(r.target)) {
        warnings.push(`בית היעד „${tgt?.building_name}” מאוכלס ואינו עובר דירה בעצמו — המשפחה הקיימת בו תוחלף.`);
      }
    }
    for (const r of sourceRows) {
      if (!targeted.has(r.source)) {
        const n = byPlot.get(r.source)?.building_name ?? r.source;
        changes.push(`בית „${n}” יתפנה ויסומן: ריק (${n} לשעבר)`);
      }
    }
    return { errors, warnings, changes, anyActive: sourceRows.length > 0 || arriveRows.length > 0 };
  }, [rows, byPlot, houses]);

  async function confirm() {
    setError(null);
    setBusy(true);
    const payload: MoveRow[] = rows
      .filter((r) => (r.mode === "arrive" ? r.newName.trim() && r.target : r.source))
      .map((r) =>
        r.mode === "arrive"
          ? { source: "", mode: "arrive" as const, target: r.target, newName: r.newName.trim() }
          : { source: r.source, mode: r.mode, target: r.mode === "existing" ? r.target : null }
      );
    const res = await applyMoves(payload);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setConfirming(false);
    setRows([EMPTY_ROW(1)]);
    setMsg("המעברים בוצעו בהצלחה.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        העברת משפחות בין בתים. הבית הפיזי (וההיסטוריה שלו) נשאר במקומו — רק המשפחה (התושבים ושם הבית)
        עוברת. „בית חדש” יוצר בית ללא מיקום (יש למקם אותו במפה לאחר מכן). „עזבו את שומריה” — הבית מתפנה.
        „משפחה חדשה שהגיעה” — משפחה שנכנסת לשומריה: הזן את שם המשפחה ובחר בית יעד (תוצג אזהרה אם השם כבר קיים).
      </div>

      {!confirming ? (
        <>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">מעבר #{i + 1}</span>
                  <button className="text-sm text-red-600 hover:underline disabled:opacity-40" disabled={rows.length === 1} onClick={() => removeRow(r.id)}>
                    הסרה
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    {r.mode === "arrive" ? (
                      <>
                        <label className="label">שם המשפחה החדשה</label>
                        <input
                          className="field"
                          value={r.newName}
                          placeholder="לדוגמה: כהן"
                          onChange={(e) => patch(r.id, { newName: e.target.value })}
                        />
                      </>
                    ) : (
                      <>
                        <label className="label">בית מקור (המשפחה שעוברת)</label>
                        <select className="field" value={r.source} onChange={(e) => patch(r.id, { source: e.target.value })}>
                          <option value="">בחר בית…</option>
                          {occupied.map((h) => (
                            <option key={h.plot_number} value={h.plot_number}>{houseLabel(h)}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="label">בית יעד</label>
                    <select
                      className="field disabled:bg-gray-100"
                      value={r.target}
                      disabled={r.mode !== "existing" && r.mode !== "arrive"}
                      onChange={(e) => patch(r.id, { target: e.target.value })}
                    >
                      <option value="">בחר בית…</option>
                      {houses.filter((h) => h.plot_number !== r.source).map((h) => (
                        <option key={h.plot_number} value={h.plot_number}>{houseLabel(h)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.mode === "new"}
                      onChange={(e) => patch(r.id, { mode: e.target.checked ? "new" : "existing", target: "" })}
                    />
                    בית חדש
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.mode === "left"}
                      onChange={(e) => patch(r.id, { mode: e.target.checked ? "left" : "existing", target: "" })}
                    />
                    עזבו את שומריה
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.mode === "arrive"}
                      onChange={(e) => patch(r.id, { mode: e.target.checked ? "arrive" : "existing", source: "" })}
                    />
                    משפחה חדשה שהגיעה
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={addRow}>+ הוספת מעבר</button>
            <button
              className="btn-primary disabled:opacity-50"
              disabled={preview.errors.length > 0 || !preview.anyActive}
              onClick={() => { setError(null); setMsg(null); setConfirming(true); }}
            >
              המשך לאישור
            </button>
          </div>

          {preview.errors.length > 0 && (
            <ul className="list-inside list-disc rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </>
      ) : (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">אישור המעברים</h2>

          <ul className="list-inside list-disc space-y-1 text-sm text-gray-800">
            {preview.changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>

          {preview.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <div className="mb-1 font-medium">שים לב:</div>
              <ul className="list-inside list-disc space-y-1">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-3">
            <button className="btn-primary disabled:opacity-50" disabled={busy} onClick={confirm}>
              {busy ? "מבצע…" : "בצע מעבר"}
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>
              חזרה לעריכה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
