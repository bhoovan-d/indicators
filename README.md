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

## How it updates

Live at https://india-pulse-phi.vercel.app (Vercel project `bhoovan-int/india-pulse`, linked to this repo). Every push redeploys it.

| What | Where it runs | When | Writes |
|---|---|---|---|
| Fuel, gold, AQI, stocks | GitHub Actions (`.github/workflows/scrape.yml`, `scrape.py --skip-thali`) | 07:30 and 17:00 IST, and whenever the scraper changes | `public/data/indicators.json` |
| Thali | This PC: Windows task **India Pulse thali** runs `run_thali.ps1` (`scrape.py --only-thali`) | 08:00 daily, or at next login if the PC was off | `public/data/thali.json` |

Thali runs from a PC because data.gov.in times out every connection from GitHub's US servers. The two writers use separate files, so their commits never conflict, and the dashboard merges them.

- The PC needs the data.gov.in key in `.env` (gitignored; the bare key or `DATA_GOV_KEY=...`). GitHub no longer needs it.
- Check the PC job's log in `thali.log`. Run it by hand with `powershell -File run_thali.ps1`.
- If a source fails, it shows "failing" under Sources on the dashboard and the others keep working.

To set this up on another machine, register the same task:

```powershell
$a = New-ScheduledTaskAction -Execute powershell.exe -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<path>\run_thali.ps1"'
Register-ScheduledTask -TaskName "India Pulse thali" -Action $a -Trigger (New-ScheduledTaskTrigger -Daily -At 8:00am) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable)
```
