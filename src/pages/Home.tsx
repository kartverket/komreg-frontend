import { Heading, Paragraph } from "@kv-designsystem/react";

export function Home() {
  return (
    <>
      <Heading level={1} data-size="lg">
        KomReg
      </Heading>
      <Paragraph>Verktøy for store kommune- og fylkesendringer i matrikkelen.</Paragraph>
    </>
  );
}
