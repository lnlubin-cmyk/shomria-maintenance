"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitFeedback } from "./actions";

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="text-lg leading-none" dir="ltr" aria-label={`${value} מתוך ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? "text-amber-400" : "text-gray-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * The caller rates the handling of a finished call (1-5). Once submitted it
 * shows read-only — the rating itself is only ever visible to מנהל תחזוקה/admin.
 */
export default function FeedbackStars({
  faultNumber,
  rating,
}: {
  faultNumber: number;
  rating: number | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rating != null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>הדירוג שלך לטיפול:</span>
        <Stars value={rating} />
      </div>
    );
  }

  async function submit() {
    if (picked < 1) return;
    setError(null);
    setBusy(true);
    const res = await submitFeedback(faultNumber, picked);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const shown = hover || picked;

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">עד כמה אתם מרוצים מהטיפול בקריאה?</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex" dir="ltr" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} כוכבים`}
              disabled={busy}
              onMouseEnter={() => setHover(n)}
              onClick={() => setPicked(n)}
              className={`px-0.5 text-2xl leading-none transition ${
                n <= shown ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || picked < 1}
          className="btn-secondary disabled:opacity-50"
        >
          {busy ? "שולח…" : "שליחת דירוג"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
