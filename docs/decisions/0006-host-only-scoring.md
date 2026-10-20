# 0006: Only the host controls scoring

**Status:** accepted

## Situation

Scoring can turn a supportive activity into a contest. It should be optional, and it should be the adult's call who earns points.

## Decision

- Scoring is off by default. Only the host can turn it on, award points to a chosen player, adjust a score by hand, or reset scores.
- Players see the tally but get no controls. The server refuses score changes from anyone but the host, and a test covers this, so hiding the buttons is not the only protection.
- Loading a new board starts a new game: scores reset, players stay and scoring stays on.

## Consequences

- Players cannot award themselves points, by design.
- The host does a little more work per clue. A "give to this player" button for each player keeps it to one tap.
