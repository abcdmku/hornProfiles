import { describe, it, expect } from "vitest";
import { ConicalProfile } from "../../src/profiles/conical";
import { HornProfileParameters } from "../../src/types";

describe("ConicalProfile", () => {
  const profile = new ConicalProfile();

  describe("generate", () => {
    it("should generate correct number of points", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
        resolution: 10,
      };

      const result = profile.generate(params);
      expect(result.points).toHaveLength(11); // 0 to 10 inclusive
    });

    it("should start at throat radius", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
      };

      const result = profile.generate(params);
      expect(result.points[0].x).toBe(0);
      expect(result.points[0].y).toBe(25);
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

    it("should have linear progression", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 125,
        length: 100,
        resolution: 4,
      };

      const result = profile.generate(params);

      // Check that radius increases linearly
      for (let i = 0; i < result.points.length - 1; i++) {
        const deltaY = result.points[i + 1].y - result.points[i].y;
        expect(deltaY).toBeCloseTo(25, 5); // (125-25)/4 = 25
      }
    });

    it("should calculate correct flare angle", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 25 + 500, // 45 degree angle
        length: 500,
      };

      const result = profile.generate(params);
      expect(result.metadata.calculatedValues.flareAngle).toBeCloseTo(45, 5);
    });
  });

  describe("validateParameters", () => {
    it("should throw error for negative throat radius", () => {
      const params: HornProfileParameters = {
        throatRadius: -10,
        mouthRadius: 300,
        length: 500,
      };

      expect(() => profile.validateParameters(params)).toThrow();
    });

    it("should throw error when throat radius >= mouth radius", () => {
      const params: HornProfileParameters = {
        throatRadius: 300,
        mouthRadius: 200,
        length: 500,
      };

      expect(() => profile.validateParameters(params)).toThrow();
    });

    it("should throw error for zero length", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 0,
      };

      expect(() => profile.validateParameters(params)).toThrow();
    });

    it("should accept valid parameters", () => {
      const params: HornProfileParameters = {
        throatRadius: 25,
        mouthRadius: 300,
        length: 500,
      };

      expect(() => profile.validateParameters(params)).not.toThrow();
    });
  });

  describe("getDefaults", () => {
    it("should return valid default parameters", () => {
      const defaults = profile.getDefaults();

      expect(defaults.throatRadius).toBeGreaterThan(0);
      expect(defaults.mouthRadius).toBeGreaterThan(defaults.throatRadius);
      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults.resolution).toBeGreaterThan(0);
    });
  });
});
