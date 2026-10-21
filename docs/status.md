# Status

Where the project stands. Update this at the end of each working session, and finish with one next action of 10 to 30 minutes. Last updated: Oct 20, 2026.

## What works

- Rooms with an unguessable link, a waiting room, up to 8 players (a screen holds 1 to 4), host-only scoring, editable boards saved as files on the host's device.
- Reconnects by itself after a dropped connection or a closed browser; keyboard and screen reader support; automated accessibility scans in the tests.
- A production build: one program serves the page and the game (`npm run build`, `npm start`).
- Only the host can create rooms: a passcode (`HOST_PASSCODE`) is required on any site that is not a demo, with guess limits (decision record 0010).

## Checks and deploys

- `npm run check` (typecheck, lint, format, tests) runs on every commit through the pre-commit hook, and on GitHub (CI) for every push. At the last update: 58 server tests and 23 client tests, all passing.
- A free demo runs on Render, described by `render.yaml` and deployed from the `main` branch. It has `DEMO=1`, so it shows a "made-up content only" banner, and it has no host passcode (removed on Oct 21 to make development easier), so anyone with the address can create rooms; the banner is the only guard. The README now links to the demo. A real site must still set `HOST_PASSCODE`. Free instances sleep after 15 idle minutes and wake in about a minute; rooms live in memory, so a restart ends them.

## Ideas for next steps (not started)

- Before the repo is made public: cap live rooms and limit room creation per address on an open demo.
- Browser end-to-end tests (for example with Playwright).
- Colour contrast scan in a real browser and a test with a real screen reader (listed under Known limits in the README).
- Optional: turn order or "host picks the tile" as a setting; a small turn indicator.
- Optional: a short screen recording for the README (made-up content only).

## Reminders

- Made-up content only, everywhere. See CLAUDE.md.
- Do not make the repository public, create accounts or deploy changes to anything other than the demo without the owner's explicit OK.
