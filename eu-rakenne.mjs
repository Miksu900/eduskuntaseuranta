import fs from "node:fs";
import { execSync } from "node:child_process";

const out = (s) => console.log(s);
execSync('curl -L -sS -A "Mozilla/5.0" --retry 3 --max-time 600 -o /tmp/reg.xml "https://transparency-register.europa.eu/odplastorganisationxml_en"', { stdio: "inherit" });

const flat = (s) => s.replace(/<\/?([A-Za-z0-9]+)[^>]*>/g, " [$1] ").replace(/\s+/g, " ").trim();
const grab = (blk, t) => (blk.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")) || [, ""])[1].replace(/\s+/g, " ").trim();

const picked = [];
const cats = new Set();
function handle(blk) {
  if (picked.length >= 6) return;
  const head = grab(blk, "headOffice");
  if (!/<country>\s*finland\s*<\/country>/i.test(head)) return;
  const cat = grab(blk, "registrationCategory");
  const name = grab(blk, "originalName");
  const fd = (blk.match(/<financialData>([\s\S]*?)<\/financialData>/) || [, ""])[1];
  if (!fd) return;
  const special = /itsenäisyyden juhlarahasto|Helsingin yliopisto/i.test(name);
  if (special || !cats.has(cat)) {
    cats.add(cat);
    picked.push({ name, cat, fd });
  }
}

const stream = fs.createReadStream("/tmp/reg.xml", { encoding: "utf8" });
let buf = "";
const END = "</interestRepresentative>";
for await (const chunk of stream) {
  buf += chunk;
  let i;
  while ((i = buf.indexOf(END)) >= 0) {
    const start = buf.indexOf("<interestRepresentative>");
    if (start >= 0 && start < i) handle(buf.slice(start, i + END.length));
    buf = buf.slice(i + END.length);
  }
  if (buf.length > 5000000) buf = buf.slice(-2000000);
  if (picked.length >= 6) break;
}

out("## Rahoitusdatan rakenne (6 suomalaista)");
for (const p of picked) {
  out("\n### " + p.name + " (" + p.cat + ")");
  out(flat(p.fd).slice(0, 2500));
}
