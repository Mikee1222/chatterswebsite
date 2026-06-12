import type { Metadata } from "next";

/** Neutral metadata — no Gunzo branding on public link pages. */
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

export default function LinkPagesPublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
