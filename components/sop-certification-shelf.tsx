"use client";

import { motion } from "framer-motion";
import { Award, GraduationCap } from "lucide-react";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopCertificationBadge } from "@/types";

export function SopCertificationShelf({ badges }: { badges: SopCertificationBadge[] }) {
  const motionCfg = useSopMotion();

  if (badges.length === 0) return null;

  return (
    <motion.div
      variants={motionCfg.reveal}
      className="sop-glass-panel rounded-2xl border border-white/10 p-4 md:p-5"
    >
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
        Certifications
      </p>
      <div className="flex flex-wrap gap-2.5">
        {badges.map((badge) => {
          if (badge.kind === "master") {
            return (
              <motion.div
                key="master"
                whileHover={motionCfg.hoverScale}
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_0_20px_-6px_rgba(245,158,11,0.35)]"
              >
                <Award className="h-3.5 w-3.5" />
                {badge.label}
              </motion.div>
            );
          }

          const cfg = badge.role_color ? SOP_COLOR_STYLES[badge.role_color] : SOP_COLOR_STYLES.pink;
          return (
            <motion.div key={badge.role_id ?? badge.label} whileHover={motionCfg.hoverScale}>
              <SopGlowBadge
                className={cn(cfg.badge, "inline-flex items-center gap-1.5 px-3.5 py-1.5")}
                glowClassName={cfg.glow}
              >
                <GraduationCap className="h-3.5 w-3.5 opacity-80" />
                {badge.label}
              </SopGlowBadge>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/** Compact badge for admin progress table rows. */
export function SopCertificationMiniBadge({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
      <GraduationCap className="h-3 w-3" />
      {label}
    </span>
  );
}
