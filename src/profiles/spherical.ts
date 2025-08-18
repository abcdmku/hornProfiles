import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { calculateFlareConstant, clamp } from "../utils/math";

export class SphericalProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate flare constant: m = 4π*fc/c
    const m = calculateFlareConstant(cutoffFrequency, speedOfSound);

    // Calculate wave radius
    const waveRadius = speedOfSound / (2 * Math.PI * cutoffFrequency);

    const points: Point2D[] = [];

    // For a spherical wave horn (Kugelwellenhorn), the area expansion follows:
    // S(x) = S0 * (1 + m*x)^2
    // where S is the cross-sectional area and m is the flare constant
    // This gives radius: r(x) = r0 * (1 + m*x)

    // However, we need to scale this to match our desired mouth radius at the given length
    // Calculate the natural expansion factor
    const naturalExpansion = 1 + m * length;
    const desiredExpansion = mouthRadius / throatRadius;

    // Adjust the flare constant to achieve the desired mouth radius
    const adjustedM = (desiredExpansion - 1) / length;

    // Generate points along the horn profile
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;

      // Spherical wave horn radius equation: r(x) = r0 * (1 + m*x)
      // This creates a linear expansion of radius with distance
      // which results in quadratic area expansion
      const y = throatRadius * (1 + adjustedM * x);

      // Ensure we don't exceed physical constraints
      const clampedY = clamp(y, throatRadius, mouthRadius);

      points.push({ x, y: clampedY });
    }

    return {
      points,
      metadata: {
        profileType: "spherical",
        parameters: normalizedParams,
        calculatedValues: {
          flareConstant: m,
          adjustedFlareConstant: adjustedM,
          waveRadius,
          theoreticalCutoffFrequency: cutoffFrequency,
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
          naturalExpansionFactor: naturalExpansion,
        },
      },
    };
  }
}
