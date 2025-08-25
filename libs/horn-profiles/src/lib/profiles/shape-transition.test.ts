import { describe, it, expect } from "vitest";
import { ConicalProfile } from "./conical";
import type { HornProfileParameters, CrossSectionMode } from "../types";

describe("Shape Transition Profile Generation", () => {
  const profile = new ConicalProfile();

  describe("ConicalProfile with shape transitions", () => {
    it("should generate shape profile when throat and mouth shapes differ", () => {
      const params: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 400,
        mouthHeight: 300,
        length: 500,
        resolution: 10,
        throatShape: "ellipse",
        mouthShape: "rectangular",
        transitionLength: 300,
        morphingFunction: "linear",
      };

      const result = profile.generate(params);

      expect(result.shapeProfile).toBeDefined();
      expect(result.shapeProfile).toHaveLength(11); // resolution + 1

      if (result.shapeProfile) {
        const firstPoint = result.shapeProfile[0];
        const lastPoint = result.shapeProfile[result.shapeProfile.length - 1];

        // First point should be pure throat shape (morphingFactor = 0)
        expect(firstPoint.shape).toBe("ellipse");
        expect(firstPoint.morphingFactor).toBe(0);
        expect(firstPoint.x).toBe(0);

        // Last point should be pure mouth shape (morphingFactor = 1)
        expect(lastPoint.shape).toBe("rectangular");
        expect(lastPoint.morphingFactor).toBe(1);
        expect(lastPoint.x).toBe(500);
      }
    });

    it("should generate transition metadata correctly", () => {
      const params: HornProfileParameters = {
        throatWidth: 60,
        throatHeight: 60,
        mouthWidth: 300,
        mouthHeight: 200,
        length: 400,
        throatShape: "ellipse",
        mouthShape: "superellipse",
        transitionLength: 200,
        morphingFunction: "cubic",
      };

      const result = profile.generate(params);

      expect(result.metadata.transitionMetadata).toBeDefined();
      if (result.metadata.transitionMetadata) {
        const transition = result.metadata.transitionMetadata;

        expect(transition.hasTransition).toBe(true);
        expect(transition.transitionStart).toBe(0);
        expect(transition.transitionEnd).toBe(200);
        expect(transition.morphingFunction).toBe("cubic");
      }
    });

    it("should handle identical throat and mouth shapes", () => {
      const params: HornProfileParameters = {
        throatWidth: 40,
        throatHeight: 40,
        mouthWidth: 200,
        mouthHeight: 200,
        length: 300,
        throatShape: "ellipse",
        mouthShape: "ellipse",
        morphingFunction: "linear",
      };

      const result = profile.generate(params);

      expect(result.shapeProfile).toBeDefined();

      if (result.shapeProfile) {
        // All points should have morphingFactor = 0 (no morphing needed)
        result.shapeProfile.forEach((point) => {
          expect(point.morphingFactor).toBe(0);
          expect(point.shape).toBe("ellipse");
        });
      }

      if (result.metadata.transitionMetadata) {
        expect(result.metadata.transitionMetadata.hasTransition).toBe(false);
      }
    });

    it("should handle partial transition length", () => {
      const params: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 300,
        mouthHeight: 300,
        length: 600,
        resolution: 12,
        throatShape: "rectangular",
        mouthShape: "ellipse",
        transitionLength: 200, // Only first 200mm should morph
        morphingFunction: "linear",
      };

      const result = profile.generate(params);

      expect(result.shapeProfile).toBeDefined();

      if (result.shapeProfile) {
        // Find points in different regions
        const throatPoints = result.shapeProfile.filter((p) => p.x <= 0);
        const transitionPoints = result.shapeProfile.filter((p) => p.x > 0 && p.x < 200);
        const mouthPoints = result.shapeProfile.filter((p) => p.x >= 200);

        // Throat region should be pure throat shape
        throatPoints.forEach((point) => {
          expect(point.morphingFactor).toBe(0);
          expect(point.shape).toBe("rectangular");
        });

        // Mouth region (after transition) should be pure mouth shape
        mouthPoints.forEach((point) => {
          expect(point.morphingFactor).toBe(1);
          expect(point.shape).toBe("ellipse");
        });

        // Transition region should have intermediate values
        if (transitionPoints.length > 0) {
          transitionPoints.forEach((point) => {
            expect(point.morphingFactor).toBeGreaterThan(0);
            expect(point.morphingFactor).toBeLessThan(1);
            expect(point.shape).toBe("morphed");
          });
        }
      }
    });

    it("should calculate dimensions correctly along profile", () => {
      const params: HornProfileParameters = {
        throatWidth: 60,
        throatHeight: 40,
        mouthWidth: 360,
        mouthHeight: 240,
        length: 300,
        resolution: 6,
        throatShape: "ellipse",
        mouthShape: "rectangular",
      };

      const result = profile.generate(params);

      expect(result.shapeProfile).toBeDefined();

      if (result.shapeProfile) {
        const firstPoint = result.shapeProfile[0];
        const lastPoint = result.shapeProfile[result.shapeProfile.length - 1];

        // First point should have throat dimensions
        expect(firstPoint.width).toBeCloseTo(60, 1);
        expect(firstPoint.height).toBeCloseTo(40, 1);

        // Last point should have mouth dimensions
        expect(lastPoint.width).toBeCloseTo(360, 1);
        expect(lastPoint.height).toBeCloseTo(240, 1);

        // Dimensions should increase monotonically for conical profile
        for (let i = 0; i < result.shapeProfile.length - 1; i++) {
          const current = result.shapeProfile[i];
          const next = result.shapeProfile[i + 1];

          expect(next.width).toBeGreaterThanOrEqual(current.width);
          expect(next.height).toBeGreaterThanOrEqual(current.height);
        }
      }
    });

    it("should validate shape transition parameters", () => {
      // Invalid transition length (greater than horn length)
      const invalidParams: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 200,
        mouthHeight: 200,
        length: 300,
        throatShape: "ellipse",
        mouthShape: "rectangular",
        transitionLength: 400, // > length
      };

      expect(() => profile.generate(invalidParams)).toThrow(/transition length cannot exceed/i);
    });

    it("should validate shape compatibility", () => {
      const invalidParams: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 200,
        mouthHeight: 200,
        length: 300,
        throatShape: "ellipse",
        mouthShape: "stereographic" as CrossSectionMode, // Unsupported shape for transitions
      };

      expect(() => profile.generate(invalidParams)).toThrow(/unsupported shape transition/i);
    });

    it("should use default values for optional shape parameters", () => {
      const params: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 200,
        mouthHeight: 200,
        length: 300,
        // No shape parameters provided - should use defaults
      };

      const result = profile.generate(params);

      expect(result.shapeProfile).toBeDefined();

      if (result.metadata.transitionMetadata) {
        expect(result.metadata.transitionMetadata.hasTransition).toBe(false);
      }

      if (result.shapeProfile) {
        // All points should be default circle shape
        result.shapeProfile.forEach((point) => {
          expect(point.shape).toBe("ellipse");
          expect(point.morphingFactor).toBe(0);
        });
      }
    });

    it("should handle different morphing functions", () => {
      const baseParams: HornProfileParameters = {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 200,
        mouthHeight: 200,
        length: 400,
        resolution: 8,
        throatShape: "ellipse",
        mouthShape: "rectangular",
        transitionLength: 400,
      };

      const linearResult = profile.generate({
        ...baseParams,
        morphingFunction: "linear",
      });

      const cubicResult = profile.generate({
        ...baseParams,
        morphingFunction: "cubic",
      });

      const sigmoidResult = profile.generate({
        ...baseParams,
        morphingFunction: "sigmoid",
      });

      // All should have same length
      if (linearResult.shapeProfile && cubicResult.shapeProfile && sigmoidResult.shapeProfile) {
        expect(linearResult.shapeProfile.length).toBe(cubicResult.shapeProfile.length);
        expect(cubicResult.shapeProfile.length).toBe(sigmoidResult.shapeProfile.length);

        // Check that different functions produce different intermediate values
        const midIndex = Math.floor(linearResult.shapeProfile.length / 2);

        const linearMidFactor = linearResult.shapeProfile[midIndex].morphingFactor;
        const cubicMidFactor = cubicResult.shapeProfile[midIndex].morphingFactor;
        const sigmoidMidFactor = sigmoidResult.shapeProfile[midIndex].morphingFactor;

        // They should be different (not all exactly 0.5)
        expect(linearMidFactor).toBeCloseTo(0.5, 2);
        expect(cubicMidFactor).toBeCloseTo(0.5, 1); // Cubic is also ~0.5 at midpoint
        expect(sigmoidMidFactor).toBeCloseTo(0.5, 1); // Sigmoid is also ~0.5 at midpoint
      }
    });
  });
});
