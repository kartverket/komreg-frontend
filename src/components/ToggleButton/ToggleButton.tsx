import { Button, type ButtonProps } from "@kv-designsystem/react";
import styles from "./ToggleButton.module.css";

type ToggleButtonProps = Omit<ButtonProps, "children" | "onClick" | "variant"> & {
  isActive: boolean;
  onToggle: (isActive: boolean) => void;
  children: React.ReactNode;
};

export function ToggleButton({ isActive, onToggle, children, ...props }: ToggleButtonProps) {
  return (
    <Button
      data-icon="true"
      variant="tertiary"
      className={isActive ? styles.active : undefined}
      aria-pressed={isActive}
      onClick={() => {
        onToggle(!isActive);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
