import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { safeSqrt, safeLog } from "../utils/math";

export class TractrixProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution, cutoffFrequency, speedOfSound } =
      normalizedParams;

    // Calculate tractrix radius based on cutoff frequency
    // r0 = c / (2π*fc)
    const r0 = speedOfSound / (2 * Math.PI * cutoffFrequency);

    // Tractrix is limited to radius < r0
    // However, we need to ensure throat radius is also within limits
    const theoreticalMax = r0 * 0.99;

    if (throatRadius >= theoreticalMax) {
      // If throat is already at or above limit, generate a linear approximation
      const points: Point2D[] = [];
      for (let i = 0; i <= resolution; i++) {
        const t = i / resolution;
        points.push({
          x: length * t,
          y: throatRadius + (mouthRadius - throatRadius) * t,
        });
      }
      return {
        points,
        metadata: {
          profileType: "tractrix",
          parameters: normalizedParams,
          calculatedValues: {
            tractrixRadius: r0,
            actualCutoffFrequency: speedOfSound / (2 * Math.PI * r0),
            theoreticalMaxRadius: r0,
            clampedMouthRadius: mouthRadius,
            scaleFactor: 1,
            linearApproximation: 1, // 1 indicates linear approximation was used
          },
        },
      };
    }

    const yMin = throatRadius;
    const yMax = Math.min(mouthRadius, theoreticalMax);

    if (mouthRadius > theoreticalMax) {
      // eslint-disable-next-line no-console
      console.warn(
        `Tractrix profile: Mouth radius ${mouthRadius}mm exceeds theoretical limit ${theoreticalMax.toFixed(2)}mm. ` +
          `Clamping to ${yMax.toFixed(2)}mm.`,
      );
    }

    const points: Point2D[] = [];

    // Generate points along the horn profile
    // Tractrix equation: x = r0 * ln((r0 + √(r0² - y²)) / y) - √(r0² - y²)
    let maxX = 0;
    const tempPoints: Point2D[] = [];

    for (let i = 0; i <= resolution; i++) {
      const y = yMin + ((yMax - yMin) * i) / resolution;

      if (y < r0 && y > 0) {
        const sqrtTerm = safeSqrt(r0 * r0 - y * y);
        const x = r0 * safeLog((r0 + sqrtTerm) / y) - sqrtTerm;

        tempPoints.push({ x, y });
        maxX = Math.max(maxX, x);
      }
    }

    // Scale x coordinates to fit desired length
    const scaleFactor = maxX > 0 ? length / maxX : 1;

    for (const point of tempPoints) {
      points.push({
        x: point.x * scaleFactor,
        y: point.y,
      });
    }

    // If we don't have enough points, add a linear interpolation to reach the mouth
    if (points.length > 0 && yMax < mouthRadius) {
      points.push({
        x: length,
        y: mouthRadius,
      });
    }

    return {
      points,
      metadata: {
        profileType: "tractrix",
        parameters: normalizedParams,
        calculatedValues: {
          tractrixRadius: r0,
          actualCutoffFrequency: speedOfSound / (2 * Math.PI * r0),
          theoreticalMaxRadius: r0,
          clampedMouthRadius: yMax,
          scaleFactor,
        },
      },
    };
  }
}
