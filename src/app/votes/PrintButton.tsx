"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      הדפסה / שמירה כ-PDF
    </button>
  );
}
