"""Daily scraper for India daily indicators. Idempotent: run any time, it fills gaps.

    python scrape.py            # update everything, backfilling missing days in the window
    python scrape.py --days 90  # window size (default 90)

Writes public/data/indicators.json: {"updated", "series": {key: {date: value}}, "meta"}.
Env: DATA_GOV_KEY (data.gov.in API key, for thali mandi prices).
"""
import io, json, os, re, statistics, sys, time
from datetime import date, datetime, timedelta, timezone

import requests
from pypdf import PdfReader

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "data", "indicators.json")
# Thali lives in its own file: data.gov.in blocks GitHub's servers, so it is scraped from a PC in India
# (run_thali.ps1) while GitHub Actions writes everything else. Separate files mean their commits never conflict.
THALI_OUT = os.path.join(os.path.dirname(OUT), "thali.json")
IST = timezone(timedelta(hours=5, minutes=30))
TODAY = datetime.now(IST).date()
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
try:  # local runs: a gitignored .env next to this file holds DATA_GOV_KEY=... (or just the bare key)
    for _l in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), encoding="utf-8-sig"):
        _l = _l.strip()
        if not _l or _l.startswith("#"):
            continue
        _k, _, _v = _l.partition("=") if "=" in _l else ("DATA_GOV_KEY", "", _l)
        os.environ.setdefault(_k.strip(), _v.strip().strip('"\''))
except FileNotFoundError:
    pass
DATA_GOV_KEY = os.environ.get("DATA_GOV_KEY", "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b")  # public demo key, heavily rate-limited

# city: (goodreturns slug, CPCB bulletin name(s) "|"-separated (later alphabetical wins), agmarknet state, agmarknet district)
CITIES = {
    "Delhi": ("new-delhi", "Delhi", "NCT of Delhi", "Delhi"),
    "Mumbai": ("mumbai", "Mumbai", "Maharashtra", "Mumbai"),
    "Kolkata": ("kolkata", "Kolkata", "West Bengal", "Kolkata"),
    "Chennai": ("chennai", "Chennai", "Tamil Nadu", "Chennai"),
    "Bengaluru": ("bangalore", "Bengaluru", "Karnataka", "Bangalore"),
    "Hyderabad": ("hyderabad", "Hyderabad", "Telangana", "Hyderabad"),
    "Pune": ("pune", "Pune", "Maharashtra", "Pune"),
    "Ahmedabad": ("ahmedabad", "Ahmedabad", "Gujarat", "Ahmedabad"),
    "Jaipur": ("jaipur", "Jaipur", "Rajasthan", "Jaipur"),
    "Lucknow": ("lucknow", "Lucknow", "Uttar Pradesh", "Lucknow"),
    "Chandigarh": ("chandigarh", "Chandigarh", "Chandigarh", "Chandigarh"),
    "Bhopal": ("bhopal", "Bhopal", "Madhya Pradesh", "Bhopal"),
    "Indore": ("indore", "Indore", "Madhya Pradesh", "Indore"),
    "Patna": ("patna", "Patna", "Bihar", "Patna"),
    "Kochi": ("ernakulam", "Eloor|Kochi", "Kerala", "Ernakulam"),
    "Thiruvananthapuram": ("trivandrum", "Thiruvananthapuram", "Kerala", "Thiruvananthapuram"),
    "Bhubaneswar": ("bhubaneswar", "Bhubaneswar", "Odisha", "Khurda"),
    "Guwahati": ("guwahati", "Guwahati", "Assam", "Kamrup"),
    "Nagpur": ("nagpur", "Nagpur", "Maharashtra", "Nagpur"),
    "Surat": ("surat", "Surat", "Gujarat", "Surat"),
}
PPAC_METROS = ["Delhi", "Mumbai", "Chennai", "Kolkata"]  # column order in the PPAC PDF

# Veg thali: raw kg per plate (CRISIL roti-rice-rate style basket). Agmarknet commodity names; first alias with rows wins.
THALI = {  # item: ([names...], agmarknet commodity code, kg per plate)
    "rice": (["Rice"], 3, 0.100),
    "wheat": (["Wheat"], 1, 0.060),  # rotis
    "tur dal": (["Red gram/Arhar/Tur(whole)", "Arhar Dal(Tur Dal)", "Arhar (Tur/Red Gram)(Whole)", "Arhar(Tur/Red Gram)(Whole)"], 49, 0.060),
    "onion": (["Onion"], 23, 0.050),
    "tomato": (["Tomato"], 65, 0.050),
    "potato": (["Potato"], 24, 0.070),
}

