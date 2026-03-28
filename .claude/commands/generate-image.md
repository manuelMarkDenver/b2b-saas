# /generate-image

Generate an AI product or UI image using Replicate (FLUX Schnell model), then optimize it for web use.

## Usage

```
/generate-image <description> [--output <relative-path>] [--width 800] [--height 600]
```

**Examples:**
```
/generate-image "hardware store drill bits on white background, product photo"
/generate-image "pizza ingredients top-down shot" --output apps/web/public/images/products/pizza-ingredients.webp
/generate-image "modern warehouse shelving" --width 1200 --height 630
```

## What this skill does

1. Calls the Replicate API (FLUX Schnell) with the description as a prompt
2. Polls until the image is ready
3. Downloads the image to the specified output path (default: `apps/web/public/images/generated/`)
4. Optimizes it using sharp: resize to target dimensions, convert to WebP, compress to ≤150KB
5. Reports original size, final size, and savings

## Prerequisites

Set `REPLICATE_API_TOKEN` in your shell environment or `.env`:
```bash
export REPLICATE_API_TOKEN=r8_your_token_here
```
Get a token at https://replicate.com — pay-per-use, FLUX Schnell is ~$0.003/image.

## Agent instructions

When this skill is invoked, act as follows:

1. Parse arguments: extract `description`, `--output` path, `--width` (default 800), `--height` (default 600)

2. Determine output path:
   - If `--output` provided, use it as-is (make it absolute relative to repo root)
   - Otherwise: `apps/web/public/images/generated/<slug>.webp` where `<slug>` is the first 4 words of description, lowercased, hyphenated

3. Ensure the output directory exists: `mkdir -p <dir>`

4. Check for REPLICATE_API_TOKEN:
   ```bash
   echo $REPLICATE_API_TOKEN
   ```
   If empty, check `.env` file. If still missing, tell the user and stop.

5. Submit the image generation job:
   ```bash
   curl -s -X POST \
     -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"input\": {\"prompt\": \"<description>, clean product photo, professional lighting, white or neutral background\", \"width\": <width>, \"height\": <height>, \"num_outputs\": 1}}" \
     "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"
   ```
   Save the `id` and `urls.get` from the response.

6. Poll until status is `succeeded` (check every 3 seconds, max 10 attempts):
   ```bash
   curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" <urls.get>
   ```
   When `status` is `succeeded`, extract the image URL from `output[0]`.

7. Download the image:
   ```bash
   curl -sL "<image_url>" -o /tmp/generated-raw.png
   ```

8. Check if sharp CLI is available. If not, install it:
   ```bash
   npx --yes sharp-cli --version
   ```

9. Optimize with sharp:
   ```bash
   npx sharp-cli -i /tmp/generated-raw.png -o <output_path> --width <width> --height <height> --fit cover --format webp --quality 80
   ```

10. Report results:
    - Original size (from `/tmp/generated-raw.png`)
    - Final size (from output path)
    - Compression ratio
    - Output path

11. Clean up: `rm /tmp/generated-raw.png`

## Output format

```
✓ Image generated and optimized
  Description: hardware store drill bits on white background
  Output:      apps/web/public/images/products/drill-bits.webp
  Dimensions:  800×600
  Original:    1.2 MB (PNG)
  Optimized:   87 KB (WebP) — 93% reduction
```
