const PAGES = [
  "https://ec.europa.eu/budget/financial-transparency-system/download.html",
  "https://transparency-register.europa.eu/open-data_en",
  "https://data.europa.eu/data/datasets/transparency-register?locale=en",
];
const H = { "User-Agent": "Mozilla/5.0 (compatible; eduskuntaseuranta-probe)", Accept: "*/*" };
console.log("## EU-koehaku\n");
const seen = new Set();
for (const p of PAGES) {
  console.log("### " + p);
  try {
    const r = await fetch(p, { headers: H, redirect: "follow" });
    const t = await r.text();
    console.log("HTTP " + r.status + ", pituus " + t.length + ", lopullinen osoite: " + r.url + "\n");
    const links = new Set();
    for (const m of t.matchAll(/href="([^"#]+)"/gi)) {
      const h = m[1];
      if (/\.(zip|csv|xml|xlsx|json|gz)(\?|$)/i.test(h) || /download|export|open-data/i.test(h)) {
        try { links.add(new URL(h, r.url).href); } catch (e) {}
      }
    }
    const arr = [...links].slice(0, 25);
    console.log("Löytyneitä linkkejä: " + links.size + "\n");
    for (const l of arr) {
      if (seen.has(l)) continue;
      seen.add(l);
      try {
        const h = await fetch(l, { method: "HEAD", headers: H, redirect: "follow" });
        console.log("- " + h.status + " " + (h.headers.get("content-type") || "") + " " + (h.headers.get("content-length") || "?") + " tavua: " + l);
      } catch (e) {
        console.log("- virhe " + e.message + ": " + l);
      }
    }
  } catch (e) {
    console.log("Virhe: " + e.message);
  }
  console.log("");
}
