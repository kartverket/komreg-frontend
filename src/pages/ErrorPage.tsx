import { Button, Heading, Paragraph } from "@kv-designsystem/react";

export function ErrorPage() {
  return (
    <>
      <Heading level={1} data-size="lg">
        Noe gikk galt
      </Heading>
      <Paragraph>Siden kunne ikke vises. Prøv å laste den inn på nytt.</Paragraph>
      <div>
        <Button onClick={() => window.location.reload()}>Last inn siden på nytt</Button>
      </div>
    </>
  );
}
