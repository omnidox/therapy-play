# 0012: The sandtray, a second activity in the same room

**Status:** accepted

## Situation

A room started as one game. A second activity was wanted: a shared sandtray, where the host and the players move figures around a tray together, live. It should work with a finger on a phone, a mouse, and a keyboard, and it should not store or show anything that people type or upload.

## Decision

- **Layout.** A tray on top and a shelf of figures below it, with category tabs. The tray has a fixed 4:3 shape on every screen and is never taller than the window allows, so the shelf stays in view.
- **One room, one activity at a time.** The host switches between Jeopardy and the sandtray. Each keeps its own state while the room lives, and everyone's screen follows the host.
- **A fixed library of figures.** The server only accepts ids from the library, so nothing typed or uploaded is stored or shown. Positions are fractions of the tray (0 to 1), so every screen size agrees. A figure's centre is kept far enough from the edges that the whole figure stays inside the tray. At most 40 figures at once.
- **Anyone admitted may place, move or put away any figure.** Last move wins. Only the host clears the tray. A waiting screen sees nothing, the same as for the game.
- **Three ways to place a figure:** drag it from the shelf onto the sand; tap it, then tap the sand (this also works well on phones, where dragging up from the bottom can clash with scrolling); or press Enter on it with a keyboard. Dragging a placed figure onto the shelf puts it away, so do Delete and a "Put away" button.
- **Keyboard moves are sent as steps** ("move right by 2%") and added up by the server, not as absolute positions. Quick key presses then accumulate even before the server has answered the first one.
- **Elements keep a fixed order in the page;** stacking is set with z-index. Moving a figure to the front must not move its element, or a keyboard user would lose focus after one key press.
- **Messages are small and separate.** Tray updates go out on their own, not with the whole room, and a connection that sends too many (more than about 40 a second) has the excess dropped. While dragging, a screen sends about 20 updates a second.
- Nothing is saved. The tray ends with the room.

## Consequences

- Two people moving the same figure at once will see it jump to the latest position. That is acceptable for shared play.
- The tray's size follows the window height, so on a very short window the tray is small.
- Adding more figures is a change to one list and one folder of images, plus a line in `ASSETS.md`.
- Which figures matter is a question for the people who use the tool. The set that ships is a starter set.
