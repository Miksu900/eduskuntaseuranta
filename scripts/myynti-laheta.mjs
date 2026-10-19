// Lähettää myynti/viestit.json-viestit Brevon kautta osoitteesta miika@eduskuntaseuranta.fi.
// Lähetetään vain viestit, joiden pohja on listassa hyvaksytyt_pohjat ja joita ei ole jo lähetetty.
// TESTI=osoite lähettää yhden viestin kustakin pohjasta testiosoitteeseen (ei merkitä lähetetyksi).
import fs from "fs";
const F = "myynti/viestit.json";
const D = JSON.parse(fs.readFileSync(F, "utf8"));
const KEY = process.env.BREVO_API_KEY, TESTI = (process.env.TESTI || "").trim();
const KOPIO = "miika.koskela990@gmail.com";
const n = (t, m) => console.log(`::notice title=${t}::${m}`);
async function laheta(to, subject, text, bcc) {
  const body = { sender: { email: "miika@eduskuntaseuranta.fi", name: "Miika Koskela | Eduskuntaseuranta" },
    replyTo: { email: "miika@eduskuntaseuranta.fi", name: "Miika Koskela" }, to: [{ email: to }], subject, textContent: text };
  if (bcc) body.bcc = [{ email: bcc }];
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t}`); return JSON.parse(t).messageId;
}
if (TESTI) {
  const pohjat = [...new Set(D.viestit.map(v => v.pohja))];
  for (const p of pohjat) { const v = D.viestit.find(x => x.pohja === p); await laheta(TESTI, "TESTI " + p + " – " + v.subject, v.body); n("Testi", `pohja ${p} → ${TESTI}`); }
  process.exit(0);
}
let k = 0;
for (const v of D.viestit) {
  if (v.lahetetty || !D.hyvaksytyt_pohjat.includes(v.pohja)) continue;
  try { v.brevo_id = await laheta(v.to, v.subject, v.body, KOPIO); v.lahetetty = new Date().toISOString(); k++; n("Lähetetty", `${v.nro}. ${v.organisaatio} <${v.to}>`); }
  catch (e) { n("VIRHE", `${v.nro}. ${v.organisaatio}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 4000));
}
fs.writeFileSync(F, JSON.stringify(D, null, 1));
n("Yhteensä", `${k} viestiä lähetetty`);
