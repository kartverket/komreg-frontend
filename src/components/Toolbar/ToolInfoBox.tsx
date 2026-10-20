import type { ReactNode } from "react";
import styles from "./ToolInfoBox.module.css";

export function ToolInfoBox({ isActive, children }: { isActive: boolean; children: ReactNode }) {
  if (!isActive) return null;

  return (
    <div className={styles.infoBox} role="status">
      {children}
    </div>
  );
}