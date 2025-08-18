/* eslint-disable no-console */
import {
  generateProfile,
  ConicalProfile,
  ProfileRegistry,
  getAvailableProfiles,
  HornProfile,
  HornProfileParameters,
} from "../src";

// Example 1: Using the convenience function
function example1(): void {
  console.log("Example 1: Using generateProfile convenience function");
  console.log("=" + "=".repeat(50));

  const conicalResult = generateProfile("conical", {
    throatRadius: 25, // 25mm throat (1 inch)
    mouthRadius: 300, // 300mm mouth (~12 inches)
    length: 500, // 500mm length (~20 inches)
    resolution: 50, // 50 points for demonstration
  });

  console.log(`Profile Type: ${conicalResult.metadata.profileType}`);
  console.log(`Number of points: ${conicalResult.points.length}`);
  console.log(`First point: x=${conicalResult.points[0].x}, y=${conicalResult.points[0].y}`);
  const lastPoint = conicalResult.points[conicalResult.points.length - 1];
  console.log(`Last point: x=${lastPoint.x}, y=${lastPoint.y}`);
  console.log(`Calculated values:`, conicalResult.metadata.calculatedValues);
  console.log();
}

// Example 2: Using profile class directly
function example2(): void {
  console.log("Example 2: Using profile class directly");
  console.log("=" + "=".repeat(50));

  const profile = new ConicalProfile();
  const defaults = profile.getDefaults();

  console.log("Default parameters:", defaults);

  const result = profile.generate({
    ...defaults,
    mouthRadius: 400, // Override mouth radius
    resolution: 25,
  });

  console.log(`Generated ${result.points.length} points`);
  console.log(`Flare angle: ${result.metadata.calculatedValues.flareAngle}°`);
  console.log();
}

// Example 3: Comparing different profiles
function example3(): void {
  console.log("Example 3: Comparing different profile types");
  console.log("=" + "=".repeat(50));

  const params: HornProfileParameters = {
    throatRadius: 25,
    mouthRadius: 250,
    length: 400,
    resolution: 30,
    cutoffFrequency: 150,
    speedOfSound: 343.2,
  };

  const profiles = ["conical", "exponential", "tractrix", "spherical"];

  for (const profileType of profiles) {
    const result = generateProfile(profileType, params);
    const midPoint = result.points[Math.floor(result.points.length / 2)];

    console.log(`${profileType.toUpperCase()} Profile:`);
    console.log(`  - Mid-point radius: ${midPoint.y.toFixed(2)}mm at x=${midPoint.x.toFixed(2)}mm`);

    if (result.metadata.calculatedValues.flareConstant !== undefined) {
      console.log(
        `  - Flare constant: ${result.metadata.calculatedValues.flareConstant.toFixed(4)}`,
      );
    }
    if (result.metadata.calculatedValues.flareAngle !== undefined) {
      console.log(`  - Flare angle: ${result.metadata.calculatedValues.flareAngle.toFixed(2)}°`);
    }
  }
  console.log();
}

// Example 4: Registering a custom profile
class CustomLinearProfile extends HornProfile {
  generate(params: HornProfileParameters): import("../src").ProfileGeneratorResult {
    this.validateParameters(params);

    const { throatRadius, mouthRadius, length, resolution = 100 } = params;
    const points: import("../src").Point2D[] = [];

    // Simple linear interpolation
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
        profileType: "custom-linear",
        parameters: params,
        calculatedValues: {
          slope: (mouthRadius - throatRadius) / length,
        },
      },
    };
  }

  getDefaults(): HornProfileParameters {
    return {
      throatRadius: 30,
      mouthRadius: 200,
      length: 300,
      resolution: 50,
    };
  }

  validateParameters(params: HornProfileParameters): void {
    if (params.throatRadius <= 0 || params.mouthRadius <= 0 || params.length <= 0) {
      throw new Error("All dimensions must be positive");
    }
  }
}

function example4(): void {
  console.log("Example 4: Registering and using a custom profile");
  console.log("=" + "=".repeat(50));

  // Register the custom profile
  ProfileRegistry.register("custom-linear", CustomLinearProfile);

  console.log("Available profiles:", getAvailableProfiles());

  // Use the custom profile
  const result = generateProfile("custom-linear", {
    throatRadius: 20,
    mouthRadius: 150,
    length: 250,
  });

  console.log(`Custom profile generated ${result.points.length} points`);
  console.log(`Slope: ${result.metadata.calculatedValues.slope}`);
  console.log();
}

// Example 5: Error handling
function example5(): void {
  console.log("Example 5: Error handling");
  console.log("=" + "=".repeat(50));

  try {
    // This should throw an error (throat radius > mouth radius)
    generateProfile("conical", {
      throatRadius: 300,
      mouthRadius: 25,
      length: 500,
    });
  } catch (error) {
    console.log("Caught expected error:", (error as Error).message);
  }

  try {
    // This should throw an error (unknown profile type)
    generateProfile("unknown", {
      throatRadius: 25,
      mouthRadius: 300,
      length: 500,
    });
  } catch (error) {
    console.log("Caught expected error:", (error as Error).message);
  }
  console.log();
}

// Run all examples
function main(): void {
  console.log("\n🎺 Horn Profile Generator - Usage Examples 🎺\n");

  example1();
  example2();
  example3();
  example4();
  example5();

  console.log("All examples completed successfully! ✅");
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
