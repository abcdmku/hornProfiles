export interface Point2D {
  x: number;
  y: number;
}

export interface HornProfileParameters {
  throatRadius: number; // r0 - Initial radius at throat (mm)
  mouthRadius: number; // rm - Final radius at mouth (mm)
  throatWidth?: number; // Initial width at throat (mm) - defaults to throatRadius * 2
  throatHeight?: number; // Initial height at throat (mm) - defaults to throatRadius * 2
  mouthWidth?: number; // Final width at mouth (mm) - defaults to mouthRadius * 2
  mouthHeight?: number; // Final height at mouth (mm) - defaults to mouthRadius * 2
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
