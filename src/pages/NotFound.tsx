import { Link as RouterLink } from "@tanstack/react-router";
import { Heading, Link, Paragraph } from "@kv-designsystem/react";

export function NotFound() {
  return (
    <>
      <Heading level={1} data-size="lg">
        Fant ikke siden
      </Heading>
      <Paragraph>
        Adressen finnes ikke.{" "}
        <Link asChild>
          <RouterLink to="/">Gå til forsiden</RouterLink>
        </Link>
      </Paragraph>
    </>
  );
}
