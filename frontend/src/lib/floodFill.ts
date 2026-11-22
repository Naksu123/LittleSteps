export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fill: [number, number, number, number],
  tolerance = 32
): boolean {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;

  const startIdx = (sy * width + sx) * 4;
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];
  const sa = data[startIdx + 3];

  if (
    Math.abs(sr - fill[0]) <= 2 &&
    Math.abs(sg - fill[1]) <= 2 &&
    Math.abs(sb - fill[2]) <= 2 &&
    Math.abs(sa - fill[3]) <= 2
  ) {
    return false;
  }

  const matchesStart = (idx: number): boolean =>
    Math.abs(data[idx] - sr) <= tolerance &&
    Math.abs(data[idx + 1] - sg) <= tolerance &&
    Math.abs(data[idx + 2] - sb) <= tolerance &&
    Math.abs(data[idx + 3] - sa) <= tolerance;

  const setPixel = (idx: number): void => {
    data[idx] = fill[0];
    data[idx + 1] = fill[1];
    data[idx + 2] = fill[2];
    data[idx + 3] = fill[3];
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    let lx = x;
    while (lx >= 0) {
      const pos = y * width + lx;
      if (visited[pos] || !matchesStart(pos * 4)) break;
      lx--;
    }
    lx++;

    let spanAbove = false;
    let spanBelow = false;

    for (let cx = lx; cx < width; cx++) {
      const pos = y * width + cx;
      const idx = pos * 4;
      if (visited[pos] || !matchesStart(idx)) break;

      visited[pos] = 1;
      setPixel(idx);

      if (y > 0) {
        const upPos = (y - 1) * width + cx;
        const upMatch = !visited[upPos] && matchesStart(upPos * 4);
        if (!spanAbove && upMatch) {
          stack.push(cx, y - 1);
          spanAbove = true;
        } else if (spanAbove && !upMatch) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const downPos = (y + 1) * width + cx;
        const downMatch = !visited[downPos] && matchesStart(downPos * 4);
        if (!spanBelow && downMatch) {
          stack.push(cx, y + 1);
          spanBelow = true;
        } else if (spanBelow && !downMatch) {
          spanBelow = false;
        }
      }
    }
  }

  return true;
}
