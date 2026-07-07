"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";

const TIME_ZONE = "Europe/Athens";

function formatParts(date: Date) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { day, time };
}

const pillClass =
  "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

/** Live date + time chip row. Timezone-locked to the app's Athens time. Needs no permissions. */
export function HomeQuickInfo() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = now ? formatParts(now) : null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={pillClass}>
        <CalendarDays className="h-4 w-4 text-pink-300/80" aria-hidden />
        <span className="tabular-nums">{parts?.day ?? "\u2014"}</span>
      </span>
      <span className={pillClass}>
        <Clock className="h-4 w-4 text-[#D4AF8C]/80" aria-hidden />
        <span className="tabular-nums" suppressHydrationWarning>
          {parts?.time ?? "\u2014"}
        </span>
      </span>
    </div>
  );
}
