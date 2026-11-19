import { useEffect, useState } from "react";
import { Heading, Link, Paragraph, Table } from "@kv-designsystem/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { listGrensejusteringer } from "@/api/grensejusteringer";
import type { GrensejusteringSummary } from "@/domain/grensejustering";

export function Grensejusteringer() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GrensejusteringSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listGrensejusteringer()
      .then((grensejusteringer) => {
        if (active) setItems(grensejusteringer);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Kunne ikke hente grensejusteringer");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Heading level={1} data-size="lg">
        Grensejusteringer
      </Heading>
      {error && (
        <Paragraph className="form-error" role="alert">
          {error}
        </Paragraph>
      )}
      {!error && items === null && <Paragraph>Henter grensejusteringer…</Paragraph>}
      {!error && items?.length === 0 && (
        <Paragraph>Ingen grensejusteringer er opprettet ennå.</Paragraph>
      )}
      {items && items.length > 0 && (
        <div className="grensejustering-table-wrapper">
          <Table data-size="sm" zebra hover>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Navn</Table.HeaderCell>
                <Table.HeaderCell>Fra kommune</Table.HeaderCell>
                <Table.HeaderCell>Til kommune</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item) => (
                <Table.Row
                  className="grensejustering-table-row"
                  key={item.id}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a")) return;
                    void navigate({
                      to: "/grensejusteringer/$grensejusteringId",
                      params: { grensejusteringId: String(item.id) },
                    });
                  }}
                >
                  <Table.Cell>
                    <Link asChild>
                      <RouterLink
                        className="grensejustering-table-link"
                        to="/grensejusteringer/$grensejusteringId"
                        params={{ grensejusteringId: String(item.id) }}
                      >
                        {item.navn}
                      </RouterLink>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>{item.fraKommunenummer}</Table.Cell>
                  <Table.Cell>{item.tilKommunenummer}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </>
  );
}
