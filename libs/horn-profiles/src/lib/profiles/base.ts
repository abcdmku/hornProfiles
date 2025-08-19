import { HornProfile, HornProfileParameters } from "../types";

export abstract class BaseHornProfile extends HornProfile {
  protected static readonly DEFAULT_RESOLUTION = 100;
  protected static readonly DEFAULT_SPEED_OF_SOUND = 343.2; // m/s at 20°C
  protected static readonly DEFAULT_CUTOFF_FREQUENCY = 100; // Hz

  getDefaults(): HornProfileParameters {
    return {
      throatWidth: 50, // 50mm (~2 inches)
      throatHeight: 50, // 50mm (~2 inches)
      mouthWidth: 600, // 600mm (~24 inches)
      mouthHeight: 600, // 600mm (~24 inches)
      length: 500, // 500mm (~20 inches)
      resolution: BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
    };
  }

  validateParameters(params: HornProfileParameters): void {
    const errors: string[] = [];

    if (params.throatWidth <= 0) {
      errors.push("Throat width must be positive");
    }

    if (params.throatHeight <= 0) {
      errors.push("Throat height must be positive");
    }

    if (params.mouthWidth <= 0) {
      errors.push("Mouth width must be positive");
    }

    if (params.mouthHeight <= 0) {
      errors.push("Mouth height must be positive");
    }

    if (params.throatWidth >= params.mouthWidth && params.throatHeight >= params.mouthHeight) {
      errors.push("Throat dimensions must be smaller than mouth dimensions");
    }

    if (params.length <= 0) {
      errors.push("Length must be positive");
    }

    if (params.resolution !== undefined && params.resolution <= 0) {
      errors.push("Resolution must be positive");
    }

    if (params.resolution !== undefined && !Number.isInteger(params.resolution)) {
      errors.push("Resolution must be an integer");
    }

    if (params.cutoffFrequency !== undefined && params.cutoffFrequency <= 0) {
      errors.push("Cutoff frequency must be positive");
    }

    if (params.speedOfSound !== undefined && params.speedOfSound <= 0) {
      errors.push("Speed of sound must be positive");
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join("\n")}`);
    }
  }

  protected normalizeParameters(params: HornProfileParameters): Required<HornProfileParameters> {
    return {
      throatWidth: params.throatWidth,
      throatHeight: params.throatHeight,
      mouthWidth: params.mouthWidth,
      mouthHeight: params.mouthHeight,
      length: params.length,
      resolution: params.resolution ?? BaseHornProfile.DEFAULT_RESOLUTION,
      cutoffFrequency: params.cutoffFrequency ?? BaseHornProfile.DEFAULT_CUTOFF_FREQUENCY,
      speedOfSound: params.speedOfSound ?? BaseHornProfile.DEFAULT_SPEED_OF_SOUND,
    };
  }
}
