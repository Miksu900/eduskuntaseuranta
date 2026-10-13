// eu-data.mjs - /eu/rahat/suomi/ (Komission suorat rahat Suomeen, FTS) ja /eu/vaikuttajat/ (avoimuusrekisterin suomalaiset organisaatiot).
import { readFileSync } from "node:fs";
const rd = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch (e) { return null; } };
const nf = (n) => new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 }).format(n);
const nf1 = (n) => new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 }).format(n);
const eur = (n) => n >= 1e9 ? nf1(n / 1e9) + " mrd €" : n >= 1e6 ? nf1(n / 1e6) + " M€" : nf(n) + " €";
const CAT = {
  "Companies & groups": "Yritykset ja yritysryhmät", "Trade and business associations": "Elinkeino- ja yritysjärjestöt",
  "Non-governmental organisations, platforms and networks and similar": "Kansalaisjärjestöt ja verkostot", "Trade unions and professional associations": "Ammattiliitot ja ammattijärjestöt",
  "Professional consultancies": "Konsulttiyritykset", "Law firms": "Asianajotoimistot", "Think tanks and research institutions": "Ajatuspajat ja tutkimuslaitokset",
  "Academic institutions": "Yliopistot ja korkeakoulut", "Associations and networks of public authorities": "Viranomaisten yhteenliittymät",
  "Other organisations, public or mixed entities": "Muut julkiset ja sekamuotoiset", "Self-employed individuals": "Yksityiset elinkeinonharjoittajat",
};
const PRG = (s) => String(s).replace(/^[\d.]+\s*-\s*/, "");

