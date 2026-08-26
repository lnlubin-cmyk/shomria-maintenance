import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/supabase/server";
import { getMenuDocs } from "@/lib/community";
import { momentsExist } from "@/lib/moments";
import { getInfoPanels, isPanelConfigured, panelHref } from "@/lib/info-panels";
import { getActiveHomeMedia } from "@/lib/home-media";
import { getActiveCampaign } from "@/lib/campaigns";
import AppHeader from "@/components/AppHeader";
import HeroCarousel from "@/components/HeroCarousel";
import CampaignModal from "@/components/CampaignModal";
import Logo from "@/components/Logo";
import { isStaff } from "@/lib/types";

/** Line clock icon (Lucide) for the "זמני תפילות" tile. */
function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.4 2" />
    </svg>
  );
}

/** Shopping-cart icon (Lucide) for the "מכולת" tile. */
function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

/** Stethoscope icon (Lucide) for the "מרפאה" tile. */
function MedicalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

/** Per-panel tile icon + description (keyed by slug). */
const PANEL_ICON: Record<string, React.ReactNode> = { store: <CartIcon />, clinic: <MedicalIcon /> };
const PANEL_DESC: Record<string, string> = {
  store: "שעות פתיחה ומידע על המכולת.",
  clinic: "שעות פעילות ומידע על המרפאה.",
};

/**
 * A portal tile. A working tile links somewhere and lifts on hover; a "בקרוב"
 * tile is inert and shows a coming-soon badge (feature not built yet).
 */
