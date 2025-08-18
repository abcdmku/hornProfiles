import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";

export class TractrixProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate the characteristic dimension for tractrix
    // This is based on the cutoff frequency
    const speedOfSoundMm = speedOfSound * 1000; // Convert m/s to mm/s
    const r0 = speedOfSoundMm / (2 * Math.PI * cutoffFrequency);

    const points: Point2D[] = [];

    // For a tractrix horn, the radius follows:
    // r(x) = r_throat * cosh(x/x0) where x0 is a scaling factor
    // We need to find x0 such that r(length) = mouthRadius

    // First, calculate the expansion ratio
    const expansionRatio = mouthRadius / throatRadius;

    // Find x0 such that cosh(length/x0) = expansionRatio
    // x0 = length / acosh(expansionRatio)
    let x0: number;

    if (expansionRatio > 1) {
      // acosh is only defined for values >= 1
      const acoshValue = Math.log(expansionRatio + Math.sqrt(expansionRatio * expansionRatio - 1));
      x0 = length / acoshValue;
    } else {
      // If no expansion, use a large x0 to make it nearly straight
      x0 = length * 1000;
    }

    // Adjust x0 based on the cutoff frequency constraint
    // The tractrix should respect the r0 parameter
    const minX0 = r0 / 2; // Empirical adjustment for better matching with references
    x0 = Math.max(x0, minX0);

    // Generate points along the horn
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;

      // Calculate radius using hyperbolic cosine expansion
      const r = throatRadius * Math.cosh(x / x0);

      // Limit to mouth radius
      const y = Math.min(r, mouthRadius);

      points.push({
        x: x,
        y: y,
      });
    }

    // Ensure smooth curve by checking for monotonic increase
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[i - 1].y) {
        points[i].y = points[i - 1].y;
      }
    }

    const actualMouthRadius = points.length > 0 ? points[points.length - 1].y : mouthRadius;

    return {
      points,
      metadata: {
        profileType: "tractrix",
        parameters: normalizedParams,
        calculatedValues: {
          r0_characteristic: r0,
          x0_scale: x0,
          expansionRatio: expansionRatio,
          actualCutoffFrequency: speedOfSoundMm / (2 * Math.PI * r0),
          actualMouthRadius: actualMouthRadius,
          throatRadius: throatRadius,
          hornLength: length,
          pointCount: points.length,
        },
      },
    };
  }
}
