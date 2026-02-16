/**
 * Wrap text onto multiple lines within a given max width.
 * Returns an array of line strings.
 */
function getWrappedLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Pick the largest font size (up to maxSize) that fits the text within
 * the given dimensions, accounting for line wrapping.
 */
function fitFontSize(
  ctx,
  text,
  maxWidth,
  maxHeight,
  maxSize = 42,
  minSize = 12,
) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `bold ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    const lines = getWrappedLines(ctx, text, maxWidth);
    const lineHeight = size * 1.3;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= maxHeight) return { size, lines, lineHeight };
  }
  // Fallback to minimum
  ctx.font = `bold ${minSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  const lines = getWrappedLines(ctx, text, maxWidth);
  const lineHeight = minSize * 1.3;
  return { size: minSize, lines, lineHeight };
}

/**
 * Generate a white post-it note image.
 * Colour can be applied via the token's tint setting.
 *
 * @param {string} name   - The trait name to display.
 * @param {number} [width=600]  - Canvas pixel width.
 * @param {number} [height=200] - Canvas pixel height.
 * @returns {string} A data URI (image/webp) of the generated image.
 */
export function generatePostItImage(name, width = 600, height = 200) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // --- Background (white — tint via token settings) ---
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // --- Subtle gradient overlay for depth ---
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(255,255,255,0.15)");
  grad.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // --- Folded corner triangle ---
  const foldSize = 28;
  ctx.fillStyle = "#CCCCCC";
  ctx.beginPath();
  ctx.moveTo(width - foldSize, 0);
  ctx.lineTo(width, foldSize);
  ctx.lineTo(width, 0);
  ctx.closePath();
  ctx.fill();

  // --- Border ---
  ctx.strokeStyle = "#B0B0B0";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

  // --- Text ---
  const padding = 24;
  const maxTextWidth = width - padding * 2;
  const maxTextHeight = height - padding * 2;

  const { size, lines, lineHeight } = fitFontSize(
    ctx,
    name,
    maxTextWidth,
    maxTextHeight,
  );
  ctx.font = `bold ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#333333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const totalTextHeight = lines.length * lineHeight;
  const startY = (height - totalTextHeight) / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
  }

  // --- Return as data URI ---
  return canvas.toDataURL("image/webp", 0.92);
}
