"""Offline check of the parsers against snippets copied from the real sources. Run: python test_scrape.py"""
from datetime import date
import scrape

R = type("R", (), {})


def fake(text_or_bytes, status=200):
    r = R()
    r.status_code, r.text, r.content = status, text_or_bytes if isinstance(text_or_bytes, str) else "", text_or_bytes
    return r


def run():
    scrape.TODAY = date(2026, 11, 19)
    st = scrape.Store(90)
    st.d = {"series": {}, "meta": {}}

    # goodreturns petrol: today + 10-day table + monthly summary reconstruction
    page = ("<p>Today (19th Nov, 2026), Rs. 110.44/Ltr</p> Last 10 Days November 17, 2026 ₹111.68 0.00 "
            "Petrol Rate in Bangalore, October 2026 Details Price 1 st October ₹ 110.90 31 st October ₹ 110.93 "
            "Highest rate in October ₹ 111.20 on October 9 Lowest Rate in October ₹ 110.80 on October 20")
    scrape.get = lambda url, **kw: fake(page)
    scrape.fuel_goodreturns(st, "Bengaluru", "bangalore", "petrol")
    s = st.d["series"]["fuel.petrol.Bengaluru"]
    assert s["2026-11-19"] == 110.44 and s["2026-11-17"] == 111.68, s
    assert s["2026-10-01"] == 110.90 and s["2026-10-09"] == 111.20 and s["2026-10-25"] == 110.80, s
    assert s["2026-11-05"] == 110.93  # held from 31 Oct until the next real quote

    # AQI bulletin row regex (multi-word category and city)
    rows = "1 Agartala Satisfactory 81 PM10 1/2\n19 Aurangabad (Maharashtra) Good 45 PM10 3/3\n7 Delhi Very Poor 312 PM2.5, PM10 38/39\n"
    got = {m[1]: (m[2], int(m[3])) for m in scrape.AQI_ROW.finditer(rows)}
    assert got["Delhi"] == ("Very Poor", 312) and got["Aurangabad (Maharashtra)"] == ("Good", 45), got
    # thali smoothing: trailing 7-day mean of the raw daily cost
    st.d["series"]["thali_raw.Delhi"] = {"2026-11-10": 10.0, "2026-11-11": 20.0, "2026-11-17": 40.0}
    scrape.smooth_thali(st)
    t = st.d["series"]["thali.Delhi"]
    assert t["2026-11-10"] == 10 and t["2026-11-11"] == 15 and t["2026-11-17"] == 30, t  # 17th window: 11th..17th

    # published error strings must never contain an API key
    assert "abc123" not in scrape.redact("Max retries: /resource/x?api-key=abc123&format=json"), "key leaked"

    print("ok")


if __name__ == "__main__":
    run()
