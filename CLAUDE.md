# therapy-play: working rules for this repo

A shared Jeopardy-style game for online sessions with children. See README.md for what it does and docs/decisions for why.

## Before every commit

- Run `npm run check` (typecheck, lint, format check, tests). The pre-commit hook runs it too; turn it on with `git config core.hooksPath .githooks`.
- Keep the README honest: update "Privacy" and "Known limits" whenever behaviour changes.
- A change to how the app works gets a short decision record in `docs/decisions`.

## Hard rules

- **Made-up content only** in code, tests, docs, screenshots and commit messages: no real names, no client details, no real screenshots, no secrets or API keys.
- The server stores nothing and logs nothing about rooms or people. No analytics.
- Never claim the app is "HIPAA compliant" or similar. Say what it does and does not store.
- Do not make this repo public, deploy anything, or create accounts without the owner's explicit OK.
- Commits use the GitHub no-reply identity already set in this clone. Do not use a personal email address.
- Label AI-assisted work in the README ("how it was built and how it was checked").

## Notes

Planning notes, research and anything about real use are kept outside this repo and must not be copied into it.
