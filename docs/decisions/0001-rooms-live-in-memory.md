# 0001: Rooms live in server memory and nothing is stored

**Status:** accepted

## Situation

The app is used in sessions with children. The less information it holds, the less there is to leak, lose or have to protect. A session is short and temporary: once it ends, nobody needs the room again.

## Decision

Rooms exist only in the server's memory (a `Map` inside `RoomStore`). There is no database, no accounts and no analytics, and the server writes no logs about rooms or people. A room ends when the host ends it, or after 30 minutes without activity.

## Consequences

- There is almost nothing to protect, and nothing to delete afterwards.
- Restarting the server ends every room. That is acceptable for short sessions, and the page says so clearly.
- The server must run as a single process. Several copies would each hold different rooms. If scale ever mattered, the room store would need to be shared (for example, a fast shared cache), which would be a new decision.
- Debugging is harder without logs. Tests and a local-only debugging approach make up for it.
