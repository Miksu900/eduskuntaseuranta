// sahko.mjs - Sähkö juuri nyt: Fingrid avoin data + pörssisähkön hinta. Lukee data/fingrid/*.json ja data/hinta/hinnat.json.
import { readFileSync } from "node:fs";

const TZ = "Europe/Helsinki";
const load = (id) => { try { return JSON.parse(readFileSync("data/fingrid/" + id + ".json", "utf8")); } catch (e) { return null; } };
const nf = (n, d = 0) => new Intl.NumberFormat("fi-FI", { maximumFractionDigits: d }).format(n);
const fmt = (t, o) => new Date(t).toLocaleString("fi-FI", Object.assign({ timeZone: TZ }, o));
const dayKey = (t) => fmt(t, { year: "numeric", month: "numeric", day: "numeric" });
const hourOf = (t) => Number(fmt(t, { hour: "numeric", hour12: false })) % 24;
const hm = (t) => fmt(t, { hour: "2-digit", minute: "2-digit" });
const onHour = (t) => new Date(t).getUTCMinutes() === 0;

function pts(d) {
  if (!d || !Array.isArray(d.hourly)) return [];
  return d.hourly.map((r) => [Date.parse(r[0]), Number(r[1])]).filter((p) => isFinite(p[0]) && isFinite(p[1]));
}

function chart(series) {
  const W = 340, H = 190, PL = 6, PR = 6, PT = 12, PB = 24;
  const all = series.flatMap((s) => s.p);
  if (all.length < 3) return "";
  let t0 = Infinity, t1 = -Infinity, lo = Infinity, hi = -Infinity;
  for (const p of all) {
    if (p[0] < t0) t0 = p[0];
    if (p[0] > t1) t1 = p[0];
    if (p[1] < lo) lo = p[1];
    if (p[1] > hi) hi = p[1];
  }
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const X = (t) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const Y = (v) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);
  let g = "";
  for (let i = 0; i <= 2; i++) {
    const v = lo + ((hi - lo) * i) / 2;
    g += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="currentColor" opacity=".15"/>';
  }
  if (lo < 0 && hi > 0) {
    g += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="currentColor" opacity=".6" stroke-dasharray="4 3"/>';
  }
  let prev = "";
  for (const p of series[0].p) {
    const k = dayKey(p[0]);
    if (prev && k !== prev) {
      const x = X(p[0]).toFixed(1);
      g += '<line x1="' + x + '" x2="' + x + '" y1="' + PT + '" y2="' + (H - PB) + '" stroke="currentColor" opacity=".12"/>';
      g += '<text x="' + (Number(x) + 2) + '" y="' + (H - 8) + '" font-size="9" fill="currentColor" opacity=".7">' + fmt(p[0], { weekday: "short" }) + "</text>";
    }
    prev = k;
  }
  for (const s of series) {
    g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" points="' +
      s.p.map((p) => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ") + '"/>';
  }
  // pystyakselin ylä- ja alaraja tekstinä kuvan ulkopuolella
  const axis = '<p class="meta" style="margin:4px 0 0">Alin ' + nf(lo + pad) + ", ylin " + nf(hi - pad) + "</p>";
  return '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--text)" role="img">' + g + "</svg>" + axis;
}

