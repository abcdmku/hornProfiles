import { HornProfileParameters, Point2D, ProfileGeneratorResult } from "../types";
import { BaseHornProfile } from "./base";
import { safeLog } from "../utils/math";

export class ExponentialProfile extends BaseHornProfile {
  protected calculateDimensionsAt(
    x: number,
    params: Required<HornProfileParameters>,
  ): { width: number; height: number } {
    const { throatWidth, throatHeight, mouthWidth, mouthHeight, length } = params;

    // Exponential expansion
    const widthFlareConstant = (2 * safeLog(mouthWidth / throatWidth)) / length;
    const heightFlareConstant = (2 * safeLog(mouthHeight / throatHeight)) / length;

    const width = throatWidth * Math.exp((widthFlareConstant * x) / 2);
    const height = throatHeight * Math.exp((heightFlareConstant * x) / 2);

    return { width, height };
  }

  generate(params: HornProfileParameters): ProfileGeneratorResult {
    this.validateParameters(params);
    const normalizedParams = this.normalizeParameters(params);

    const { throatWidth, throatHeight, mouthWidth, mouthHeight, length, resolution } =
      normalizedParams;

    // Generate width profile with exponential expansion
    const widthProfile: Point2D[] = [];
    const widthFlareConstant = (2 * safeLog(mouthWidth / throatWidth)) / length;

    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = (throatWidth / 2) * Math.exp((widthFlareConstant * x) / 2);
      widthProfile.push({ x, y });
    }

    // Generate height profile with exponential expansion
    const heightProfile: Point2D[] = [];
    const heightFlareConstant = (2 * safeLog(mouthHeight / throatHeight)) / length;

    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = (throatHeight / 2) * Math.exp((heightFlareConstant * x) / 2);
      heightProfile.push({ x, y });
    }

    // Use the average for the primary profile (for compatibility)
    const points: Point2D[] = [];
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const avgRadius = (widthProfile[i].y + heightProfile[i].y) / 2;
      points.push({ x, y: avgRadius });
    }

    // Generate shape profile for transitions
    const shapeProfile = this.generateShapeProfile(normalizedParams);
    const transitionMetadata = this.generateTransitionMetadata(normalizedParams);

    // Calculate additional values for backward compatibility
    const { cutoffFrequency, speedOfSound } = normalizedParams;
    const flareConstant = (widthFlareConstant + heightFlareConstant) / 2;
    const theoreticalFlareConstant = (4 * Math.PI * cutoffFrequency) / speedOfSound;

    return {
      points,
      widthProfile,
      heightProfile,
      shapeProfile,
      metadata: {
        profileType: "exponential",
        parameters: normalizedParams,
        calculatedValues: {
          flareConstant,
          theoreticalFlareConstant,
          widthFlareConstant,
          heightFlareConstant,
          throatArea: (throatWidth * throatHeight) / 4,
          mouthArea: (mouthWidth * mouthHeight) / 4,
          areaExpansion: (mouthWidth * mouthHeight) / (throatWidth * throatHeight),
        },
        transitionMetadata,
      },
    };
  }
}
