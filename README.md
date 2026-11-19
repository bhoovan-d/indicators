# India Pulse

A daily dashboard of street-level Indian indicators for traders: fuel, gold, the cost of a thali and AQI across 20 cities, each shown beside the stocks it moves.

| Indicator | Source (all free) | History |
|---|---|---|
| Petrol, diesel: metros | PPAC daily RSP PDF (IOC retail prices) | 90 days, official |
| Petrol, diesel: 16 other cities | goodreturns.in city pages | Daily from the first scrape; older history reconstructed from monthly summaries and drawn dashed |
| CNG | goodreturns.in | Monthly history, then daily |
| Gold 24K/22K, silver | IBJA 30-day PDF | 30 days, then grows daily |
| Thali (veg, ₹/plate) | Agmarknet mandi modal prices via the data.gov.in API | Backfills 90 days once `DATA_GOV_KEY` is set |
| AQI | CPCB daily 4 PM bulletin PDF | 90 days |
| Linked stocks | Yahoo Finance chart API | 6 months |

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:DATA_GOV_KEY = "<your data.gov.in key>"   # optional; the public demo key gets throttled
.venv\Scripts\python scrape.py                 # idempotent: fills any missing days in the last 90
.venv\Scripts\python test_scrape.py            # parser self-check
python -m http.server 8765 --directory public  # then open http://localhost:8765
```

## Deploy (GitHub Actions + Vercel)

1. Push this folder to a GitHub repo.
2. In the repo, go to Settings → Secrets and variables → Actions and add `DATA_GOV_KEY`. Get a free key at data.gov.in: sign up, then My Account → API key.
3. In Vercel, import the repo. Choose framework "Other" with no build command; the output directory `public` comes from `vercel.json`.
4. `.github/workflows/scrape.yml` runs at 07:30 and 17:00 IST and commits `public/data/indicators.json`. Each commit redeploys Vercel. You can also run it by hand from the Actions tab.

If a government site blocks GitHub's US runners, that source shows "failing" under Sources on the dashboard and every other source keeps working. The fallback is to run `scrape.py` on any machine in India and push the result.
