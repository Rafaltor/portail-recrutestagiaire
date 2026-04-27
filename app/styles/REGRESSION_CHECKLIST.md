# CSS Regression Checklist

Use this checklist after any global style change.

## Core Pages

- `/` (home)
  - hero title wraps on mobile
  - hero buttons fit width
  - "Le meilleur CV" CTA placement is correct on mobile
- `/profils`
  - mobile filter card has no horizontal overflow
  - cards align and text wraps correctly
- `/depot`
  - no horizontal scroll on iPhone widths
  - stepper labels remain readable
  - success links do not overflow
- `/swipe`
  - top chrome/header offset is correct
  - no hidden footer regression on swipe mode

## Header / Drawer

- mobile header bar: logo/title/burger alignment
- drawer open/close animation and overlay
- desktop nav alignment and active tab styling
- homepage transparent/solid header transition on scroll

## Cross-Cutting

- run `npm run build`
- check for new lints in edited files
- spot-check at least one small mobile viewport (~375px)
