import { useState } from "react";
import { Button, Heading, Paragraph, Textfield } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { createRegulering } from "@/api/reguleringer";
import {
  formatMatrikkelnummer,
  lagMatrikkelenhetDraft,
  validerGrensejustering,
  type GrensejusteringDraft,
} from "@/domain/regulering";
import { useMatrikkelenheter } from "@/hooks/useMatrikkelenheter";

export function NewRegulering() {
  const navigate = useNavigate();
  const valgte = useMatrikkelenheter((state) => state.matrikkelenheter);
  const clearMatrikkelenheter = useMatrikkelenheter((state) => state.clearMatrikkelenheter);
  const drafts = Array.from(valgte.values(), lagMatrikkelenhetDraft);
  const utenMatrikkelnummer = drafts.filter((draft) => draft === null).length;
  const matrikkelenheter = drafts.filter((draft) => draft !== null);
  const [navn, setNavn] = useState("");
  const [dato, setDato] = useState("");
  const [fraKommune, setFraKommune] = useState(matrikkelenheter[0]?.kommunenummer ?? "");
  const [tilKommune, setTilKommune] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (utenMatrikkelnummer) {
      setError("Teiger uten matrikkelnummer kan ikke flyttes ennå. Fjern dem i kartet.");
      return;
    }
    const grensejustering: GrensejusteringDraft = {
      fraKommunenummer: fraKommune.trim(),
      tilKommunenummer: tilKommune.trim(),
      matrikkelenheter,
    };
    const valideringsfeil = validerGrensejustering(grensejustering);
    if (valideringsfeil) {
      setError(valideringsfeil);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const id = await createRegulering({ navn, dato, grensejustering });
      clearMatrikkelenheter();
      await navigate({ to: "/reguleringer/$reguleringId", params: { reguleringId: String(id) } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke opprette reguleringen");
      setSaving(false);
    }
  }

  return (
    <>
      <Heading level={1} data-size="lg">
        Opprett grensejustering
      </Heading>
      {!valgte.size ? (
        <Paragraph>Ingen matrikkelenheter er valgt. Velg dem i kartet først.</Paragraph>
      ) : (
        <form className="regulering-form" onSubmit={(event) => void submit(event)}>
          <Textfield
            label="Navn"
            value={navn}
            onChange={(event) => setNavn(event.target.value)}
            required
          />
          <Textfield
            label="Ikrafttredelsesdato"
            type="date"
            value={dato}
            onChange={(event) => setDato(event.target.value)}
            required
          />
          <Textfield
            label="Fra kommune"
            value={fraKommune}
            onChange={(event) => setFraKommune(event.target.value)}
            inputMode="numeric"
            required
          />
          <Textfield
            label="Til kommune"
            value={tilKommune}
            onChange={(event) => setTilKommune(event.target.value)}
            inputMode="numeric"
            required
          />
          <section>
            <Heading level={2} data-size="xs">
              Matrikkelenheter ({matrikkelenheter.length})
            </Heading>
            <ul>
              {matrikkelenheter.map((item) => (
                <li key={formatMatrikkelnummer(item)}>{formatMatrikkelnummer(item)}</li>
              ))}
            </ul>
            {utenMatrikkelnummer > 0 && (
              <Paragraph>{utenMatrikkelnummer} teig(er) uten matrikkelnummer er valgt.</Paragraph>
            )}
          </section>
          {error && (
            <Paragraph className="form-error" role="alert">
              {error}
            </Paragraph>
          )}
          <div className="form-actions">
            <Button asChild variant="secondary">
              <RouterLink to="/kart">Tilbake til kartet</RouterLink>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Oppretter…" : "Opprett regulering"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