export function euDataPages({ shell, esc, dateFi }) {
  const pages = [];
  const fts = rd("data/eu/fts.json");
  if (fts && fts.finland) {
    const F = fts.finland, years = Object.keys(F.byYear).sort(), max = Math.max(...years.map((y) => F.byYear[y]));
    const bars = years.map((y) => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="width:38px;font-size:13px">${y}</span><div style="flex:1"><div style="height:16px;border-radius:4px;background:#3b4ec9;width:${Math.max(1, F.byYear[y] / max * 100).toFixed(1)}%"></div></div><span style="width:78px;text-align:right;font-size:13px">${eur(F.byYear[y])}</span></div>`).join("");
    const prog = F.programmes.slice(0, 15).map((p) => `<tr><td>${esc(PRG(p.n))}</td><td style="text-align:right;white-space:nowrap">${eur(p.total)}</td></tr>`).join("");
    const last = years[years.length - 1];
    const ben = F.beneficiaries.slice(0, 40).map((b) => `<tr><td>${esc(b.n)}<div class="meta">${esc(b.type || "")}${b.city && b.city !== "-" ? " · " + esc(b.city) : ""}</div></td><td style="text-align:right;white-space:nowrap">${eur(b.total)}</td><td style="text-align:right;white-space:nowrap">${eur((b.y || {})[String(Number(last) - 1)] || 0)}</td></tr>`).join("");
    const C = fts.countries || {}, pick = ["Finland", "Sweden", "Denmark", "Estonia", "Germany", "France"].filter((k) => C[k]);
    const cy = String(Number(last) - 1);
    const FI = { Finland: "Suomi", Sweden: "Ruotsi", Denmark: "Tanska", Estonia: "Viro", Germany: "Saksa", France: "Ranska" };
    const cmp = pick.map((k) => `<tr><td>${FI[k]}</td><td style="text-align:right">${eur(C[k][cy] || 0)}</td></tr>`).join("");
    const body = `<p class="meta"><a href="/eu/rahat/">← EU:n rahat</a></p><h1>EU-komission rahat Suomeen</h1>
<p>Tällä sivulla näkyy raha, jonka Euroopan komissio on sitonut suoraan suomalaisille saajille: yliopistoille, yrityksille, viranomaisille ja järjestöille. Tiedot ovat komission avoimesta rahoitusraportointijärjestelmästä (FTS), ja luvut ovat sitoumuksia, eivät välttämättä maksettuja summia.</p>
<div class="note"><b>Mitä luvut eivät sisällä.</b> Tässä on vain komission suoraan hallinnoima raha, kuten Horisontti Eurooppa, Erasmus+ ja LIFE. Maatalouden tuet (CAP) ja koheesiorahat kulkevat jäsenmaiden kautta, eikä niitä ole tässä. Ne löytyvät sivulta <a href="/eu/rahat/">EU:n rahat</a>.</div>
<h2>Vuosittain</h2>${bars}
<p class="meta">Vuosien 2021–2023 nousu johtuu pääosin elpymisrahastosta (RRF): ohjelman sitoumukset kirjattiin Suomen valtiolle. Vuosi ${esc(last)} voi olla vielä keskeneräinen.</p>
<h2>Suurimmat ohjelmat</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Ohjelma</th><th style="text-align:right">Yhteensä 2014–${esc(last)}</th></tr></thead><tbody>${prog}</tbody></table></div>
<h2>Suurimmat saajat</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Saaja</th><th style="text-align:right">Yhteensä</th><th style="text-align:right">${cy}</th></tr></thead><tbody>${ben}</tbody></table></div>
<h2>Vertailu muihin maihin, ${esc(cy)}</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tbody>${cmp}</tbody></table></div>
<p class="meta">Luvut ovat kokonaissummia, joita ei ole suhteutettu asukaslukuun. Isot maat saavat luonnollisesti enemmän.</p>
<p class="meta">Lähde: Euroopan komissio, Financial Transparency System (ec.europa.eu/budget/financial-transparency-system). Päivitetty ${esc(String(fts.updated || "").slice(0, 10))}.</p>`;
    pages.push({ path: "/eu/rahat/suomi/", html: shell({ title: "EU-komission rahat Suomeen: ohjelmat ja saajat | Eduskuntaseuranta", desc: "Mihin EU-komission suoraan hallinnoima raha Suomessa menee? Vuosisummat, ohjelmat ja suurimmat saajat avoimesta datasta.", path: "/eu/rahat/suomi/", body }) });
  }
  const av = rd("data/eu/avoimuus.json");
  if (av && Array.isArray(av.finland)) {
    const cost = (o) => o.costAbs || o.costMax || 0;
    const rows = av.finland.slice().sort((a, b) => cost(b) - cost(a) || b.grantTotal - a.grantTotal);
    const costTxt = (o) => o.costAbs ? nf(o.costAbs) + " €" : o.costMax ? nf(o.costMin) + "–" + nf(o.costMax) + " €" : "ei ilmoitettu";
    const tr = rows.map((o) => `<tr class="vr" data-s="${esc((o.n + " " + o.city + " " + (CAT[o.cat] || o.cat)).toLowerCase())}"><td><a href="https://transparency-register.europa.eu/search-details_en?id=${encodeURIComponent(o.id)}" rel="noopener">${esc(o.n)}</a><div class="meta">${esc(CAT[o.cat] || o.cat)}${o.city ? " · " + esc(o.city) : ""}</div></td><td style="text-align:right">${costTxt(o)}</td><td style="text-align:right;white-space:nowrap">${o.grantTotal ? nf(o.grantTotal) + " €" : "–"}</td></tr>`).join("");
    const withCost = rows.filter((o) => cost(o)).length, withGr = rows.filter((o) => o.grantTotal).length;
    const gr = rows.filter((o) => o.grantTotal).sort((a, b) => b.grantTotal - a.grantTotal).slice(0, 10).map((o) => `<li>${esc(o.n)}: ${eur(o.grantTotal)}</li>`).join("");
    const body = `<p class="meta"><a href="/eu/">← EU</a></p><h1>Kuka vaikuttaa EU-päätöksiin Suomesta?</h1>
<p>EU:n avoimuusrekisteriin ovat ilmoittautuneet organisaatiot, jotka pyrkivät vaikuttamaan EU-päätöksiin. Suomalaisia organisaatioita on rekisterissä ${nf(rows.length)}. Näet, paljonko ne ilmoittavat käyttävänsä vaikuttamistyöhön ja minkä EU-rahoituksen ne ovat saaneet.</p>
<div class="note"><b>Lue näin.</b> Kulut ovat organisaatioiden itse ilmoittamia, ja ne ovat usein 100 000 euron suuruisia haarukoita viimeiseltä päättyneeltä tilikaudelta. Rekisteri ei kerro, mihin päätökseen vaikutettiin. Kulutietoja on ${nf(withCost)} organisaatiolla ja avustustietoja ${nf(withGr)}:lla. Ilmoittamatta jättäminen ei tarkoita, ettei vaikuttamista olisi.</div>
<h2>Suurimmat saadut avustukset</h2><ol>${gr}</ol>
<h2>Kaikki suomalaiset organisaatiot</h2><input id="vq" type="search" placeholder="Hae nimellä, paikkakunnalla tai tyypillä" style="width:100%;padding:10px;font-size:16px;margin:6px 0;box-sizing:border-box"><p class="meta" id="vc"></p>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Organisaatio</th><th style="text-align:right">Vaikuttamiskulut</th><th style="text-align:right">Avustukset</th></tr></thead><tbody>${tr}</tbody></table></div>
<script>(function(){var q=document.getElementById("vq"),r=document.querySelectorAll(".vr"),c=document.getElementById("vc");function f(){var v=q.value.trim().toLowerCase(),n=0;r.forEach(function(x){var s=!v||x.getAttribute("data-s").indexOf(v)>-1;x.style.display=s?"":"none";if(s)n++});c.textContent=n+" organisaatiota"}q.addEventListener("input",f);f()})();</script>
<p class="meta">Lähde: EU:n avoimuusrekisteri (transparency-register.europa.eu), viennin päivä ${esc(String(av.exportDate || "").slice(0, 10))}. Taulukko on järjestetty suurimman ilmoitetun kulun mukaan.</p>`;
    pages.push({ path: "/eu/vaikuttajat/", html: shell({ title: "Kuka vaikuttaa EU-päätöksiin Suomesta? Avoimuusrekisteri | Eduskuntaseuranta", desc: "Suomalaiset EU:n avoimuusrekisterin organisaatiot: ilmoitetut vaikuttamiskulut ja saadut EU-avustukset, haettavissa.", path: "/eu/vaikuttajat/", body }) });
  }
  return pages;
}
