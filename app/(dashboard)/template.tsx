/**
 * Dashboard segment template: stable flex child (`min-h-0`).
 *
 * Previously this wrapped pages in `<motion.div className="min-h-0" initial={{ opacity: 0 }} … />`;
 * App Router navigations sometimes left Framer inline `opacity: 0` stuck on that node (interactive
 * but invisible). No route-level motion lives here anymore.
 *
 * Inline `opacity: 1` is defensive (beats any stale motion styles if a CDN/SW caches old JS).
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div data-dashboard-template-root className="min-h-0 opacity-100" style={{ opacity: 1 }}>
      {children}
    </div>
  );
}
