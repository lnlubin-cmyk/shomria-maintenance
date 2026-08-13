"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";

export type MoveMode = "existing" | "new" | "left";
export type MoveRow = { source: string; mode: MoveMode; target: string | null };
export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type B = any;
const residentsOf = (b: B) => [b.resident_1, b.resident_2, b.resident_3, b.resident_4] as (string | null)[];
const residentCols = (rs: (string | null)[]) => ({
  resident_1: rs[0] ?? null,
  resident_2: rs[1] ?? null,
  resident_3: rs[2] ?? null,
  resident_4: rs[3] ?? null,
});

/**
 * Apply a batch of family moves. The PHYSICAL houses never move — only the
 * family (its residents + the house name) moves between plots, so fault history
 * stays with each physical house.
 *
 * Per row: move the source family to an existing target, to a brand-new
 * (unplaced) house, or nowhere ("left Shomria"). A source that no family moves
 * into becomes "ריק (<name> לשעבר)". Computed as snapshot-then-assign so chains
 * and swaps work.
 */
export async function applyMoves(rows: MoveRow[]): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const clean = (rows ?? []).filter((r) => r?.source);
  if (clean.length === 0) return { error: "לא הוגדרו מעברים" };

  const admin = createAdminClient();
  const { data: all } = await admin
    .from("buildings")
    .select("plot_number, building_name, street_name, layer_id, resident_1, resident_2, resident_3, resident_4");
  const byPlot = new Map<string, B>((all ?? []).map((b: B) => [String(b.plot_number), b]));

  // ---- validate ----
  const sources = clean.map((r) => r.source);
  if (new Set(sources).size !== sources.length) return { error: "אותו בית מקור מופיע ביותר משורה אחת" };
  for (const r of clean) {
    if (!byPlot.has(r.source)) return { error: "בית מקור לא נמצא" };
    if (r.mode === "existing") {
      if (!r.target) return { error: "יש לבחור בית יעד" };
      if (!byPlot.has(r.target)) return { error: "בית יעד לא נמצא" };
      if (r.target === r.source) return { error: "בית מקור ויעד זהים" };
    }
  }
  const existingTargets = clean.filter((r) => r.mode === "existing").map((r) => r.target!);
  if (new Set(existingTargets).size !== existingTargets.length)
    return { error: "אותו בית יעד מופיע ביותר משורה אחת" };

  // ---- snapshot every source family BEFORE any writes ----
  const familyOf = new Map<string, { name: string; residents: (string | null)[] }>();
  for (const r of clean) {
    const b = byPlot.get(r.source)!;
    familyOf.set(r.source, { name: b.building_name ?? "", residents: residentsOf(b) });
  }

  // ---- generate new plot numbers ----
  const nums = (all ?? []).map((b: B) => parseInt(String(b.plot_number), 10)).filter((n: number) => !isNaN(n));
  let nextPlot = (nums.length ? Math.max(...nums) : 1000) + 1;

  // ---- compute assignments (target plot -> new family) + new inserts ----
  type Assign = { plot: string; name: string; residents: (string | null)[] };
  const updates: Assign[] = [];
  const inserts: (Assign & { layer_id: number | null; street_name: string | null })[] = [];
  const targeted = new Set<string>();

  for (const r of clean) {
    const fam = familyOf.get(r.source)!;
    if (r.mode === "existing") {
      targeted.add(r.target!);
      updates.push({ plot: r.target!, name: fam.name, residents: fam.residents });
    } else if (r.mode === "new") {
      const src = byPlot.get(r.source)!;
      const plot = String(nextPlot++);
      inserts.push({ plot, name: fam.name, residents: fam.residents, layer_id: src.layer_id ?? null, street_name: src.street_name ?? null });
    }
    // "left" → family goes nowhere
  }

  // ---- vacated sources (no family moved in) → "ריק (<name> לשעבר)" ----
  for (const r of clean) {
    if (targeted.has(r.source)) continue; // someone moved in here
    const orig = familyOf.get(r.source)!.name;
    const vacantName = orig.startsWith("ריק ") ? orig : `ריק (${orig} לשעבר)`;
    updates.push({ plot: r.source, name: vacantName, residents: [null, null, null, null] });
  }

  // ---- apply ----
  try {
    for (const ins of inserts) {
      const { error } = await admin.from("buildings").insert({
        plot_number: ins.plot,
        building_name: ins.name,
        street_name: ins.street_name,
        layer_id: ins.layer_id,
        ...residentCols(ins.residents),
      });
      if (error) throw new Error(error.message);
    }
    for (const u of updates) {
      const { error } = await admin
        .from("buildings")
        .update({ building_name: u.name, ...residentCols(u.residents) })
        .eq("plot_number", u.plot);
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    console.error("applyMoves failed:", e);
    return { error: "ביצוע המעברים נכשל. ייתכן שחלק מהשינויים בוצעו — בדוק את רשימת המבנים." };
  }

  revalidatePath("/admin");
  revalidatePath("/map");
  return { ok: true };
}
