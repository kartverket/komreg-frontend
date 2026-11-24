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

## Typer fra backend

`src/api/regulering-api.d.ts` er generert fra OpenAPI-dokumentet til `regulering-api`, og skal ikke
endres for hånd. Når API-et endres, start backend og generer filen på nytt:

```sh
curl -o openapi.json http://localhost:8082/openapi/openapi.json
vp dlx openapi-typescript@7 openapi.json -o src/api/regulering-api.d.ts
rm openapi.json
```