STOCKS = {
    "fuel": ["IOC.NS", "BPCL.NS", "HINDPETRO.NS", "IGL.NS", "MGL.NS", "CONCOR.NS", "BZ=F"],  # BZ=F: Brent, $/bbl
    "gold": ["TITAN.NS", "KALYANKJIL.NS", "MUTHOOTFIN.NS", "MANAPPURAM.NS"],
    "thali": ["^NSEBANK", "HINDUNILVR.NS", "JUBLFOOD.NS", "^CNXFMCG"],
    "aqi": ["APOLLOHOSP.NS", "BLUESTARCO.NS", "TMPV.NS", "OLAELEC.NS"],
}

S = requests.Session()
S.headers.update(UA)


def get(url, tries=4, **kw):
    for i in range(tries):
        try:
            r = S.get(url, timeout=45, **kw)
            if r.status_code == 404:
                return r
            r.raise_for_status()
            return r
        except requests.RequestException:
            if i == tries - 1:
                raise
            time.sleep(2 ** i * 2)


def text(html):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    import html as h
    return re.sub(r"\s+", " ", h.unescape(t))


def pdf_text(content):
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


class Store:
    def __init__(self, days, path=OUT):
        self.path = path
        self.start = TODAY - timedelta(days=days)
        try:
            self.d = json.load(open(path, encoding="utf8"))
        except FileNotFoundError:
            self.d = {"series": {}, "meta": {"status": {}}}

    def put(self, key, day, val, overwrite=True):
        if day < self.start or day > TODAY or val is None:
            return
        s = self.d["series"].setdefault(key, {})
        k = day.isoformat()
        if overwrite or k not in s:
            s[k] = round(float(val), 2)

    def real_since(self, key, day):
        """First date of genuine daily quotes; earlier values were reconstructed. Fixed on first run."""
        self.d["meta"].setdefault("real_since", {}).setdefault(key, day.isoformat())

    def has(self, key, day):
        return day.isoformat() in self.d["series"].get(key, {})

    def save(self):
        self.d["updated"] = datetime.now(IST).isoformat(timespec="minutes")
        for k, s in self.d["series"].items():
            self.d["series"][k] = dict(sorted(s.items()))
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf8") as f:
            json.dump(self.d, f, separators=(",", ":"))


def days(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


# ---------------- Fuel ----------------
def fuel_ppac(st):
    """Official IOC retail prices for the 4 metros, daily since 2017 (PPAC)."""
    page = get("https://ppac.gov.in/retail-selling-price-rsp-of-petrol-diesel-and-domestic-lpg/rsp-of-petrol-and-diesel-in-metro-cities-since-16-6-2017").text
    link = re.search(r"https://ppac\.gov\.in/uploads/page-images/[^\"']*DailyPriceMSHSD_Metro[^\"']*\.pdf", page).group(0)
    num = r"\s+([\d.]+)"
    rx = re.compile(r"(\d{1,2}-[A-Za-z]{3}-\d{2})" + num * 4 + r"\s+\1" + num * 4)
    n = 0
    for m in rx.finditer(pdf_text(get(link).content)):
        day = datetime.strptime(m.group(1), "%d-%b-%y").date()
        for i, city in enumerate(PPAC_METROS):
            st.put(f"fuel.petrol.{city}", day, m.group(2 + i))
            st.put(f"fuel.diesel.{city}", day, m.group(6 + i))
        n += 1
    assert n, "no rows parsed from PPAC PDF"


MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August",
                                      "September", "October", "November", "December"], 1)}


def fill_steps(st, key, anchors, overwrite=False):
    """Forward-fill sparse (date, value) anchors into daily values (step function)."""
    anchors = sorted(a for a in anchors if a[0] <= TODAY)
    for (d0, v), nxt in zip(anchors, anchors[1:] + [(TODAY + timedelta(days=1), None)]):
        for d in days(d0, nxt[0] - timedelta(days=1)):
            st.put(key, d, v, overwrite=overwrite)


