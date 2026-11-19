---
name: India Pulse
description: Street-level Indian indicators posted like a fuel-station rate board, for the pre-market scan.
colors:
  canopy-green: "#133b2f"
  canopy-green-2: "#23564a"
  signal-saffron: "#f08a00"
  saffron-ink: "#a85c00"
  steel-enamel: "#e7ebe6"
  enamel-panel: "#fbfcfa"
  rule: "#cdd6d0"
  rule-soft: "#e2e8e3"
  selected-row: "#dfe8e2"
  ink-2: "#44564f"
  ink-3: "#5f6f68"
  digit-light: "#f1f5f2"
  rise: "#a8321d"
  fall: "#1e5fa0"
  alert-tint: "#f6e7e4"
  alert-ink: "#8a2a17"
  overlay-stock: "#88a096"
  bar-ink: "#bfd0c8"
  alert-rule: "#ebcdc6"
  disabled-ink: "#9fada6"
typography:
  board-digits:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  board-title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.05em"
  section-title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
  table-value:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  body-small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  cell: "2px"
  control: "3px"
  panel: "4px"
spacing:
  gap: "16px"
  gutter: "24px"
  row-x: "14px"
components:
  digit-cell:
    backgroundColor: "{colors.canopy-green}"
    textColor: "{colors.digit-light}"
    typography: "{typography.board-digits}"
    rounded: "{rounded.cell}"
    padding: "4px 9px 2px"
  digit-cell-selected:
    backgroundColor: "{colors.enamel-panel}"
    textColor: "{colors.canopy-green}"
    rounded: "{rounded.cell}"
  board-header:
    backgroundColor: "{colors.canopy-green}"
    textColor: "#ffffff"
    typography: "{typography.board-title}"
    padding: "8px 14px"
  alert-strip:
    backgroundColor: "{colors.alert-tint}"
    textColor: "{colors.alert-ink}"
    padding: "6px 14px"
  segmented-on:
    backgroundColor: "{colors.canopy-green}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "5px 10px"
---

# Design System: India Pulse

## Overview

**Creative North Star: "The Morning Rate Board"**

India Pulse posts the country's street-level prices the way a fuel station posts its rates. Green canopy fascia runs across the top, cool white enamel panels sit below, and every price sits in a dark window with light, heavy, condensed digits that are revised in place each morning. The system serves a trader scanning before the open, so density and alignment come before decoration. Each board says its unit and its source in the header, and history that was reconstructed rather than observed is drawn dashed.

The world contributes only four things: type (condensed tabular board digits), palette (green, steel enamel, one reserved saffron), density (boards of three priced rows), and one signature move (a revised price flips into its window on first load). Layout, navigation and controls stay standard web: a select, tabs, a segmented control, a sortable table.

It must never read as a consumer price site, crypto or neon, or a generic SaaS card grid.

**Key Characteristics:**
- Prices in fixed-width green digit windows, aligned within each board.
- One reserved accent: signal saffron marks the selected city and nothing else.
- Line form carries data state: solid means observed, dashed means reconstructed.
- Flat enamel: no shadows, gradients or glow.

## Colors

The palette is restrained: a cool enamel ground, a green that carries structure, and one saffron that is never decorative.

