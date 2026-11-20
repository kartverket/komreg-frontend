import { useState } from "react";
import { Button, Heading, Paragraph, Table, Textfield } from "@kv-designsystem/react";
import { Link as RouterLink, useParams } from "@tanstack/react-router";
import { updateRegulering } from "@/api/reguleringer";
import { BackButton } from "@/components/BackButton/BackButton";
import {
  formatMatrikkelnummer,
  formatNyttMatrikkelnummer,
  type GrensejusteringDraft,
  type ReguleringDetail as Regulering,
} from "@/domain/regulering";
import { formatNyVegadresse, formatVegadresse, vegadresseNokkel } from "@/domain/vegadresse";
import { useRegulering } from "@/hooks/useRegulering";

// Navn og dato gjelder hele reguleringen, så de redigeres her og ikke i en grensejustering.
function ReguleringInfoSkjema({
  regulering,
  onLagret,
}: {
  regulering: Regulering;
  onLagret: (regulering: Regulering) => void;
}) {
  const [navn, setNavn] = useState(regulering.navn);
  const [dato, setDato] = useState(regulering.dato);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!navn.trim() || !dato) {
      setError("Fyll inn navn og ikrafttredelsesdato");
      return;
    }
    setError("");
    setSaving(true);
    const neste = { ...regulering, navn: navn.trim(), dato };
    try {
      await updateRegulering(regulering.id, neste);
      onLagret(neste);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kunne ikke lagre reguleringen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="regulering-form" onSubmit={(event) => void submit(event)}>
      <Textfield
        className="regulering-felt"
        label="Navn"
        value={navn}
        onChange={(event) => setNavn(event.target.value)}
        required
      />
      <Textfield
        className="regulering-felt"
        label="Ikrafttredelsesdato"
        type="date"
        value={dato}
        onChange={(event) => setDato(event.target.value)}
        required
      />
      {error && (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      )}
      <div className="form-actions">
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Lagrer…" : "Lagre navn og dato"}
        </Button>
      </div>
    </form>
  );
}

function Grensejustering({
  reguleringId,
  indeks,
  grensejustering,
}: {
  reguleringId: string;
  indeks: number;
  grensejustering: GrensejusteringDraft;
}) {
  const { fraKommunenummer, tilKommunenummer, matrikkelenheter, teiger, vegadresser } =
    grensejustering;
  const kommuner = `${fraKommunenummer} → ${tilKommunenummer}`;

  return (
    <section>
      <Heading level={2} data-size="sm">
        {kommuner}
      </Heading>
      <Button asChild variant="secondary">
        <RouterLink
          to="/reguleringer/$reguleringId/rediger"
          params={{ reguleringId }}
          search={{ grensejustering: indeks }}
          aria-label={`Rediger grensejustering ${kommuner}`}
        >
          Rediger grensejustering
        </RouterLink>
      </Button>
      <Heading level={3} data-size="xs">
        Matrikkelenheter
      </Heading>
      <div className="regulering-table-wrapper">
        <Table data-size="sm" zebra>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Gårdsnummer</Table.HeaderCell>
              <Table.HeaderCell>Bruksnummer</Table.HeaderCell>
              <Table.HeaderCell>Teiger</Table.HeaderCell>
              <Table.HeaderCell>Nytt matrikkelnummer</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {matrikkelenheter.map((item) => (
              <Table.Row key={formatMatrikkelnummer(item)}>
                <Table.Cell>{item.gardsnummer}</Table.Cell>
                <Table.Cell>{item.bruksnummer ?? "Hele gårdsnummeret"}</Table.Cell>
                <Table.Cell>{item.teigIder.length}</Table.Cell>
                <Table.Cell>{formatNyttMatrikkelnummer(item)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      {teiger.length > 0 && (
        <>
          <Heading level={3} data-size="xs">
            Teiger uten matrikkelnummer
          </Heading>
          <div className="regulering-table-wrapper">
            <Table data-size="sm" zebra>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Teig-ID</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {teiger.map((teig) => (
                  <Table.Row key={teig.teigId}>
                    <Table.Cell>{teig.teigId}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </>
      )}
      {vegadresser.length > 0 && (
        <>
          <Heading level={3} data-size="xs">
            Vegadresser
          </Heading>
          <div className="regulering-table-wrapper">
            <Table data-size="sm" zebra>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Adresse</Table.HeaderCell>
                  <Table.HeaderCell>Ny adresse</Table.HeaderCell>
                  <Table.HeaderCell>Ny adressekode</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {vegadresser.map((adresse) => (
                  <Table.Row key={vegadresseNokkel(adresse)}>
                    <Table.Cell>{formatVegadresse(adresse)}</Table.Cell>
                    <Table.Cell>{formatNyVegadresse(adresse)}</Table.Cell>
                    <Table.Cell>{adresse.nyVeg?.adressekode}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

export function ReguleringDetail() {
  const { reguleringId } = useParams({ strict: false });
  const { id, regulering, error, setRegulering } = useRegulering(reguleringId);

  return (
    <>
      <BackButton to="/reguleringer">Tilbake til reguleringer</BackButton>
      {error ? (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      ) : !regulering ? (
        <Paragraph>Henter regulering…</Paragraph>
      ) : (
        <>
          <Heading level={1} data-size="lg">
            {regulering.navn}
          </Heading>
          <Paragraph>Ikrafttredelse: {regulering.dato}</Paragraph>
          <ReguleringInfoSkjema regulering={regulering} onLagret={setRegulering} />
          {regulering.grensejusteringer.map((grensejustering, indeks) => (
            <Grensejustering
              key={indeks}
              reguleringId={String(id)}
              indeks={indeks}
              grensejustering={grensejustering}
            />
          ))}
        </>
      )}
    </>
  );
}