def fuel_goodreturns(st, city, slug, kind):
    """Petrol/diesel: today + last 10 days daily (real), older days reconstructed from monthly summaries."""
    t = text(get(f"https://www.goodreturns.in/{kind}-price-in-{slug}.html").text)
    key = f"fuel.{kind}.{city}"
    m = re.search(r"Today \((\d+)\w\w (\w{3}), (\d{4})\), Rs\. ([\d.]+)", t)
    real = []
    if m:
        real.append((datetime.strptime(f"{m[1]} {m[2]} {m[3]}", "%d %b %Y").date(), m[4]))
    for m in re.finditer(r"(\w+) (\d{1,2}), (\d{4}) ₹\s?([\d.]+) [-+]?[\d.]+", t):
        if m[1] in MONTHS:
            real.append((date(int(m[3]), MONTHS[m[1]], int(m[2])), m[4]))
    # Monthly summaries: "<Kind> Rate in City, October 2026 Details Price 1 st October ₹ 110.9 31 st October ₹ 111.2
    #   Highest rate in October ₹ 111.68 on October 2 Lowest Rate in October ₹ 110.44 on October 18"
    anchors = []
    for m in re.finditer(r"Rate in [\w ]+, (\w+) (\d{4}) Details Price 1 st \w+ ₹ ([\d.]+) (\d+) \w\w \w+ ₹ ([\d.]+) "
                         r"Highest rate in \w+ ₹ ([\d.]+) on \w+ (\d+) Lowest Rate in \w+ ₹ ([\d.]+) on \w+ (\d+)", t):
        y, mo = int(m[2]), MONTHS.get(m[1])
        if not mo:
            continue
        anchors += [(date(y, mo, 1), float(m[3])), (date(y, mo, int(m[7])), float(m[6])), (date(y, mo, int(m[9])), float(m[8]))]
        last = date(y, mo, int(m[4]))
        if last < TODAY:
            anchors.append((last, float(m[5])))
    fill_steps(st, key, anchors + [(d, float(v)) for d, v in real])
    assert real, f"no prices parsed for {kind} {city}"
    for d, v in real:
        st.put(key, d, v)  # real daily quotes always win
    st.real_since(key, min(d for d, _ in real))


def cng_goodreturns(st, city, slug):
    """CNG: today's price (real) + monthly history (reconstructed: each month's price held for the month)."""
    r = get(f"https://www.goodreturns.in/cng-price-in-{slug}.html", allow_redirects=False)
    if r.status_code != 200:
        return  # city has no CNG page
    t = text(r.text)
    key = f"fuel.cng.{city}"
    anchors = [(date(int(m[2]), MONTHS[m[1]], 1), float(m[3]))
               for m in re.finditer(r"(\w+) (\d{4}) ₹([\d.]+) [-+]?[\d.]+", t) if m[1] in MONTHS]
    m = re.search(r"Today Rs\. ([\d.]+)/Kg \((\d+)\w\w (\w{3}), (\d{4})\)", t)
    if m:
        today = datetime.strptime(f"{m[2]} {m[3]} {m[4]}", "%d %b %Y").date()
        # ponytail: current month's change date unknown; we assume it applied from the 1st.
        anchors.append((today.replace(day=1), float(m[1])))
        st.put(key, today, m[1])
        st.real_since(key, today)
    fill_steps(st, key, anchors)


# ---------------- AQI ----------------
AQI_ROW = re.compile(r"^\d+\s+(.+?)\s+(Good|Satisfactory|Moderate|Poor|Very Poor|Severe)\s+(\d+)\s+(.+?)\s+\d+\s*/\s*\d+\s*$", re.M)


def aqi_cpcb(st):
    """CPCB daily 4 PM bulletin (24h average), one PDF per day; fetch any missing day in window."""
    want = {n: c for c, v in CITIES.items() for n in v[1].split("|")}
    misses = 0
    for day in sorted(days(st.start, TODAY), reverse=True):
        if all(st.has(f"aqi.{c}", day) for c in CITIES):
            continue
        r = get(f"https://www.cpcb.gov.in/upload/Downloads/AQI_Bulletin_{day:%Y%m%d}.pdf")
        if r.status_code == 404 or not r.content.startswith(b"%PDF"):
            misses += 1
            continue
        for m in AQI_ROW.finditer(pdf_text(r.content)):
            name = re.sub(r"\s+", " ", m[1]).strip()
            if name in want:
                st.put(f"aqi.{want[name]}", day, m[3])
        time.sleep(0.5)
    print(f"  aqi: {misses} days without a bulletin")


