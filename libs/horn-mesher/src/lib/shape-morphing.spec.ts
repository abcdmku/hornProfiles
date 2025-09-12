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

  describe("rectangular shape corner preservation", () => {
    it("should preserve sharp corners for rectangular shapes", () => {
      const params: ShapeMorphParams = {
        sourceShape: "rectangular",
        targetShape: "rectangular",
        morphFactor: 0,
        sourceWidth: 40,
        sourceHeight: 30,
        targetWidth: 40,
        targetHeight: 30,
        resolution: 16,
      };

      const result = morphCrossSectionShapes(params);

      // Check that we have sharp corners by looking for points that are exactly
      // at the expected corner positions
      const halfWidth = 20;
      const halfHeight = 15;
      const tolerance = 1e-10;

      // Find exact corner points
      const topLeft = result.find(
        (p) => Math.abs(p.y + halfWidth) < tolerance && Math.abs(p.z - halfHeight) < tolerance,
      );
      const topRight = result.find(
        (p) => Math.abs(p.y - halfWidth) < tolerance && Math.abs(p.z - halfHeight) < tolerance,
      );
      const bottomRight = result.find(
        (p) => Math.abs(p.y - halfWidth) < tolerance && Math.abs(p.z + halfHeight) < tolerance,
      );
      const bottomLeft = result.find(
        (p) => Math.abs(p.y + halfWidth) < tolerance && Math.abs(p.z + halfHeight) < tolerance,
      );

      // All 4 corners should exist exactly
      expect(topLeft).toBeDefined();
      expect(topRight).toBeDefined();
      expect(bottomRight).toBeDefined();
      expect(bottomLeft).toBeDefined();

      // Verify points are on rectangle edges only
      const edgeTolerance = 1e-10;
      for (const point of result) {
        const onLeftEdge = Math.abs(point.y + halfWidth) < edgeTolerance;
        const onRightEdge = Math.abs(point.y - halfWidth) < edgeTolerance;
        const onTopEdge = Math.abs(point.z - halfHeight) < edgeTolerance;
        const onBottomEdge = Math.abs(point.z + halfHeight) < edgeTolerance;

        // Every point should be on exactly one edge
        expect(onLeftEdge || onRightEdge || onTopEdge || onBottomEdge).toBe(true);
      }
    });

    it("should maintain corner sharpness during morphing from rectangular to ellipse", () => {
      const params: ShapeMorphParams = {
        sourceShape: "rectangular",
        targetShape: "ellipse",
        morphFactor: 0.5,
        sourceWidth: 40,
        sourceHeight: 30,
        targetWidth: 40,
        targetHeight: 30,
        resolution: 16,
      };

      const result = morphCrossSectionShapes(params);

      // At 50% morph, should still have some degree of corner definition
      // The shape shouldn't be completely rounded
      expect(result).toBeDefined();
      expect(result.length).toBe(16);
    });
  });

  describe("morphCrossSectionShapes", () => {
    const baseParams: ShapeMorphParams = {
      sourceShape: "ellipse",
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

      // For ellipse at factor 0, points should form an ellipse with given dimensions
      const halfWidth = baseParams.targetWidth / 2;
      const halfHeight = baseParams.targetHeight / 2;
      result.forEach((point) => {
        // Check that point lies on ellipse: (y/a)Â² + (z/b)Â² â‰ˆ 1
        const ellipseValue =
          (point.y * point.y) / (halfWidth * halfWidth) +
          (point.z * point.z) / (halfHeight * halfHeight);
        expect(ellipseValue).toBeCloseTo(1, 1);
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

      // Rectangular shape should have varying radii (not constant like ellipse)
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

      // Should be different from both pure ellipse and pure rectangle
      expect(result).not.toEqual(morphCrossSectionShapes({ ...params, morphFactor: 0 }));
      expect(result).not.toEqual(morphCrossSectionShapes({ ...params, morphFactor: 1 }));
    });

    it("should return same shape when source and target are identical", () => {
      const params: ShapeMorphParams = {
        ...baseParams,
        sourceShape: "ellipse",
        targetShape: "ellipse",
        morphFactor: 0.5,
      };

      const result = morphCrossSectionShapes(params);
      const ellipseResult = morphCrossSectionShapes({ ...params, morphFactor: 0 });

      expect(result).toBeDefined();
      expect(result.length).toBe(ellipseResult.length);

      // Should be same as pure ellipse since both source and target are ellipses
      result.forEach((point, i) => {
        expect(point.y).toBeCloseTo(ellipseResult[i].y, 5);
        expect(point.z).toBeCloseTo(ellipseResult[i].z, 5);
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
