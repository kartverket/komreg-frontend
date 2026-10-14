import styles from "./Toolbar.module.css";

export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div role="toolbar" aria-label="Kartverktøy" className={styles.maptoolbar}>
      {children}
    </div>
  );
}
