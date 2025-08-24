import { describe, it, expect } from "vitest";
import {
  degreesToRadians,
  radiansToDegrees,
  clamp,
  lerp,
  calculateFlareConstant,
  safeSqrt,
  safeLog,
  safeDivide,
} from "./math";

describe("Math Utilities", () => {
  describe("degreesToRadians", () => {
    it("should convert degrees to radians correctly", () => {
      expect(degreesToRadians(0)).toBe(0);
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10);
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10);
    });
  });

  describe("radiansToDegrees", () => {
    it("should convert radians to degrees correctly", () => {
      expect(radiansToDegrees(0)).toBe(0);
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
    });
  });

  describe("clamp", () => {
    it("should clamp values correctly", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("lerp", () => {
    it("should interpolate correctly", () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(10, 20, 0.25)).toBe(12.5);
    });
  });

  describe("calculateFlareConstant", () => {
    it("should calculate flare constant correctly", () => {
      const fc = 100; // Hz
      const c = 343.2; // m/s
      const expected = (4 * Math.PI * fc) / c;
      expect(calculateFlareConstant(fc, c)).toBeCloseTo(expected, 10);
    });
  });

  describe("safeSqrt", () => {
    it("should handle positive values", () => {
      expect(safeSqrt(4)).toBe(2);
      expect(safeSqrt(9)).toBe(3);
    });

    it("should return 0 for negative values", () => {
      expect(safeSqrt(-1)).toBe(0);
      expect(safeSqrt(-100)).toBe(0);
    });
  });

  describe("safeLog", () => {
    it("should handle positive values", () => {
      expect(safeLog(Math.E)).toBeCloseTo(1, 10);
      expect(safeLog(1)).toBe(0);
    });

    it("should throw for non-positive values", () => {
      expect(() => safeLog(0)).toThrow();
      expect(() => safeLog(-1)).toThrow();
    });
  });

  describe("safeDivide", () => {
    it("should handle normal division", () => {
      expect(safeDivide(10, 2)).toBe(5);
      expect(safeDivide(7, 3)).toBeCloseTo(2.333333, 5);
    });

    it("should throw for division by zero", () => {
      expect(() => safeDivide(10, 0)).toThrow();
      expect(() => safeDivide(10, Number.EPSILON / 2)).toThrow();
    });
  });
});