function Tile({
  href,
  icon,
  title,
  desc,
  soon,
  tone = "brand",
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  soon?: boolean;
  tone?: "brand" | "accent";
}) {
  const iconTone =
    tone === "accent" ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-600";

  const inner = (
    <div
      className={`card flex h-full items-start gap-4 transition-all duration-200 ${
        soon
          ? "opacity-60"
          : "group-hover:-translate-y-1 group-hover:border-brand-200 group-hover:shadow-lg group-hover:ring-1 group-hover:ring-brand-100"
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl transition-transform duration-200 ${iconTone} ${
          soon ? "" : "group-hover:scale-110 group-hover:-rotate-3"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {soon && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              בקרוב
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );

  if (soon || !href) {
    return (
      <div aria-disabled="true" className="group cursor-default">
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} className="group block">
      {inner}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div data-reveal className="mb-5 flex items-center gap-3">
      <span className="h-6 w-1.5 rounded-full bg-brown-600" />
      <h2 className="text-xl font-bold text-gray-900">{children}</h2>
    </div>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const staff = session ? isStaff(session.user.role) : false;
  // Fetch the independent data concurrently rather than one round trip at a time.
  const [{ community, info, torah }, hasMoments, media, campaign, panels] = await Promise.all([
    session ? getMenuDocs() : Promise.resolve({ community: [], info: [], torah: [] }),
    session ? momentsExist() : Promise.resolve(false),
    getActiveHomeMedia(),
    getActiveCampaign(),
    getInfoPanels(),
  ]);
  const infoPanels = panels.filter(isPanelConfigured);

  return (
    <div className="min-h-screen bg-gray-50">
      {campaign && <CampaignModal campaign={campaign} loggedIn={!!session} />}
      <AppHeader session={session} />

      <main>
        {/* Hero band — full-bleed media with the heading laid over a dark scrim. */}
        <section className="relative w-full overflow-hidden bg-black">
          {/* Admin-managed media carousel, or a static image if none. */}
          {media.length > 0 ? (
            <HeroCarousel items={media} bare heightClass="h-[380px] sm:h-[480px] lg:h-[560px]" />
          ) : (
            <div className="relative h-[380px] w-full sm:h-[480px] lg:h-[560px]">
              <Image
                src="/hero.svg"
                alt="איור של מבני הקיבוץ"
                fill
                priority
                className="animate-kenburns object-cover"
              />
            </div>
          )}

          {/* Legibility scrim (darkest at the bottom, where the text sits). */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

          {/* Heading overlay, aligned to the page content width. pointer-events-none
              lets the carousel controls underneath stay clickable; the CTA re-enables
              its own clicks. */}
          <div className="pointer-events-none absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl flex-col items-start justify-end px-4 pb-6 sm:pb-8">
              <h1
                data-reveal
                className="text-2xl font-bold leading-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.6)] sm:text-3xl lg:text-4xl"
              >
                מידע ושירות לתושב
              </h1>

              {!session && (
                <div className="pointer-events-auto mt-4">
                  <Link href="/login" className="btn-primary">
                    כניסה / רישום
                  </Link>
                  <p className="mt-2 text-sm text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
                    השירותים פתוחים לחברי הישוב לאחר כניסה למערכת.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Scroll cue — hints there's more below the fold. */}
          {session && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <svg
                className="animate-bob h-6 w-6 text-white/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          )}
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12">
          {/* תורה ותפילה — shown first */}
          <section>
            <SectionTitle>תורה ותפילה</SectionTitle>
            <div data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Tile href="/prayer-times" tone="accent" icon={<ClockIcon />} title="זמני תפילות" desc="זמני התפילות והמניינים בישוב." />
              <Tile href="/torah-lessons" tone="accent" icon="📖" title="שיעורי תורה" desc="שיעורי התורה בישוב." />
              <Tile href="/halachic-times" tone="accent" icon="🕰️" title="זמנים הלכתיים" desc="זמני היום לפי התאריך העברי." />
              <Tile href="/eruv" tone="accent" icon="🔗" title="קו העירוב" desc="מפת היקף העירוב וכללי הטלטול בשבת." />
              {torah.map((d) => (
                <Tile
                  key={d.id}
                  href={`/community/${d.id}`}
                  tone="accent"
                  icon={d.icon || "📄"}
                  title={d.subject}
                  desc={d.description || "לחצו לצפייה."}
                />
              ))}
              {session?.user.role === "gabbai" && (
                <Tile
                  href="/admin"
                  tone="accent"
                  icon="🛠️"
                  title="ניהול תורה ותפילה"
                  desc="עדכון זמני תפילות, שיעורי תורה וזמנים הלכתיים."
                />
              )}
            </div>
          </section>

          {/* מידע לתושב */}
          <section className="mt-12">
            <SectionTitle>מידע לתושב</SectionTitle>
            <div data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Tile href="/map" tone="accent" icon="🗺️" title="חפש בית בישוב" desc="מציאת בית של משפחה על מפת הישוב." />
              <Tile href="/phone-directory" tone="accent" icon="📞" title="חפש מספר טלפון" desc="ספר טלפונים של חברי הישוב." />
              {infoPanels.map((p) => (
                <Tile
                  key={p.slug}
                  href={panelHref(p.slug)}
                  tone="accent"
                  icon={PANEL_ICON[p.slug] ?? "📄"}
                  title={p.menu_label}
                  desc={PANEL_DESC[p.slug] ?? ""}
                />
              ))}
              {info.map((d) => (
                <Tile
                  key={d.id}
                  href={`/community/${d.id}`}
                  tone="accent"
                  icon={d.icon || "📄"}
                  title={d.subject}
                  desc={d.description || "לחצו לצפייה."}
                />
              ))}
            </div>
          </section>

          {/* קהילה — dynamic, admin-managed items + the "רגעים שזוכרים" gallery
              (shown only when there's something to show) */}
          {(community.length > 0 || hasMoments) && (
            <section className="mt-12">
              <SectionTitle>קהילה</SectionTitle>
              <div data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {hasMoments && (
                  <Tile
                    href="/moments"
                    tone="accent"
                    icon="🎬"
                    title="רגעים שזוכרים"
                    desc="רגעים ואירועים היסטוריים מחיי הקהילה."
                  />
                )}
                {community.map((c) => (
                  <Tile
                    key={c.id}
                    href={`/community/${c.id}`}
                    tone="accent"
                    icon={c.icon || "📄"}
                    title={c.subject}
                    desc={c.description || "לחצו לצפייה."}
                  />
                ))}
              </div>
            </section>
          )}

          {/* פנייה לצוות חצר — the existing maintenance features */}
          <section className="mt-12">
            <SectionTitle>פנייה לצוות חצר</SectionTitle>
            <div data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Tile
                href="/faults/new"
                icon="🔧"
                title="פתיחת קריאה לתקלה"
                desc="דיווח על תקלה במבנה. הטיפול יתועד עד לסגירה."
              />
              <Tile
                href="/faults"
                icon="📋"
                title={staff ? "ניהול תקלות" : "מעקב סטטוס קריאה"}
                desc={
                  staff
                    ? "צפייה בכל הקריאות, סינון, עדכון סטטוס וטיפול."
                    : "מעקב אחר הקריאות שדיווחת, משלב הפתיחה ועד לסגירה."
                }
              />
              {session?.user.role === "admin" && (
                <Tile href="/admin" icon="⚙️" title="ניהול מערכת" desc="ניהול משתמשים, תושבים ומבנים." />
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 text-center">
          <Logo className="h-10 w-auto" />
          <p className="text-sm text-gray-500">קהילת עצמונה-שומריה — מידע ושירות לתושב</p>
        </div>
      </footer>
    </div>
  );
}
