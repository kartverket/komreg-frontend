import styles from "./ToggleButton.module.css";

export function ToggleButton({ isActive, onToggle, children, ...props }: { isActive: boolean; onToggle: (isActive: boolean) => void; children: React.ReactNode }) {
    return (
        <button data-icon="true" className={`ds-button ${isActive ? styles.active : ""}`} onClick={() => {
            onToggle(!isActive);
        }} {...props}>
            {children}
        </button>
    );
}