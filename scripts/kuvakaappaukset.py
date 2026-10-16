import os
from playwright.sync_api import sync_playwright

PERUS = "https://eduskuntaseuranta.fi"
SIVUT = [
    ("1-etusivu", "/", None),
    ("2-edustajat", "/viikko/", None),
    ("3-valtion-talous", "/valtion-talous/", None),
    ("4-kela", "/kela/", "Oulu"),
    ("5-yritykset", "/yritykset/", "Nokia"),
    ("6-sahko", "/sahko/", None),
]
os.makedirs("kuvat", exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 540, "height": 960}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale="fi-FI")
    for nimi, polku, haku in SIVUT:
        try:
            s = ctx.new_page()
            s.goto(PERUS + polku, wait_until="networkidle", timeout=60000)
            s.wait_for_timeout(2500)
            if haku:
                try:
                    kentta = s.locator("input[type=search], input[type=text], input:not([type])").first
                    kentta.fill(haku, timeout=5000)
                    kentta.press("Enter")
                    s.wait_for_timeout(4000)
                except Exception as e:
                    print("haku ei onnistunut", nimi, e)
            s.screenshot(path=f"kuvat/{nimi}.png")
            print("ok", nimi)
            s.close()
        except Exception as e:
            print("VIRHE", nimi, e)
    b.close()
