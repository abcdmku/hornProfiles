# PRP: Horn Mount Integration with Offset-Based Profile Redefinition

## Problem Statement

Update the horn mesher to support **driver mount** and **horn mount** as optional features that are fully integrated into the horn body as **one watertight solid** suitable for STL export. The current implementation generates separate meshes that are simply merged without proper integration at the mount interfaces.

## Requirements (from mesh.md)

1. **Offset-Based Horn Redefinition**: When a mount is present, the horn profile must be recalculated starting from (or ending at) the mount's offset plane
2. **Interpolation at Mount Offsets**: Mount planes may fall between existing horn sample points
3. **Mount Geometry**: Mounts can be rectangular, ellipse, or circle with proper cutout matching
4. **Solid Integration**: Horn mesh and mount mesh must be stitched at their shared offset plane with welded vertices
5. **Optional Mounts**: Either or both mounts may be present
6. **Export**: Always output a single manifold STL

## Root Cause Analysis

The current implementation in `libs/horn-mesher/src/lib/horn-mesh-3d.ts`:
- Generates horn body mesh independently
- Generates mount meshes separately  
- Uses simple `mergeMeshData` which concatenates arrays without welding vertices
- No offset-based horn profile recalculation
- No shared vertices at mount interfaces

## Solution Approach

### Phase 1: Offset-Based Horn Profile Calculation

Implement profile trimming and interpolation for mount offsets:

```typescript
interface MountOffsets {
  driverMountOffset?: number;  // Distance from throat
  hornMountOffset?: number;    // Distance from mouth  
}

function calculateEffectiveProfile(
  profile: ProfileXY,
  driverMount?: DriverMountConfig,
  hornMount?: HornMountConfig
): { profile: ProfileXY; offsets: MountOffsets } {
  let effectiveProfile = [...profile];
  const offsets: MountOffsets = {};
  
  // Trim profile at driver mount offset
  if (driverMount?.enabled) {
    const mountThickness = 10; // mm (from config)
    offsets.driverMountOffset = mountThickness;
    effectiveProfile = trimProfileAtStart(effectiveProfile, mountThickness);
  }
  
  // Trim profile at horn mount offset  
  if (hornMount?.enabled) {
    const mountThickness = 10; // mm (from config)
    offsets.hornMountOffset = mountThickness;
    effectiveProfile = trimProfileAtEnd(effectiveProfile, mountThickness);
  }
  
  return { profile: effectiveProfile, offsets };
}
```

### Phase 2: Profile Interpolation

Implement interpolation for finding exact radius at mount offsets:

```typescript
function interpolateProfileAt(profile: ProfileXY, xPosition: number): number {
  // Find surrounding points
  let lower = profile[0];
  let upper = profile[profile.length - 1];
  
  for (let i = 0; i < profile.length - 1; i++) {
    if (profile[i].x <= xPosition && profile[i + 1].x >= xPosition) {
      lower = profile[i];
      upper = profile[i + 1];
      break;
    }
  }
  
  // Linear interpolation
  const t = (xPosition - lower.x) / (upper.x - lower.x);
  return lower.y + t * (upper.y - lower.y);
}
```

### Phase 3: Integrated Mesh Generation

Update `generateHornMesh3D` to create integrated geometry:

```typescript
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const { resolution = 50 } = options;
  
  // Calculate effective profile with mount offsets
  const { profile: effectiveProfile, offsets } = calculateEffectiveProfile(
    geometry.profile,
    geometry.driverMount,
    geometry.hornMount
  );
  
  // Generate horn body with shared vertices at mount planes
  const hornMesh = generateIntegratedHornBody(
    geometry,
    effectiveProfile,
    offsets,
    resolution
  );
  
  return hornMesh;
}
```

### Phase 4: Vertex Welding for Watertight Mesh

Implement proper vertex welding at mount interfaces:

```typescript
function weldVerticesAtInterface(
  bodyVertices: Float32Array,
  mountVertices: Float32Array,
  interfaceX: number,
  tolerance: number = 0.001
): { vertices: Float32Array; indexMap: Map<number, number> } {
  const mergedVertices = [];
  const indexMap = new Map<number, number>();
  
  // Add body vertices
  for (let i = 0; i < bodyVertices.length; i += 3) {
    mergedVertices.push(bodyVertices[i], bodyVertices[i + 1], bodyVertices[i + 2]);
  }
  
  // Add mount vertices, welding those at interface
  for (let i = 0; i < mountVertices.length; i += 3) {
    const x = mountVertices[i];
    const y = mountVertices[i + 1];
    const z = mountVertices[i + 2];
    
    if (Math.abs(x - interfaceX) < tolerance) {
      // Find matching body vertex
      const matchIndex = findMatchingVertex(bodyVertices, x, y, z, tolerance);
      if (matchIndex !== -1) {
        indexMap.set(i / 3, matchIndex);
        continue; // Skip adding duplicate
      }
    }
    
    indexMap.set(i / 3, mergedVertices.length / 3);
    mergedVertices.push(x, y, z);
  }
  
  return {
    vertices: new Float32Array(mergedVertices),
    indexMap
  };
}
```

### Phase 5: Generate Integrated Horn Body

Create a single mesh with mount geometry included:

