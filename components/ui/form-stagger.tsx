"use client";

import * as React from "react";

/**
 * Clones direct children and passes `staggerIndex` (0, 1, 2, …) for `FormField` entrance delays.
 * Only works for immediate `FormField` children (or elements that accept `staggerIndex`).
 */
export function FormStagger({ children }: { children: React.ReactNode }) {
  let index = 0;
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const staggerIndex = index++;
        return React.cloneElement(child, { staggerIndex } as Record<string, unknown>);
      })}
    </>
  );
}
