import { describe, it, expect } from "vitest";
import { SphericalProfile } from "./spherical";
import { HornProfileParameters } from "../types";

describe("SphericalProfile", () => {
  const profile = new SphericalProfile();

  describe("generate", () => {
    it("should generate correct number of points", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        resolution: 20,
      };

      const result = profile.generate(params);
      expect(result.points).toHaveLength(21); // 0 to 20 inclusive
    });

    it("should start at throat radius", () => {
      const params: HornProfileParameters = {
        throatRadius: 30,
        mouthRadius: 400,
        length: 600,
      };

      const result = profile.generate(params);
      expect(result.points[0].x).toBe(0);
      expect(result.points[0].y).toBe(30);
    });

    it("should have hyperbolic expansion", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 500,
        length: 300,
        resolution: 20,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);

      // Check that the profile expands hyperbolically
      // The expansion should accelerate along the horn
      const expansionRates: number[] = [];
      for (let i = 1; i < result.points.length - 1; i++) {
        const deltaY = result.points[i].y - result.points[i - 1].y;
        const deltaX = result.points[i].x - result.points[i - 1].x;
        if (deltaX > 0) {
          expansionRates.push(deltaY / deltaX);
        }
      }

      // Check that expansion generally increases
      // Compare the average of first third vs last third
      const thirdSize = Math.floor(expansionRates.length / 3);
      if (thirdSize > 0) {
        const firstThirdAvg =
          expansionRates.slice(0, thirdSize).reduce((a, b) => a + b, 0) / thirdSize;
        const lastThirdAvg =
          expansionRates.slice(-thirdSize).reduce((a, b) => a + b, 0) / thirdSize;

        // The expansion rate should increase along the horn
        expect(lastThirdAvg).toBeGreaterThan(firstThirdAvg);
      } else {
        // If not enough points, just check that we have expansion
        expect(expansionRates[expansionRates.length - 1]).toBeGreaterThan(0);
      }
    });

    it("should calculate flare constant correctly", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 400,
        length: 500,
        cutoffFrequency: 150,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);
      const expectedFlareConstant = (4 * Math.PI * 150) / 343.2;

      expect(result.metadata.calculatedValues.flareConstant).toBeCloseTo(expectedFlareConstant, 5);
    });

    it("should include T-factor in metadata", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
      };

      const result = profile.generate(params);
      expect(result.metadata.calculatedValues.tFactor).toBe(1.0);
    });

    it("should calculate area expansion correctly", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 100,
        length: 500,
      };

      const result = profile.generate(params);
      const expectedAreaExpansion = (100 / 25) ** 2; // (rm/r0)^2

      expect(result.metadata.calculatedValues.areaExpansion).toBeCloseTo(expectedAreaExpansion, 5);
    });

    it("should have monotonically increasing x coordinates", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        resolution: 50,
      };

      const result = profile.generate(params);

      for (let i = 1; i < result.points.length; i++) {
        expect(result.points[i].x).toBeGreaterThan(result.points[i - 1].x);
      }
    });

    it("should have monotonically increasing y coordinates", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        resolution: 50,
      };

      const result = profile.generate(params);

      for (let i = 1; i < result.points.length; i++) {
        expect(result.points[i].y).toBeGreaterThanOrEqual(result.points[i - 1].y);
      }
    });

    it("should respect mouth radius constraint", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 200,
        length: 1000, // Long horn that would naturally expand beyond mouth radius
        cutoffFrequency: 50, // Low frequency for rapid expansion
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);

      // Check that no point exceeds the mouth radius
      for (const point of result.points) {
        expect(point.y).toBeLessThanOrEqual(200);
      }

      // The last point should be at or very close to the mouth radius
      const lastPoint = result.points[result.points.length - 1];
      expect(lastPoint.y).toBeCloseTo(200, 1);
    });

    it("should handle different cutoff frequencies", () => {
      const params1: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 600, // Large mouth radius to avoid clamping
        length: 500,
        cutoffFrequency: 50,
      };

      const params2: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 600, // Same large mouth radius
        length: 500,
        cutoffFrequency: 200,
      };

      const result1 = profile.generate(params1);
      const result2 = profile.generate(params2);

      // Lower cutoff frequency should have smaller flare constant
      expect(result1.metadata.calculatedValues.flareConstant).toBeLessThan(
        result2.metadata.calculatedValues.flareConstant,
      );

      // Higher cutoff frequency (larger flare constant) should expand more rapidly
      // Check expansion at early point (before clamping)
      const checkIndex = Math.floor(result1.points.length / 4); // Check at 1/4 point
      const radius1 = result1.points[checkIndex].y;
      const radius2 = result2.points[checkIndex].y;

      // Higher frequency should have more expansion at this early point
      expect(radius2).toBeGreaterThan(radius1);
    });
  });

  describe("validateParameters", () => {
    it("should accept valid parameters", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        cutoffFrequency: 150,
        speedOfSound: 343.2,
      };

      expect(() => profile.validateParameters(params)).not.toThrow();
    });

    it("should use default cutoff frequency and speed of sound", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
      };

      const result = profile.generate(params);
      expect(result.metadata.parameters.cutoffFrequency).toBeDefined();
      expect(result.metadata.parameters.speedOfSound).toBeDefined();
    });
  });
});
