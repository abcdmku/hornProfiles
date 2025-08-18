import { describe, it, expect } from "vitest";
import { TractrixProfile } from "./tractrix";
import { HornProfileParameters } from "../types";

describe("TractrixProfile", () => {
  const profile = new TractrixProfile();

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

    it("should end at mouth radius or r0 limit", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);
      const lastPoint = result.points[result.points.length - 1];
      const r0 = (343.2 * 1000) / (2 * Math.PI * 100);
      const expectedMouthRadius = Math.min(300, r0 * 0.999);

      expect(lastPoint.x).toBe(500);
      expect(lastPoint.y).toBeCloseTo(expectedMouthRadius, 2);
    });

    it("should create a curved profile (not straight line)", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 200,
        length: 500,
        resolution: 20,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);

      // Check that the profile curves by comparing x-spacing for equal y-increments
      // In a tractrix, x-spacing should vary for equal radius increments
      const xSpacings: number[] = [];
      for (let i = 1; i < result.points.length; i++) {
        const deltaX = result.points[i].x - result.points[i - 1].x;
        xSpacings.push(deltaX);
      }

      // Check variance in x-spacings - they should not all be the same
      const avgSpacing = xSpacings.reduce((a, b) => a + b, 0) / xSpacings.length;
      const variance =
        xSpacings.reduce((sum, spacing) => {
          return sum + Math.pow(spacing - avgSpacing, 2);
        }, 0) / xSpacings.length;

      // A straight line would have variance near 0
      // A curved profile should have measurable variance
      expect(variance).toBeGreaterThan(0.1);
    });

    it("should calculate r0 correctly from cutoff frequency", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 1000, // Large value to test r0 limiting
        length: 500,
        cutoffFrequency: 50,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);
      const expectedR0 = (343.2 * 1000) / (2 * Math.PI * 50);

      expect(result.metadata.calculatedValues.tractrixMouthRadius_mm).toBeCloseTo(expectedR0, 2);
      expect(result.metadata.calculatedValues.actualMouthRadius).toBeLessThan(expectedR0);
    });

    it("should handle edge case where mouth radius exceeds r0", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 2000, // Very large mouth radius
        length: 500,
        cutoffFrequency: 200, // High frequency = small r0
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);
      const r0 = (343.2 * 1000) / (2 * Math.PI * 200);

      // Actual mouth radius should be clamped to r0 * 0.999
      expect(result.metadata.calculatedValues.actualMouthRadius).toBeCloseTo(r0 * 0.999, 2);
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
