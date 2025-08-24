# PRP: Throat and Mouth Shape Transition System

## Project Overview
Extend the existing horn profile generation system to support different shapes at the throat and mouth, with smooth morphing transitions between them. The transition length should be configurable, allowing users to control how gradually the geometry morphs from the throat shape to the mouth shape.

## Current System Architecture

### Existing Infrastructure
- **HornProfileParameters** interface in `libs/horn-profiles/src/lib/types/index.ts` already supports:
  - `throatWidth/throatHeight` and `mouthWidth/mouthHeight` for rectangular cross-sections
  - Separate `widthProfile` and `heightProfile` for non-circular horns
- **CrossSectionMode** type in `libs/horn-sim/types/src/lib/types.ts` supports:
  - `"circle"`, `"ellipse"`, `"superellipse"`, `"rectangular"`, `"stereographic"`
- **Cross-section generation** in `libs/horn-mesher/src/lib/cross-section.ts`:
  - `generateCrossSectionPoints()` function already implements all shape types
  - Functions for circle, ellipse, rectangle, superellipse generation
- **3D meshing** in `libs/horn-mesher/src/lib/horn-mesh-3d.ts`:
  - `generateHornBodyMesh()` already interpolates cross-sections along horn length
  - `calculateDimensionsAt()` function for width/height at any position

### Key Files to Reference
- `libs/horn-profiles/src/lib/types/index.ts` - Core interfaces
- `libs/horn-profiles/src/lib/profiles/base.ts` - Base class with validation patterns
- `libs/horn-profiles/src/lib/profiles/conical.ts` - Width/height profile generation pattern
- `libs/horn-mesher/src/lib/cross-section.ts` - Shape generation functions
- `libs/horn-mesher/src/lib/horn-mesh-3d.ts` - 3D mesh generation with interpolation
- `libs/horn-mesher/src/lib/profile-utils.ts` - Profile calculation utilities

## Feature Requirements

### Core Functionality
1. **Shape Definition**: Allow throat and mouth to have different `CrossSectionMode` values
2. **Smooth Transition**: Generate intermediate cross-sections that morph between shapes
3. **Configurable Length**: Control the axial length over which morphing occurs
4. **Backward Compatibility**: Maintain existing API while extending functionality

### Technical Specifications
- Extend `HornProfileParameters` to include throat and mouth shape modes
- Add transition length parameter with sensible defaults
- Implement shape morphing algorithms for all supported cross-section combinations
- Update 3D mesh generation to use morphed cross-sections

## Research Context

### Shape Morphing Techniques (2024)
Based on recent research in acoustic horn design and shape morphing:

1. **Morphological Morphing**: Gradual transformation between normalized cross-sections
2. **Linear Interpolation**: Simple parameter blending for compatible shapes
3. **Curve-Based Morphing**: Using Bezier curves for smooth feature transitions
4. **Acoustic Considerations**: Smooth transitions prevent high-order mode excitation

### Academic References
- **Shape-based interpolation using morphological morphing** (ResearchGate)
- **Morphing using curves and shape interpolation techniques** (IEEE)
- **Acoustic Horn Design** discussions on diyAudio.com emphasizing smooth transitions

### Horn Design Best Practices
- Gradual transitions minimize acoustic reflections
- Circular-to-rectangular transitions commonly use octagonal intermediates
- FEA optimization shows significant improvement with smooth morphing
- Modern 3D printing allows complex transition geometries

## Implementation Blueprint

### Type Extensions

```typescript
// Extend HornProfileParameters in libs/horn-profiles/src/lib/types/index.ts
export interface HornProfileParameters {
  throatWidth: number;
  throatHeight: number;
  mouthWidth: number;
  mouthHeight: number;
  length: number;
  resolution?: number;
  cutoffFrequency?: number;
  speedOfSound?: number;
  
  // NEW: Shape transition parameters
  throatShape?: CrossSectionMode;  // Default: "circle"
  mouthShape?: CrossSectionMode;   // Default: "circle" 
  transitionLength?: number;       // Length over which to morph (default: full length)
  morphingFunction?: 'linear' | 'cubic' | 'sigmoid'; // Default: 'linear'
}

// Extend ProfileGeneratorResult 
export interface ProfileGeneratorResult {
  points: Point2D[];
  widthProfile?: Point2D[];
  heightProfile?: Point2D[];
  shapeProfile?: ShapePoint[];  // NEW: Shape at each axial position
  metadata: {
    profileType: string;
    parameters: HornProfileParameters;
    calculatedValues: Record<string, number>;
    transitionMetadata?: TransitionMetadata; // NEW
  };
}

// NEW: Shape transition types
export interface ShapePoint {
  x: number;  // Axial position
  shape: CrossSectionMode;
  morphingFactor: number; // 0 = throat shape, 1 = mouth shape
  width: number;
  height: number;
}

export interface TransitionMetadata {
  hasTransition: boolean;
  transitionStart: number;
  transitionEnd: number;
  morphingFunction: string;
}
```

