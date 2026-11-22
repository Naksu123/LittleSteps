import { floodFill } from "@/lib/floodFill";
import { scoreFromFirstTries, starsForScore } from "@/lib/gameScoring";

describe("Game scoring and floodFill utilities", () => {
  it("computes starsForScore thresholds consistently with the backend", () => {
    expect(starsForScore(100)).toBe(3);
    expect(starsForScore(80)).toBe(3);
    expect(starsForScore(79)).toBe(2);
    expect(starsForScore(50)).toBe(2);
    expect(starsForScore(49)).toBe(1);
    expect(starsForScore(0)).toBe(1);
  });

  it("computes scoreFromFirstTries accurately", () => {
    expect(scoreFromFirstTries(5, 5)).toBe(100);
    expect(scoreFromFirstTries(1, 2)).toBe(50);
    expect(scoreFromFirstTries(0, 4)).toBe(0);
    expect(scoreFromFirstTries(0, 0)).toBe(100);
  });

  it("floodFills only inside a bounded region without crossing a dark wall", () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill 4x4 with white, plus 1px dark vertical wall at x=2
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x === 2) {
          data[idx] = 36;
          data[idx + 1] = 51;
          data[idx + 2] = 77;
          data[idx + 3] = 255;
        } else {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
    }

    const changed = floodFill(data, width, height, 0, 0, [120, 200, 245, 255]);
    expect(changed).toBe(true);

    // Left side (x < 2) should be filled with sky blue
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 2; x++) {
        const idx = (y * width + x) * 4;
        expect(Array.from(data.slice(idx, idx + 4))).toEqual([120, 200, 245, 255]);
      }
    }

    // Wall (x = 2) and right side (x = 3) remain untouched
    for (let y = 0; y < height; y++) {
      const wallIdx = (y * width + 2) * 4;
      expect(Array.from(data.slice(wallIdx, wallIdx + 3))).toEqual([36, 51, 77]);

      const rightIdx = (y * width + 3) * 4;
      expect(Array.from(data.slice(rightIdx, rightIdx + 4))).toEqual([255, 255, 255, 255]);
    }
  });
});
