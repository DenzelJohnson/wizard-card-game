# Simplified Mode Cards Design

## Goal

Reduce each home-screen difficulty card to only the information the player needs to select or understand that mode.

## Design

- Easy is an enabled button containing only the visible label “Easy”.
- Medium is an enabled button containing only the visible label “Medium”.
- Hard remains a disabled button containing only “Hard”, a top-right “Beta” badge, and “Locked” beneath the name.
- Remove the suit icons, explanatory descriptions, Easy and Medium action taglines, Hard teaser copy, and the separate Beta note below the grid.
- Preserve the existing backgrounds, borders, hover/focus behavior, responsive grid, click behavior, disabled behavior, and accessible button names.

## Testing

Component tests will assert the exact visible content of each mode card and retain behavior checks for Easy, Medium, and disabled Hard. The full unit/build suite and Playwright browser suite will protect responsive layout and gameplay entry.
