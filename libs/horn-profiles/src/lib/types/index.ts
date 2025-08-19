export interface Point2D {
  x: number;
  y: number;
}

export interface HornProfileParameters {
  throatWidth: number; // Initial width at throat (mm)
  throatHeight: number; // Initial height at throat (mm)
  mouthWidth: number; // Final width at mouth (mm)
  mouthHeight: number; // Final height at mouth (mm)
  length: number; // L - Total horn length (mm)
  resolution?: number; // Number of points to generate (default: 100)
  cutoffFrequency?: number; // fc - Cutoff frequency in Hz
  speedOfSound?: number; // c - Speed of sound (default: 343.2 m/s)
}

export interface ProfileGeneratorResult {
  points: Point2D[]; // Primary profile (radius or width)
  widthProfile?: Point2D[]; // Separate width profile for non-circular horns
  heightProfile?: Point2D[]; // Separate height profile for non-circular horns
  metadata: {
    profileType: string;
    parameters: HornProfileParameters;
    calculatedValues: Record<string, number>;
  };
}

export abstract class HornProfile {
  abstract generate(params: HornProfileParameters): ProfileGeneratorResult;
  abstract getDefaults(): HornProfileParameters;
  abstract validateParameters(params: HornProfileParameters): void;
}
