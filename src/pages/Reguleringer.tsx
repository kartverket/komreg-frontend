import { useEffect, useState } from "react";
import { Heading, Link, Paragraph, Table } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { listReguleringer } from "@/api/reguleringer";
import type { ReguleringSummary } from "@/domain/regulering";

export function Reguleringer() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReguleringSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listReguleringer()
      .then((reguleringer) => {
        if (active) setItems(reguleringer);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Kunne ikke hente reguleringer");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Heading level={1} data-size="lg">
        Reguleringer
      </Heading>
      {error && (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      )}
      {!error && items === null && <Paragraph>Henter reguleringer…</Paragraph>}
      {!error && items?.length === 0 && (
        <Paragraph>Ingen reguleringer er opprettet ennå.</Paragraph>
      )}
      {items && items.length > 0 && (
        <div className="regulering-table-wrapper">
          <Table data-size="sm" zebra hover>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Navn</Table.HeaderCell>
                <Table.HeaderCell>Fra kommune</Table.HeaderCell>
                <Table.HeaderCell>Til kommune</Table.HeaderCell>
                <Table.HeaderCell>Matrikkelenheter</Table.HeaderCell>
                <Table.HeaderCell>Ikrafttredelse</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item) => (
                <Table.Row
                  className="regulering-table-row"
                  key={item.id}
                  onClick={(event) => {
                    // The name link navigates by itself.
                    if (event.target instanceof Element && event.target.closest("a")) return;
                    void navigate({
                      to: "/reguleringer/$reguleringId",
                      params: { reguleringId: String(item.id) },
                    });
                  }}
                >
                  <Table.Cell>
                    <Link asChild>
                      <RouterLink
                        className="regulering-table-link"
                        to="/reguleringer/$reguleringId"
                        params={{ reguleringId: String(item.id) }}
                      >
                        {item.navn}
                      </RouterLink>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{item.fraKommunenummer}</Table.Cell>
                  <Table.Cell>{item.tilKommunenummer}</Table.Cell>
                  <Table.Cell>{item.antallMatrikkelenheter}</Table.Cell>
                  <Table.Cell>{item.dato}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </>
  );
}
