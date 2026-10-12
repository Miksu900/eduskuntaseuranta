// Välimuisti ulkoisille GET-haulle: nopeuttaa rakennusta. Supabase-haut (äänet jne.) eivät mene välimuistiin.
// FETCH_TTL_H = tuntia, kuinka vanhaa välimuistia saa käyttää (0 = aina tuore haku, mutta tulos tallennetaan).
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
const DIR = ".cache/fetch";
const TTL = Number(process.env.FETCH_TTL_H || 0) * 3600 * 1000;
const real = globalThis.fetch;
await mkdir(DIR, { recursive: true });
let hit = 0, miss = 0;
globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input.url;
  const method = ((init && init.method) || (typeof input !== "string" && input.method) || "GET").toUpperCase();
  if (method !== "GET" || !/^https?:/.test(url) || /supabase\.co/.test(url)) return real(input, init);
  const key = createHash("sha1").update(url + JSON.stringify((init && init.headers) || {})).digest("hex");
  const body = `${DIR}/${key}.bin`, meta = `${DIR}/${key}.json`;
  if (TTL > 0) {
    try {
      const st = await stat(meta);
      if (Date.now() - st.mtimeMs < TTL) {
        const m = JSON.parse(await readFile(meta, "utf8"));
        const buf = await readFile(body);
        hit++;
        return new Response(buf, { status: m.status, headers: m.headers });
      }
    } catch {}
  }
  const res = await real(input, init);
  miss++;
  if (res.ok) {
    try {
      const buf = Buffer.from(await res.clone().arrayBuffer());
      const headers = {};
      for (const h of ["content-type", "content-encoding"]) if (res.headers.get(h) && h !== "content-encoding") headers[h] = res.headers.get(h);
      await writeFile(body, buf);
      await writeFile(meta, JSON.stringify({ status: res.status, headers }));
    } catch {}
  }
  return res;
};
process.on("exit", () => console.log(`[välimuisti] osumia ${hit}, hakuja ${miss}`));
