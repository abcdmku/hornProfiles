import type {
  CrossSectionMode,
  MeshData,
  DriverMountConfig,
  HornMountConfig,
} from "@horn-sim/types";
import * as poly2tri from "poly2tri";

/**
 * Remove duplicate consecutive points from a polygon
 */
function removeDuplicatePoints(points: poly2tri.Point[]): poly2tri.Point[] {
  if (points.length === 0) return points;

  const filtered: poly2tri.Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Check if points are different (with small epsilon for floating point comparison)
    if (Math.abs(prev.x - curr.x) > 1e-10 || Math.abs(prev.y - curr.y) > 1e-10) {
      filtered.push(curr);
    }
  }

  // Also check if the last point equals the first (closing duplicate)
  if (filtered.length > 1) {
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    if (Math.abs(first.x - last.x) < 1e-10 && Math.abs(first.y - last.y) < 1e-10) {
      filtered.pop();
    }
  }

  return filtered;
}

/**
 * Generate a driver mount (circular flange with throat-shaped inner hole)
 */
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
  let outerContour: poly2tri.Point[] = [];
  const numOuterPoints = resolution * 2; // Higher resolution for outer edge

  for (let i = 0; i < numOuterPoints; i++) {
    const angle = (i / numOuterPoints) * 2 * Math.PI;
    outerContour.push(
      new poly2tri.Point(outerRadius * Math.cos(angle), outerRadius * Math.sin(angle)),
    );
  }

  // Remove any duplicate points
  outerContour = removeDuplicatePoints(outerContour);

  // Step 2: Create SweepContext with outer boundary
  const sweepContext = new poly2tri.SweepContext(outerContour);

  // Step 3: Add throat opening as a hole
  let throatHole: poly2tri.Point[] = [];
  const throatPoints = generateCrossSectionPoints(
    throatMode,
    throatWidth / 2,
    throatHeight / 2,
    resolution,
  );

  for (const point of throatPoints) {
    throatHole.push(new poly2tri.Point(point.y, point.z));
  }

  // Remove any duplicate points
  throatHole = removeDuplicatePoints(throatHole);

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

    let boltHole: poly2tri.Point[] = [];
    const holeResolution = 16; // Points per hole

    for (let j = 0; j < holeResolution; j++) {
      const holeAngle = (j / holeResolution) * 2 * Math.PI;
      boltHole.push(
        new poly2tri.Point(
          centerY + boltHoleRadius * Math.cos(holeAngle),
          centerZ + boltHoleRadius * Math.sin(holeAngle),
        ),
      );
    }
    // Remove any duplicate points
    boltHole = removeDuplicatePoints(boltHole);
    // IMPORTANT: Reverse hole points for correct winding order
    boltHole.reverse();
    if (boltHole.length >= 3) {
      // Only add hole if it has at least 3 points
      sweepContext.addHole(boltHole);
    }
  }

  // Step 5: Triangulate
  try {
    sweepContext.triangulate();
  } catch (error) {
    // Fallback to simple mesh without holes if triangulation fails
    return createFallbackMesh(throatPosition, outerRadius, resolution);
  }

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

      const index = pointMap.get(key);
      if (index !== undefined) {
        indices.push(index);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Generate a horn mount (follows mouth shape with extension)
 */
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
    resolution * 2, // Higher resolution for better triangulation
  );

  let outerContour: poly2tri.Point[] = [];
  for (const point of outerPoints) {
    outerContour.push(new poly2tri.Point(point.y, point.z));
  }

  // Remove any duplicate points
  outerContour = removeDuplicatePoints(outerContour);

  // Step 2: Create SweepContext
  const sweepContext = new poly2tri.SweepContext(outerContour);

  // Step 3: Add mouth opening as a hole
  let mouthHole: poly2tri.Point[] = [];
  const innerPoints = generateCrossSectionPoints(
    mouthMode,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution,
  );

  for (const point of innerPoints) {
    mouthHole.push(new poly2tri.Point(point.y, point.z));
  }

  // Remove any duplicate points
  mouthHole = removeDuplicatePoints(mouthHole);

  mouthHole.reverse(); // Correct winding order
  sweepContext.addHole(mouthHole);

  // Step 4: Calculate and add bolt holes
  const perimeter = calculatePerimeter(outerPoints);
  const boltCount = Math.max(4, Math.ceil(perimeter / config.boltSpacing));
  const boltHoleRadius = config.boltHoleDiameter / 2;

  // Place bolts between inner and outer edges
  for (let b = 0; b < boltCount; b++) {
    // Calculate bolt position based on mode
    let centerY: number, centerZ: number;

    if (mouthMode === "circle" || mouthMode === "ellipse") {
      // Radial placement - midway between inner and outer
      const innerPoint = innerPoints[Math.floor((b / boltCount) * innerPoints.length)];
      const outerPoint = outerPoints[Math.floor((b / boltCount) * outerPoints.length)];

      centerY = (innerPoint.y + outerPoint.y) / 2;
      centerZ = (innerPoint.z + outerPoint.z) / 2;
    } else {
      // For rectangular, interpolate between inner and outer
      const innerIdx = Math.floor((b / boltCount) * innerPoints.length);
      const outerIdx = Math.floor((b / boltCount) * outerPoints.length);

      centerY = (innerPoints[innerIdx].y + outerPoints[outerIdx].y) / 2;
      centerZ = (innerPoints[innerIdx].z + outerPoints[outerIdx].z) / 2;
    }

    // Create bolt hole
    let boltHole: poly2tri.Point[] = [];
    const holeResolution = 16;

    for (let j = 0; j < holeResolution; j++) {
      const holeAngle = (j / holeResolution) * 2 * Math.PI;
      boltHole.push(
        new poly2tri.Point(
          centerY + boltHoleRadius * Math.cos(holeAngle),
          centerZ + boltHoleRadius * Math.sin(holeAngle),
        ),
      );
    }
    // Remove any duplicate points
    boltHole = removeDuplicatePoints(boltHole);
    boltHole.reverse();
    if (boltHole.length >= 3) {
      // Only add hole if it has at least 3 points
      sweepContext.addHole(boltHole);
    }
  }

  // Step 5: Triangulate and convert to MeshData
  try {
    sweepContext.triangulate();
  } catch (error) {
    // Fallback to simple mesh without holes if triangulation fails
    return createFallbackMeshForHorn(mouthPosition, outerPoints, innerPoints);
  }

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

      const index = pointMap.get(key);
      if (index !== undefined) {
        indices.push(index);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Generate cross-section points based on mode
 */
function generateCrossSectionPoints(
  mode: CrossSectionMode,
  halfWidth: number,
  halfHeight: number,
  resolution: number,
): Array<{ y: number; z: number }> {
  const points: Array<{ y: number; z: number }> = [];

  switch (mode) {
    case "circle": {
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * 2 * Math.PI;
        points.push({
          y: halfWidth * Math.cos(angle),
          z: halfWidth * Math.sin(angle), // Use halfWidth for both since it's a circle
        });
      }
      break;
    }

    case "ellipse": {
      for (let i = 0; i < resolution; i++) {
        const angle = (i / resolution) * 2 * Math.PI;
        points.push({
          y: halfWidth * Math.cos(angle),
          z: halfHeight * Math.sin(angle),
        });
      }
      break;
    }

    case "rectangular": {
      // Create a rectangle with points distributed along edges
      const pointsPerSide = Math.floor(resolution / 4);
      const remainingPoints = resolution - pointsPerSide * 4;

      // Bottom edge (don't include the last point to avoid duplicate with right edge)
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: -halfWidth + t * 2 * halfWidth,
          z: -halfHeight,
        });
      }

      // Right edge (don't include the last point to avoid duplicate with top edge)
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: halfWidth,
          z: -halfHeight + t * 2 * halfHeight,
        });
      }

      // Top edge (don't include the last point to avoid duplicate with left edge)
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: halfWidth - t * 2 * halfWidth,
          z: halfHeight,
        });
      }

      // Left edge (don't include the last point to avoid duplicate with bottom edge start)
      for (let i = 0; i < pointsPerSide + remainingPoints; i++) {
        const t = i / (pointsPerSide + remainingPoints);
        points.push({
          y: -halfWidth,
          z: halfHeight - t * 2 * halfHeight,
        });
      }

      break;
    }

    default:
      throw new Error(`Unsupported cross-section mode: ${mode}`);
  }

  return points;
}

