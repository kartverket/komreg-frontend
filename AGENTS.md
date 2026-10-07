# komreg-frontend

- **Only `vp`:** no `pnpm` commands, no `package.json` scripts. Run `vp check` and `vp test` before
  calling a change done; `vp build` does not type check.
- **Router code from the installed version**, never from memory: read the types in
  `node_modules/@tanstack/react-router` first.
