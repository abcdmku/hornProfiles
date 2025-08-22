import { describe, it, expect } from "vitest";
import {
  calculateEffectiveProfile,
  interpolateProfileAt,
  trimProfileAtStart,
  trimProfileAtEnd,
  calculateDimensionsAt,
} from "./profile-utils";
import type { ProfileXY, DriverMountConfig, HornMountConfig } from "@horn-sim/types";

describe("Profile Utilities", () => {
  const sampleProfile: ProfileXY = [
    { x: 0, y: 25 },
    { x: 50, y: 35 },
    { x: 100, y: 50 },
    { x: 150, y: 70 },
    { x: 200, y: 100 },
  ];

  describe("interpolateProfileAt", () => {
    it("should interpolate between two points", () => {
      const result = interpolateProfileAt(sampleProfile, 75);
      expect(result).toBeCloseTo(42.5); // Midpoint between 35 and 50
    });

    it("should return first point value when position is before profile", () => {
      const result = interpolateProfileAt(sampleProfile, -10);
      expect(result).toBe(25);
    });

    it("should return last point value when position is after profile", () => {
      const result = interpolateProfileAt(sampleProfile, 250);
      expect(result).toBe(100);
    });

    it("should handle single-point profile", () => {
      const singlePoint: ProfileXY = [{ x: 0, y: 50 }];
      const result = interpolateProfileAt(singlePoint, 10);
      expect(result).toBe(50);
    });

    it("should throw error for empty profile", () => {
      expect(() => interpolateProfileAt([], 50)).toThrow("Cannot interpolate empty profile");
    });
  });

  describe("trimProfileAtStart", () => {
    it("should trim profile at start with interpolation", () => {
      const result = trimProfileAtStart(sampleProfile, 25);
      expect(result[0].x).toBe(25);
      expect(result[0].y).toBeCloseTo(30); // Interpolated between 25 and 35
      expect(result.length).toBe(5); // One interpolated + 4 remaining points
    });

    it("should handle zero offset", () => {
      const result = trimProfileAtStart(sampleProfile, 0);
      expect(result).toEqual(sampleProfile);
    });

    it("should handle empty profile", () => {
      const result = trimProfileAtStart([], 10);
      expect(result).toEqual([]);
    });
  });

  describe("trimProfileAtEnd", () => {
    it("should trim profile at end with interpolation", () => {
      const result = trimProfileAtEnd(sampleProfile, 25);
      expect(result[result.length - 1].x).toBe(175);
      expect(result[result.length - 1].y).toBeCloseTo(85); // Interpolated between 70 and 100
      expect(result.length).toBe(5); // 4 original points + 1 interpolated
    });

    it("should handle zero offset", () => {
      const result = trimProfileAtEnd(sampleProfile, 0);
      expect(result).toEqual(sampleProfile);
    });

    it("should handle empty profile", () => {
      const result = trimProfileAtEnd([], 10);
      expect(result).toEqual([]);
    });
  });

  describe("calculateEffectiveProfile", () => {
    it("should calculate profile with driver mount offset", () => {
      const driverMount: DriverMountConfig = {
        enabled: true,
        thickness: 10,
        outerDiameter: 150,
        boltHoleDiameter: 8,
        boltCircleDiameter: 120,
        boltCount: 4,
      };

      const { profile, offsets } = calculateEffectiveProfile(sampleProfile, driverMount);

      expect(offsets.driverMountOffset).toBe(10);
      expect(profile[0].x).toBe(10);
      expect(profile[0].y).toBeCloseTo(27); // Interpolated value
    });

    it("should calculate profile with horn mount offset", () => {
      const hornMount: HornMountConfig = {
        enabled: true,
        thickness: 15,
        widthExtension: 20,
        boltSpacing: 30,
        boltHoleDiameter: 6,
      };

      const { profile, offsets } = calculateEffectiveProfile(sampleProfile, undefined, hornMount);

      expect(offsets.hornMountOffset).toBe(15);
      expect(profile[profile.length - 1].x).toBe(185);
      expect(profile[profile.length - 1].y).toBeCloseTo(91); // Interpolated value
    });

    it("should handle both driver and horn mounts", () => {
      const driverMount: DriverMountConfig = {
        enabled: true,
        thickness: 10,
        outerDiameter: 150,
        boltHoleDiameter: 8,
        boltCircleDiameter: 120,
        boltCount: 4,
      };

      const hornMount: HornMountConfig = {
        enabled: true,
        thickness: 15,
        widthExtension: 20,
        boltSpacing: 30,
        boltHoleDiameter: 6,
      };

      const { profile, offsets } = calculateEffectiveProfile(sampleProfile, driverMount, hornMount);

      expect(offsets.driverMountOffset).toBe(10);
      expect(offsets.hornMountOffset).toBe(15);
      expect(profile[0].x).toBe(10);
      expect(profile[profile.length - 1].x).toBe(185);
    });

    it("should return original profile when no mounts are enabled", () => {
      const { profile, offsets } = calculateEffectiveProfile(sampleProfile);

      expect(offsets.driverMountOffset).toBeUndefined();
      expect(offsets.hornMountOffset).toBeUndefined();
      expect(profile).toEqual(sampleProfile);
    });

    it("should ignore disabled mounts", () => {
      const driverMount: DriverMountConfig = {
        enabled: false,
        thickness: 10,
        outerDiameter: 150,
        boltHoleDiameter: 8,
        boltCircleDiameter: 120,
        boltCount: 4,
      };

      const { profile, offsets } = calculateEffectiveProfile(sampleProfile, driverMount);

      expect(offsets.driverMountOffset).toBeUndefined();
      expect(profile).toEqual(sampleProfile);
    });
  });

  describe("calculateDimensionsAt", () => {
    const widthProfile: ProfileXY = [
      { x: 0, y: 30 },
      { x: 100, y: 60 },
      { x: 200, y: 110 },
    ];

    const heightProfile: ProfileXY = [
      { x: 0, y: 20 },
      { x: 100, y: 50 },
      { x: 200, y: 90 },
    ];

    it("should calculate dimensions with width and height profiles", () => {
      const { width, height } = calculateDimensionsAt(
        sampleProfile,
        widthProfile,
        heightProfile,
        50,
      );

      expect(width).toBeCloseTo(90); // Interpolated width * 2
      expect(height).toBeCloseTo(70); // Interpolated height * 2
    });

    it("should use default dimensions when profiles are undefined", () => {
      const { width, height } = calculateDimensionsAt(
        sampleProfile,
        undefined,
        undefined,
        50,
        100,
        80,
      );

      expect(width).toBe(100);
      expect(height).toBe(80);
    });

    it("should use base radius when no defaults provided", () => {
      const { width, height } = calculateDimensionsAt(sampleProfile, undefined, undefined, 50);

      const expectedRadius = 35; // Interpolated at x=50
      expect(width).toBeCloseTo(expectedRadius * 2);
      expect(height).toBeCloseTo(expectedRadius * 2);
    });

    it("should handle mixed profile scenarios", () => {
      const { width, height } = calculateDimensionsAt(
        sampleProfile,
        widthProfile,
        undefined,
        100,
        undefined,
        120,
      );

      expect(width).toBe(120); // From width profile
      expect(height).toBe(120); // From default
    });
  });
});