/**
 * Calculate perimeter of a closed curve
 */
function calculatePerimeter(points: Array<{ y: number; z: number }>): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    perimeter += Math.sqrt((p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
  }
  return perimeter;
}

/**
 * Create a simple fallback mesh for driver mount without holes
 */
function createFallbackMesh(position: number, radius: number, resolution: number): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Center vertex
  vertices.push(position, 0, 0);
  normals.push(1, 0, 0);

  // Perimeter vertices
  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;
    vertices.push(position, radius * Math.cos(angle), radius * Math.sin(angle));
    normals.push(1, 0, 0);
  }

  // Create triangles
  for (let i = 0; i < resolution; i++) {
    indices.push(0, i + 1, ((i + 1) % resolution) + 1);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Create a simple fallback mesh for horn mount without holes
 */
function createFallbackMeshForHorn(
  position: number,
  outerPoints: Array<{ y: number; z: number }>,
  innerPoints: Array<{ y: number; z: number }>,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Add inner vertices
  const innerStartIdx = 0;
  for (const point of innerPoints) {
    vertices.push(position, point.y, point.z);
    normals.push(1, 0, 0);
  }

  // Add outer vertices
  const outerStartIdx = innerPoints.length;
  for (const point of outerPoints) {
    vertices.push(position, point.y, point.z);
    normals.push(1, 0, 0);
  }

  // Create simple quad triangulation between inner and outer
  const innerCount = innerPoints.length;
  const outerCount = outerPoints.length;
  const maxCount = Math.max(innerCount, outerCount);

  for (let i = 0; i < maxCount; i++) {
    const innerIdx1 = innerStartIdx + (i % innerCount);
    const innerIdx2 = innerStartIdx + ((i + 1) % innerCount);
    const outerIdx1 = outerStartIdx + (i % outerCount);
    const outerIdx2 = outerStartIdx + ((i + 1) % outerCount);

    indices.push(innerIdx1, outerIdx1, innerIdx2);
    indices.push(innerIdx2, outerIdx1, outerIdx2);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

/**
 * Merge multiple mesh data into a single mesh
 */
export function mergeMeshData(meshes: MeshData[]): MeshData {
  let totalVertices = 0;
  let totalIndices = 0;
  let totalNormals = 0;

  // Calculate total sizes
  for (const mesh of meshes) {
    totalVertices += mesh.vertices.length;
    totalIndices += mesh.indices.length;
    totalNormals += mesh.normals ? mesh.normals.length : 0;
  }

  // Create merged arrays
  const mergedVertices = new Float32Array(totalVertices);
  const mergedIndices = new Uint32Array(totalIndices);
  const mergedNormals = new Float32Array(totalNormals);

  let vertexOffset = 0;
  let indexOffset = 0;
  let normalOffset = 0;
  let vertexCount = 0;

  // Merge all meshes
  for (const mesh of meshes) {
    // Copy vertices
    mergedVertices.set(mesh.vertices, vertexOffset);
    vertexOffset += mesh.vertices.length;

    // Copy indices with offset
    for (let i = 0; i < mesh.indices.length; i++) {
      mergedIndices[indexOffset + i] = mesh.indices[i] + vertexCount;
    }
    indexOffset += mesh.indices.length;

    // Copy normals if they exist
    if (mesh.normals) {
      mergedNormals.set(mesh.normals, normalOffset);
      normalOffset += mesh.normals.length;
    }

    // Update vertex count for next mesh
    vertexCount += mesh.vertices.length / 3;
  }

  return {
    vertices: mergedVertices,
    indices: mergedIndices,
    normals: mergedNormals,
  };
}
