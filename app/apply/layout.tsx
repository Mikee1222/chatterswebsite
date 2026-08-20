import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: undefined,
  manifest: undefined,
  appleWebApp: undefined,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    siteName: undefined,
  },
};

export default function ApplyPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#EDE6DC]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,140,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(26,21,18,0.08), transparent)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