function priceChart(items, nowMs) {
  const W = 340, H = 210, PL = 6, PR = 6, PT = 14, PB = 30;
  if (items.length < 2) return "";
  const vals = items.map((x) => x.p);
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  if (hi - lo < 1) hi = lo + 1;
  const sorted = vals.slice().sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const bw = (W - PL - PR) / items.length;
  const Y = (v) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);
  let g = "";
  g += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="currentColor" opacity=".4"/>';
  items.forEach((x, i) => {
    const x0 = PL + i * bw;
    const yTop = Y(Math.max(x.p, 0));
    const yBot = Y(Math.min(x.p, 0));
    const color = x.p <= q1 ? "#3ddc97" : x.p >= q3 ? "#ff6b81" : "#7cc4ff";
    const cur = x.t <= nowMs && nowMs < x.e;
    g += '<rect x="' + (x0 + 0.5).toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + Math.max(1, bw - 1).toFixed(1) +
      '" height="' + Math.max(1, yBot - yTop).toFixed(1) + '" fill="' + color + '"' + (cur ? ' stroke="#fff" stroke-width="1.5"' : "") + "/>";
    const h = hourOf(x.t);
    if (h % 6 === 0 && onHour(x.t)) {
      g += '<text x="' + (x0 + bw / 2).toFixed(1) + '" y="' + (H - 16) + '" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">' + h + "</text>";
    }
    if ((h === 0 && onHour(x.t)) || i === 0) {
      if (h === 0 && onHour(x.t) && i > 0) g += '<line x1="' + x0.toFixed(1) + '" x2="' + x0.toFixed(1) + '" y1="' + PT + '" y2="' + (H - PB) + '" stroke="currentColor" opacity=".15"/>';
      g += '<text x="' + (x0 + 2).toFixed(1) + '" y="' + (H - 3) + '" font-size="9" fill="currentColor" opacity=".8">' + fmt(x.t, { weekday: "short", day: "numeric", month: "numeric" }) + "</text>";
    }
  });
  return '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--text)" role="img">' + g + "</svg>";
}

const legend = (items) =>
  '<p class="meta">' + items.map((i) => '<span style="color:' + i.color + '">■</span> ' + i.label).join(" &nbsp; ") + "</p>";


// ---- Laskuri: halvin aika käyttää laitetta ----
// Puhdas funktio, testattavissa Nodessa. hours = [[alkuMs, c/kWh], ...] tunneittain.
export const BEST_FN = `function bestWindow(hours,nowMs,dur,kw,horizonH){
  var H=3600000,a=[];
  for(var i=0;i<hours.length;i++){if(hours[i][0]+H>nowMs&&(horizonH<=0||hours[i][0]<nowMs+horizonH*H))a.push(hours[i]);}
  a.sort(function(x,y){return x[0]-y[0]});
  var runs=[],cur=[];
  for(var j=0;j<a.length;j++){if(cur.length&&a[j][0]-cur[cur.length-1][0]!==H){runs.push(cur);cur=[];}cur.push(a[j]);}
  if(cur.length)runs.push(cur);
  var all=[];
  runs.forEach(function(r){for(var k=0;k+dur<=r.length;k++){var c=0;for(var m=0;m<dur;m++)c+=r[k+m][1];all.push({start:r[k][0],end:r[k+dur-1][0]+H,cost:c*kw/100,avg:c/dur});}});
  if(!all.length)return null;
  var best=all[0],worst=all[0];
  all.forEach(function(w){if(w.cost<best.cost)best=w;if(w.cost>worst.cost)worst=w;});
  return {best:best,worst:worst,now:all[0],n:all.length};
}`;

const CALC_CSS = `<style>.lk{background:var(--surface);border-radius:14px;padding:14px;margin:14px 0}.lk label{display:block;font-size:14px;color:var(--mute);margin:10px 0 4px}.lk select,.lk input{font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--text);width:100%;box-sizing:border-box}.lk .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lk .res{margin-top:14px;font-size:17px;line-height:1.5}.lk .res b{font-size:22px}.lk .sv{color:#3ddc97}.ht{width:100%;border-collapse:collapse;font-size:15px}.ht td{padding:7px 4px;border-bottom:1px solid var(--line)}.ht td.n{text-align:right;font-weight:700}</style>`;

