# `!important` Audit (Phase 6)

Snapshot of `!important` usage in app-level CSS after refactor.

## Count by file

- `globals.css`: `0`
- `portal-theme.css`: `8`
- `rs-shopify-header.css`: `101`
- `rs-shopify-header-mobile.css`: `59`
- `rs-shopify-ui.css`: `18`
- `rs-ds-paris.css`: `247`
- `rs-modern-portal.css`: `45`
- `rs-portal-header.css`: `241`
- `rs-portal-header-next.css`: `19`

## Why many `!important` remain

- The project intentionally layers historical CSS sources (Shopify legacy + DS + portal overrides).
- Many selectors are cross-file overrides where the original source cannot be safely rewritten yet.
- Removing these flags blindly is high regression risk for mobile header, drawer, and swipe layouts.

## Safe strategy for reduction

1. **Start with leaf pages/components** (avoid header first).
2. Convert one cluster at a time (e.g. profils list, then depot stepper).
3. For each cluster:
   - remove a small set of `!important`,
   - run build/lint,
   - perform visual checks on mobile + desktop.
4. Keep header/swipe `!important` rules until the legacy stacks are fully consolidated.
