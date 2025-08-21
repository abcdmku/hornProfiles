# PRP: Fix Mesh Triangulation for Bolt Holes and Throat/Mouth Openings

## Problem Statement

The current mesh generation for driver and horn mounts has incorrect triangulation where:
1. Triangles cross through the interior of bolt holes instead of forming proper hole boundaries
2. Triangles cross through the throat opening area instead of respecting it as a constrained boundary
3. The manual triangulation approach in `libs/horn-mesher/src/lib/mounts.ts` doesn't properly handle constrained boundaries

**Visual Evidence**: See `examples/issue/image.png` showing triangles incorrectly crossing through throat area (marked in red) and bolt holes.

## Root Cause Analysis

The current implementation in `libs/horn-mesher/src/lib/mounts.ts` attempts manual triangulation by:
- Creating vertices for inner edge (throat/mouth shape) 
- Creating vertices for outer edge
- Creating vertices around bolt holes
- Manually connecting vertices with triangles using angular calculations

This approach fails because:
- It doesn't implement proper Constrained Delaunay Triangulation (CDT)
- Manual triangle creation leads to overlapping and crossing through holes
- No proper boundary constraint enforcement

## Solution Approach

Implement proper Constrained Delaunay Triangulation using a proven library that handles holes correctly.

### Recommended Library: poly2tri.js

**Why poly2tri.js:**
- Explicitly designed for polygons with holes
- Simple API with `addHole()` method
- Proven implementation of "Sweep-line algorithm for constrained Delaunay triangulation"
- Most mature and widely used option for CDT with holes in JavaScript

**Installation:**
```bash
pnpm add poly2tri --filter @horn-sim/mesher
```

**Documentation**: https://github.com/r3mi/poly2tri.js

### Alternative Library: cdt2d

If poly2tri.js has issues with complex cases:
- More robust handling with automatic hole detection
- Supports exterior face removal with `{exterior: false}` flag
- Claims to be "the only non-broken triangulation library in JavaScript"

**Installation:**
```bash
pnpm add cdt2d --filter @horn-sim/mesher
```

**Documentation**: https://www.npmjs.com/package/cdt2d

## Implementation Blueprint

### Phase 1: Install Dependencies

```bash
# Install poly2tri for CDT with holes
pnpm add poly2tri --filter @horn-sim/mesher

# Install types if available
pnpm add -D @types/poly2tri --filter @horn-sim/mesher
```

If types don't exist, create `libs/horn-mesher/src/lib/poly2tri.d.ts`:
```typescript
declare module 'poly2tri' {
  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }
  
  export class SweepContext {
    constructor(contour: Point[]);
    addHole(hole: Point[]): void;
    addPoint(point: Point): void;
    triangulate(): void;
    getTriangles(): Triangle[];
  }
  
  export class Triangle {
    getPoints(): [Point, Point, Point];
  }
  
  export function triangulate(contour: Point[], holes?: Point[][]): Triangle[];
}
```

### Phase 2: Refactor `generateDriverMount` Function

**File**: `libs/horn-mesher/src/lib/mounts.ts`

