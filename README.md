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

## Midlertidig lagring av reguleringer

Reguleringsutkast lagres foreløpig i nettleserens `localStorage`. De synkroniseres ikke mellom
nettlesere eller brukere, og må ikke regnes som varig lagret i backend.

All lagring går gjennom `src/api/reguleringer.ts`. Når backend kan lagre reguleringer, er det bare
den filen som skal byttes ut.
