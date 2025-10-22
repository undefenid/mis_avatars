import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import globby from "globby";
import pc from "picocolors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const IN_DIR = path.join(ROOT, "avatars");
const OUT_DIR = path.join(ROOT, "dist");
const OUT_AV = path.join(OUT_DIR, "avatars");
const OUT_TH = path.join(OUT_DIR, "thumbs");
const OUT_JSON = path.join(OUT_DIR, "index.json");

const REPO = process.env.GITHUB_REPOSITORY || "";
const BRANCH = process.env.GITHUB_REF_NAME || "gh-pages"; // publicamos a gh-pages
const BASE = `https://${REPO.split("/")[0]}.github.io/${REPO.split("/")[1]}`;

const VALID = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function niceName(id) {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function build() {
  console.log(pc.cyan("• Building avatars manifest…"));

  await fs.rm(OUT_DIR, { recursive: true, force: true }).catch(()=>{});
  await ensureDir(OUT_AV);
  await ensureDir(OUT_TH);

  // grupos = subcarpetas directas de avatars/
  const entries = await fs.readdir(IN_DIR, { withFileTypes: true });
  const groups = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

  const manifest = {
    version: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    base: BASE,
    groups: []
  };

  for (const g of groups) {
    const gIn = path.join(IN_DIR, g);
    const files = (await fs.readdir(gIn)).filter(f => VALID.has(path.extname(f).toLowerCase())).sort();

    const gOut = path.join(OUT_AV, g);
    const tOut = path.join(OUT_TH, g);
    await ensureDir(gOut);
    await ensureDir(tOut);

    const items = [];
    for (const f of files) {
      const inPath = path.join(gIn, f);
      const id = path.parse(f).name;

      const img = sharp(inPath);
      const meta = await img.metadata();

      // Optimiza → WEBP (máx 1024px, manteniendo aspect)
      const outFile = `${id}.webp`;
      const outPath = path.join(gOut, outFile);
      const pipeline = sharp(inPath).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 });
      const outBuf = await pipeline.toBuffer();
      await fs.writeFile(outPath, outBuf);

      // Thumb 256px
      const thFile = `${id}@2x.webp`;
      const thPath = path.join(tOut, thFile);
      const thBuf = await sharp(inPath).resize({ width: 256, height: 256, fit: "cover" }).webp({ quality: 82 }).toBuffer();
      await fs.writeFile(thPath, thBuf);

      const digest = await sha256(outBuf);
      const { width, height } = await sharp(outBuf).metadata();

      items.push({
        id,
        url: `${BASE}/avatars/${g}/${outFile}`,
        thumb: `${BASE}/thumbs/${g}/${thFile}`,
        w: width || meta.width || null,
        h: height || meta.height || null,
        bytes: outBuf.length,
        sha256: digest
      });
    }

    manifest.groups.push({
      id: g,
      name: niceName(g),
      baseUrl: `${BASE}/avatars/${g}/`,
      count: items.length,
      items
    });
  }

  await fs.writeFile(OUT_JSON, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(pc.green(`✓ Wrote ${path.relative(ROOT, OUT_JSON)}`));
}

build().catch(e => {
  console.error(e);
  process.exit(1);
});
