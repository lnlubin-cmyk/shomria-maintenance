"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, staffName, type Resident, type UserRole } from "@/lib/types";
import { formatIsraeliPhone } from "@/lib/phone";
import { createUser, updateUserRole, deleteUser } from "./actions";
import type { AdminUserRow } from "./AdminTabs";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
// A non-resident account can only hold these roles.
const EXTERNAL_ROLES: UserRole[] = ["maintenance", "maintenance_manager"];

type NewUserKind = "resident" | "external";

export default function UsersTab({
  users,
  residents,
  currentUserId,
}: {
  users: AdminUserRow[];
  residents: Resident[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<NewUserKind>("resident");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A resident who already has an account cannot get a second one. Login is by
  // phone (or email, if the resident has one), so any unlinked resident is
  // eligible — an email is no longer required.
  const linkedIds = new Set(users.map((u) => u.resident_id));
  const available = residents.filter((r) => !linkedIds.has(r.id));

  async function run(action: (fd: FormData) => Promise<any>, fd: FormData) {
    setError(null);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);

    if (result && "error" in result) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{users.length} משתמשים</span>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? "ביטול" : "הוספת משתמש"}
        </button>
      </div>

      {adding && (
        <form
          key={kind}
          className="card space-y-4"
          action={async (fd) => {
            fd.set("kind", kind);
            if (await run(createUser, fd)) {
              setAdding(false);
              setKind("resident");
            }
          }}
        >
          <h2 className="font-semibold">משתמש חדש</h2>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind("resident")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                kind === "resident"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              תושב קיים
            </button>
            <button
              type="button"
              onClick={() => setKind("external")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                kind === "external"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600"
              }`}
            >
              עובד תחזוקה חיצוני
            </button>
          </div>

          {kind === "resident" ? (
            <>
              <p className="text-sm text-gray-600">
                המשתמש נוצר עבור תושב קיים. הכניסה תתבצע עם מספר הטלפון הרשום לתושב (או האימייל, אם
                קיים) וקוד אימות ב-SMS.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="resident_id">
                    תושב *
                  </label>
                  <select id="resident_id" name="resident_id" className="field" required>
                    <option value="">— בחר תושב —</option>
                    {available.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name} — {r.email ?? formatIsraeliPhone(r.phone)}
                      </option>
                    ))}
                  </select>
                  {available.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      אין תושבים זמינים. כל התושבים כבר קושרו לחשבון.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="role">
                    סוג משתמש *
                  </label>
                  <select id="role" name="role" className="field" defaultValue="resident" required>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={busy || available.length === 0}>
                {busy ? "יוצר..." : "יצירת משתמש"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                עובד תחזוקה שאינו תושב הישוב (למשל קבלן חיצוני). הכניסה תתבצע עם האימייל שתזין וקוד
                אימות.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="first_name">
                    שם פרטי *
                  </label>
                  <input id="first_name" name="first_name" className="field" required />
                </div>
                <div>
                  <label className="label" htmlFor="last_name">
                    שם משפחה *
                  </label>
                  <input id="last_name" name="last_name" className="field" required />
                </div>
                <div>
                  <label className="label" htmlFor="ext_email">
                    אימייל *
                  </label>
                  <input id="ext_email" name="email" type="email" dir="ltr" className="field" required />
                </div>
                <div>
                  <label className="label" htmlFor="ext_phone">
                    טלפון
                  </label>
                  <input
                    id="ext_phone"
                    name="phone"
                    dir="ltr"
                    className="field"
                    placeholder="050-123-4567"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ext_role">
                    סוג משתמש *
                  </label>
                  <select id="ext_role" name="role" className="field" defaultValue="maintenance" required>
                    {EXTERNAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "יוצר..." : "יצירת משתמש"}
              </button>
            </>
          )}
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-3">שם</th>
              <th className="px-3 py-3">סוג</th>
              <th className="px-3 py-3">תעודת זהות</th>
              <th className="px-3 py-3">טלפון</th>
              <th className="px-3 py-3">אימייל</th>
              <th className="px-3 py-3">סוג משתמש</th>
              <th className="px-3 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                  אין משתמשים במערכת.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium">
                  {staffName(u)}
                  {u.id === currentUserId && (
                    <span className="mr-2 text-xs text-gray-500">(אתה)</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">
                  {u.resident_id ? "תושב" : "חיצוני"}
                </td>
                <td className="px-3 py-3" dir="ltr">
                  {u.resident_id ?? "—"}
                </td>
                <td className="px-3 py-3" dir="ltr">
                  {u.phone ? formatIsraeliPhone(u.phone) : "—"}
                </td>
                <td className="px-3 py-3" dir="ltr">
                  {u.email || "—"}
                </td>
                <td className="px-3 py-3">
                  <form
                    action={async (fd) => {
                      await run(updateUserRole, fd);
                    }}
                  >
                    <input type="hidden" name="user_id" value={u.id} />
                    <select
                      name="role"
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      defaultValue={u.role}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </form>
                </td>
                <td className="px-3 py-3">
                  {u.id !== currentUserId && (
                    <form
                      action={async (fd) => {
                        await run(deleteUser, fd);
                      }}
                      onSubmit={(e) => {
                        if (!confirm(`למחוק את המשתמש ${staffName(u)}?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="user_id" value={u.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        מחיקה
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
