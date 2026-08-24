/**
 * A `template` (unlike `layout`) remounts on every navigation, so this gentle
 * fade-in replays each time the route changes. Reduced-motion users get no
 * animation (see globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