### Shape Morphing Utilities

```typescript
// NEW: libs/horn-mesher/src/lib/shape-morphing.ts
import type { CrossSectionMode } from "@horn-sim/types";
import { Point2D } from "./point-utils";

export interface ShapeMorphParams {
  sourceShape: CrossSectionMode;
  targetShape: CrossSectionMode;
  morphFactor: number; // 0-1, 0=source, 1=target
  width: number;
  height: number;
  resolution: number;
}

/**
 * Morph between two cross-section shapes
 * Implements shape-based interpolation using normalized point sets
 */
export function morphCrossSectionShapes(params: ShapeMorphParams): Point2D[] {
  const { sourceShape, targetShape, morphFactor, width, height, resolution } = params;
  
  // Generate source and target point sets
  const sourcePoints = generateCrossSectionPoints(sourceShape, width/2, height/2, resolution);
  const targetPoints = generateCrossSectionPoints(targetShape, width/2, height/2, resolution);
  
  // Handle same shapes (optimization)
  if (sourceShape === targetShape) {
    return sourcePoints;
  }
  
  // Normalize point sets to same resolution
  const normalizedSource = normalizePointSet(sourcePoints, resolution);
  const normalizedTarget = normalizePointSet(targetPoints, resolution);
  
  // Interpolate between normalized point sets
  return interpolatePointSets(normalizedSource, normalizedTarget, morphFactor);
}

/**
 * Normalize point set to specific resolution with even angular distribution
 */
function normalizePointSet(points: Point2D[], targetResolution: number): Point2D[] {
  // Convert to polar, interpolate evenly, convert back to cartesian
  const angles = points.map(p => Math.atan2(p.z, p.y));
  const radii = points.map(p => Math.sqrt(p.y*p.y + p.z*p.z));
  
  const normalized: Point2D[] = [];
  for (let i = 0; i < targetResolution; i++) {
    const targetAngle = (2 * Math.PI * i) / targetResolution;
    const radius = interpolateRadiusAtAngle(angles, radii, targetAngle);
    normalized.push({
      y: radius * Math.cos(targetAngle),
      z: radius * Math.sin(targetAngle)
    });
  }
  
  return normalized;
}

/**
 * Linear interpolation between two point sets
 */
function interpolatePointSets(source: Point2D[], target: Point2D[], factor: number): Point2D[] {
  return source.map((sourcePoint, i) => ({
    y: sourcePoint.y + factor * (target[i].y - sourcePoint.y),
    z: sourcePoint.z + factor * (target[i].z - sourcePoint.z)
  }));
}

/**
 * Morphing functions for transition control
 */
export const MORPHING_FUNCTIONS = {
  linear: (t: number) => t,
  cubic: (t: number) => t * t * (3 - 2 * t), // Smoothstep
  sigmoid: (t: number) => 1 / (1 + Math.exp(-6 * (t - 0.5))) // S-curve
};
```

### Profile Generation Updates