# ---------------- Gold ----------------
def gold_ibja(st):
    """IBJA benchmark rates: 30-day PDF linked from the homepage. PM (closing) rate preferred, AM if PM missing."""
    home = get("https://ibjarates.com/").text
    href = re.search(r"UploadedFiles/30DaysPdf/[^\"']+\.pdf", home).group(0)
    t = pdf_text(get("https://ibjarates.com/" + requests.utils.requote_uri(href)).content)
    n = 0
    for line in t.splitlines():
        m = re.match(r"(\d{1,2}-[A-Za-z]{3}-\d{2})\s+([\d\s]+)$", line.strip())
        if not m:
            continue
        v = [int(x) for x in m[2].split()]
        day = datetime.strptime(m[1], "%d-%b-%y").date()
        if len(v) == 12:    # AM/PM pairs: 999, 995, 916, 750, 585, silver
            g24, g22, ag = v[1], v[5], v[11]
        elif len(v) == 6:   # AM only (PM not yet published)
            g24, g22, ag = v[0], v[2], v[5]
        else:
            continue
        st.put("gold.24k", day, g24)
        st.put("gold.22k", day, g22)
        st.put("gold.silver", day, ag)
        n += 1
    assert n, "no rows parsed from IBJA PDF"


# ---------------- Thali ----------------
def mandi(day, name=None, code=None):
    rows, off = [], 0
    flt = {"filters[Commodity]": name} if name else {"filters[Commodity_Code]": code}
    while True:
        r = get("https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24", params={
            "api-key": DATA_GOV_KEY, "format": "json", "limit": 1000, "offset": off,
            "filters[Arrival_Date]": f"{day:%d/%m/%Y}", **flt}).json()
        if "records" not in r:
            raise RuntimeError(f"data.gov.in: {r.get('error') or r.get('message') or r}")
        rows += [x for x in r["records"] if x.get("Modal_Price")]
        off += 1000
        if off >= int(r.get("total") or 0):
            return rows


def norm(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


def thali_mandi(st, max_days=None):
    """Veg thali ingredient cost at mandi (wholesale) modal prices. City = median of its district's markets,
    falling back to its state, then all-India. Rs/quintal -> Rs/kg. Ingredient series are kept even on days
    the full basket is incomplete; the thali itself needs every ingredient."""
    matched = st.d["meta"].setdefault("thali_matched", {})  # item -> the name/code that returned rows
    todo = [d for d in sorted(days(st.start, TODAY), reverse=True) if not st.has("thali_raw.India", d)]
    made, missing = 0, {}
    for i, day in enumerate(todo[:max_days], 1):
        cost = {c: 0.0 for c in [*CITIES, "India"]}
        complete = True
        for item, (aliases, code, kg) in THALI.items():
            tries = ([matched[item]] if item in matched else []) + aliases + [code]
            rows = []
            for t in dict.fromkeys(tries):
                rows = mandi(day, code=t) if isinstance(t, int) else mandi(day, name=t)
                if rows:
                    matched[item] = t
                    break
            if not rows:
                complete = False
                missing[item] = missing.get(item, 0) + 1
                continue
            nat = statistics.median(r["Modal_Price"] for r in rows) / 100
            st.put(f"mandi.{norm(item)}.India", day, nat)
            cost["India"] += kg * nat
            for c, (_, _, state, dist) in CITIES.items():
                pick = [r["Modal_Price"] for r in rows if norm(dist) in norm(r["District"])] or                        [r["Modal_Price"] for r in rows if norm(state)[:6] in norm(r["State"])]  # 'Kerala'~'Keralam'
                cost[c] += kg * (statistics.median(pick) / 100 if pick else nat)
            time.sleep(0.3)
        if complete:  # mandis shut on some holidays; skip partial days
            for c, v in cost.items():
                st.put(f"thali_raw.{c}", day, v)
            made += 1
        print(f"  thali {day} {'ok' if complete else 'partial'} ({i}/{len(todo[:max_days])})", flush=True)
        if i % 10 == 0:
            st.save()
    print(f"  thali: {made} days built; missing ingredient-days: {missing or 'none'}; matched: {matched}")
    smooth_thali(st)
    if todo and not made and not any(st.has("thali_raw.India", d) for d in days(st.start, TODAY)):
        raise RuntimeError(f"no complete thali day; missing {missing}")


def smooth_thali(st, window=7):
    """Publish thali.<city> as the trailing 7-day mean of thali_raw.<city>. A city's daily mandi median jumps
    around when only a few of its markets report, so the raw daily value is too noisy to alert on."""
    for c in [*CITIES, "India"]:
        raw = st.d["series"].get(f"thali_raw.{c}", {})
        for k in raw:
            d = date.fromisoformat(k)
            win = [raw[x.isoformat()] for x in days(d - timedelta(days=window - 1), d) if x.isoformat() in raw]
            st.put(f"thali.{c}", d, sum(win) / len(win))


# ---------------- Stocks ----------------
def yahoo(st, tk, key):
    r = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{requests.utils.quote(tk)}",
            params={"range": "6mo", "interval": "1d"}).json()["chart"]["result"][0]
    for ts, close in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]):
        st.put(key, datetime.fromtimestamp(ts, IST).date(), close)
    return r["meta"]


