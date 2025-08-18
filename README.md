# Horn Profiles

A TypeScript library for generating 2D profiles of loudspeaker horns with an extensible architecture. Generate mathematically accurate horn profiles for acoustic design and analysis.

## Features

- **Four Built-in Profile Types**:
  - **Conical**: Linear expansion horn with constant flare angle
  - **Exponential**: Exponential expansion with configurable cutoff frequency
  - **Tractrix**: Curved profile based on tractrix mathematics for minimal reflections
  - **Spherical**: Spherical wave horn (Kugelwellen) profile

- **Extensible Architecture**: Register custom profile types via the registry system
- **Full TypeScript Support**: Complete type definitions and strict type checking
- **Configurable Parameters**: Control throat/mouth radius, length, resolution, and acoustic properties
- **Mathematical Utilities**: Built-in helpers for acoustic calculations

## Installation

```bash
npm install horn-profiles
```

## Quick Start

```typescript
import { generateProfile } from 'horn-profiles';

// Generate a conical horn profile
const profile = generateProfile('conical', {
  throatRadius: 25,    // 25mm throat
  mouthRadius: 300,    // 300mm mouth
  length: 500,         // 500mm length
  resolution: 100      // 100 points
});

// Access the generated points
profile.points.forEach(point => {
  console.log(`x: ${point.x}, y: ${point.y}`);
});

// View calculated properties
console.log(profile.metadata.calculatedValues);
```

## API Reference

### Main Functions

#### `generateProfile(type: string, params: HornProfileParameters): ProfileGeneratorResult`

Generate a horn profile of the specified type.

**Parameters:**
- `type`: Profile type ('conical', 'exponential', 'tractrix', 'spherical')
- `params`: Profile parameters object

**Returns:** ProfileGeneratorResult with points and metadata

#### `getAvailableProfiles(): string[]`

Get a list of all registered profile types.

### Types

#### `HornProfileParameters`

```typescript
interface HornProfileParameters {
  throatRadius: number;      // Initial radius at throat (mm)
  mouthRadius: number;       // Final radius at mouth (mm)
  length: number;            // Total horn length (mm)
  resolution?: number;       // Number of points (default: 100)
  cutoffFrequency?: number;  // Cutoff frequency in Hz
  speedOfSound?: number;     // Speed of sound (default: 343.2 m/s)
}
```

#### `ProfileGeneratorResult`

```typescript
interface ProfileGeneratorResult {
  points: Point2D[];         // Array of {x, y} coordinates
  metadata: {
    profileType: string;
    parameters: HornProfileParameters;
    calculatedValues: Record<string, number>;
  };
}
```

## Profile Types

### Conical Profile

Linear expansion horn with constant flare angle.

**Formula:** `r(x) = r0 + x * tan(θ)`

**Calculated Values:**
- `flareAngle`: Flare angle in degrees
- `expansionRate`: Rate of radius increase
- `volumeExpansion`: Volume expansion ratio

### Exponential Profile

Exponential expansion following acoustic theory.

**Formula:** `r(x) = r0 * exp(m*x/2)`

**Calculated Values:**
- `flareConstant`: Adjusted flare constant
- `theoreticalFlareConstant`: Theoretical value based on cutoff frequency
- `actualCutoffFrequency`: Actual cutoff based on dimensions
- `expansionFactor`: Exponential growth factor

### Tractrix Profile

Curved profile minimizing internal reflections.

**Formula:** `x = r0 * ln((r0 + √(r0² - y²)) / y) - √(r0² - y²)`

**Calculated Values:**
- `tractrixRadius`: Theoretical tractrix radius
- `actualCutoffFrequency`: Cutoff frequency based on tractrix radius
- `clampedMouthRadius`: Actual mouth radius (limited by tractrix constraints)

### Spherical Profile

Spherical wave horn based on Kugelwellen theory.

**Calculated Values:**
- `flareConstant`: Expansion constant
- `waveRadius`: Spherical wave radius
- `theoreticalCutoffFrequency`: Design cutoff frequency

## Advanced Usage

### Using Profile Classes Directly

```typescript
import { ConicalProfile } from 'horn-profiles';

const profile = new ConicalProfile();
const defaults = profile.getDefaults();

const result = profile.generate({
  ...defaults,
  mouthRadius: 400  // Override specific parameters
});
```

### Creating Custom Profiles

```typescript
import { HornProfile, ProfileRegistry, HornProfileParameters, ProfileGeneratorResult } from 'horn-profiles';

class CustomProfile extends HornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    // Custom generation logic
    const points = [];
    // ... generate points
    
    return {
      points,
      metadata: {
        profileType: 'custom',
        parameters: params,
        calculatedValues: {}
      }
    };
  }
  
  getDefaults(): HornProfileParameters {
    return {
      throatRadius: 30,
      mouthRadius: 200,
      length: 300
    };
  }
  
  validateParameters(params: HornProfileParameters): void {
    // Custom validation logic
  }
}

// Register the custom profile
ProfileRegistry.register('custom', CustomProfile);

// Use it like built-in profiles
const result = generateProfile('custom', { /* params */ });
```

## Mathematical Background

This library implements horn profiles based on acoustic theory:

- **Conical horns** provide linear expansion with no phase distortion but have higher cutoff frequencies
- **Exponential horns** offer optimal acoustic loading with balanced frequency response
- **Tractrix horns** minimize internal reflections through their curved profile
- **Spherical wave horns** are designed for spherical wavefront propagation

The cutoff frequency (fc) determines the lowest frequency a horn can efficiently reproduce:
- `fc = c / (2π * r_mouth)` for simple horns
- More complex relationships for tractrix and spherical profiles

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts`: Comprehensive examples of all features
- Comparing different profile types
- Custom profile implementation
- Error handling

Run examples:
```bash
npx ts-node examples/basic-usage.ts
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build library
npm run build

# Lint code
npm run lint

# Type check
npm run typecheck
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## References

- Horn Theory Introduction (GRC Acoustics)
- Tractrix Horn Mathematics (Spherical Horns)
- Kugelwellen Horn Design (Klangfilm/Siemens)