"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import PageTransition from "../_components/PageTransition";

export default function AdminTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={pathname}>{children}</PageTransition>
    </AnimatePresence>
  );
}
