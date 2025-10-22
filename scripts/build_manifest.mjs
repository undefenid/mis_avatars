// scripts/build_manifest.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "<owner>";
const REPO_NAME  = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "<repo>";
const PAGES_BASE = `https://${REPO_OWNER}.github.io/${REPO_NAME}`;

const ROOT = "avatars"; // cada subcarpeta = grupo

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const pretty = s => s.replace(/[_-]+/g, " ")
                     .replace(/\s+/g, " ")
                     .trim()
                     .replace(/\b\w/g, x => x.toUpperCase());

async function listDirSafe(p) {
  try { return await fs.readdir(p, { withFileTypes: true }); }
  catch { return []; }
}

async function build() {
  const groups = [];
  const entries = await listDirSafe(ROOT);

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = e.name;                   // p.ej. "naruto"
    const abs = path.join(ROOT, dir);
    const files = await listDirSafe(abs);

    const items = [];
    for (const f of files) {
      if (!f.isFile()) continue;
      const ext = path.extname(f.name).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;

      const relPath = `${ROOT}/${dir}/${f.name}`;
      items.push({
        filename: f.name,
        url: `${PAGES_BASE}/${relPath}`
      });
    }

    if (items.length === 0) continue; // omitir carpetas vacías

    groups.push({
      id: dir,
      name: pretty(dir),
      animeUrl: `https://example.com/anime/${encodeURIComponent(dir)}`, // ajusta como quieras
      count: items.length,
      items
    });
  }

  const outDir = "dist";
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "index.json"), JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: PAGES_BASE,
    groups
  }, null, 2));
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
