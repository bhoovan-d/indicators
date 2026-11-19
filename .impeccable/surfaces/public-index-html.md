---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

# Surface: India Pulse dashboard (public/index.html)

Mode: Operate. Audience: hedge-fund analysts and traders doing a pre-market desk scan (8 to 9:30 AM IST, large monitor). Job: see what moved in fuel, gold, thali and AQI across 20 cities and which linked stocks it touches, in under a minute. The user chose four indicator panels as the first view, with alerts as badges on the panels. Constraints: free public data, honesty labels (reconstructed, wholesale, monthly CNG), no CSV export.

## Direction contract

THESIS: Every indicator is posted like the rate board at an Indian fuel station: big tabular digits on enamel panels, revised in place each morning. It refuses the KPI-card-grid-with-sparklines arrangement.

OWN-WORLD: Cool steel-enamel ground (#e9ecf0) with #fbfcfd panels. The ground moved from #f4f2ec after the detector flagged it as cream, and real enamel signs are cool white anyway. Navy (#14213d) panel headers and top bar, a 4px orange (#e8590c) canopy band under the bar. Prices sit in flat navy digit cells with light numerals, like a pump totem's windows. Orange is reserved for the selected city across every panel, chart and ranking. Barlow Condensed for board digits and panel titles, Barlow for UI. State is shown by line form (solid real, dashed reconstructed), with rise in red-brown and fall in green. No glow, no neon. Exception: AQI category chips use CPCB's national colour scale, which traders read as a standard.

STORY: The trader sees four boards for the chosen city with Δday and Δweek, and alert strips on any board that moved. They click a board to open its chart with the linked-stock overlay, then scan the 20-city ranking.

FIRST VIEWPORT:
- Navy top bar: wordmark, tabs, city select, data timestamp.
- Four equal enamel boards across, each with 3 rows of 40px digits plus a 90-day line.
- Below: a movers list (1/3) and the 20-city ranked board (2/3).

FORM: Pump Price Board, item 5 on my ordered list; seed:e17681a3a71154e3. Signature move: a revised value redraws in place on its board (the digit-panel flip), and the selected city is orange everywhere.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
