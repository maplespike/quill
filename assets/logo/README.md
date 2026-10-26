# Quill mark

The product mark for Quill, drawn to sit beside the MapleSpike parent mark.

Both are straight-line geometry on a 32x32 grid with one dominant point and one
split: the leaf points up and splits into notches, the nib points down and splits
at the crown. No curves, no gradients, no filters.

## Files

| File | Use |
|---|---|
| `logo.svg` | the mark on a paper plate, for READMEs and anywhere the background is unknown |
| `logo.png` | 512 px render of `logo.svg` |
| `mark.svg` | the mark alone, transparent, for the portal and print |
| `lockup.svg` | mark + wordmark, for light backgrounds |
| `lockup-dark.svg` | mark + wordmark, for dark backgrounds |

The portal consumes `packages/portal/public/favicon.svg` and the PNG icon set.

## Colour

| Field | Mark | Plate |
|---|---|---|
| paper (`#F4F2EC`) | `#A63029` | none |
| dark (`#0A0E17`) | `#E84545` | none |

`#A63029` on `#F4F2EC` is 5.2:1. `#E84545` on `#0A0E17` is 5.03:1. Both pass
WCAG AA for graphics.

## Size

- Mark alone: 16 px minimum.
- Lockup: 96 px wide minimum.

## Do not

- Do not add a nib slit thinner than 1.2 units on the 32 grid; it fills in at
  16 px.
- Do not put the mark on the MapleSpike leaf's red field.
- Do not rotate or outline it.
