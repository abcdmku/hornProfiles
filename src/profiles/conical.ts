import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { radiansToDegrees } from "../utils/math";

export class ConicalProfile extends BaseHornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatRadius, mouthRadius, length, resolution } = normalizedParams;

    // Calculate flare angle: θ = atan((rm - r0) / L)
    const flareAngle = Math.atan((mouthRadius - throatRadius) / length);
    const expansionRate = Math.tan(flareAngle);

    const points: Point2D[] = [];

    // Generate points along the horn profile
    // Formula: r(x) = r0 + x * tan(θ)
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatRadius + x * expansionRate;
      points.push({ x, y });
    }

    return {
      points,
      metadata: {
        profileType: "conical",
        parameters: normalizedParams,
        calculatedValues: {
          flareAngle: radiansToDegrees(flareAngle),
          expansionRate,
          volumeExpansion: (mouthRadius / throatRadius) ** 2,
        },
      },
    };
  }
}
