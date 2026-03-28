# /optimize-images

Batch-optimize images in the web app for production. Converts to WebP, resizes to max dimensions, compresses without visible quality loss.

## Usage

```
/optimize-images [--path <glob>] [--width 1200] [--quality 80] [--dry-run]
```

**Examples:**
```
/optimize-images
/optimize-images --path "apps/web/public/images/products/**"
/optimize-images --dry-run
```

Defaults: scans `apps/web/public/images/**/*.{png,jpg,jpeg}`, max width 1200px, WebP quality 80.

## Agent instructions

When this skill is invoked:

1. Parse args: `--path` (default `apps/web/public/images/**/*.{png,jpg,jpeg}`), `--width` (default 1200), `--quality` (default 80), `--dry-run` (boolean)

2. Find all matching image files:
   ```bash
   find apps/web/public/images -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) | grep -v ".webp"
   ```

3. For each file, check if an optimized `.webp` version already exists at the same path with `.webp` extension.
   - Skip if `.webp` exists and is newer than the source.

4. If `--dry-run`, list what would be processed and estimated savings. Do not create files.

5. Otherwise, for each file run:
   ```bash
   npx --yes sharp-cli -i <input> -o <output>.webp --width <width> --withoutEnlargement --format webp --quality <quality>
   ```
   where `<output>` is the input path with extension replaced by `.webp`.

6. After all files are processed, print a summary table:
   ```
   File                                  Before    After     Saved
   ────────────────────────────────────  ────────  ────────  ─────
   images/products/drill-bits.png        1.2 MB    87 KB     93%
   images/products/pizza-dough.jpg       840 KB    62 KB     93%
   ────────────────────────────────────  ────────  ────────  ─────
   Total                                 2.04 MB   149 KB    93%
   ```

7. Remind the user: replace `<img src="*.png">` with `<Image src="*.webp">` using the Next.js `Image` component. The original files can be kept as fallback or deleted.

## Notes

- Always prefer `.webp` for product/UI images — 25–35% smaller than JPEG at same quality
- Use Next.js `<Image>` component for automatic format negotiation and lazy loading
- Never commit unoptimized images to the repo — run this before any image-related PR
- AI-generated images from `/generate-image` are already optimized — no need to re-run
