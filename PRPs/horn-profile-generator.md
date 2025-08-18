# PRP: 2D Horn Profile Generator Library

## Project Overview
Create a TypeScript library for generating 2D profiles of loudspeaker horns with an extensible architecture. The library will provide standard horn profiles (conical, exponential, tractrix, spherical) with each profile contained in its own module that exports a generator function, default values, and user-modifiable parameters.

## Core Requirements
- TypeScript with strict typing
- Each profile in its own file/module
- Returns x,y coordinate arrays for plotting
- Configurable parameters with defaults
- Extensible architecture for adding new profiles
- Follow monorepo best practices from claude.md

## Research References

### Mathematical Documentation
- Horn Theory Introduction: https://www.grc.com/acoustics/an-introduction-to-horn-theory.pdf
- Tractrix Calculator: https://sphericalhorns.net/2019/08/30/a-true-expansion-tractrix-horn/
- Spherical Wave Horns: https://sphericalhorns.net/tag/spherical-wave-horn/
- Horn Physics: http://www.quarter-wave.com/Horns/Horn_Physics.pdf

### TypeScript Architecture Patterns
- Plugin Architecture: https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions
- Factory Pattern: https://refactoring.guru/design-patterns/factory-method/typescript/example

## Implementation Blueprint

### Directory Structure
```
hornProfiles/
├── src/
│   ├── index.ts                 # Main library export
│   ├── types/
│   │   └── index.ts             # Core interfaces and types
│   ├── profiles/
│   │   ├── base.ts              # Abstract base profile class
│   │   ├── conical.ts           # Conical horn profile
│   │   ├── exponential.ts       # Exponential horn profile
│   │   ├── tractrix.ts          # Tractrix horn profile
│   │   └── spherical.ts         # Spherical wave horn profile
│   ├── utils/
│   │   ├── math.ts              # Mathematical utilities
│   │   └── validation.ts        # Parameter validation
│   └── registry/
│       └── index.ts              # Profile registry for extensibility
├── tests/
│   ├── profiles/
│   │   ├── conical.test.ts
│   │   ├── exponential.test.ts
│   │   ├── tractrix.test.ts
│   │   └── spherical.test.ts
│   └── utils/
│       └── math.test.ts
├── examples/
│   └── basic-usage.ts
├── package.json
├── tsconfig.json
├── .eslintrc.json
└── README.md
```

### Core Types and Interfaces

```typescript
// types/index.ts
export interface Point2D {
  x: number;
  y: number;
}

export interface HornProfileParameters {
  throatRadius: number;      // r0 - Initial radius at throat
  mouthRadius: number;       // rm - Final radius at mouth
  length: number;            // L - Total horn length
  resolution?: number;       // Number of points to generate (default: 100)
  cutoffFrequency?: number;  // fc - Cutoff frequency in Hz
  speedOfSound?: number;     // c - Speed of sound (default: 343.2 m/s)
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
```

### Mathematical Implementations

#### Conical Profile (conical.ts)
```typescript
// Formula: r(x) = r0 + x * tan(θ)
// where θ = atan((rm - r0) / L)

export class ConicalProfile extends HornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    const { throatRadius, mouthRadius, length, resolution = 100 } = params;
    const flareAngle = Math.atan((mouthRadius - throatRadius) / length);
    
    const points: Point2D[] = [];
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatRadius + x * Math.tan(flareAngle);
      points.push({ x, y });
    }
    
    return {
      points,
      metadata: {
        profileType: 'conical',
        parameters: params,
        calculatedValues: {
          flareAngle: flareAngle * (180 / Math.PI),
          expansionRate: Math.tan(flareAngle)
        }
      }
    };
  }
}
```

