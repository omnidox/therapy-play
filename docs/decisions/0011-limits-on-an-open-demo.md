# 0011: Limits on rooms, especially on an open demo

**Status:** accepted

## Situation

A demo site can be left open so anyone can try it (see 0010). On a free host, rooms live in a small amount of memory and the host counts running hours. Without limits, one visitor or a script could create thousands of rooms, fill the memory and use up the month's free hours.

## Decision

- **A ceiling on live rooms for every site.** The default is 200 rooms at once. At the ceiling, creating a room fails with a "busy" message and a 503 status. Idle rooms are already removed after 30 minutes, which frees space.
- **A per-address limit on an open demo.** When a site is a demo (`DEMO=1`) and has no host passcode, one address can create 10 rooms in 15 minutes, with a lower overall limit of 100 for all addresses together in case addresses are faked. Past the limit, creation fails with a 429 status and a wait time.
- **No per-address limit with a passcode,** and none outside a demo, so real hosts and local development are not slowed down. The passcode already controls who can create rooms.
- The home page shows a plain message for each case. Counts live in memory only and are never stored.

## Consequences

- A person demonstrating the app to several people can still create enough rooms. If someone really needs more, they can wait, or the demo can be locked with a passcode.
- The ceiling and the limits are fixed numbers in the code, chosen to be generous for people and tight for scripts. They can become settings if needed.
- The limit relies on the address the host's proxy reports; the overall limit covers the case where it is faked.
