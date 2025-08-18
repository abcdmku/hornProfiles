# PRP: Fix Tractrix and Spherical Horn Profiles

## Problem Statement
The current implementation of tractrix and spherical horn profiles has calculation errors:
- **Tractrix profile**: Appears as a straight line instead of the characteristic curved shape
- **Spherical profile**: Incorrect expansion calculations not following spherical wave propagation

Reference images showing correct profiles are available in `examples/` folder:
- `tractrix_compare_01.jpg`
- `traxtrix_radius_exp_01.jpg` 
- `traxtrix_sfa_compare_01.jpg`
- `swh_PETF_*.jpg` (spherical wave horn examples)

## Research Context

### Tractrix Horn Mathematical Foundation
Source: https://sphericalhorns.net/2019/08/30/a-true-expansion-tractrix-horn/

**Key Formulas:**
1. **Horn axis equation (correct implementation):**
   ```
   x = r0 * ln((r0 + sqrt(r0^2 - y^2)) / y) - sqrt(r0^2 - y^2)
   ```
   Where:
   - x: distance along horn axis
   - y: radius at position x
   - r0: mouth radius defined by cutoff frequency

2. **Mouth radius calculation:**
   ```
   r0 = c / (2 * π * fc)
   ```
   Where:
   - c: speed of sound (m/s)
   - fc: cutoff frequency (Hz)

3. **Critical Implementation Notes:**
   - The tractrix naturally produces x values that DECREASE as radius increases
   - Need to invert and scale the x-axis properly
   - Radius must always be less than r0 (asymptotic limit)

### Spherical Wave Horn Mathematical Foundation
Source: https://sphericalhorns.net/2020/12/14/progressive-expansion-t-factor-horns/

**Key Formulas:**
1. **Surface area expansion:**
   ```
   S(x) = S0 * (cosh(m*x/2) + T * sinh(m*x/2))^2
   ```
   
2. **Radius from area (for circular cross-section):**
   ```
   r(x) = sqrt(S(x) / π)
   ```
   
3. **Flare constant:**
   ```
   m = 4π * fc / c
   ```

4. **T-factor for spherical wave:**
   - T = 1 for hyperbolic horn
   - T = 0 for catenoidal horn
   - T can be progressive for PETF horns

## Current Implementation Analysis

### File Locations
- **Tractrix Implementation**: `libs/horn-profiles/src/lib/profiles/tractrix.ts`
- **Spherical Implementation**: `libs/horn-profiles/src/lib/profiles/spherical.ts`
- **Base Class**: `libs/horn-profiles/src/lib/profiles/base.ts`
- **Types**: `libs/horn-profiles/src/lib/types/index.ts`
- **Math Utils**: `libs/horn-profiles/src/lib/utils/math.ts`
- **Tests**: `libs/horn-profiles/src/lib/profiles/*.test.ts`

### Existing Patterns to Follow
From analyzing `exponential.ts` and `conical.ts`:
1. Extend `BaseHornProfile` class
2. Implement `generate()` method
3. Use `validateParameters()` and `normalizeParameters()` from base
4. Return `ProfileGeneratorResult` with points and metadata
5. Include calculated values in metadata
6. Handle edge cases with fallback to simpler profiles

## Implementation Blueprint

### Task 1: Fix Tractrix Profile

```typescript
// Pseudocode for corrected tractrix.ts
class TractrixProfile extends BaseHornProfile {
  generate(params) {
    // 1. Calculate r0 from cutoff frequency
    const r0 = (speedOfSound * 1000) / (2 * Math.PI * cutoffFrequency);
    
    // 2. Ensure mouth radius doesn't exceed r0
    const actualMouthRadius = Math.min(mouthRadius, r0 * 0.99);
    
    // 3. Generate radius values from throat to mouth
    const radiusValues = [];
    for (i = 0 to resolution) {
      const r = throatRadius + (actualMouthRadius - throatRadius) * (i / resolution);
      radiusValues.push(r);
    }
    
    // 4. Calculate x positions using tractrix equation
    const xPositions = [];
    for (each radius r in radiusValues) {
      if (r < r0 && r > 0) {
        const sqrtTerm = sqrt(r0^2 - r^2);
        const x = r0 * ln((r0 + sqrtTerm) / r) - sqrtTerm;
        xPositions.push(x);
      }
    }
    
    // 5. Normalize and invert x-axis
    const xMax = xPositions[0];  // Largest x at throat
    const xMin = xPositions[last]; // Smallest x at mouth
    
    for (i = 0 to xPositions.length) {
      normalizedX = ((xMax - xPositions[i]) / (xMax - xMin)) * length;
      points.push({ x: normalizedX, y: radiusValues[i] });
    }
    
    return ProfileGeneratorResult with points and metadata;
  }
}
```

### Task 2: Fix Spherical Profile

```typescript
// Pseudocode for corrected spherical.ts
class SphericalProfile extends BaseHornProfile {
  generate(params) {
    // 1. Calculate flare constant
    const m = (4 * Math.PI * cutoffFrequency) / speedOfSound;
    
    // 2. Calculate T-factor (default to 1 for standard spherical)
    const T = 1.0;
    
    // 3. Generate profile using hyperbolic functions
    const points = [];
    const S0 = Math.PI * throatRadius * throatRadius;
    
    for (i = 0 to resolution) {
      const x = (length * i) / resolution;
      
      // Calculate surface area at position x
      const expansionFactor = cosh(m * x / 2) + T * sinh(m * x / 2);
      const S_x = S0 * expansionFactor * expansionFactor;
      
      // Convert area to radius
      const y = sqrt(S_x / Math.PI);
      
      // Clamp to mouth radius
      const clampedY = Math.min(y, mouthRadius);
      
      points.push({ x, y: clampedY });
    }
    
    // 4. Ensure smooth transition to mouth radius
    if (points[last].y !== mouthRadius) {
      // Apply smoothing for last 10% of profile
      smoothTransitionToMouth(points, mouthRadius);
    }
    
    return ProfileGeneratorResult with points and metadata;
  }
}
```

