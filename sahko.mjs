// sahko.mjs - Sähkö juuri nyt (Fingrid avoin data). Lukee data/fingrid/*.json.
import { readFileSync } from "node:fs";

const TZ = "Europe/Helsinki";
const load = (id) => { try { return JSON.parse(readFileSync("data/fingrid/" + id + ".json", "utf8")); } catch (e) { return null; } };
const nf = (n, d = 0) => new Intl.NumberFormat("fi-FI", { maximumFractionDigits: d }).format(n);
const fmt = (t, o) => new Date(t).toLocaleString("fi-FI", Object.assign({ timeZone: TZ }, o));
const dayKey = (t) => fmt(t, { year: "numeric", month: "numeric", day: "numeric" });

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
    g += '<text x="' + (PL + 2) + '" y="' + (Y(v) - 3).toFixed(1) + '" font-size="9" fill="currentColor" opacity=".7">' + nf(v) + "</text>";
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
  return '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--text)" role="img">' + g + "</svg>";
}

const legend = (items) =>
  '<p class="meta">' + items.map((i) => '<span style="color:' + i.color + '">■</span> ' + i.label).join(" &nbsp; ") + "</p>";

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

  // tuotannon jakauma
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
    '<p class="meta">Tilanne ' + when + ". Päivittyy noin kuuden tunnin välein.</p>" +
    '<div class="chips">' + chips + "</div>" +
    (lead ? '<p style="font-size:18px">' + lead + "</p>" : "") +
    mix + sec1 + sec2 + sec3 +
    (hz != null ? '<h2>Verkon taajuus</h2><p>Nyt <b>' + nf(hz, 3) + ' Hz</b>. Suomen sähköverkon tavoitetaajuus on 50 Hz. Pienet heilahtelut ovat normaaleja, ja ne kertovat siitä, onko tuotantoa ja kulutusta yhtä paljon.</p>' : "") +
    '<h2>Mitä luvut tarkoittavat</h2><ul>' +
    "<li><b>MW (megawatti)</b> kertoo tehon eli sen, kuinka paljon sähköä käytetään tai tuotetaan juuri nyt.</li>" +
    "<li><b>MWh/h</b> on tunnin keskiteho. Se vastaa käytännössä MW-lukua.</li>" +
    "<li><b>Tuonti</b> tarkoittaa, että Suomessa kulutetaan enemmän kuin tuotetaan, ja erotus tulee Ruotsista, Virosta tai Norjasta.</li></ul>" +
    '<div class="note"><b>Tarvitsetko tämän datan omaan käyttöösi?</b><br>Toimittajille, järjestöille, kunnille ja yrityksille teemme räätälöityjä raportteja ja vertailuja. Ota yhteyttä: <a href="mailto:miika@eduskuntaseuranta.fi">miika@eduskuntaseuranta.fi</a></div>';

  let html = shell({
    title: "Sähkö Suomessa juuri nyt: kulutus, tuotanto ja tuonti | Eduskuntaseuranta",
    desc: "Paljonko sähköä Suomessa kulutetaan ja tuotetaan juuri nyt? Ydinvoima, tuulivoima, vesivoima, tuonti ja päästökerroin Fingridin avoimesta datasta.",
    path: "/sahko/",
    body,
  });
  html = html.replace(/<footer>[\s\S]*?<\/footer>/, "<footer>Lähde: Fingrid Oyj, avoin data (data.fingrid.fi), lisenssi CC BY 4.0. Luvut ovat Fingridin reaaliaikaisia mittauksia sellaisenaan.</footer>");
  return [{ path: "/sahko/", html }];
}
