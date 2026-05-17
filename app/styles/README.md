# Portal CSS Architecture

Single global entrypoint loaded by `app/layout.tsx`: `index.css`.

```
index.css
 ├── @import "tailwindcss"
 ├── tokens.css       # design tokens (--color-*, --font-*, --radius-*, --space-*)
 ├── base.css         # html/body/main reset + global typography + footer
 ├── header.css       # header + drawer (Shopify-derived) + portail overrides
 ├── components.css   # reusable: rs-btn, rs-panel, rs-pill, rs-metric-card, etc.
 └── pages.css        # page-scoped styles (home hero, depot, swipe overrides)
```

## Token naming

All theme tokens live in `tokens.css`. Use the canonical names:

| Concept       | Token                  |
| ------------- | ---------------------- |
| Brand pink    | `--color-brand`        |
| Brand hover   | `--color-brand-hover`  |
| Light pink    | `--color-brand-light`  |
| Pink border   | `--color-brand-border` |
| Pale pink     | `--color-brand-pale`   |
| Ink (text)    | `--color-ink`          |
| Page bg       | `--color-bg`           |
| Surface       | `--color-surface`      |
| Border        | `--color-border`       |
| Muted text    | `--color-muted`        |
| Subtle bg     | `--color-subtle`       |
| Display font  | `--font-display`       |
| Body font     | `--font-body`          |
| Page padding  | `--space-x`            |
| Content width | `--content-max`        |

Older variables (`--rs-brand-pink`, `--accent`, `--gray-200`, `--rs-page-bg`, …)
have been retired. Don't reintroduce them.

## Conventions

- One source of truth per concept (token / component / page).
- Mobile/desktop breakpoint: **900px**.
- `!important` is reserved for cascade-fights against Tailwind utility classes
  with the `!` prefix or for active-state precedence over hover. Today there
  are < 40 occurrences across all layers — keep that budget.
- Files outside `app/styles/` that stay separate:
  - `app/profils/profils-list.css` (imported by `app/profils/page.tsx`)
  - `app/swipe/swipe-stamps.css` (imported by `app/swipe/page.tsx`)
