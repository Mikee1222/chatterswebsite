/**
 * Dashboard segment template: keep a stable flex child (`min-h-0`) without Framer
 * page transitions. AnimatePresence + motion `initial={{ opacity: 0 }}` with
 * `mode="wait"` was leaving a `min-h-0` wrapper stuck at `opacity: 0` after
 * navigations — content was interactive but invisible.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0">{children}</div>;
}
