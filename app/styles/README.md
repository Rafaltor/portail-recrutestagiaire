# Portal CSS Layers

This folder defines a single global CSS entrypoint for the portal app: `index.css`.

## Layer Order (must stay stable)

1. `base.css`  
   Global tokens/resets (`globals.css`).
2. `header.css`  
   Header foundation + mobile header/drawer shell.
3. `theme.css`  
   UI components, theme tokens, and broad visual overrides.
4. `overrides.css`  
   Portal-specific header overrides and final cascade adjustments.

## Rule of Thumb

- Keep styles scoped with `.rs-*` selectors.
- Prefer `min-width: 0` on flex/grid children to avoid overflow issues.
- Add new global rules in the narrowest layer possible.
- If a new rule depends on cascade priority, place it in `overrides.css`.

## Operational Docs

- `IMPORTANT_AUDIT.md`: baseline and strategy to reduce `!important` safely.
- `REGRESSION_CHECKLIST.md`: manual verification checklist after style changes.
