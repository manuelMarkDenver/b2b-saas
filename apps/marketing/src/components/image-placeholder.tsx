/**
 * Renders a styled placeholder wherever a generated image will eventually go.
 * Shows the image dimensions, label, and the exact /generate-image command to run.
 * Completely invisible in production — replace `src` in marketing.config.ts to hide.
 */

type Props = {
  width: number;
  height: number;
  label: string;
  hint?: string;
};

export function ImagePlaceholder({ width, height, label, hint }: Props) {
  const aspectRatio = `${width} / ${height}`;
  return (
    <div
      style={{ aspectRatio }}
      className="w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-3">
        <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-indigo-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{width}×{height}px</p>
      {hint && <p className="mt-2 text-xs text-indigo-400 italic">{hint}</p>}
    </div>
  );
}
