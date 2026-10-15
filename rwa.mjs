// rwa.mjs - /rwa-proto/: prototyyppi tokenisoidun omaisuuden (RWA) seurannasta. Data: DeFiLlama (api.llama.fi).
// Ei sitemapissa, noindex. Rakennus ei kaadu, jos haku epäonnistuu.

const CATS = new Set(["RWA", "RWA Lending"]);
const WATCH = ["XDC", "Stellar"];

export async function loadRwa() {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch("https://api.llama.fi/protocols", { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error("odottamaton vastaus");
    return summarize(j);
  } finally { clearTimeout(to); }
}

const num = x => (typeof x === "number" && isFinite(x) ? x : 0);

export function summarize(list) {
  const items = list.filter(p => p && CATS.has(p.category)).map(p => ({
    name: String(p.name || ""), cat: p.category, tvl: num(p.tvl), d1: p.change_1d, d7: p.change_7d,
    chains: Array.isArray(p.chains) ? p.chains : [], url: typeof p.url === "string" ? p.url : "",
    chainTvls: p.chainTvls && typeof p.chainTvls === "object" ? p.chainTvls : {},
  })).filter(p => p.name && p.tvl > 0);
  const total = items.reduce((s, p) => s + p.tvl, 0);
  const byChain = {};
  for (const p of items) for (const [k, v] of Object.entries(p.chainTvls)) {
    if (k.includes("-") || /pool2|staking|borrowed/i.test(k)) continue;
    const cur = v && typeof v === "object" ? num(v.tvl) : num(v);
    if (cur > 0) byChain[k] = (byChain[k] || 0) + cur;
  }
  const chains = Object.entries(byChain).sort((a, b) => b[1] - a[1]);
  return { items: items.sort((a, b) => b.tvl - a.tvl), total, chains, at: new Date().toISOString() };
}

const fmtUsd = v => v >= 1e9 ? (v / 1e9).toFixed(2).replace(".", ",") + " mrd $" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " milj. $" : Math.round(v / 1e3).toLocaleString("fi-FI") + " t. $";
const pct = v => (typeof v === "number" && isFinite(v)) ? `<span style="color:${v >= 0 ? "#3ddc97" : "#ff6b6b"}">${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")} %</span>` : "–";

export function rwaPages({ shell, esc, data }) {
  const d = data;
  const top = d.items.slice(0, 15);
  const maxC = d.chains.length ? d.chains[0][1] : 1;
  const chainRows = d.chains.slice(0, 10).map(([k, v]) => `<div class="rw"><span>${esc(k)}</span><span class="bar"><i style="width:${Math.max(2, Math.round(v / maxC * 100))}%"></i></span><b>${fmtUsd(v)}</b></div>`).join("");
  const watch = WATCH.map(w => {
    const hit = d.chains.find(([k]) => k.toLowerCase() === w.toLowerCase());
    return `<li><b>${esc(w)}</b>: ${hit ? fmtUsd(hit[1]) + " (DeFiLlaman RWA-luokissa)" : "ei näy DeFiLlaman RWA-luokissa, joten tälle ketjulle tarvitaan oma datalähde"}</li>`;
  }).join("");
  const rows = top.map(p => `<tr><td>${esc(p.name)}<div class="meta">${esc(p.cat)} · ${esc(p.chains.slice(0, 3).join(", "))}${p.chains.length > 3 ? " +" + (p.chains.length - 3) : ""}</div></td><td class="n">${fmtUsd(p.tvl)}</td><td class="n">${pct(p.d7)}</td></tr>`).join("");
  const at = new Date(d.at).toLocaleString("fi-FI", { timeZone: "Europe/Helsinki", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const css = `<style>.rw{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;margin:8px 0}.rw .bar{background:var(--surface);border-radius:6px;height:12px;display:block}.rw .bar i{display:block;height:100%;background:#4a7bff;border-radius:6px}.rt{width:100%;border-collapse:collapse;font-size:15px}.rt td,.rt th{padding:8px 4px;border-bottom:1px solid var(--line);text-align:left}.rt .n,.rt th.n{text-align:right;white-space:nowrap}.big{font-size:34px;font-weight:800;margin:4px 0}.sw{overflow-x:auto}</style>`;
  const body = `${css}<h1>Tokenisoitu omaisuus numeroina</h1>
<p><b>Prototyyppi.</b> Tämä sivu näyttää, kuinka paljon arvoa on sidottu tokenisoituun oikean maailman omaisuuteen (RWA, esimerkiksi valtionlainat ja yksityinen luotto). Luvut päivittyvät sivuston rakennuksen yhteydessä.</p>
<div class="card"><div class="meta">Arvo yhteensä (TVL) DeFiLlaman RWA-luokissa</div><div class="big">${fmtUsd(d.total)}</div><div class="meta">${d.items.length} protokollaa · päivitetty ${esc(at)}</div></div>
<h2>Ketjuittain</h2>${chainRows}
<h2>Seurattavat ketjut</h2><ul>${watch}</ul>
<h2>Suurimmat protokollat</h2><div class="sw"><table class="rt"><thead><tr><th>Protokolla</th><th class="n">Arvo</th><th class="n">7 pv</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">Lähde: <a href="https://defillama.com" rel="noopener">DeFiLlama</a>. TVL tarkoittaa protokolliin sidottua arvoa, ei suoraan tokenisoidun omaisuuden määrää, ja DeFiLlama luokittelee protokollat omalla tavallaan. Tämä ei ole sijoitusneuvontaa.</p>`;
  return [{ path: "/rwa-proto/", html: shell({ title: "Tokenisoitu omaisuus numeroina (prototyyppi)", desc: "Prototyyppi: tokenisoidun oikean maailman omaisuuden määrä ketjuittain.", path: "/rwa-proto/", body, head: '<meta name="robots" content="noindex">' }) }];
}
