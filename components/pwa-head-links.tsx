import {
  PWA_APPLE_TOUCH_ICON,
  PWA_APPLE_TOUCH_ICON_PRECOMPOSED,
  PWA_ICON_192,
  PWA_ICON_512,
} from "@/lib/site-metadata";

/**
 * Explicit PWA icon link tags (no crossorigin) so iOS Add to Home Screen and
 * Android install pick up the Gunzo PNG logo reliably. Manifest href stays in
 * layout metadata so dashboard routes can override with manifest-dashboard.json.
 */
export function PwaHeadLinks() {
  return (
    <>
      <link rel="apple-touch-icon" href={PWA_APPLE_TOUCH_ICON} sizes="180x180" />
      <link
        rel="apple-touch-icon-precomposed"
        href={PWA_APPLE_TOUCH_ICON_PRECOMPOSED}
        sizes="180x180"
      />
      <link rel="icon" type="image/png" sizes="192x192" href={PWA_ICON_192} />
      <link rel="icon" type="image/png" sizes="512x512" href={PWA_ICON_512} />
    </>
  );
}
