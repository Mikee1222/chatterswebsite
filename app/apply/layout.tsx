import type { Metadata } from "next";
import { ApplyAmbientBg } from "@/components/application-public-chrome";
import { APPLY_SHELL } from "@/lib/application-ui-tokens";

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
    <div className={APPLY_SHELL}>
      <ApplyAmbientBg />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}
