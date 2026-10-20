# 0005: Boards are files on the host's device

**Status:** accepted

## Situation

Hosts want to write their own boards and reuse them later. Keeping boards on the server would mean storing content for people who are not signed in, which goes against 0001.

## Decision

- The host edits a copy of the board in the browser. "Use this board" sends it to the room, and the server checks it (length limits, a maximum of 6 categories and 6 rows, every category with the same number of rows).
- Saving writes a plain JSON file on the host's own device, through a "Save as" window where the browser supports it (desktop Chrome and Edge), otherwise a normal download. Loading reads such a file and runs it through the same check.
- The server never keeps a board after the room ends.

## Consequences

- No accounts, storage or cleanup on the server, and the host decides where files live.
- A lost file is a lost board. Backing it up is up to the host.
- Board content passes through the server while a room is active. It is held in memory only.