```typescript
function generateIntegratedHornBody(
  geometry: HornGeometry,
  effectiveProfile: ProfileXY,
  offsets: MountOffsets,
  resolution: number
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  
  // Generate driver mount face if present
  if (geometry.driverMount?.enabled && offsets.driverMountOffset) {
    const mountVertices = generateMountFace(
      offsets.driverMountOffset,
      geometry.driverMount,
      geometry.mode,
      effectiveProfile[0].y,  // Interpolated radius at offset
      resolution
    );
    vertices.push(...mountVertices.vertices);
    indices.push(...mountVertices.indices);
    normals.push(...mountVertices.normals);
  }
  
  // Generate horn body vertices
  const bodyStart = vertices.length / 3;
  for (let i = 0; i < effectiveProfile.length; i++) {
    const point = effectiveProfile[i];
    const crossSection = generateCrossSection(
      geometry.mode,
      point.y,
      geometry.width,
      geometry.height,
      resolution
    );
    
    for (const csPoint of crossSection) {
      vertices.push(point.x, csPoint.y, csPoint.z);
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      normals.push(0, csPoint.y / len, csPoint.z / len);
    }
  }
  
  // Connect horn body segments
  for (let i = 0; i < effectiveProfile.length - 1; i++) {
    for (let j = 0; j < resolution; j++) {
      const a = bodyStart + i * resolution + j;
      const b = bodyStart + i * resolution + ((j + 1) % resolution);
      const c = bodyStart + (i + 1) * resolution + j;
      const d = bodyStart + (i + 1) * resolution + ((j + 1) % resolution);
      
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  
  // Generate horn mount face if present
  if (geometry.hornMount?.enabled && offsets.hornMountOffset) {
    const mountVertices = generateMountFace(
      effectiveProfile[effectiveProfile.length - 1].x,
      geometry.hornMount,
      geometry.mode,
      effectiveProfile[effectiveProfile.length - 1].y,
      resolution
    );
    
    // Offset indices for horn mount
    const mountIndicesOffset = vertices.length / 3;
    for (const idx of mountVertices.indices) {
      indices.push(idx + mountIndicesOffset);
    }
    
    vertices.push(...mountVertices.vertices);
    normals.push(...mountVertices.normals);
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}
```

## Implementation Context

### Existing Code References

- **Current mesh generation**: `libs/horn-mesher/src/lib/horn-mesh-3d.ts`
- **Mount generation**: `libs/horn-mesher/src/lib/mounts.ts`
- **Mesh utilities**: `libs/horn-mesher/src/lib/mesh-utils.ts`
- **Cross-section generation**: `libs/horn-mesher/src/lib/cross-section.ts`
- **Types**: `libs/horn-sim/types/src/lib/types.ts`

### External Documentation

- **Three.js BufferGeometryUtils**: https://threejs.org/docs/examples/en/utils/BufferGeometryUtils.html
- **Mesh welding techniques**: https://stackoverflow.com/questions/46267844/removing-duplicate-vertices-from-three-js-geometry
- **poly2tri triangulation**: https://github.com/r3mi/poly2tri.js (already in use)

## Implementation Tasks

1. **Update Types** (`libs/horn-sim/types/src/lib/types.ts`)
   - Add mount thickness to DriverMountConfig and HornMountConfig
   - Add offset calculation interfaces

2. **Create Profile Utilities** (`libs/horn-mesher/src/lib/profile-utils.ts`)
   - Implement `calculateEffectiveProfile`
   - Implement `interpolateProfileAt`
   - Implement `trimProfileAtStart` and `trimProfileAtEnd`

3. **Update Mesh Generation** (`libs/horn-mesher/src/lib/horn-mesh-3d.ts`)
   - Refactor `generateHornMesh3D` to use integrated approach
   - Implement `generateIntegratedHornBody`
   - Remove separate mount mesh generation calls

4. **Implement Vertex Welding** (`libs/horn-mesher/src/lib/mesh-utils.ts`)
   - Add `weldVerticesAtInterface` function
   - Add `findMatchingVertex` helper
   - Update `mergeMeshData` to support welding

5. **Update Mount Generation** (`libs/horn-mesher/src/lib/mounts.ts`)
   - Refactor to generate mount faces as part of integrated mesh
   - Ensure shared vertices at mount interfaces
   - Keep triangulation logic for mount surfaces

6. **Add Tests** (`libs/horn-mesher/src/lib/horn-mesher.spec.ts`)
   - Test offset-based profile calculation
   - Test vertex welding
   - Test watertight mesh validation
   - Test STL export compatibility

## Validation Gates

```bash
# Type checking
npx tsc --noEmit

# Run tests
npx vitest run --filter horn-mesher

# Linting
npx eslint libs/horn-mesher --fix

# Integration test (visual inspection)
pnpm dev:web
# Check that mounts are integrated without gaps
```

## Success Criteria

✅ Mount at throat shifts horn start by mountThickness  
✅ Mount at mouth shifts horn end by mountThickness  
✅ Mount cutouts match horn cross-section at interface  
✅ Horn and mounts export as 1 STL solid  
✅ No overlaps, duplicate shells, or gaps  
✅ Vertices are properly welded at interfaces  
✅ Mesh passes watertight validation  

## Common Pitfalls to Avoid

1. **Vertex Duplication**: Ensure vertices at mount interfaces are shared, not duplicated
2. **Normal Direction**: Keep consistent normal directions for proper STL export
3. **Index Offset Errors**: When combining meshes, carefully manage vertex index offsets
4. **Profile Interpolation**: Use proper interpolation for smooth transitions
5. **Triangulation Overlap**: Ensure mount triangulation doesn't create overlapping faces

## Quality Score

**Confidence Level: 8/10**

Strong foundation with existing mount generation code. Main challenges are profile recalculation and vertex welding, both well-documented techniques. Clear requirements and existing test patterns provide good validation framework.