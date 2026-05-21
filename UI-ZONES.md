# UI Zones — Fixed Element Map

Reference for all `position: fixed` UI elements. Check this before adding new panels, toasts, or overlays to avoid collisions.

## Zone Grid (desktop, game screens)

```
┌─────────────────────────────────────────────────────────┐
│  [TL] top-6 left-6          [TR] top-6 right-6          │
│                                                          │
│  Tutorial:  Step panel       FREE                        │
│  Challenges: Objectives      FREE                        │
│  Sandbox:   FREE             FREE                        │
│                                                          │
│                  [CENTER]                                │
│              right-6 top-1/2 -translate-y-1/2            │
│              Inspector (service / connection panel)      │
│              w-64 — all game screens                     │
│                                                          │
│  [BL] bottom-6 left-6       [BR] bottom-6 right-6       │
│                                                          │
│  Palette — all game screens  FREE                        │
│  w-auto                                                  │
│                                                          │
│                             [BR-inner] bottom-1 right-1  │
│                             Settings button — ALL screens│
│                             36×36px circle, z-50         │
└─────────────────────────────────────────────────────────┘
```

## Element Registry

| Element | Selector | Position | z-index | Width | Screens |
|---------|----------|----------|---------|-------|---------|
| Palette | `app-service-palette` | `bottom-6 left-6` | 50 | auto | Tutorial, Sandbox, Challenges |
| Inspector | `app-service-inspector` | `right-6 top-1/2 -translate-y-1/2` | 50 | w-64 (256px) | Tutorial, Sandbox, Challenges |
| Settings button | `app-settings` (via `app.ts`) | `bottom-1 right-1` | 50 | 36px | All screens |
| Tutorial step panel | inline in `tutorial-page.component.html` | `left-6 top-1/2 -translate-y-1/2` | 50 | w-72 (288px) | Tutorial only |
| Challenges objectives | inline in `challenge-page.component.html` | `top-6 left-6` | 50 | w-64 (256px) | Challenges only |
| Star toasts | inline in `challenge-page.component.html` | `bottom-6 right-72` | 90 | dynamic | Challenges only |
| Tutorial celebration | inline in `tutorial-page.component.html` | `inset-0` | 100 | full screen | Tutorial only |
| Challenge briefing | inline in `challenge-page.component.html` | `inset-0` | 100 | full screen | Challenges only |
| Challenge results | inline in `challenge-page.component.html` | `inset-0` | 100 | full screen | Challenges only |
| Settings overlay | inline in `settings.component.ts` | `inset-0` | 200 | full screen | All screens |

## Design Rules

- **Left-center** — tutorial step panel only (`left-6 top-1/2 -translate-y-1/2`). Mirrors the inspector on the right.
- **Top-right** — reserved / free. Do not place persistent panels here (inspector owns the right rail).
- **Right-center** — inspector only. Always `right-6 top-1/2 -translate-y-1/2 w-64`.
- **Bottom-left** — palette only.
- **Bottom-right** — settings button only (`bottom-1 right-1`). Keep clear above it.
- **Toasts** — anchor to `bottom-6 right-72` (clears the inspector). Stack upward.
- **Full-screen overlays** — `inset-0` with `z-[100]` minimum. Settings modal uses `z-[200]`.

## z-index Ladder

| Layer | Value | Usage |
|-------|-------|-------|
| panels | 50 | All persistent UI panels |
| toasts | 90 | Star toasts (challenges) |
| overlays | 100 | Celebration, briefing, results |
| settings modal | 200 | Settings overlay (must cover everything) |

## Planned Additions

- **Insight toasts** (roadmap) — use same anchor as star toasts: `bottom-6 right-72`, stack upward, z-90.
- **Mobile bottom sheets** (roadmap) — replace palette + inspector with slide-up drawers on narrow viewports.
