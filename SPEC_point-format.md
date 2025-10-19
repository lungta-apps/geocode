# Feature: Point Formatting Toolbar (UI-only)

Branch: feature/point-format

Goal: Enhance the existing marker popup to include a compact toolbar with 3 buttons:
1) Icon picker → shows a grid of icon choices; apply to the selected marker.
2) Color picker → shows a row of color swatches; apply to the selected marker.
3) Label editor → toggles a small text input; typing updates the marker label live.

Constraints:
- Frontend-only (no backend/API changes).
- Integrate into the EXISTING marker popup UI, above the “Delete Marker” button.
- Keep current popup content (geocode + address + delete) intact.
- Use existing map library and state; store chosen icon/color/label in the same in-memory state used for markers.
- ESM imports only; do not modify package.json scripts.
- Keep styles simple and consistent with current UI.

Deliverables:
- Updated popup component renders a toolbar with 3 buttons.
- Clicking a button reveals its panel (icons, colors, or label input).
- Selecting an option immediately updates the selected marker’s appearance/label.
- Brief summary of changed files and how to use the new controls.

Testing:
- Run `npx vercel dev --yes --listen 4321` and verify:
  - Left-click marker → popup shows toolbar.
  - Icon/color changes are visible.
  - Label input updates text live.
