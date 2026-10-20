# 0002: No accounts: an unguessable link and a waiting room

**Status:** accepted

## Situation

Families join from whatever device they have, often a phone, and the host emails them a link. Accounts and passwords would add friction and mean storing personal details.

## Decision

- Creating a room returns a random 128-bit room code and a separate random host key. The host's browser keeps the key, so only that browser is the host.
- A joining screen needs no name. It waits until the host admits it. Admitting is on by default and can be switched off. The host can admit one screen or everyone waiting.
- Room codes and keys are compared with a constant-time check.

## Consequences

- Anyone who gets the link can ask to join, but cannot enter without being admitted, and a room's link stops working when the room ends.
- If the host's browser loses the key, the room cannot be recovered. The key is kept on the device (see 0007) to reduce that risk.
- This is not strong authentication. It is a deliberate fit for short, host-supervised sessions, and it would need revisiting for anything else.
