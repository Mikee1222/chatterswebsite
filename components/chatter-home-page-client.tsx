"use client";

import * as React from "react";
import { motion } from "framer-motion";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
} as const;

const fadeUpItem = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

/**
 * Staggers welcome banner, main dashboard client, and recent activity on the chatter home page.
 */
export function ChatterHomePageClient({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);

  return (
    <motion.div
      className="space-y-10"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {items.map((child, i) => (
        <motion.div key={i} variants={fadeUpItem} className="will-change-transform">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
