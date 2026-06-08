"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { buildSopsDeepLink } from "@/lib/sop-academy";
import { useSopMotion } from "@/components/sop/sop-motion";
import type { SopAcademyResume } from "@/types";

export function SopResumeBanner({ resume }: { resume: SopAcademyResume }) {
  const motionCfg = useSopMotion();
  const href = buildSopsDeepLink(resume);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 backdrop-blur-xl md:px-5"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px -12px rgba(0,0,0,0.45)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10 text-pink-300/80">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm text-white/70">
            <span className="text-white/85">Συνέχισε το training σου</span>
            {" — "}
            <span className="font-medium text-white/90">{resume.role_name}</span>
            {": "}
            <span className="tabular-nums text-white/75">
              {resume.completed_count}/{resume.total_functions}
            </span>
          </p>
        </div>
        <motion.div whileHover={motionCfg.hoverScale} whileTap={{ scale: 0.98 }}>
          <Link
            href={href}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-pink-500/25 hover:bg-white/[0.09] hover:text-white sm:w-auto"
          >
            Συνέχεια
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