const calcJs = () => `<script>(function(){
var D=JSON.parse(document.getElementById("spot").textContent),hours=D.map(function(x){return[x[0],x[1]]});
${BEST_FN}
var pre={wash:[0.5,2],dish:[0.5,2],dry:[0.8,2],sauna:[6,1],car:[3.7,8],boiler:[2,3]};
var $=function(i){return document.getElementById(i)};
function fm(t){return new Date(t).toLocaleString("fi-FI",{timeZone:"Europe/Helsinki",hour:"2-digit",minute:"2-digit"})}
function fd(t){var o={timeZone:"Europe/Helsinki"},a=new Date(t).toLocaleDateString("fi-FI",o),n=new Date(),b=n.toLocaleDateString("fi-FI",o),c=new Date(n.getTime()+864e5).toLocaleDateString("fi-FI",o);return a===b?"tänään":a===c?"huomenna":a}
function eur(v){return v.toLocaleString("fi-FI",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}
function run(){var kw=parseFloat(String($("lk-kw").value).replace(",",".")),dur=parseInt($("lk-h").value,10),hz=parseInt($("lk-hz").value,10),out=$("lk-out");
if(!(kw>0)||!(dur>=1)||dur>12){out.textContent="Anna teho (kW) ja kesto 1–12 tuntia.";return}
var r=bestWindow(hours,Date.now(),dur,kw,hz);
if(!r){out.textContent="Hintatietoja ei ole tälle ajalle tarpeeksi. Huomisen hinnat tulevat yleensä iltapäivällä.";return}
var save=r.now.cost-r.best.cost,tot=kw*dur;
out.innerHTML="Halvin aloitusaika: <b>"+fd(r.best.start)+" klo "+fm(r.best.start)+"</b> (valmis klo "+fm(r.best.end)+")<br>Hinta silloin noin <b>"+eur(r.best.cost)+"</b> ("+(Math.round(r.best.avg*100)/100).toLocaleString("fi-FI")+" c/kWh keskimäärin).<br>Jos aloitat heti: "+eur(r.now.cost)+". "+(save>0.005?'Säästö <span class="sv"><b>'+eur(save)+'</b></span>.':"Nyt on jo halvin aika.")+"<br>Kalleimmalla ajalla: "+eur(r.worst.cost)+". Energiaa kuluu yhteensä "+(Math.round(tot*10)/10).toLocaleString("fi-FI")+" kWh."}
$("lk-dev").onchange=function(){var v=pre[this.value];if(v){$("lk-kw").value=String(v[0]).replace(".",",");$("lk-h").value=v[1]}run()};
["lk-kw","lk-h","lk-hz"].forEach(function(i){$(i).oninput=run;$(i).onchange=run});
run()})()</script>`;

const calcSec = (hours) =>
  CALC_CSS +
  "<h2>Milloin kannattaa käyttää sähköä?</h2>" +
  "<p>Valitse laite, niin laskuri etsii halvimman ajan, jolloin sen voi käyttää, ja kertoo paljonko säästät verrattuna siihen, että aloittaisit heti.</p>" +
  '<div class="lk"><label for="lk-dev">Laite</label><select id="lk-dev">' +
  '<option value="wash">Pyykinpesukone</option><option value="dish">Astianpesukone</option><option value="dry">Kuivausrumpu</option><option value="sauna">Sauna</option><option value="car">Sähköauton lataus</option><option value="boiler">Lämminvesivaraaja</option><option value="own">Oma laite</option></select>' +
  '<div class="two"><div><label for="lk-kw">Teho (kW)</label><input id="lk-kw" inputmode="decimal" value="0,5"></div><div><label for="lk-h">Kesto (tuntia)</label><input id="lk-h" inputmode="numeric" value="2"></div></div>' +
  '<label for="lk-hz">Ajanjakso</label><select id="lk-hz"><option value="12">Seuraavat 12 tuntia</option><option value="24">Seuraavat 24 tuntia</option><option value="0">Kaikki saatavilla olevat tunnit</option></select>' +
  '<div class="res" id="lk-out" aria-live="polite">Lasketaan…</div></div>' +
  '<p class="note">Laitteiden tehot ovat suuntaa antavia esimerkkejä, joten muokkaa teho ja kesto omaksi. Laskuri käyttää pörssisähkön tuntihintoja ilman sähköyhtiön marginaalia ja siirtomaksua, joten se kertoo hintaeron, ei koko laskua.</p>' +
  '<script type="application/json" id="spot">' + JSON.stringify(hours.map((x) => [x.t, Math.round(x.p * 1000) / 1000])) + "</script>" +
  calcJs();