### Primary
- **Canopy Green** (#133b2f): top bar, board headers, digit windows, chart lines, active segmented control. It carries all structure.

### Secondary
- **Signal Saffron** (#f08a00): the 4px canopy band under the top bar and the selected city everywhere (its board label, its Compare row and bar). Nothing else.
- **Saffron Ink** (#a85c00): the same saffron darkened for text. Bright saffron is 2.4:1 on enamel, too faint for a city name, so the selected city's *text* uses Saffron Ink (4.9:1) while the band, bars and wordmark keep Signal Saffron.

### Neutral
- **Steel Enamel** (#e7ebe6): the page ground.
- **Enamel Panel** (#fbfcfa): boards, boxes, the chart background.
- **Rule** (#cdd6d0) and **Soft Rule** (#e2e8e3): borders, and the dividers between rows.
- **Slate Inks** (#44564f, #5f6f68): secondary text, dates, units and hints.
- **Digit Light** (#f1f5f2): numerals inside digit windows.
- **Bar Ink** (#bfd0c8): secondary text on the green bar and board headers.
- **Disabled Ink** (#9fada6): metric buttons with no data yet.

### State
- **Rise** (#a8321d) and **Fall** (#1e5fa0): direction of change; a flat change uses Slate Ink. Fall is blue, not green, so a falling price never blends into the green structure.
- **Alert Tint** (#f6e7e4) with **Alert Ink** (#8a2a17): the alert strip at the top of a board.
- **CPCB AQI scale** (Good #2f8f46 · Satisfactory #8cbf3f · Moderate #f2d43a · Poor #ef8a2f · Very Poor #d93a2b · Severe #8a1f1a): AQI category chips only. This is the national standard, an accepted exception to the saffron reservation.

### Named Rules
**The Reserved Saffron Rule.** Signal saffron means "your city". Any other use of saffron, or a tint of it, breaks the rule; alerts use the rise family instead.

## Typography

**Display/Digits Font:** Barlow Condensed (with Arial Narrow)
**Body Font:** Barlow (with system-ui)

**Character:** the condensed grotesque of a station price board, heavy and tabular. Barlow keeps the UI plain.

### Hierarchy
- **Board digits** (700, 38px, line-height 1, tnum): every headline price, inside a digit window. 34px on phones.
- **Board title** (700, 24px, uppercase, 0.05em): FUEL, GOLD, THALI, AQI.
- **Section title** (700, 22px): Compare, Movers, Chart, Sources.
- **Table value** (600, 20px, tnum): values in the Compare ranking.
- **Body** (400, 15px/1.4): UI text, plus notes at 13px.
- **Label** (600, 12px, uppercase, 0.06em): table headers and chips.

### Named Rules
**The Tabular Rule.** Every number on screen uses tabular figures, so digits line up down a column.

## Layout

The page is a desk, not a scroll. The board rail on the left is 392px wide, and the pinned workspace to its right fills the rest; the workspace stays at viewport height below the 56px bar. The workspace stacks, top to bottom:
1. A readout and controls row: metric switch, city, range 7D/30D/90D/All, stock overlay.
2. The chart.
3. The legend.
4. Compare (1.5fr) beside Movers (1fr), each scrolling inside its own pane.

Every interaction (board row, metric, city, range, compare row, mover) updates the workspace in place, and the page never scrolls. Sources sit in a footer below.

At 1100px and narrower, the rail becomes a horizontal scroll-snap strip of boards above an unpinned workspace. At 640px the side gutters drop to 16px. The page has a 16px gap and a 24px gutter, with 5px by 12px row padding.

### Named Rules
**The Stay-Put Rule.** No control may scroll the page; anything a click changes must already be on screen beside the thing clicked.

## Elevation & Depth

The system is flat. Depth comes from tone: green bars over enamel panels over the steel ground, separated by 1px rules. There are no shadows anywhere. The only `box-shadow` is the 2px inset frame on a selected digit window, which is a state marker, not depth.

### Named Rules
**The Enamel Rule.** Surfaces are flat painted enamel: no bevels, gradients, glows or blur.

## Shapes

The corners are near square: 2px on digit windows, 3px on controls, 4px on panels. Rectangles are framed by 1px rules. The only round shape is the 8px severity dot in Movers.

## Components

### Digit window (signature)
- **Shape:** a flat green cell (2px radius). Its width is fixed per board from that board's longest value (`--cell` in ch), so windows align.
- **Selected:** inverted to an enamel fill with green numerals and a 2px inset green frame. It must stay distinct from the keyboard focus outline (2px green at a 2px offset).
- **Motion:** on first load only, a revised value slides into its window (700ms, cubic-bezier(.16,1,.3,1), staggered 80ms per row). This is disabled under prefers-reduced-motion and never replays on interaction.

### Board
- A green header with the title, plus its unit and source on the right.
- An alert strip (tinted) or a calm "No alerts" line.
- Three price rows, each with a label, date/note, digit window and Δday over Δweek.
- A 90-day line labelled with start date, low and high, and end date. The reconstructed part is dashed.

### Compare table
- A ranked list of the 20 cities with sortable headers (an SVG chevron marks the sorted column) and a green value bar.
- The selected city's row and bar are saffron. Clicking a row switches the city.

### Navigation
- Green top bar with the uppercase condensed wordmark ("Pulse" in saffron) and anchor tabs in slate (hover: white with a 2px underline).
- A native city select and the data timestamp sit on the right.

### Controls
- A segmented range control (active segment in green).
- Native selects with 1px rule borders and a 3px radius.

### City matrix (Cities view)
- **What:** all 20 cities against every city-level indicator (petrol, diesel, CNG, thali, AQI) plus a Pressure score, which is the average of a city's percentile ranks across the indicators it has.
- **Level mode:** sequential, one green hue, five steps light to dark: #e0ebe5, #b2cdbf, #7fa694, #3b6b5a, #133b2f. The step comes from the city's percentile among the 20; darker means higher. Ink is green on the three light steps and white on the two dark ones.
- **30-day change mode:** diverging. Falling is blue (#dce8f4, #93b6db, #1e5fa0), rising is red-brown (#f2dcd7, #d99a90, #a8321d), and the midpoint is neutral grey (#eceeec). Steps scale to the column's largest move.
- **Cells:** 2px surface gap between fills (`border-spacing: 2px`), value on top and rank plus change below, a 2px green inset ring on hover. A missing indicator renders as an enamel "—" cell.
- **Behaviour:** clicking a cell opens that city and metric on the Desk, and the Back button returns to the matrix. Headers sort. The city column is sticky, and the table scrolls inside its box on phones.

## Do's and Don'ts

### Do:
- **Do** put every headline price in a digit window and keep windows the same width within a board.
- **Do** name the unit and the source in every board header.
- **Do** draw reconstructed history dashed and say so in the chart legend.
- **Do** use rise (#a8321d) and fall (#1e5fa0) for change, and slate for no change.

### Don't:
- **Don't** use saffron for anything but the selected city and the canopy band.
- **Don't** render digits as glowing LEDs or add neon, glass or gradients.
- **Don't** fall back to KPI cards with floating sparklines; values live in board rows.
- **Don't** mark selection with a colored side stripe.
