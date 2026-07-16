"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, fullName, type Resident, type UserRole } from "@/lib/types";
import { formatIsraeliPhone } from "@/lib/phone";
import { createUser, updateUserRole, deleteUser } from "./actions";
import type { AdminUserRow } from "./AdminTabs";

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A resident who already has an account cannot get a second one.
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
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createUser, fd)) setAdding(false);
          }}
        >
          <h2 className="font-semibold">משתמש חדש</h2>
          <p className="text-sm text-gray-600">
            המשתמש נוצר עבור תושב קיים. הכניסה תתבצע עם מספר הטלפון הרשום לתושב.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="resident_id">
                תושב *
              </label>
              <select id="resident_id" name="resident_id" className="field" required>
                <option value="">— בחר תושב —</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.first_name} {r.last_name} — {formatIsraeliPhone(r.phone)}
                  </option>
                ))}
              </select>
              {available.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  לכל התושבים כבר קיים חשבון. הוסף תושב חדש תחילה.
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

            <div>
              <label className="label" htmlFor="email">
                אימייל (לא חובה)
              </label>
              <input id="email" name="email" type="email" className="field" dir="ltr" />
              <p className="mt-1 text-xs text-gray-500">נדרש רק לכניסה דרך Google.</p>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={busy || available.length === 0}>
            {busy ? "יוצר..." : "יצירת משתמש"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-3">שם</th>
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
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                  אין משתמשים במערכת.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium">
                  {fullName(u.resident)}
                  {u.id === currentUserId && (
                    <span className="mr-2 text-xs text-gray-500">(אתה)</span>
                  )}
                </td>
                <td className="px-3 py-3" dir="ltr">
                  {u.resident_id}
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
                        if (!confirm(`למחוק את המשתמש ${fullName(u.resident)}?`)) {
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
