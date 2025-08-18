import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { safeLog } from "../utils/math";

export class ExponentialProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution } = normalizedParams;

    // Calculate flare constant to match mouth radius at length L
    // For radius: r(x) = r0 * exp(m*x/2)
    // At x = L: rm = r0 * exp(m*L/2)
    // Therefore: m = (2 * ln(rm/r0)) / L
    const mAdjusted = (2 * safeLog(mouthRadius / throatRadius)) / length;

    const points: Point2D[] = [];

    // Generate points along the horn profile
    // Formula: r(x) = r0 * exp(m*x/2)
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatRadius * Math.exp((mAdjusted * x) / 2);
      points.push({ x, y });
    }

    return {
      points,
      metadata: {
        profileType: "exponential",
        parameters: normalizedParams,
        calculatedValues: {
          flareConstant: mAdjusted,
          expansionFactor: Math.exp(mAdjusted),
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
        },
      },
    };
  }
}
