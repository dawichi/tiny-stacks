# UI Layout Map

Reference for fixed-position panels, toasts, and overlays. Check this map before placing another persistent element so it does not collide with an existing game-screen control.

## Zone grid

```text
┌─────────────────────────────────────────────────────────┐
│  [TL] top-6 left-6                                      │
│  Challenge objectives (Challenges only)                 │
│  Sandbox live HUD (Sandbox only), top-28 left-6          │
│                                                         │
│                  [CENTER]                               │
│              right-6 top-1/2 -translate-y-1/2           │
│              Inspector (service / connection panel)     │
│              w-64 — all game screens                    │
│                                                         │
│  [LC] left-6 top-1/2        [BL] bottom-6 left-6        │
│  Tutorial step panel         Palette — all game screens │
│  (Tutorial only)             w-auto                      │
│                                                         │
│                             [BR-inner] bottom-4 right-4 │
│                             Settings button — all       │
│                             screens, 36×36px, z-50       │
└─────────────────────────────────────────────────────────┘
```

## Element registry

| Element | Selector or owner | Position | z-index | Width | Screens |
|---------|-------------------|----------|---------|-------|---------|
| Palette | `app-service-palette` | `bottom-6 left-6` | 50 | auto | Tutorial, Sandbox, Challenges |
| Inspector | `app-service-inspector` | `right-6 top-1/2 -translate-y-1/2` | 50 | w-64 (256px) | Tutorial, Sandbox, Challenges |
| Sandbox live metrics | `sandbox-page.component.ts` | `top-28 left-6` | 40 | w-56 (224px) | Sandbox |
| Settings button | `app-settings` via `app.ts` | `bottom-4 right-4` | 50 | 36px | All screens |
| Tutorial step panel | `tutorial-page.component.html` | `left-6 top-1/2 -translate-y-1/2` | 50 | w-72 (288px) | Tutorial |
| Challenges objectives | `challenge-page.component.html` | `top-6 left-6` | 50 | w-64 (256px) | Challenges |
| Star toasts | `challenge-page.component.html` | `bottom-6 right-72` | 90 | dynamic | Challenges |
| Tutorial celebration | `tutorial-page.component.html` | `inset-0` | 100 | full screen | Tutorial |
| Challenge briefing | `challenge-page.component.html` | `inset-0` | 100 | full screen | Challenges |
| Challenge results | `challenge-page.component.html` | `inset-0` | 100 | full screen | Challenges |
| Settings overlay | `settings.component.ts` | `inset-0` | 200 | full screen | All screens |

## Placement rules

- Top-left is shared by Challenge objectives at `top-6 left-6` and Sandbox metrics at `top-28 left-6`.
- Left-center is reserved for the Tutorial step panel.
- Top-right is free for transient content; avoid persistent panels there.
- Right-center is reserved for the inspector.
- Bottom-left is reserved for the service palette.
- Bottom-right is reserved for the Settings button.
- Toasts use `bottom-6 right-72` to clear the inspector and stack upward.
- Full-screen overlays use `inset-0` and at least `z-[100]`. Settings uses `z-[200]`.

## z-index ladder

| Layer | Value | Usage |
|-------|-------|-------|
| Panels | 50 | Persistent panels |
| Toasts | 90 | Star toasts |
| Overlays | 100 | Tutorial celebration, challenge briefing, and results |
| Settings modal | 200 | Settings overlay |
