
import styles from "./Toolbar.module.css";

export function Toolbar({ children }: { children: React.ReactNode }) {

    return (
        <div className={styles.maptoolbar}>
            {children}
        </div>
    );
}