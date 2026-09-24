import atlasUrl from '../../assets/disaster-marker-atlas.png';

type Hazard = 'Cyclone' | 'Flood' | 'Tsunami' | 'Volcanic' | 'Earthquake' | 'Heatwave' | 'Landslide';

// The supplied atlas is five columns by two rows. These choices follow the
// requested disaster colors; Earthquake uses the orange art with a brown tint.
const cells: Record<Hazard, { column: number; row: number; filter?: string }> = {
  Volcanic: { column: 0, row: 0 },
  Tsunami: { column: 1, row: 0 },
  Landslide: { column: 2, row: 0 },
  Heatwave: { column: 3, row: 0 },
  Earthquake: { column: 4, row: 0, filter: 'sepia(.72) saturate(1.15) hue-rotate(340deg) brightness(.82)' },
  Cyclone: { column: 0, row: 1 },
  Flood: { column: 2, row: 1 },
};

let markerImages: Promise<Record<Hazard, string>> | undefined;

function cleanCell(image: HTMLImageElement, column: number, row: number, filter?: string) {
  const x = Math.round(column * image.naturalWidth / 5);
  const y = Math.round(row * image.naturalHeight / 2);
  const width = Math.round((column + 1) * image.naturalWidth / 5) - x;
  const height = Math.round((row + 1) * image.naturalHeight / 2) - y;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '';
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  const { data } = frame;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let tail = 0;
  const background = (pixel: number) => {
    const offset = pixel * 4;
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) < 15 && (r + g + b) / 3 > 166;
  };
  const seed = (pixel: number) => {
    if (pixel >= 0 && pixel < visited.length && !visited[pixel] && background(pixel)) {
      visited[pixel] = 1; queue[tail++] = pixel;
    }
  };
  // Remove the outside checker and each pin's enclosed center hole.
  for (let cx = 0; cx < width; cx++) { seed(cx); seed((height - 1) * width + cx); }
  for (let cy = 0; cy < height; cy++) { seed(cy * width); seed(cy * width + width - 1); }
  const holeY = Math.round(height * (row === 0 ? 0.38 : 0.28));
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) seed((holeY + dy) * width + width / 2 + dx | 0);
  for (let head = 0; head < tail; head++) {
    const pixel = queue[head];
    const x0 = pixel % width, y0 = (pixel / width) | 0;
    data[pixel * 4 + 3] = 0;
    if (x0 > 0) seed(pixel - 1);
    if (x0 + 1 < width) seed(pixel + 1);
    if (y0 > 0) seed(pixel - width);
    if (y0 + 1 < height) seed(pixel + width);
  }
  context.putImageData(frame, 0, 0);
  if (filter) {
    const tinted = document.createElement('canvas');
    tinted.width = width; tinted.height = height;
    const tintContext = tinted.getContext('2d');
    if (tintContext) { tintContext.filter = filter; tintContext.drawImage(canvas, 0, 0); }
    return tinted.toDataURL('image/png');
  }
  return canvas.toDataURL('image/png');
}

export function loadDisasterMarkerImages() {
  if (!markerImages) markerImages = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const result = Object.fromEntries(Object.entries(cells).map(([hazard, cell]) => [
        hazard, cleanCell(image, cell.column, cell.row, cell.filter),
      ])) as Record<Hazard, string>;
      resolve(result);
    };
    image.onerror = reject;
    image.src = atlasUrl;
  });
  return markerImages;
}
