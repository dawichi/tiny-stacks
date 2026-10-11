# Accessibility Review

## Scope and method

Review date: 2026-10-11. The review used the final local production build served at a production-like local URL and the shared browser. Axe-core 4.10.3 ran with WCAG 2.0/2.1 Level A and AA and best-practice rules enabled. Each route and the dynamic states listed below had zero reported violations.

The review covered the desktop experience supported by the app. It included route landmarks and names, keyboard operation, focus visibility and movement, dialogs, live announcements, and reduced-motion styling. It did not include a screen reader, browser zoom testing, a formal measurement of every color pair, or mobile layouts; the app identifies itself as desktop-only and shows a narrow-screen guard.

## Route scans

| Route/state | Axe violations | Incomplete checks |
|---|---:|---:|
| Home (`/`) | 0 | 9 |
| Tutorial (`/tutorial`) | 0 | 2 |
| Sandbox (`/sandbox`) | 0 | 16 |
| Challenge list (`/challenges`) | 0 | 18 |
| Challenge detail (`/challenges/1`) | 0 | 2 |
| Sandbox service inspector | 0 | — |
| Tutorial completion dialog | 0 | — |
| Challenge briefing dialog | 0 | — |
| Challenge results dialog | 0 | — |
| Settings dialog | 0 | — |

Axe marked some contrast checks incomplete where it could not determine a reliable background color over gradients or images. The incomplete counts are retained above as a limitation, not as passed checks. During review, the identified foreground styles for service nodes, labels, links, buttons, metrics, and modal actions were darkened and visually inspected against their rendered backgrounds. This was not a full contrast-ratio measurement.

The review found and corrected low-contrast service text, several muted labels/actions, a heading-level skip, and connection-method buttons whose text color followed the method color. It also found and corrected missing landmarks/accessible names and keyboard/focus gaps described below. The final scans were run after these fixes.

## Keyboard journeys

The following flows were completed using keyboard input in the production build:

- **Sandbox:** tab to a palette item and place a service, move a board item with arrow keys, move a service, connect ports, select and change a connection, then delete connections/services. The rendered integration test also checks placement, movement, port connection, and local-storage persistence.
- **Tutorial:** complete the tutorial without a pointer, including removing and creating connections, changing route methods, and opening the completion dialog. The dialog initially focuses its primary action, traps focus within its actions, closes with Escape, and returns focus to the board.
- **Challenge:** complete the first challenge without a pointer, configure route methods and simulation speed, and reach the three-star result. Briefing and results dialogs place focus on their primary action, keep Tab within dialog actions, close on Escape, and restore focus to the board.
- **Settings and inspector:** open each from the keyboard, move through controls, close settings with Escape, and verify focus restoration. The inspector's interactive controls had accessible names.

The board exposes keyboard instructions and polite status announcements for board actions. Delete/Backspace only deletes board selections and is ignored while focus is on unrelated controls. Reduced-motion preferences are respected by shared motion styles.

## Follow-up cadence

Repeat the route and representative dialog scans before a production release that changes layout, navigation, controls, or shared styles, and at least quarterly while the project is active. Recheck keyboard-only Sandbox, Tutorial, and Challenge flows when board interaction or dialog behavior changes. Retain a dated report when a scan finds a violation, when the tool/rule set changes, or when the review scope changes. Update this report with the new results and any limits.
