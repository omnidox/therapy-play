# 0007: Seats survive dropped connections and closed browsers

**Status:** accepted

## Situation

Children's phones lock their screens, lose Wi-Fi, or have the browser closed by accident. A player who is thrown out and must start again loses their name and score, and may find the room full.

## Decision

- The page reconnects by itself, retrying after 1, 2 and 4 seconds, then every 8, and immediately when a phone wakes up. A "Reconnecting" banner shows meanwhile.
- A screen gets a private random token when it joins. After a reconnect it presents the token to take its seat, names and score back.
- The token (and the host's key) is kept in the browser's local storage, so closing the browser does not lose it. It is removed when the room ends or the seat is closed, and expires after a day.
- A disconnected screen keeps its seat for 15 minutes. The host can remove a screen sooner.
- A heartbeat catches dead connections: the server pings every 20 seconds and drops a connection that does not answer, and the page treats 40 seconds of silence as a drop.

## Consequences

- A absent player holds a seat for up to 15 minutes unless the host removes them.
- Every tab of one browser shares the token. For testing several players in one browser, a `?fresh` option on the link starts a new player.
- There are no accounts, so a different phone or browser cannot recover a seat. That is the intended limit.
- A random code per room is stored on each device until the room ends. It identifies nobody.
