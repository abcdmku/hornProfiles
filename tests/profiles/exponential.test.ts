import { describe, it, expect } from "vitest";
import { ExponentialProfile } from "../../src/profiles/exponential";
import { HornProfileParameters } from "../../src/types";

describe("ExponentialProfile", () => {
  const profile = new ExponentialProfile();

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

    it("should end at mouth radius", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
      };

      const result = profile.generate(params);
      const lastPoint = result.points[result.points.length - 1];
      expect(lastPoint.x).toBe(500);
      expect(lastPoint.y).toBeCloseTo(300, 5);
    });

    it("should have exponential progression", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 200,
        length: 100,
        resolution: 5,
      };

      const result = profile.generate(params);

      // Check that the ratio between consecutive points is constant (exponential growth)
      const ratios: number[] = [];
      for (let i = 0; i < result.points.length - 1; i++) {
        if (result.points[i].y > 0) {
          ratios.push(result.points[i + 1].y / result.points[i].y);
        }
      }

      // All ratios should be approximately equal for exponential growth
      if (ratios.length > 1) {
        const avgRatio = ratios.reduce((a, b) => a + b) / ratios.length;
        ratios.forEach((ratio) => {
          expect(ratio).toBeCloseTo(avgRatio, 3);
        });
      }
    });

    it("should calculate flare constant correctly", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 100,
        length: 500,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
      };

      const result = profile.generate(params);
      expect(result.metadata.calculatedValues.flareConstant).toBeGreaterThan(0);
      expect(result.metadata.calculatedValues.theoreticalFlareConstant).toBeCloseTo(
        (4 * Math.PI * 100) / 343.2,
        5,
      );
    });

    it("should handle different cutoff frequencies", () => {
      const params1: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        cutoffFrequency: 50,
      };

      const params2: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        cutoffFrequency: 200,
      };

      const result1 = profile.generate(params1);
      const result2 = profile.generate(params2);

      expect(result1.metadata.calculatedValues.theoreticalFlareConstant).toBeLessThan(
        result2.metadata.calculatedValues.theoreticalFlareConstant,
      );
    });
  });

  describe("validateParameters", () => {
    it("should accept valid parameters with cutoff frequency", () => {
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
