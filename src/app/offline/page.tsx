import Logo from "@/components/Logo";

export const metadata = { title: "אין חיבור — קהילת עצמונה-שומריה" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-xl font-bold text-gray-900">אין חיבור לאינטרנט</h1>
        <p className="mt-2 text-sm text-gray-600">
          האפליקציה דורשת חיבור לרשת. בדקו את החיבור ונסו שוב.
        </p>
      </div>
    </main>
  );
}
