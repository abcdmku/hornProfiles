import { describe, it, expect } from "vitest";
import { morphCrossSectionShapes } from "./shape-morphing";
import type { ShapeMorphParams } from "./shape-morphing";
import { MORPHING_FUNCTIONS } from "horn-profiles";

describe("shape-morphing", () => {
  describe("MORPHING_FUNCTIONS", () => {
    it("should have linear function that returns identity", () => {
      expect(MORPHING_FUNCTIONS.linear(0)).toBe(0);
      expect(MORPHING_FUNCTIONS.linear(0.5)).toBe(0.5);
      expect(MORPHING_FUNCTIONS.linear(1)).toBe(1);
    });

    it("should have cubic function that provides smooth transitions", () => {
      expect(MORPHING_FUNCTIONS.cubic(0)).toBe(0);
      expect(MORPHING_FUNCTIONS.cubic(1)).toBe(1);
      expect(MORPHING_FUNCTIONS.cubic(0.5)).toBeCloseTo(0.5, 5);
    });

    it("should have sigmoid function that provides S-curve", () => {
      // Sigmoid function has asymptotic behavior, so it won't exactly reach 0 or 1
      expect(MORPHING_FUNCTIONS.sigmoid(0)).toBeCloseTo(0, 1);
      expect(MORPHING_FUNCTIONS.sigmoid(1)).toBeCloseTo(1, 1);
      expect(MORPHING_FUNCTIONS.sigmoid(0.5)).toBeCloseTo(0.5, 2);
    });
  });

  describe("morphCrossSectionShapes", () => {
    const baseParams: ShapeMorphParams = {
      sourceShape: "circle",
      targetShape: "rectangular",
      morphFactor: 0.5,
      sourceWidth: 100,
      sourceHeight: 80,
      targetWidth: 100,
      targetHeight: 80,
      resolution: 8,
    };

    it("should return source shape when morphFactor is 0", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        morphFactor: 0,
      };

      const result = morphCrossSectionShapes(params);

      expect(result).toBeDefined();
      expect(result.length).toBe(8);

      // For circle at factor 0, all points should be at same radius
      const radius = baseParams.sourceWidth / 2; // Circle uses width as diameter
      result.forEach((point) => {
        const pointRadius = Math.sqrt(point.y * point.y + point.z * point.z);
        expect(pointRadius).toBeCloseTo(radius, 1);
      });
    });

    it("should return target shape when morphFactor is 1", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        morphFactor: 1,
      };

      const result = morphCrossSectionShapes(params);

      expect(result).toBeDefined();
      expect(result.length).toBe(8);

      // For rectangular target, points should be at corners/edges
      // We can't easily test exact rectangle shape due to point distribution,
      // but we can verify it's different from circle
      const maxRadius = Math.max(...result.map((p) => Math.sqrt(p.y * p.y + p.z * p.z)));
      const minRadius = Math.min(...result.map((p) => Math.sqrt(p.y * p.y + p.z * p.z)));

      // Rectangular shape should have varying radii (not constant like circle)
      expect(maxRadius).toBeGreaterThan(minRadius);
    });

    it("should return intermediate shape when morphFactor is between 0 and 1", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        morphFactor: 0.3,
      };

      const result = morphCrossSectionShapes(params);

      expect(result).toBeDefined();
      expect(result.length).toBe(8);

      // Should be different from both pure circle and pure rectangle
      expect(result).not.toEqual(morphCrossSectionShapes({ ...params, morphFactor: 0 }));
      expect(result).not.toEqual(morphCrossSectionShapes({ ...params, morphFactor: 1 }));
    });

    it("should return same shape when source and target are identical", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        sourceShape: "circle",
        targetShape: "circle",
        morphFactor: 0.5,
      };

      const result = morphCrossSectionShapes(params);
      const circleResult = morphCrossSectionShapes({ ...params, morphFactor: 0 });

      expect(result).toBeDefined();
      expect(result.length).toBe(circleResult.length);

      // Should be same as pure circle since both source and target are circles
      result.forEach((point, i) => {
        expect(point.y).toBeCloseTo(circleResult[i].y, 5);
        expect(point.z).toBeCloseTo(circleResult[i].z, 5);
      });
    });

    it("should handle ellipse to superellipse morphing", () => {
      const params: ShapeMorphParams = {
        sourceShape: "ellipse",
        targetShape: "superellipse",
        morphFactor: 0.5,
        sourceWidth: 120,
        sourceHeight: 80,
        targetWidth: 120,
        targetHeight: 80,
        resolution: 12,
      };

      const result = morphCrossSectionShapes(params);

      expect(result).toBeDefined();
      expect(result.length).toBe(12);

      // Basic sanity check - all points should be within reasonable bounds
      result.forEach((point) => {
        expect(Math.abs(point.y)).toBeLessThanOrEqual(params.sourceWidth / 2 + 1);
        expect(Math.abs(point.z)).toBeLessThanOrEqual(params.sourceHeight / 2 + 1);
      });
    });

    it("should respect resolution parameter", () => {
      const lowRes = morphCrossSectionShapes({ ...baseParams, resolution: 4 });
      const highRes = morphCrossSectionShapes({ ...baseParams, resolution: 16 });

      expect(lowRes.length).toBe(4);
      expect(highRes.length).toBe(16);
    });

    it("should handle different width and height values", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        sourceWidth: 200,
        sourceHeight: 50,
        targetWidth: 200,
        targetHeight: 50,
        morphFactor: 0.5,
      };

      const result = morphCrossSectionShapes(params);

      expect(result).toBeDefined();
      expect(result.length).toBe(8);

      // Verify that points are generated (exact values depend on morphing algorithm)
      const hasValidPoints = result.every(
        (p) => isFinite(p.y) && isFinite(p.z) && !isNaN(p.y) && !isNaN(p.z),
      );
      expect(hasValidPoints).toBe(true);
    });
  });
});
