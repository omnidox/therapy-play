# 0003: The server owns the game and hides answers until needed

**Status:** accepted

## Situation

Several screens act on one shared board. Letting each screen keep its own copy would lead to disagreements, and sending everything to every screen would let a curious player read the answers from the page data.

## Decision

- Clients send small actions: open a tile, show the answer, done, put back. The server applies them in order and sends the new state to everyone allowed to see it.
- If two actions conflict (two taps at once), the first one wins and the other is ignored. The screen that lost simply receives the new state.
- The state sent to players lists categories and points, but never questions or answers. A question is sent only when its tile is opened, and its answer only after "Show answer". The full board goes only to the host.
- A waiting screen receives no game state at all.

## Consequences

- Every screen always shows the same thing, and reconnecting is simple: the server sends the current state.
- Each action costs a short round trip to the server, which is fine on a normal connection.
- The rules live in one place (`game.ts`) and are tested without any network.
