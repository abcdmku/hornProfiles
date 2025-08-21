# PRP: Horn Mount Features Implementation

## Overview
Add optional mounting features to acoustic horns: driver mount (throat side) and horn mount (mouth side) with bolt holes. This involves creating mount surfaces with configurable bolt patterns and merging them with the existing horn mesh.

## Requirements Summary
From `horn.md`:
- **Driver Mount**: Round mount at throat with configurable outer diameter, bolt hole diameter, and bolt circle diameter
- **Horn Mount**: Mount at mouth with width extension and evenly spaced bolt holes  
- Both mounts optional, planar, parallel to mouth/throat
- Surface mesh only (no thickness)
- Single merged mesh output from three functions
- Clean UI integration in sidebar

## Implementation Context

### Existing Code Patterns

#### Mesh Generation Pattern (`libs/horn-mesher/src/lib/horn-mesher.ts`)
```typescript
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  
  // Build vertices and indices
  // Return as MeshData with Float32Array
}
```

#### UI Pattern (`apps/horn-viewer/src/app/app.tsx`)
```tsx
// Collapsible sections with toggle buttons
<div>
  <div className="flex items-center justify-between mb-2">
    <label className="text-sm font-medium text-slate-300">
      Section Name
    </label>
    <button onClick={() => setExpanded(!expanded)}>
      {/* Toggle icon */}
    </button>
  </div>
  {expanded && (
    <div className="space-y-3">
      {/* Input fields */}
    </div>
  )}
</div>
```

#### Type Extension Pattern (`libs/horn-sim/types/src/lib/types.ts`)
Add to existing interfaces or create new ones following existing patterns.

### External Documentation & Resources

#### Three.js Mesh Operations
- **BufferGeometry Docs**: https://threejs.org/docs/api/en/core/BufferGeometry.html
- **BufferGeometryUtils**: https://threejs.org/docs/#examples/en/utils/BufferGeometryUtils.mergeBufferGeometries
- **CSG Operations**: https://github.com/samalexander/three-csg-ts (for boolean operations if needed)

#### Key Algorithms

**Bolt Circle Calculation**:
```javascript
function calculateBoltPositions(centerX, centerY, radius, count, startAngle = 0) {
  const positions = [];
  const angleStep = (2 * Math.PI) / count;
  
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i * angleStep);
    positions.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }
  return positions;
}
```

**Mesh Merging**:
```javascript
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';

const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries([
  driverMountGeometry,
  hornGeometry, 
  hornMountGeometry
]);
```

## Implementation Blueprint

### Phase 1: Type Definitions

1. **Add Mount Configuration Types** (`libs/horn-sim/types/src/lib/types.ts`)
```typescript
export interface DriverMountConfig {
  enabled: boolean;
  outerDiameter: number;      // mm
  boltHoleDiameter: number;   // mm  
  boltCircleDiameter: number; // mm
  boltCount: number;          // Number of bolts
}

export interface HornMountConfig {
  enabled: boolean;
  widthExtension: number;     // mm added to mouth width
  boltSpacing: number;        // max mm between bolts
  boltHoleDiameter: number;   // mm
}

export interface HornGeometry {
  // ... existing fields
  driverMount?: DriverMountConfig;
  hornMount?: HornMountConfig;
}
```

### Phase 2: Mount Generation Functions

2. **Create Mount Generation Module** (`libs/horn-mesher/src/lib/mounts.ts`)
```typescript
// Driver mount: circular flange with bolt holes
export function generateDriverMount(
  throatPosition: number,
  throatShape: CrossSectionPoints,
  config: DriverMountConfig,
  resolution: number
): MeshData

// Horn mount: follows mouth shape with extension
export function generateHornMount(
  mouthPosition: number,
  mouthShape: CrossSectionPoints,
  config: HornMountConfig,
  resolution: number
): MeshData

// Helper: Create annular surface with holes
function createAnnularSurface(
  innerRadius: number,
  outerRadius: number,
  holePositions: Point2D[],
  holeRadius: number,
  resolution: number
): MeshData

// Helper: Triangulate between two closed curves
function triangulateBetweenCurves(
  innerCurve: Point3D[],
  outerCurve: Point3D[]
): { indices: number[] }
```

### Phase 3: Mesh Integration