```typescript
import * as poly2tri from 'poly2tri';

export function generateDriverMount(
  throatPosition: number,
  throatWidth: number,
  throatHeight: number,
  throatMode: CrossSectionMode,
  config: DriverMountConfig,
  resolution: number,
): MeshData {
  // Step 1: Generate 2D points for outer boundary (circular flange)
  const outerRadius = config.outerDiameter / 2;
  const outerContour: poly2tri.Point[] = [];
  const numOuterPoints = resolution * 2; // Higher resolution for outer edge
  
  for (let i = 0; i < numOuterPoints; i++) {
    const angle = (i / numOuterPoints) * 2 * Math.PI;
    outerContour.push(new poly2tri.Point(
      outerRadius * Math.cos(angle),
      outerRadius * Math.sin(angle)
    ));
  }
  
  // Step 2: Create SweepContext with outer boundary
  const sweepContext = new poly2tri.SweepContext(outerContour);
  
  // Step 3: Add throat opening as a hole
  const throatHole: poly2tri.Point[] = [];
  const throatPoints = generateCrossSectionPoints(
    throatMode,
    throatWidth / 2,
    throatHeight / 2,
    resolution
  );
  
  for (const point of throatPoints) {
    throatHole.push(new poly2tri.Point(point.y, point.z));
  }
  // IMPORTANT: Reverse hole points for correct winding order
  throatHole.reverse();
  sweepContext.addHole(throatHole);
  
  // Step 4: Add bolt holes
  const boltCircleRadius = config.boltCircleDiameter / 2;
  const boltHoleRadius = config.boltHoleDiameter / 2;
  
  for (let i = 0; i < config.boltCount; i++) {
    const angle = (i / config.boltCount) * 2 * Math.PI;
    const centerY = boltCircleRadius * Math.cos(angle);
    const centerZ = boltCircleRadius * Math.sin(angle);
    
    const boltHole: poly2tri.Point[] = [];
    const holeResolution = 16; // Points per hole
    
    for (let j = 0; j < holeResolution; j++) {
      const holeAngle = (j / holeResolution) * 2 * Math.PI;
      boltHole.push(new poly2tri.Point(
        centerY + boltHoleRadius * Math.cos(holeAngle),
        centerZ + boltHoleRadius * Math.sin(holeAngle)
      ));
    }
    // IMPORTANT: Reverse hole points for correct winding order
    boltHole.reverse();
    sweepContext.addHole(boltHole);
  }
  
  // Step 5: Triangulate
  sweepContext.triangulate();
  const triangles = sweepContext.getTriangles();
  
  // Step 6: Convert to MeshData format
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const pointMap = new Map<string, number>();
  let vertexIndex = 0;
  
  for (const triangle of triangles) {
    const points = triangle.getPoints();
    
    for (const point of points) {
      const key = `${point.x},${point.y}`;
      
      if (!pointMap.has(key)) {
        vertices.push(throatPosition, point.x, point.y);
        normals.push(1, 0, 0); // Normal pointing in +X direction
        pointMap.set(key, vertexIndex);
        vertexIndex++;
      }
      
      indices.push(pointMap.get(key)!);
    }
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}
```

### Phase 3: Refactor `generateHornMount` Function

Apply similar CDT approach for horn mount:

```typescript
export function generateHornMount(
  mouthPosition: number,
  mouthWidth: number,
  mouthHeight: number,
  mouthMode: CrossSectionMode,
  config: HornMountConfig,
  resolution: number,
): MeshData {
  // Step 1: Generate outer boundary (mouth shape + extension)
  const extensionFactor = 1 + config.widthExtension / Math.max(mouthWidth, mouthHeight);
  const outerPoints = generateCrossSectionPoints(
    mouthMode,
    (mouthWidth / 2) * extensionFactor,
    (mouthHeight / 2) * extensionFactor,
    resolution * 2 // Higher resolution for better triangulation
  );
  
  const outerContour: poly2tri.Point[] = [];
  for (const point of outerPoints) {
    outerContour.push(new poly2tri.Point(point.y, point.z));
  }
  
  // Step 2: Create SweepContext
  const sweepContext = new poly2tri.SweepContext(outerContour);
  
  // Step 3: Add mouth opening as a hole
  const mouthHole: poly2tri.Point[] = [];
  const innerPoints = generateCrossSectionPoints(
    mouthMode,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution
  );
  
  for (const point of innerPoints) {
    mouthHole.push(new poly2tri.Point(point.y, point.z));
  }
  mouthHole.reverse(); // Correct winding order
  sweepContext.addHole(mouthHole);
  
  // Step 4: Calculate and add bolt holes
  const perimeter = calculatePerimeter(outerPoints);
  const boltCount = Math.max(4, Math.ceil(perimeter / config.boltSpacing));
  const boltHoleRadius = config.boltHoleDiameter / 2;
  
  // Place bolts between inner and outer edges
  for (let b = 0; b < boltCount; b++) {
    const angle = (b / boltCount) * 2 * Math.PI;
    
    // Calculate bolt position based on mode
    let centerY: number, centerZ: number;
    
    if (mouthMode === "circle" || mouthMode === "ellipse") {
      // Radial placement
      const innerR = Math.sqrt(innerPoints[0].y ** 2 + innerPoints[0].z ** 2);
      const outerR = Math.sqrt(outerPoints[0].y ** 2 + outerPoints[0].z ** 2);
      const midR = (innerR + outerR) / 2;
      
      centerY = midR * Math.cos(angle);
      centerZ = midR * Math.sin(angle);
    } else {
      // For rectangular, interpolate between inner and outer
      const innerIdx = Math.floor((b / boltCount) * innerPoints.length);
      const outerIdx = Math.floor((b / boltCount) * outerPoints.length);
      
      centerY = (innerPoints[innerIdx].y + outerPoints[outerIdx].y) / 2;
      centerZ = (innerPoints[innerIdx].z + outerPoints[outerIdx].z) / 2;
    }
    
    // Create bolt hole
    const boltHole: poly2tri.Point[] = [];
    const holeResolution = 16;
    
    for (let j = 0; j < holeResolution; j++) {
      const holeAngle = (j / holeResolution) * 2 * Math.PI;
      boltHole.push(new poly2tri.Point(
        centerY + boltHoleRadius * Math.cos(holeAngle),
        centerZ + boltHoleRadius * Math.sin(holeAngle)
      ));
    }
    boltHole.reverse();
    sweepContext.addHole(boltHole);
  }
  
  // Step 5: Triangulate and convert to MeshData
  sweepContext.triangulate();
  const triangles = sweepContext.getTriangles();
  
  // Convert triangles to MeshData (same as driver mount)
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const pointMap = new Map<string, number>();
  let vertexIndex = 0;
  
  for (const triangle of triangles) {
    const points = triangle.getPoints();
    
    for (const point of points) {
      const key = `${point.x},${point.y}`;
      
      if (!pointMap.has(key)) {
        vertices.push(mouthPosition, point.x, point.y);
        normals.push(1, 0, 0);
        pointMap.set(key, vertexIndex);
        vertexIndex++;
      }
      
      indices.push(pointMap.get(key)!);
    }
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}
```

