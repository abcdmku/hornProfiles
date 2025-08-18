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

    // Generate points along the horn profile
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;

      // For spherical wave horns, the profile can expand rapidly
      // We apply a more sophisticated spherical cap calculation
      // The radius at distance x is derived from the spherical wave propagation

      // Calculate the effective radius considering spherical wavefront
      // This is simplified from the full Kugelwellen equations
      let y: number;

      if (x === 0) {
        y = throatRadius;
      } else {
        // Spherical expansion with exponential area growth
        const expansionFactor = Math.exp(m * x);

        // The radius grows following spherical wave propagation
        // Combined with exponential expansion for acoustic loading
        y = throatRadius * Math.sqrt(expansionFactor);

        // Apply physical constraints
        y = clamp(y, throatRadius, mouthRadius);
      }

      points.push({ x, y });
    }

    // Ensure we reach the mouth radius at the end
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      if (Math.abs(lastPoint.y - mouthRadius) > 0.01) {
        // Smooth transition to mouth radius
        const smoothingPoints = 10;
        const startIndex = Math.max(0, points.length - smoothingPoints - 1);

        for (let i = startIndex; i < points.length; i++) {
          const t = (i - startIndex) / (points.length - startIndex - 1);
          const smoothY = lastPoint.y + (mouthRadius - lastPoint.y) * t;
          points[i].y = smoothY;
        }
      }
    }

    return {
      points,
      metadata: {
        profileType: "spherical",
        parameters: normalizedParams,
        calculatedValues: {
          flareConstant: m,
          waveRadius,
          theoreticalCutoffFrequency: cutoffFrequency,
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
        },
      },
    };
  }
}