3. **Update Main Mesh Generator** (`libs/horn-mesher/src/lib/horn-mesher.ts`)
```typescript
export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const meshes: MeshData[] = [];
  
  // Generate horn body (existing code)
  const hornMesh = generateHornBody(geometry, options);
  meshes.push(hornMesh);
  
  // Generate driver mount if enabled
  if (geometry.driverMount?.enabled) {
    const mountMesh = generateDriverMount(
      0, // throat at x=0
      getThroatCrossSection(geometry),
      geometry.driverMount,
      options.resolution
    );
    meshes.push(mountMesh);
  }
  
  // Generate horn mount if enabled
  if (geometry.hornMount?.enabled) {
    const mountMesh = generateHornMount(
      geometry.profile[geometry.profile.length - 1].x,
      getMouthCrossSection(geometry),
      geometry.hornMount,
      options.resolution
    );
    meshes.push(mountMesh);
  }
  
  // Merge all meshes
  return mergeMeshData(meshes);
}
```

### Phase 4: UI Integration

4. **Add Mount Controls** (`apps/horn-viewer/src/app/app.tsx`)
```typescript
// Add state for mount configurations
const [driverMount, setDriverMount] = useState<DriverMountConfig>({
  enabled: false,
  outerDiameter: 150,
  boltHoleDiameter: 6,
  boltCircleDiameter: 120,
  boltCount: 4
});

const [hornMount, setHornMount] = useState<HornMountConfig>({
  enabled: false,
  widthExtension: 50,
  boltSpacing: 100,
  boltHoleDiameter: 8
});

// Add UI sections after existing parameters
// Use collapsible sections with enable toggles
// Follow existing input field patterns
```

## Key Implementation Details

### Driver Mount Algorithm
1. Calculate bolt positions on circle
2. Create outer circle vertices at mount diameter
3. Create inner vertices matching throat cross-section
4. For each bolt hole:
   - Create circle of vertices around hole
   - Exclude triangles that would fill the hole
5. Triangulate between curves avoiding holes
6. Position at throat (x=0)

### Horn Mount Algorithm  
1. Calculate mouth perimeter
2. Determine bolt count from spacing
3. Create outer vertices (mouth + extension)
4. Create inner vertices (mouth shape)
5. Place bolt holes evenly along perimeter
6. Triangulate surface with holes
7. Position at mouth end

### Mesh Merging Strategy
1. Collect all vertex/index/normal arrays
2. Offset indices for each additional mesh
3. Concatenate arrays
4. Return single MeshData

### UI/UX Considerations
- Mounts disabled by default
- Collapsible sections to reduce clutter
- Input validation (min/max values)
- Visual feedback when enabled
- Live preview updates

## Validation Gates

```bash
# Type checking
npx tsc --noEmit

# Linting
npx eslint . --fix

# Run tests (if tests exist)
npx vitest run

# Build verification
pnpm build

# Manual validation checklist:
# - [ ] Driver mount renders correctly when enabled
# - [ ] Horn mount renders correctly when enabled  
# - [ ] Bolt holes visible and correctly positioned
# - [ ] Meshes properly merged into single geometry
# - [ ] UI controls responsive and intuitive
# - [ ] No console errors or warnings
# - [ ] Performance acceptable with mounts enabled
```

## Common Issues & Solutions

### Issue: Holes not visible
**Solution**: Ensure triangulation excludes hole areas. Use Earcut or similar for complex polygons with holes.

### Issue: Normals inverted  
**Solution**: Check winding order consistency. Use `geometry.computeVertexNormals()` after merging.

### Issue: Z-fighting at mount interfaces
**Solution**: Slightly offset mount position (0.01mm) or ensure exact vertex alignment.

### Issue: Performance with high resolution
**Solution**: Limit mount resolution independently from horn resolution. Use LOD if needed.

## Implementation Tasks (in order)

1. [ ] Define TypeScript interfaces for mount configurations
2. [ ] Create mount generation functions with bolt hole calculations
3. [ ] Implement mesh merging utility function
4. [ ] Update main mesh generator to conditionally include mounts
5. [ ] Add UI state management for mount parameters
6. [ ] Create UI components for mount configuration
7. [ ] Wire up UI to mesh generation
8. [ ] Test all combinations (no mounts, driver only, horn only, both)
9. [ ] Optimize triangulation for performance
10. [ ] Add input validation and error handling

## Success Criteria
- Both mount types can be independently enabled/disabled
- Bolt patterns correctly calculated and rendered
- Single merged mesh output
- Clean, intuitive UI integration
- No performance degradation
- Code follows existing patterns and conventions

## Confidence Score: 8/10

Strong confidence due to:
- Clear requirements and examples
- Existing codebase patterns to follow
- Well-documented Three.js APIs
- Straightforward geometry calculations

Minor uncertainty around:
- Optimal triangulation with holes (may need iteration)
- Exact UI layout preferences