```typescript
// Update libs/horn-profiles/src/lib/profiles/base.ts
export abstract class BaseHornProfile extends HornProfile {
  
  validateParameters(params: HornProfileParameters): void {
    // ... existing validation ...
    
    // NEW: Shape transition validation
    if (params.transitionLength !== undefined) {
      if (params.transitionLength <= 0) {
        errors.push("Transition length must be positive");
      }
      if (params.transitionLength > params.length) {
        errors.push("Transition length cannot exceed total horn length");
      }
    }
    
    // Validate shape compatibility
    const throatShape = params.throatShape ?? 'circle';
    const mouthShape = params.mouthShape ?? 'circle';
    this.validateShapeTransition(throatShape, mouthShape);
  }
  
  protected validateShapeTransition(throat: CrossSectionMode, mouth: CrossSectionMode): void {
    const supportedShapes = ['circle', 'ellipse', 'rectangular', 'superellipse'];
    if (!supportedShapes.includes(throat) || !supportedShapes.includes(mouth)) {
      throw new Error(`Unsupported shape transition: ${throat} to ${mouth}`);
    }
  }
  
  protected generateShapeProfile(params: Required<HornProfileParameters>): ShapePoint[] {
    const { length, resolution, throatShape, mouthShape, transitionLength, morphingFunction } = params;
    const morphFunc = MORPHING_FUNCTIONS[morphingFunction];
    
    const shapeProfile: ShapePoint[] = [];
    const transitionStart = 0;
    const transitionEnd = transitionLength ?? length;
    
    for (let i = 0; i <= resolution; i++) {
      const x = (length * i) / resolution;
      let morphingFactor: number;
      
      if (throatShape === mouthShape) {
        morphingFactor = 0; // No morphing needed
      } else if (x <= transitionStart) {
        morphingFactor = 0; // Pure throat shape
      } else if (x >= transitionEnd) {
        morphingFactor = 1; // Pure mouth shape
      } else {
        // Morph within transition region
        const t = (x - transitionStart) / (transitionEnd - transitionStart);
        morphingFactor = morphFunc(t);
      }
      
      // Calculate dimensions at this position
      const { width, height } = this.calculateDimensionsAt(x, params);
      
      shapeProfile.push({
        x,
        shape: morphingFactor === 0 ? throatShape : morphingFactor === 1 ? mouthShape : 'morphed',
        morphingFactor,
        width,
        height
      });
    }
    
    return shapeProfile;
  }
}
```

### 3D Mesh Generation Updates

```typescript
// Update libs/horn-mesher/src/lib/horn-mesh-3d.ts
function generateHornBodyMesh(
  geometry: HornGeometry,
  originalProfile: ProfileXY,
  resolution: number,
): MeshData {
  const { mode, widthProfile, heightProfile } = geometry;
  
  // NEW: Handle shape transitions
  const shapeProfile = geometry.shapeProfile; // From profile generation
  const hasShapeTransition = shapeProfile && 
    shapeProfile.some(sp => sp.morphingFactor > 0 && sp.morphingFactor < 1);
  
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const circumferenceSteps = resolution;
  const profileSteps = originalProfile.length;

  // Generate vertices for each profile point
  for (let i = 0; i < profileSteps; i++) {
    const point = originalProfile[i];
    const x = point.x;
    
    // Calculate dimensions at this position
    const { width, height } = calculateDimensionsAt(
      originalProfile,
      widthProfile,
      heightProfile,
      x,
      geometry.width,
      geometry.height,
    );
    
    let crossSection: Point2D[];
    
    if (hasShapeTransition && shapeProfile) {
      // NEW: Generate morphed cross-section
      const shapeData = shapeProfile[i] || shapeProfile[shapeProfile.length - 1];
      
      if (shapeData.morphingFactor === 0) {
        // Pure throat shape
        crossSection = generateCrossSection(
          geometry.throatShape || mode, 
          point.y, 
          width, 
          height, 
          circumferenceSteps
        );
      } else if (shapeData.morphingFactor === 1) {
        // Pure mouth shape
        crossSection = generateCrossSection(
          geometry.mouthShape || mode, 
          point.y, 
          width, 
          height, 
          circumferenceSteps
        );
      } else {
        // Morphed shape
        crossSection = morphCrossSectionShapes({
          sourceShape: geometry.throatShape || mode,
          targetShape: geometry.mouthShape || mode,
          morphFactor: shapeData.morphingFactor,
          width,
          height,
          resolution: circumferenceSteps
        });
      }
    } else {
      // Existing behavior - uniform shape
      crossSection = generateCrossSection(mode, point.y, width, height, circumferenceSteps);
    }

    // Add vertices for this cross-section
    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);
    }
  }
  
  // ... rest of mesh generation ...
}
```

## Implementation Tasks

1. **Type Extensions**
   - Extend HornProfileParameters with shape transition properties
   - Add ShapePoint and TransitionMetadata interfaces  
   - Update ProfileGeneratorResult interface

2. **Shape Morphing System**
   - Create libs/horn-mesher/src/lib/shape-morphing.ts
   - Implement morphCrossSectionShapes function
   - Add point set normalization and interpolation utilities
   - Implement morphing functions (linear, cubic, sigmoid)

3. **Profile Generation Updates**
   - Update BaseHornProfile validation for shape transitions
   - Add generateShapeProfile method to base class
   - Update existing profile classes (ConicalProfile, etc.) to generate shape profiles

4. **3D Mesh Integration**
   - Update generateHornBodyMesh to use morphed cross-sections
   - Extend HornGeometry interface with shape properties
   - Update calculateDimensionsAt for shape-aware calculations

