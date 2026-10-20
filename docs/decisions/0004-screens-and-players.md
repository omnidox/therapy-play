# 0004: Screens and players are separate

**Status:** accepted

## Situation

At first a room was one host and one child. A parent may sit beside the child on one phone, a group may have several children on their own devices, and the host may want to play too.

## Decision

- A **screen** is one connection. It holds one to four **players**. A player has a name and a score.
- The host sets the room's player limit from 1 to 8, and the limit counts every player, including the host if they play. Lowering it below the players already in is refused, so nobody is removed by accident.
- Default names are "Player 1", "Player 2" and so on (the lowest unused number). Names are free text up to 20 characters, cleaned of control characters, and can be changed by the player or the host.
- The player count a screen takes is chosen by that screen when it joins, capped by the seats left.

## Consequences

- One model covers a child alone, a parent and child sharing a screen, and a group.
- Names are free text from children and pass through server memory (not stored or logged). That is noted for any future privacy review.
- Turn order is not modelled. Anyone admitted can tap, and the first tap wins. A turn setting can be added without changing this model.
