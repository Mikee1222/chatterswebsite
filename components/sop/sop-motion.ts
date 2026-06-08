"use client";

import { useReducedMotion } from "framer-motion";

const easeOut = [0.22, 1, 0.36, 1] as const;

export const sopStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const sopItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
};

export const sopReveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};

export const sopFade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const sopScale = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

export function useSopMotion() {
  const reduce = useReducedMotion();
  if (reduce) {
    return {
      stagger: { hidden: {}, show: {} },
      item: { hidden: {}, show: {} },
      reveal: { hidden: {}, show: {} },
      fade: { hidden: {}, show: {}, exit: {} },
      scale: { hidden: {}, show: {}, exit: {} },
      hoverLift: undefined as undefined,
      hoverScale: undefined as undefined,
      tabTransition: { duration: 0 },
    };
  }
  return {
    stagger: sopStagger,
    item: sopItem,
    reveal: sopReveal,
    fade: sopFade,
    scale: sopScale,
    hoverLift: { y: -3, transition: { type: "spring" as const, stiffness: 400, damping: 26 } },
    hoverScale: { scale: 1.02, transition: { type: "spring" as const, stiffness: 400, damping: 26 } },
    tabTransition: { duration: 0.28, ease: easeOut },
  };
}