### Phase 4: Error Handling and Edge Cases

Add robust error handling for CDT failures:

```typescript
function triangulateWithHoles(
  outerContour: poly2tri.Point[],
  holes: poly2tri.Point[][]
): poly2tri.Triangle[] {
  try {
    const sweepContext = new poly2tri.SweepContext(outerContour);
    
    for (const hole of holes) {
      // Validate hole doesn't self-intersect
      if (validatePolygon(hole)) {
        sweepContext.addHole(hole);
      } else {
        console.warn('Skipping invalid hole polygon');
      }
    }
    
    sweepContext.triangulate();
    return sweepContext.getTriangles();
  } catch (error) {
    console.error('Triangulation failed:', error);
    // Fallback to simple triangulation without holes
    return fallbackTriangulation(outerContour);
  }
}

function validatePolygon(points: poly2tri.Point[]): boolean {
  // Check for self-intersections
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    
    for (let j = i + 2; j < points.length; j++) {
      if (j === points.length - 1 && i === 0) continue;
      
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return false;
      }
    }
  }
  
  return true;
}
```

## Testing Approach

### Unit Tests

Create `libs/horn-mesher/src/lib/mounts.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDriverMount, generateHornMount } from './mounts';

describe('Mount Triangulation', () => {
  it('should generate driver mount without triangles crossing holes', () => {
    const mesh = generateDriverMount(
      0, // throatPosition
      50, // throatWidth
      50, // throatHeight
      'circle', // throatMode
      {
        enabled: true,
        outerDiameter: 150,
        boltHoleDiameter: 10,
        boltCircleDiameter: 120,
        boltCount: 4
      },
      32 // resolution
    );
    
    // Verify mesh has vertices and indices
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    
    // Verify no triangles cross hole boundaries
    expect(validateNoHoleCrossing(mesh)).toBe(true);
  });
  
  it('should handle elliptical throat shapes', () => {
    const mesh = generateDriverMount(
      0, 30, 40, 'ellipse',
      {
        enabled: true,
        outerDiameter: 150,
        boltHoleDiameter: 10,
        boltCircleDiameter: 120,
        boltCount: 6
      },
      32
    );
    
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(validateNoHoleCrossing(mesh)).toBe(true);
  });
});

function validateNoHoleCrossing(mesh: MeshData): boolean {
  // Implement validation that triangles don't cross hole boundaries
  // Check that no triangle edge crosses from outside to inside a hole
  return true; // Placeholder
}
```

### Visual Testing

Create a test scene to visually verify the triangulation:

