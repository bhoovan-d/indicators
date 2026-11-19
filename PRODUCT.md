# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML/CSS/vanilla JS with no build step (TradingView lightweight-charts from a CDN), served on Vercel. A Python scraper (`scrape.py`) runs daily in GitHub Actions and commits `public/data/indicators.json`, which triggers the Vercel redeploy. Chosen because the data is small, daily and public, so no backend is needed.

## Users

Hedge-fund analysts and traders covering Indian equities. The main scene is a pre-market desk scan around 8 to 9:30 AM IST on a large monitor, checking which ground-level India indicators moved overnight or this week before the open.

## Product Purpose

India Pulse tracks four street-level daily indicators that move listed stocks: fuel pump prices, IBJA gold and silver rates, the cost of a veg thali, and city AQI. It covers 20 major cities, keeps at least 90 days of history, and sets each indicator beside the stocks it moves. It succeeds when a trader can tell in under a minute what changed, where, and which tickers it touches.

## Positioning

India Pulse puts official, city-level daily indicators (PPAC, IBJA, CPCB, Agmarknet) side by side with the linked NSE stocks in one place, refreshed every morning. Consumer price sites show one price per page for retail readers. Macro terminals carry national monthly CPI but not the daily street-level signal.

## Operating Context

- Read on a desktop monitor alongside a trading terminal, before market open.
- Data refreshes once a day (around 7:30 AM IST), plus the CPCB AQI bulletin, which is published around 4 PM for that day.
- Users compare cities, look for revisions (fuel), spikes (gold), food-inflation drift (thali) and seasonal AQI deterioration (Oct–Feb).

## Capabilities and Constraints

- Indicators:
  - Fuel: petrol and diesel in ₹/L, CNG in ₹/kg.
  - Gold: 24K and 22K in ₹/10 g, silver in ₹/kg.
  - Thali: ingredient cost in ₹ per plate at mandi wholesale prices.
  - AQI: 0 to 500.
- Coverage: 20 cities. Fuel and AQI keep 90 days of history. Gold history starts 30 days back and grows daily. Thali history depends on the data.gov.in API key.
- Extras:
  - A linked-stock overlay for each indicator.
  - Day and week change alerts.
  - A cross-city comparison.
- Free data only. There is no CSV export (the user declined it).
- Data honesty:
  - Non-metro petrol and diesel before the first scrape are reconstructed from monthly summaries.
  - CNG history is monthly.
  - Thali is wholesale (mandi), not retail.
  - The UI must say all three where relevant.

## Evidence on Hand

All data is real and scraped from public sources into `public/data/indicators.json`. There are no testimonials, customers or performance claims, and none may be invented.

## Product Principles

1. The change is the headline: lead with what moved, by how much, and since when.
2. Every number names its source and its unit.
3. Say which data is reconstructed or wholesale; never imply false precision.
4. Make cross-city comparison and the stock link one click away, never buried.
5. Density over decoration: this is a working instrument for professionals.

## Brand Commitments

- Name: India Pulse.
- It must not feel like a consumer price site, crypto/neon flashiness, or a generic SaaS admin template.