#### Exponential Profile (exponential.ts)
```typescript
// Formula: S(x) = S0 * exp(m*x)
// For radius: r(x) = r0 * exp(m*x/2)
// where m = 4π*fc/c

export class ExponentialProfile extends HornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    const { 
      throatRadius, 
      mouthRadius, 
      length, 
      resolution = 100,
      cutoffFrequency = 100,
      speedOfSound = 343.2
    } = params;
    
    // Calculate flare constant
    const m = (4 * Math.PI * cutoffFrequency) / speedOfSound;
    
    // Adjust m to match mouth radius at length L
    const mAdjusted = (2 * Math.log(mouthRadius / throatRadius)) / length;
    
    const points: Point2D[] = [];
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const y = throatRadius * Math.exp(mAdjusted * x / 2);
      points.push({ x, y });
    }
    
    return {
      points,
      metadata: {
        profileType: 'exponential',
        parameters: params,
        calculatedValues: {
          flareConstant: mAdjusted,
          theoreticalFlareConstant: m,
          expansionFactor: Math.exp(mAdjusted)
        }
      }
    };
  }
}
```

#### Tractrix Profile (tractrix.ts)
```typescript
// Tractrix equation: x = r0 * ln((r0 + √(r0² - y²)) / y) - √(r0² - y²)
// Implementation uses iterative approach for x,y generation

export class TractrixProfile extends HornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    const { 
      throatRadius, 
      mouthRadius, 
      length, 
      resolution = 100,
      cutoffFrequency = 100,
      speedOfSound = 343.2
    } = params;
    
    // Calculate r0 based on cutoff frequency
    const r0 = speedOfSound / (2 * Math.PI * cutoffFrequency);
    
    const points: Point2D[] = [];
    const yMin = throatRadius;
    const yMax = Math.min(mouthRadius, r0 * 0.99); // Tractrix limited to < r0
    
    for (let i = 0; i <= resolution; i++) {
      const y = yMin + ((yMax - yMin) * i) / resolution;
      
      if (y < r0) {
        const x = r0 * Math.log((r0 + Math.sqrt(r0 * r0 - y * y)) / y) 
                  - Math.sqrt(r0 * r0 - y * y);
        
        // Scale x to fit desired length
        const scaledX = (x / (r0 * Math.log(r0 / yMin))) * length;
        points.push({ x: scaledX, y });
      }
    }
    
    return {
      points,
      metadata: {
        profileType: 'tractrix',
        parameters: params,
        calculatedValues: {
          tractrixRadius: r0,
          actualCutoffFrequency: speedOfSound / (2 * Math.PI * r0)
        }
      }
    };
  }
}
```

#### Spherical Wave Profile (spherical.ts)
```typescript
// Spherical wave (Kugelwellen) horn
// h = h0 * exp(m*x), where m = 4π*fc/c
// Profile calculated assuming spherical wavefronts

export class SphericalProfile extends HornProfile {
  generate(params: HornProfileParameters): ProfileGeneratorResult {
    const { 
      throatRadius, 
      mouthRadius, 
      length, 
      resolution = 100,
      cutoffFrequency = 100,
      speedOfSound = 343.2
    } = params;
    
    const m = (4 * Math.PI * cutoffFrequency) / speedOfSound;
    const h0 = throatRadius;
    
    const points: Point2D[] = [];
    
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      const h = h0 * Math.exp(m * x);
      
      // Convert height to radius for spherical cap
      // This is simplified; full implementation would use spherical cap geometry
      const y = Math.min(h, mouthRadius);
      
      points.push({ x, y });
    }
    
    return {
      points,
      metadata: {
        profileType: 'spherical',
        parameters: params,
        calculatedValues: {
          flareConstant: m,
          waveRadius: speedOfSound / (2 * Math.PI * cutoffFrequency)
        }
      }
    };
  }
}
```

### Registry Pattern for Extensibility

```typescript
// registry/index.ts
export class ProfileRegistry {
  private static profiles = new Map<string, typeof HornProfile>();
  
  static register(name: string, profileClass: typeof HornProfile): void {
    this.profiles.set(name.toLowerCase(), profileClass);
  }
  
  static get(name: string): typeof HornProfile | undefined {
    return this.profiles.get(name.toLowerCase());
  }
  
  static list(): string[] {
    return Array.from(this.profiles.keys());
  }
}

// Auto-register built-in profiles
ProfileRegistry.register('conical', ConicalProfile);
ProfileRegistry.register('exponential', ExponentialProfile);
ProfileRegistry.register('tractrix', TractrixProfile);
ProfileRegistry.register('spherical', SphericalProfile);
```