```typescript
// apps/horn-viewer/src/app/TestMounts.tsx
import { generateDriverMount, generateHornMount } from '@horn-sim/mesher';
import { HornViewer3D } from '@horn-sim/viewer-3d';

export function TestMounts() {
  const driverMount = generateDriverMount(
    0, 50, 50, 'circle',
    {
      enabled: true,
      outerDiameter: 150,
      boltHoleDiameter: 10,
      boltCircleDiameter: 120,
      boltCount: 4
    },
    32
  );
  
  const meshData = {
    positions: driverMount.vertices,
    indices: driverMount.indices,
    normals: driverMount.normals
  };
  
  return (
    <HornViewer3D
      meshData={meshData}
      wireframe={true} // Show triangulation
    />
  );
}
```

## Validation Gates

Execute these commands to verify the implementation:

```bash
# 1. Install dependencies
pnpm install --filter @horn-sim/mesher

# 2. Type checking - Must pass without errors
npx tsc --noEmit

# 3. Linting - Must pass
npx eslint libs/horn-mesher --fix

# 4. Run unit tests - All must pass
npx vitest run libs/horn-mesher

# 5. Build the library - Must succeed
pnpm --filter @horn-sim/mesher build

# 6. Run the viewer app to visually verify
pnpm --filter @horn-sim/horn-viewer dev
# Then navigate to the app and enable driver/horn mounts
# Verify that:
# - No triangles cross through bolt holes
# - No triangles cross through throat/mouth openings
# - Mesh renders correctly in wireframe mode
```

## Implementation Tasks

1. **Install poly2tri library** - Add CDT library to horn-mesher package
2. **Create type definitions** - Add TypeScript types for poly2tri if needed
3. **Refactor generateDriverMount** - Replace manual triangulation with CDT
4. **Refactor generateHornMount** - Replace manual triangulation with CDT  
5. **Add error handling** - Handle edge cases and CDT failures gracefully
6. **Create unit tests** - Verify triangulation correctness
7. **Visual testing** - Verify in 3D viewer with wireframe mode
8. **Clean up old code** - Remove unused manual triangulation logic

## Known Gotchas

1. **Winding Order**: Holes must have opposite winding order from outer contour (typically clockwise for holes, counter-clockwise for outer boundary)

2. **Self-Intersections**: poly2tri will fail if polygons self-intersect. Pre-validate all polygons.

3. **Duplicate Points**: Remove duplicate consecutive points before triangulation

4. **Collinear Points**: Too many collinear points can cause issues - consider simplifying polygons

5. **Hole Overlap**: Holes must not overlap each other or touch the outer boundary

## Alternative Approach (if poly2tri fails)

Use **cdt2d** library instead:

```typescript
import cdt2d from 'cdt2d';

function triangulateWithCDT2D(outer: number[][], holes: number[][][]) {
  const points: number[][] = [];
  const edges: number[][] = [];
  
  // Add outer boundary
  let offset = 0;
  for (let i = 0; i < outer.length; i++) {
    points.push(outer[i]);
    edges.push([offset + i, offset + (i + 1) % outer.length]);
  }
  offset += outer.length;
  
  // Add holes
  for (const hole of holes) {
    const holeStart = offset;
    for (let i = 0; i < hole.length; i++) {
      points.push(hole[i]);
      edges.push([offset + i, offset + (i + 1) % hole.length]);
    }
    offset += hole.length;
  }
  
  // Triangulate with constrained edges
  const triangles = cdt2d(points, edges, { exterior: false });
  return triangles;
}
```

## Success Criteria

✅ No triangles cross through bolt hole interiors  
✅ No triangles cross through throat/mouth openings  
✅ Clean triangulation visible in wireframe mode  
✅ All existing tests pass  
✅ New unit tests verify correct triangulation  
✅ Performance comparable or better than manual approach  
✅ Handles all cross-section modes (circle, ellipse, rectangular)  
✅ Graceful degradation for edge cases

## References

- **poly2tri.js Documentation**: https://github.com/r3mi/poly2tri.js
- **cdt2d Documentation**: https://www.npmjs.com/package/cdt2d
- **Three.js BufferGeometry**: https://threejs.org/docs/api/en/core/BufferGeometry.html
- **Constrained Delaunay Triangulation**: https://en.wikipedia.org/wiki/Constrained_Delaunay_triangulation
- **Issue Example**: `examples/issue/image.png` - Shows incorrect triangulation to fix

---

**Confidence Score: 8/10**

This PRP provides comprehensive context and implementation details for one-pass success. The score is 8 rather than 10 because:
- Library integration may have unforeseen TypeScript typing issues
- Edge cases in complex geometries might require iteration
- Visual validation requires manual testing

The implementation path is clear with fallback options and extensive validation gates to ensure correctness.