5. **Testing**
   - Unit tests for shape morphing utilities
   - Profile generation tests with shape transitions
   - 3D mesh generation tests with morphed shapes
   - Integration tests for complete workflow

6. **Documentation**
   - API documentation for new parameters
   - Usage examples showing shape transitions
   - Performance considerations for morphing

## External Dependencies & References

### Documentation URLs
- **Horn Theory Introduction**: https://www.grc.com/acoustics/an-introduction-to-horn-theory.pdf
- **diyAudio Horn Design Thread**: https://www.diyaudio.com/community/threads/acoustic-horn-design-the-easy-way-ath4.338806/
- **Shape Morphing Research**: https://www.researchgate.net/publication/3920088_Shape-based_interpolation_using_morphological_morphing
- **COMSOL Horn Optimization**: https://doc.comsol.com/6.0/doc/com.comsol.help.models.aco.horn_shape_optimization/horn_shape_optimization.html

### Algorithm References
- **Morphological Morphing**: Reconstruction from normalized cross-sections with smooth transformation
- **Bezier Curve Morphing**: Feature correspondence through curve approximation
- **Linear Interpolation**: Parameter blending for compatible shapes

## Validation Gates

```bash
# Type checking
npx tsc --noEmit

# Linting  
npx eslint . --fix

# Unit tests
npx vitest run

# Build verification
pnpm build

# Integration tests
pnpm test:integration
```

## Error Handling Strategy

1. **Shape Compatibility**
   - Validate supported shape combinations
   - Provide clear error messages for unsupported transitions
   - Graceful fallback to uniform shapes

2. **Parameter Validation**
   - Check transition length bounds
   - Validate morphing function parameters
   - Ensure shape dimensions are positive

3. **Geometric Edge Cases**
   - Handle degenerate shapes (zero width/height)
   - Prevent self-intersecting morphed shapes  
   - Maintain mesh quality during transitions

## Gotchas & Considerations

### Library Version Compatibility
- Current system uses width/height parameters but tests show radius parameters
- Need to maintain backward compatibility with existing profiles
- CrossSectionMode type includes "stereographic" but no implementation exists

### Performance Considerations  
- Shape morphing adds computational overhead
- Consider caching morphed cross-sections for repeated use
- Normalize resolution to prevent excessive point generation

### Acoustic Implications
- Rapid shape changes can cause acoustic reflections
- Smooth transitions preserve horn performance
- Consider acoustic validation of morphed shapes

## Example Usage

```typescript
import { generateProfile, ConicalProfile } from '@horn-profiles';

// Simple shape transition
const result = generateProfile('conical', {
  throatWidth: 50,
  throatHeight: 50,
  mouthWidth: 400,
  mouthHeight: 300,
  length: 500,
  throatShape: 'circle',
  mouthShape: 'rectangular', 
  transitionLength: 300,      // Morph over first 300mm
  morphingFunction: 'cubic'    // Smooth S-curve transition
});

// Access shape profile
result.shapeProfile.forEach((point, i) => {
  console.log(`Position ${point.x}: ${point.shape} (factor: ${point.morphingFactor})`);
});

// Use with 3D mesher
const hornGeometry: HornGeometry = {
  mode: 'circle',           // Legacy - overridden by shape profile
  profile: result.points,
  widthProfile: result.widthProfile,
  heightProfile: result.heightProfile,
  shapeProfile: result.shapeProfile,  // NEW
  throatShape: 'circle',              // NEW
  mouthShape: 'rectangular',          // NEW
  // ... other geometry properties
};

const mesh = generateHornMesh3D(hornGeometry, { resolution: 50 });
```

## Success Criteria

- All existing tests pass without modification
- New shape transition functionality works for all supported combinations
- Morphed cross-sections generate valid 3D meshes
- Performance impact is acceptable (< 50% overhead)
- API maintains backward compatibility
- Documentation covers all new features with examples

## Confidence Score: 8/10

**High confidence due to:**
- Existing infrastructure already supports most required functionality
- Clear mathematical approach based on established morphing algorithms
- Well-defined interfaces and extension points in current system
- Extensive research into acoustic horn design best practices
- Backward compatibility preserved through optional parameters

**Confidence deducted (-2) for:**
- Complex shape morphing algorithms may need iteration to get right
- Integration between profile generation and 3D meshing requires careful coordination
- Performance optimization may require multiple passes
- Edge cases in morphing different shape types may surface during implementation