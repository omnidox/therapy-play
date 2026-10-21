# 0010: Only the host can create rooms, with a passcode

**Status:** accepted

## Situation

Anyone who opened the site could press "New room" and become a host. They could not get into other people's rooms, which need the link and the host's key. But a stranger could create their own room and send out a link that looks like it comes from the host's site, and could fill the server with rooms.

## Decision

- The server has a **host passcode**, set as a private setting (`HOST_PASSCODE`) on the host machine. It is never in the code or the repository, and it must be at least 12 characters (6 on a demo site, which has only made-up content).
- The home page asks for it before creating a room. Players never see this: they use the link the host sends, and joining or playing needs no passcode.
- The server **fails closed**: a site that is not a demo refuses to start without a passcode. Demo sites (`DEMO=1`) and local development (the dev scripts pass `--allow-open`) may run without one.
- The check compares the passcode without leaking how much of a guess was right. After 5 wrong guesses from one address in 15 minutes, that address must wait, and a lower overall limit covers guesses spread over many addresses. The counts live in memory only.
- The passcode is typed each time and never stored in the browser, so nothing is left behind on a shared computer. A password manager can fill it in.

## Consequences

- A leaked passcode lets anyone create rooms until it is changed. Changing it is one setting and a restart.
- It is a shared secret, not a login. Stronger options (passkeys, a code from an authenticator app, or a gateway in front of the host page) can be added later without changing the room model.
- The limiter relies on the address the host's proxy reports. The overall limit covers the case where that address is faked.
- Rooms that already exist keep working if the passcode is changed. Their keys are separate.