## Implementation Tasks (In Order)

1. **Update Math Utilities** (`libs/horn-profiles/src/lib/utils/math.ts`)
   - Add `sinh` and `cosh` helper functions if not present
   - Add safe logarithm function for tractrix calculations
   - Add clamping utilities

2. **Fix Tractrix Profile** (`libs/horn-profiles/src/lib/profiles/tractrix.ts`)
   - Implement correct tractrix equation
   - Fix x-axis inversion and normalization
   - Add proper boundary checks for r < r0
   - Update metadata calculations

3. **Create Tractrix Tests** (`libs/horn-profiles/src/lib/profiles/tractrix.test.ts`)
   - Test that profile curves correctly (not straight)
   - Verify throat and mouth radius constraints
   - Check r0 calculation from cutoff frequency
   - Validate x-axis normalization

4. **Fix Spherical Profile** (`libs/horn-profiles/src/lib/profiles/spherical.ts`)
   - Implement hyperbolic expansion formula
   - Add T-factor support (default to 1.0)
   - Fix area-to-radius conversion
   - Improve mouth radius smoothing

5. **Create Spherical Tests** (`libs/horn-profiles/src/lib/profiles/spherical.test.ts`)
   - Test exponential area growth
   - Verify correct flare constant calculation
   - Check profile curvature
   - Validate clamping behavior

6. **Update Integration Tests**
   - Verify all profiles generate valid points
   - Check that tractrix and spherical are visually distinct
   - Compare against reference profiles

7. **Visual Verification**
   - Use HornProfileViewer component to visualize results
   - Compare with reference images in examples folder
   - Ensure curves match expected horn shapes

## Validation Gates

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Linting
npx eslint libs/horn-profiles --fix

# 3. Run specific profile tests
npx vitest run libs/horn-profiles/src/lib/profiles/tractrix.test.ts
npx vitest run libs/horn-profiles/src/lib/profiles/spherical.test.ts

# 4. Run all tests
npx vitest run

# 5. Build the library
cd libs/horn-profiles && npm run build

# 6. Run the viewer app to visually verify
cd apps/horn-viewer && npm run dev
```

## Error Handling Strategy

1. **Mathematical Domain Errors**
   - Check for `y >= r0` in tractrix (would cause sqrt of negative)
   - Handle `y = 0` case (would cause ln(0))
   - Clamp all radius values to physical limits

2. **Numerical Stability**
   - Use safe math functions from utils
   - Add epsilon values for floating point comparisons
   - Handle edge cases at x=0 and x=length

3. **Parameter Validation**
   - Ensure cutoff frequency > 0
   - Verify throat < mouth radius
   - Check resolution is positive integer

## Reference Code from Existing Profiles

### Pattern from exponential.ts (lines 24-30):
```typescript
for (let i = 0; i <= resolution; i++) {
  const x = (length * i) / resolution;
  const y = throatRadius * Math.exp((mAdjusted * x) / 2);
  points.push({ x, y });
}
```

### Pattern from base.ts for validation:
```typescript
this.validateParameters(params);
const normalizedParams = this.normalizeParameters(params);
```

### Test pattern from exponential.test.ts (lines 39-44):
```typescript
const result = profile.generate(params);
const lastPoint = result.points[result.points.length - 1];
expect(lastPoint.x).toBe(500);
expect(lastPoint.y).toBeCloseTo(300, 5);
```

## Additional Resources

- **Tractrix Deep Dive**: https://sphericalhorns.net/2019/08/30/a-true-expansion-tractrix-horn/
- **PETF Horns**: https://sphericalhorns.net/2020/12/14/progressive-expansion-t-factor-horns/
- **Horn Theory**: http://www.quarter-wave.com/Horns/Horn_Physics.pdf
- **Reference Images**: See `examples/` folder in project root

## Success Criteria

1. Tractrix profile shows characteristic curved shape (not straight line)
2. Spherical profile exhibits proper exponential area growth
3. All existing tests continue to pass
4. New tests verify correct mathematical implementations
5. Visual output matches reference images
6. TypeScript compilation succeeds without errors
7. No linting errors

## Common Pitfalls to Avoid

1. **Tractrix x-axis inversion**: The raw tractrix equation gives decreasing x for increasing radius
2. **Unit confusion**: Speed of sound may be in m/s but dimensions in mm
3. **Domain errors**: Must check y < r0 before calculating tractrix
4. **Clamping order**: Apply physical constraints after calculations, not before
5. **Test precision**: Use appropriate decimal places in `toBeCloseTo()` assertions

## Confidence Score: 9.5/10

High confidence because:
- Clear mathematical formulas from authoritative sources
- Existing working patterns to follow (exponential, conical)
- Comprehensive test framework already in place
- Visual reference images available for validation
- Well-structured codebase with clear separation of concerns

Minor uncertainty (-0.5) for:
- Exact smoothing algorithm for mouth radius transition may need tuning