### Main Library Export

```typescript
// index.ts
export * from './types';
export * from './profiles/conical';
export * from './profiles/exponential';
export * from './profiles/tractrix';
export * from './profiles/spherical';
export * from './registry';

export function generateProfile(
  type: string, 
  params: HornProfileParameters
): ProfileGeneratorResult {
  const ProfileClass = ProfileRegistry.get(type);
  if (!ProfileClass) {
    throw new Error(`Unknown profile type: ${type}`);
  }
  
  const profile = new ProfileClass();
  profile.validateParameters(params);
  return profile.generate(params);
}
```

### Package.json Configuration

```json
{
  "name": "horn-profiles",
  "version": "1.0.0",
  "description": "2D profile generator for loudspeaker horns",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  },
  "keywords": ["horn", "loudspeaker", "acoustic", "profile", "generator"],
  "license": "MIT"
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Implementation Tasks

1. **Project Setup**
   - Initialize npm project with TypeScript
   - Configure ESLint and Prettier
   - Set up vitest for testing
   - Create directory structure

2. **Core Types Implementation**
   - Define interfaces in types/index.ts
   - Create abstract HornProfile base class
   - Implement validation utilities

3. **Profile Implementations**
   - Implement ConicalProfile class
   - Implement ExponentialProfile class
   - Implement TractrixProfile class
   - Implement SphericalProfile class

4. **Registry System**
   - Create ProfileRegistry class
   - Auto-register built-in profiles
   - Add registration validation

5. **Utility Functions**
   - Math utilities for common calculations
   - Parameter validation helpers
   - Coordinate transformation utilities

6. **Testing**
   - Unit tests for each profile
   - Validation tests
   - Integration tests for registry
   - Edge case testing

7. **Documentation**
   - API documentation
   - Usage examples
   - Profile comparison guide

## Validation Gates

```bash
# TypeScript compilation
npx tsc --noEmit

# Linting
npx eslint . --ext .ts

# Unit tests
npx vitest run

# Format check
npx prettier --check "src/**/*.ts"

# Build verification
npm run build
```

## Error Handling Strategy

1. **Parameter Validation**
   - Check for negative values where inappropriate
   - Verify throat radius < mouth radius
   - Ensure length > 0
   - Validate resolution is positive integer

2. **Mathematical Edge Cases**
   - Handle division by zero
   - Check for domain errors in logarithms/square roots
   - Clamp values to physical limits

3. **User Feedback**
   - Clear error messages with parameter names
   - Suggest valid ranges when validation fails
   - Include profile type in error context

## Example Usage

```typescript
import { generateProfile, ProfileRegistry, ConicalProfile } from 'horn-profiles';

// Using the convenience function
const conicalResult = generateProfile('conical', {
  throatRadius: 25,      // 25mm throat
  mouthRadius: 300,      // 300mm mouth
  length: 500,           // 500mm length
  resolution: 200        // 200 points
});

// Using class directly
const profile = new ConicalProfile();
const defaults = profile.getDefaults();
const result = profile.generate({
  ...defaults,
  mouthRadius: 400
});

// Registering custom profile
class CustomProfile extends HornProfile {
  generate(params) { /* ... */ }
  getDefaults() { /* ... */ }
  validateParameters(params) { /* ... */ }
}

ProfileRegistry.register('custom', CustomProfile);
```

## Success Criteria

- All four profile types generate correct coordinates
- Tests pass with 100% coverage of critical paths
- TypeScript strict mode compilation succeeds
- Library can be imported and used in external projects
- Custom profiles can be registered and used
- Generated coordinates can be plotted to show correct horn shapes

## Confidence Score: 9/10

High confidence due to:
- Clear mathematical formulas researched and documented
- Well-defined TypeScript architecture
- Existing conventions from claude.md to follow
- Modular, extensible design
- Comprehensive validation and error handling

Minor uncertainty (-1) for:
- Exact spherical wave horn implementation may need refinement
- Coordinate scaling for different use cases might need adjustment