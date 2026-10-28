import type { ReactNode } from "react";
import { Button } from "@kv-designsystem/react";
import { Link as RouterLink, type LinkProps } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@navikt/aksel-icons";
import styles from "./BackButton.module.css";

export function BackButton({ to, children }: { to: LinkProps["to"]; children: ReactNode }) {
  return (
    <Button asChild variant="tertiary" data-size="sm" className={styles.backButton}>
      <RouterLink to={to}>
        <ArrowLeftIcon aria-hidden />
        {children}
      </RouterLink>
    </Button>
  );
}
