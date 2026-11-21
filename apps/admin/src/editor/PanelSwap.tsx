import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Fades and nudges a side panel when what it shows changes (an editor opening,
 * closing or switching to another item). Motion is skipped when the visitor
 * prefers reduced motion (see MotionConfig in App).
 */
export function PanelSwap({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className="kc-panel-swap"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 12 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
