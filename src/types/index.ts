export interface Point2D {
  x: number;
  y: number;
}

export interface HornProfileParameters {
  throatRadius: number; // r0 - Initial radius at throat (mm)
  mouthRadius: number; // rm - Final radius at mouth (mm)
  length: number; // L - Total horn length (mm)
  resolution?: number; // Number of points to generate (default: 100)
  cutoffFrequency?: number; // fc - Cutoff frequency in Hz
  speedOfSound?: number; // c - Speed of sound (default: 343.2 m/s)
}

export interface ProfileGeneratorResult {
  points: Point2D[];
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
