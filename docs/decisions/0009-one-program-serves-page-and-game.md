# 0009: One program serves the page and the game

**Status:** accepted

## Situation

In development the page comes from Vite's development server, which forwards game traffic to the real server. That is convenient for editing but is two programs, and it is not meant to face real users.

## Decision

- `npm run build` compiles the page into plain files (`client/dist`) and bundles the server, with the shared types included, into one file (`server/dist/main.js`).
- `npm start` runs that one file. It serves the page, answers room links like `/r/CODE` with the app, serves the game traffic, and offers `/health` for a host to check that it is alive. Missing files and unknown API paths stay real 404s.
- The port comes from the `PORT` setting. The program shuts down politely when a host stops it.
- Built files have fingerprinted names, so they are cached for a long time. The page itself is always re-checked.
- Every web response carries a few safety headers. `Referrer-Policy: no-referrer` keeps a room link from being passed to other sites.

## Consequences

- Any computer or hosting service that can run Node 22 can run the app with two commands. There is nothing else to set up and no file to configure.
- The server stays a single process (see 0001).
- Containers, process managers and a reverse proxy are left to whoever deploys it.
