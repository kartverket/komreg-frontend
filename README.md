# KomReg Frontend

Webklient til KomReg, Kartverkets verktøy for store kommune- og fylkesendringer i matrikkelen. React
og Kartverkets designsystem, med kart fra Kartverkets åpne kartcache.

## Kom i gang

Installer [`vp`](https://viteplus.dev/guide/) med `curl -fsSL https://vite.plus | bash`.

```sh
vp install    # avhengigheter
vp dev        # http://localhost:5173
vp check      # formatering, lint og typesjekk
vp test       # tester
```

For å teste frontend med Caddy lokalt, kjør fra repoet:

```sh
./dev.sh    # http://localhost:8080
```

## Lagring av reguleringer

Reguleringer lagres i backend, som er fasit. Klienten holder bare en cache i minnet, og serveren må
være tilgjengelig for å lagre. All kommunikasjon går gjennom `src/api/reguleringer.ts`:

- `GET /api/reguleringer/stream` (SSE): `snapshot` med alle reguleringer ved hver (re)tilkobling,
  deretter `upsert` med hele reguleringen per endring.
- `POST /api/reguleringer`: oppretter, og svarer med hele reguleringen inkludert `id`.

Testene bruker en falsk backend i `src/api/fakeReguleringBackend.ts`.