def stocks_yahoo(st):
    for group, tickers in STOCKS.items():
        for tk in tickers:
            try:
                m = yahoo(st, tk, f"stock.{tk}")
            except Exception as e:
                print(f"  stock {tk} failed: {e}")
                continue
            st.d["meta"].setdefault("stocks", {})[tk] = {"group": group, "name": "Brent crude ($/bbl)" if tk == "BZ=F" else m.get("shortName") or tk}


# ---------------- Fuel margin ----------------
# Delhi price build-up: RSP = (price to dealer + excise + dealer commission) x (1 + VAT).
# ponytail: hand-entered from IOC's Delhi price build-up (iocl.com, via PPAC); a tax change shifts the level,
# not the day/week moves. Update these when excise or Delhi VAT change, or scrape the build-up if they drift.
DELHI_TAX = {"petrol": (0.194, 21.90, 4.39), "diesel": (0.1675, 17.80, 3.02)}  # (VAT, excise Rs/L, dealer Rs/L)
BBL_L = 158.987


def spread(rsp, brent, usdinr, vat, excise, dealer):
    """Rs/L an OMC keeps after taxes, dealer commission and the crude in the litre: pays for refining,
    freight and its marketing margin. Moves one-for-one with OMC margins while pump prices are frozen."""
    return rsp / (1 + vat) - excise - dealer - brent * usdinr / BBL_L


def asof(s, iso):
    k = max((x for x in s if x <= iso), default=None)
    return s[k] if k else None


def fuel_margin(st):
    yahoo(st, "INR=X", "fx.usdinr")
    ser = st.d["series"]
    brent, fx = ser.get("stock.BZ=F") or {}, ser["fx.usdinr"]
    assert brent, "no Brent series (stocks job failed?)"
    for kind, tax in DELHI_TAX.items():
        rsp = ser[f"fuel.{kind}.Delhi"]
        for iso, b in brent.items():
            r, f = asof(rsp, iso), asof(fx, iso)
            if r and f:
                st.put(f"fuel.margin.{kind}", date.fromisoformat(iso), spread(r, b, f, *tax))


def redact(s):
    s = re.sub(r"(api[-_]?key=)[^&\s'\")]+", r"\1***", s, flags=re.I)
    return s.replace(DATA_GOV_KEY, "***") if DATA_GOV_KEY else s


def main():
    """python scrape.py --skip-thali  (GitHub Actions)  |  python scrape.py --only-thali  (PC in India)"""
    window = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 90
    if "--only-thali" in sys.argv:
        st = Store(window, THALI_OUT)
        return run_jobs(st, [("thali_mandi", lambda: thali_mandi(st))])
    st = Store(window)
    jobs = [("fuel_ppac", lambda: fuel_ppac(st))]
    for city, (slug, *_ ) in CITIES.items():
        if city not in PPAC_METROS:
            for kind in ("petrol", "diesel"):
                jobs.append((f"fuel_{kind}_{city}", lambda c=city, s=slug, k=kind: fuel_goodreturns(st, c, s, k)))
        jobs.append((f"cng_{city}", lambda c=city, s=slug: cng_goodreturns(st, c, s)))
    jobs += [("gold_ibja", lambda: gold_ibja(st)), ("aqi_cpcb", lambda: aqi_cpcb(st)),
             ("thali_mandi", lambda: thali_mandi(st)), ("stocks", lambda: stocks_yahoo(st)),
             ("fuel_margin", lambda: fuel_margin(st))]
    if "--skip-thali" in sys.argv:
        jobs = [j for j in jobs if j[0] != "thali_mandi"]
    run_jobs(st, jobs)


def run_jobs(st, jobs):
    status = st.d["meta"].setdefault("status", {})
    failed = 0
    for name, fn in jobs:
        print(name)
        try:
            fn()
            status[name] = {"ok": True, "at": datetime.now(IST).isoformat(timespec="minutes")}
        except Exception as e:
            failed += 1
            err = redact(repr(e))  # errors are published in indicators.json: never let a key through
            print(f"  FAILED: {err}")
            status[name] = {**status.get(name, {}), "ok": False, "error": err[:200]}
        st.save()  # save after every job so a crash never loses earlier work
    st.d["meta"]["cities"] = list(CITIES)
    st.d["meta"]["thali_basket_kg"] = {k: kg for k, (_, _, kg) in THALI.items()}
    st.save()
    print(f"done, {failed} job(s) failed")


if __name__ == "__main__":
    main()
