// Builds public/v1/ (manifest.json + full/thumb/cover JPEGs) from source/catalog.json and source/images/.
// Also copies everything in static/ (app-ads.txt, the privacy policy page) to the site root.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encode } from 'blurhash';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, 'source');
const OUT = join(ROOT, 'public', 'v1');

// Must match ToneId in the app (src/data/types.ts); anything else is silently turned into "midnight" there.
const TONES = ['midnight', 'ember', 'ocean', 'bloom', 'forest', 'mono'];
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|tiff?|avif)$/i;
const FULL_MAX_HEIGHT = 4800;
const THUMB_WIDTH = 600;
const COVER_WIDTH = 900;

const catalog = JSON.parse(readFileSync(join(SOURCE, 'catalog.json'), 'utf8'));
const images = readdirSync(join(SOURCE, 'images')).filter((f) => IMAGE_EXT.test(f));

validate(catalog);

rmSync(OUT, { recursive: true, force: true });
for (const dir of ['full', 'thumbs', 'covers']) mkdirSync(join(OUT, dir), { recursive: true });

const wallpapers = [];
for (const w of catalog.wallpapers) {
  const input = sharp(join(SOURCE, 'images', imageFor(w.id))).rotate(); // .rotate() applies EXIF orientation

  const full = await input
    .clone()
    .resize({ height: FULL_MAX_HEIGHT, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await input
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();

  const { width, height } = full.info;
  wallpapers.push({
    id: w.id,
    title: w.title,
    collectionId: w.collectionId,
    tone: w.tone,
    tags: w.tags ?? [],
    isLive: w.isLive === true,
    resolution: resolutionLabel(width, height),
    thumb: write('thumbs', w.id, thumb),
    full: write('full', w.id, full.data),
    width,
    height,
    popularity: w.popularity ?? 0,
    addedAt: w.addedAt,
    blurhash: await blurhashOf(input.clone()),
  });
}

const collections = [];
for (const c of catalog.collections) {
  const cover = await sharp(join(SOURCE, 'images', imageFor(c.coverWallpaperId)))
    .rotate()
    .resize({ width: COVER_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  collections.push({
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    cover: write('covers', c.id, cover),
  });
}

const manifest = { version: 1, todaysPickId: catalog.todaysPickId, collections, wallpapers };
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(`Built ${wallpapers.length} wallpapers in ${collections.length} collections → public/v1/manifest.json`);

const STATIC = join(ROOT, 'static');
if (existsSync(STATIC)) {
  cpSync(STATIC, join(ROOT, 'public'), { recursive: true });
  console.log(`Copied ${readdirSync(STATIC).join(', ')} → public/`);
}

/** Writes a content-hashed file (so "immutable" caching is safe) and returns its path relative to the manifest. */
function write(dir, id, buffer) {
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10);
  const path = `${dir}/${id}-${hash}.jpg`;
  writeFileSync(join(OUT, path), buffer);
  return path;
}

function imageFor(id) {
  const file = images.find((f) => f.replace(IMAGE_EXT, '') === id);
  if (!file) throw new Error(`No image in source/images/ for "${id}"`);
  return file;
}

async function blurhashOf(image) {
  const { data, info } = await image
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 3, 4);
}

function resolutionLabel(width, height) {
  const short = Math.min(width, height);
  if (short >= 2160) return '4K';
  if (short >= 1440) return '2K';
  if (short >= 1080) return 'FHD';
  return 'HD';
}

function validate({ todaysPickId, collections, wallpapers }) {
  const errors = [];
  const collectionIds = new Set(collections.map((c) => c.id));
  const wallpaperIds = new Set();
  const idPattern = /^[a-z0-9][a-z0-9-]*$/;

  for (const w of wallpapers) {
    if (!idPattern.test(w.id ?? '')) errors.push(`wallpaper id "${w.id}" must be lowercase letters, digits and dashes`);
    if (wallpaperIds.has(w.id)) errors.push(`duplicate wallpaper id "${w.id}"`);
    wallpaperIds.add(w.id);
    if (!w.title) errors.push(`${w.id}: missing title`);
    if (!collectionIds.has(w.collectionId)) errors.push(`${w.id}: unknown collectionId "${w.collectionId}"`);
    if (!TONES.includes(w.tone)) errors.push(`${w.id}: tone "${w.tone}" must be one of ${TONES.join(', ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.addedAt ?? '')) errors.push(`${w.id}: addedAt must be YYYY-MM-DD`);
    if (!images.some((f) => f.replace(IMAGE_EXT, '') === w.id)) errors.push(`${w.id}: no image in source/images/`);
  }
  for (const c of collections) {
    if (!idPattern.test(c.id ?? '')) errors.push(`collection id "${c.id}" must be lowercase letters, digits and dashes`);
    if (!c.title) errors.push(`${c.id}: missing title`);
    if (!wallpaperIds.has(c.coverWallpaperId)) errors.push(`${c.id}: coverWallpaperId "${c.coverWallpaperId}" is not a wallpaper`);
  }
  if (todaysPickId && !wallpaperIds.has(todaysPickId)) errors.push(`todaysPickId "${todaysPickId}" is not a wallpaper`);

  if (errors.length) {
    console.error(`catalog.json has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
    process.exit(1);
  }
}