const hourTable = (hours, q1, q3, nowMs) =>
  "<details><summary>Kaikki tunnit taulukkona</summary><table class=\"ht\"><tbody>" +
  hours.map((x) => {
    const cur = x.t <= nowMs && nowMs < x.e;
    const mark = x.p <= q1 ? " · halpa" : x.p >= q3 ? " · kallis" : "";
    return "<tr" + (cur ? ' style="font-weight:700"' : "") + "><td>" + fmt(x.t, { weekday: "short", day: "numeric", month: "numeric" }) + " klo " + hm(x.t) + "–" + hm(x.e) + (cur ? " (nyt)" : "") + '</td><td class="n">' + nf(x.p, 2) + " c/kWh" + mark + "</td></tr>";
  }).join("") +
  "</tbody></table></details>";

export function sahkoPages({ shell, esc }) {
  const ids = [124, 192, 74, 181, 188, 191, 194, 265, 177];
  const d = {};
  for (const id of ids) d[id] = load(id);
  if (!d[124] || !d[192]) return [];
  const lv = (id) => (d[id] && d[id].latest && d[id].latest[1] != null && isFinite(d[id].latest[1]) ? Number(d[id].latest[1]) : null);

  const kul = lv(124), tuo = lv(192), imp = lv(194);
  const wind = lv(181), nuc = lv(188), hyd = lv(191);
  const co2 = lv(265), hz = lv(177);
  const when = fmt(d[192].latest[0], { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

  // ---- Pörssisähkön hinta ----
  let hp = [];
  try { hp = JSON.parse(readFileSync("data/hinta/hinnat.json", "utf8")).prices || []; } catch (e) {}
  const nowMs = Date.now();
  const todayKey = dayKey(nowMs), tomorrowKey = dayKey(nowMs + 86400000);
  const items = hp
    .map((x) => ({ t: Date.parse(x.s), e: x.e ? Date.parse(x.e) : Date.parse(x.s) + 3600000, p: Number(x.p) }))
    .filter((x) => isFinite(x.t) && isFinite(x.p) && (dayKey(x.t) === todayKey || dayKey(x.t) === tomorrowKey))
    .sort((a, b) => a.t - b.t);
  let priceSec = "";
  if (items.length >= 12) {
    const cur = items.find((x) => x.t <= nowMs && nowMs < x.e);
    const day = (k) => items.filter((x) => dayKey(x.t) === k);
    const avg = (a) => a.reduce((s, x) => s + x.p, 0) / a.length;
    const tod = day(todayKey), tom = day(tomorrowKey);
    const chip = (v, label) => '<div class="chip"><b>' + v + "</b><span>" + label + "</span></div>";
    // tuntikeskihinnat listoja varten (toimii sekä tunti- että vartin datalla)
    const bucket = new Map();
    for (const x of items) {
      const k = Math.floor(x.t / 3600000);
      const o = bucket.get(k) || { t: k * 3600000, e: k * 3600000 + 3600000, s: 0, n: 0 };
      o.s += x.p; o.n++; bucket.set(k, o);
    }
    const hours = [...bucket.values()].map((o) => ({ t: o.t, e: o.e, p: o.s / o.n }));
    const hsorted = hours.map((x) => x.p).sort((a, b) => a - b);
    const q1h = hsorted[Math.floor(hsorted.length * 0.25)], q3h = hsorted[Math.floor(hsorted.length * 0.75)];
    let chips = "";
    if (cur) {
      const lvl = cur.p <= q1h ? "halpa" : cur.p >= q3h ? "kallis" : "normaali";
      chips += chip(nf(cur.p, 2), "hinta nyt (c/kWh), " + lvl + " tänään ja huomenna");
    }
    if (tod.length) chips += chip(nf(avg(tod), 2), "tänään keskimäärin");
    if (tom.length >= 20) chips += chip(nf(avg(tom), 2), "huomenna keskimäärin");
    const upcoming = hours.filter((x) => x.e > nowMs);
    const cheap = upcoming.slice().sort((a, b) => a.p - b.p).slice(0, 3).sort((a, b) => a.t - b.t);
    const dear = upcoming.slice().sort((a, b) => b.p - a.p).slice(0, 3).sort((a, b) => a.t - b.t);
    const row = (x) => "klo " + hm(x.t) + "–" + hm(x.e) + (dayKey(x.t) === tomorrowKey ? " (huomenna)" : "") + ": " + nf(x.p, 2) + " c/kWh";
    priceSec = "<h2>Pörssisähkön hinta</h2>" +
      '<div class="chips">' + chips + "</div>" +
      priceChart(items, nowMs) +
      legend([{ color: "#3ddc97", label: "halvin neljännes" }, { color: "#7cc4ff", label: "keskihintaiset" }, { color: "#ff6b81", label: "kallein neljännes" }]) +
      '<p class="note">Palkit ovat hintoja tänään ja huomenna, ja valkoinen reunus on kuluva jakso. Alareunan numerot ovat kellonaikoja. Listoissa on tuntikeskihinnat.</p>' +
      (cheap.length ? "<h3>Halvimmat tulevat tunnit</h3><ul>" + cheap.map((x) => "<li>" + row(x) + "</li>").join("") + "</ul>" : "") +
      (dear.length ? "<h3>Kalleimmat tulevat tunnit</h3><ul>" + dear.map((x) => "<li>" + row(x) + "</li>").join("") + "</ul>" : "") +
      calcSec(hours) +
      hourTable(hours, q1h, q3h, nowMs) +
      '<p class="note">Tämä on sähkön pörssihinta. Sähköyhtiön marginaali ja siirtomaksu tulevat sen päälle. Huomisen hinnat julkaistaan yleensä iltapäivällä.</p>';
  }

  let lead = "";
  if (kul != null && tuo != null) {
    lead = "Suomessa kulutetaan nyt noin " + nf(kul) + " MW sähköä ja tuotetaan noin " + nf(tuo) + " MW. ";
    if (imp != null) {
      lead += imp < 0
        ? "Erotus, noin " + nf(-imp) + " MW, tuodaan ulkomailta."
        : "Ylijäämä, noin " + nf(imp) + " MW, viedään ulkomaille.";
    }
  }

  let chips = "";
  const chip = (v, label, unit) => (v == null ? "" : '<div class="chip"><b>' + nf(v, unit === "Hz" ? 3 : 0) + '</b><span>' + label + "</span></div>");
  chips += chip(kul, "kulutus (MW)");
  chips += chip(tuo, "tuotanto (MW)");
  if (imp != null) chips += '<div class="chip"><b>' + nf(Math.abs(imp)) + "</b><span>" + (imp < 0 ? "tuonti (MW)" : "vienti (MW)") + "</span></div>";
  chips += chip(co2, "päästökerroin (g/kWh)");

  let mix = "";
  if (tuo && tuo > 0) {
    const rows = [];
    if (nuc != null) rows.push(["Ydinvoima", nuc, "#ffc857"]);
    if (hyd != null) rows.push(["Vesivoima", hyd, "#7cc4ff"]);
    if (wind != null) rows.push(["Tuulivoima", wind, "#3ddc97"]);
    const sum = rows.reduce((a, r) => a + r[1], 0);
    rows.push(["Muu (lämpövoima, aurinko ym.)", Math.max(0, tuo - sum), "#93a4bd"]);
    mix = "<h2>Mistä sähkö tulee</h2>" + rows.map((r) => {
      const p = Math.max(0, Math.min(100, (100 * r[1]) / tuo));
      return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:15px"><span>' + r[0] +
        "</span><b>" + nf(r[1]) + " MW · " + nf(p) + ' %</b></div><div style="height:8px;background:#2a2a2a;border-radius:4px;overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:' +
        p.toFixed(1) + "%;background:" + r[2] + '"></i></div></div>';
    }).join("") + '<p class="note">Osuudet lasketaan Suomessa tuotetusta sähköstä. Luvut ovat lähes reaaliaikaisia ja pyöristettyjä, joten ne eivät täsmää aivan tarkasti.</p>';
  }

  const kp = pts(d[124]).slice(-168);
  const tp = pts(d[74] || d[192]).slice(-168);
  const c1 = chart([{ p: kp, color: "#7cc4ff" }, { p: tp, color: "#3ddc97" }]);
  const ip = pts(d[194]).slice(-168);
  const c2 = chart([{ p: ip, color: "#ffc857" }]);
  const cp = pts(d[265]).slice(-168);
  const c3 = chart([{ p: cp, color: "#ff6b81" }]);

  const sec1 = c1 ? "<h2>Kulutus ja tuotanto, viimeiset 7 päivää</h2>" + c1 +
    legend([{ color: "#7cc4ff", label: "Kulutus (MWh/h)" }, { color: "#3ddc97", label: "Tuotanto (MWh/h)" }]) +
    '<p class="note">Kun sininen viiva on vihreän yläpuolella, Suomi tuo sähköä ulkomailta.</p>' : "";
  const sec2 = c2 ? "<h2>Tuonti ja vienti</h2>" + c2 + legend([{ color: "#ffc857", label: "Nettotuonti/-vienti (MW)" }]) +
    '<p class="note">Fingridin luvussa miinus tarkoittaa tuontia Suomeen ja plus vientiä Suomesta. Katkoviiva on nollataso.</p>' : "";
  const sec3 = c3 ? "<h2>Sähkön päästökerroin</h2>" + c3 + legend([{ color: "#ff6b81", label: "g CO₂ / kWh" }]) +
    '<p class="note">Kertoo, kuinka paljon hiilidioksidia Suomessa kulutetun sähkön tuotannosta syntyy yhtä kilowattituntia kohden. Mitä pienempi luku, sitä vähemmän päästöjä.</p>' : "";

  const body = '<h1>Sähkö Suomessa juuri nyt</h1>' +
    '<p class="meta">Tilanne ' + when + ". Päivittyy noin kolmen tunnin välein.</p>" +
    '<div class="chips">' + chips + "</div>" +
    (lead ? '<p style="font-size:18px">' + lead + "</p>" : "") +
    priceSec + mix + sec1 + sec2 + sec3 +
    (hz != null ? '<h2>Verkon taajuus</h2><p>Nyt <b>' + nf(hz, 3) + ' Hz</b>. Suomen sähköverkon tavoitetaajuus on 50 Hz. Pienet heilahtelut ovat normaaleja, ja ne kertovat siitä, onko tuotantoa ja kulutusta yhtä paljon.</p>' : "") +
    '<h2>Mitä luvut tarkoittavat</h2><ul>' +
    "<li><b>MW (megawatti)</b> kertoo tehon eli sen, kuinka paljon sähköä käytetään tai tuotetaan juuri nyt.</li>" +
    "<li><b>MWh/h</b> on tunnin keskiteho. Se vastaa käytännössä MW-lukua.</li>" +
    "<li><b>c/kWh</b> on sähkön hinta sentteinä kilowattituntia kohden.</li>" +
    "<li><b>Tuonti</b> tarkoittaa, että Suomessa kulutetaan enemmän kuin tuotetaan, ja erotus tulee Ruotsista, Virosta tai Norjasta.</li></ul>" +
    '<div class="note"><b>Tarvitsetko tämän datan omaan käyttöösi?</b><br>Toimittajille, järjestöille, kunnille ja yrityksille teemme räätälöityjä raportteja ja vertailuja. Ota yhteyttä: <a href="mailto:miika@eduskuntaseuranta.fi">miika@eduskuntaseuranta.fi</a></div>';

  let html = shell({
    title: "Sähkö Suomessa juuri nyt: hinta, kulutus, tuotanto ja tuonti | Eduskuntaseuranta",
    desc: "Paljonko sähkö maksaa tänään ja huomenna? Pörssisähkön hinta tunneittain, kulutus, tuotanto, tuonti ja päästökerroin Suomessa.",
    path: "/sahko/",
    body,
  });
  html = html.replace(/<footer>[\s\S]*?<\/footer>/, "<footer>Lähteet: Fingrid Oyj, avoin data (data.fingrid.fi, lisenssi CC BY 4.0) ja porssisahko.net (pörssisähkön hinnat). Luvut ovat lähteiden julkaisemia sellaisenaan.</footer>");
  return [{ path: "/sahko/", html }];
}
