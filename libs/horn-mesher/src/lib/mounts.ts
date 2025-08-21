import type {
  CrossSectionMode,
  MeshData,
  DriverMountConfig,
  HornMountConfig,
} from "@horn-sim/types";

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
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Generate inner edge (throat shape)
  const innerPoints = generateCrossSectionPoints(
    throatMode,
    throatWidth / 2,
    throatHeight / 2,
    resolution,
  );

  // Generate outer edge (always circular)
  const outerRadius = config.outerDiameter / 2;
  const outerPoints: Array<{ y: number; z: number }> = [];
  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;
    outerPoints.push({
      y: outerRadius * Math.cos(angle),
      z: outerRadius * Math.sin(angle),
    });
  }

  // Calculate bolt hole positions
  const boltCircleRadius = config.boltCircleDiameter / 2;
  const boltHoleRadius = config.boltHoleDiameter / 2;
  const boltHoles: Array<{ y: number; z: number }> = [];

  for (let i = 0; i < config.boltCount; i++) {
    const angle = (i / config.boltCount) * 2 * Math.PI;
    boltHoles.push({
      y: boltCircleRadius * Math.cos(angle),
      z: boltCircleRadius * Math.sin(angle),
    });
  }

  // Build vertex arrays with hole boundaries
  let vertexIndex = 0;

  // Add inner edge vertices (throat shape)
  const innerStartIndex = vertexIndex;
  for (const point of innerPoints) {
    vertices.push(throatPosition, point.y, point.z);
    normals.push(1, 0, 0);
    vertexIndex++;
  }

  // Add outer edge vertices
  const outerStartIndex = vertexIndex;
  for (const point of outerPoints) {
    vertices.push(throatPosition, point.y, point.z);
    normals.push(1, 0, 0);
    vertexIndex++;
  }

  // Add vertices around each bolt hole
  const holeStartIndices: number[] = [];
  const holeVerticesPerHole = 16; // Resolution for each hole

  for (const hole of boltHoles) {
    holeStartIndices.push(vertexIndex);
    for (let i = 0; i < holeVerticesPerHole; i++) {
      const angle = (i / holeVerticesPerHole) * 2 * Math.PI;
      vertices.push(
        throatPosition,
        hole.y + boltHoleRadius * Math.cos(angle),
        hole.z + boltHoleRadius * Math.sin(angle),
      );
      normals.push(1, 0, 0);
      vertexIndex++;
    }
  }

  // Create proper triangulation that connects edges to hole boundaries
  // We need to create a mesh that goes: inner edge -> around holes -> outer edge

  // For each segment around the perimeter, check if it intersects a hole
  for (let i = 0; i < resolution; i++) {
    const nextI = (i + 1) % resolution;

    // Current segment vertices
    const inner1 = innerStartIndex + i;
    const inner2 = innerStartIndex + nextI;
    const outer1 = outerStartIndex + i;
    const outer2 = outerStartIndex + nextI;

    // Get angles for this segment
    const angle1 = (i / resolution) * 2 * Math.PI;
    const angle2 = ((i + 1) / resolution) * 2 * Math.PI;

    // Check each hole to see if it's in this angular segment
    let holeInSegment = -1;
    for (let h = 0; h < boltHoles.length; h++) {
      const holeAngle = Math.atan2(boltHoles[h].z, boltHoles[h].y);
      const normalizedHoleAngle = holeAngle < 0 ? holeAngle + 2 * Math.PI : holeAngle;

      // Check if hole is in this angular segment
      if (angle2 > angle1) {
        if (normalizedHoleAngle >= angle1 && normalizedHoleAngle <= angle2) {
          holeInSegment = h;
          break;
        }
      } else {
        // Segment wraps around 0
        if (normalizedHoleAngle >= angle1 || normalizedHoleAngle <= angle2) {
          holeInSegment = h;
          break;
        }
      }
    }

    if (holeInSegment >= 0) {
      // This segment contains a hole - connect around it
      const holeStart = holeStartIndices[holeInSegment];

      // Connect inner edge to hole edge (going around the hole)
      for (let hv = 0; hv < holeVerticesPerHole; hv++) {
        const holeVertex = holeStart + hv;
        const nextHoleVertex = holeStart + ((hv + 1) % holeVerticesPerHole);
        const hvAngle = (hv / holeVerticesPerHole) * 2 * Math.PI;

        // Connect from inner edge to hole on the "left" side
        if (hvAngle >= Math.PI) {
          indices.push(inner1, holeVertex, nextHoleVertex);
        }

        // Connect from hole to outer edge on the "right" side
        if (hvAngle < Math.PI) {
          indices.push(holeVertex, outer1, nextHoleVertex);
          if (hv === 0) {
            indices.push(nextHoleVertex, outer1, outer2);
          }
        }
      }

      // Connect the corners
      indices.push(inner1, holeStart + Math.floor(holeVerticesPerHole * 0.5), inner2);
      indices.push(holeStart, outer1, holeStart + Math.floor(holeVerticesPerHole * 0.75));
    } else {
      // No hole in this segment - simple quad between inner and outer
      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
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
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Generate inner edge (mouth shape)
  const innerPoints = generateCrossSectionPoints(
    mouthMode,
    mouthWidth / 2,
    mouthHeight / 2,
    resolution,
  );

  // Generate outer edge (mouth shape + extension)
  const extensionFactor = 1 + config.widthExtension / Math.max(mouthWidth, mouthHeight);
  const outerPoints = generateCrossSectionPoints(
    mouthMode,
    (mouthWidth / 2) * extensionFactor,
    (mouthHeight / 2) * extensionFactor,
    resolution,
  );

  // Calculate bolt hole positions along the perimeter
  const perimeter = calculatePerimeter(outerPoints);
  const boltCount = Math.max(4, Math.ceil(perimeter / config.boltSpacing));
  const boltHoleRadius = config.boltHoleDiameter / 2;

  // Place bolts evenly between inner and outer edges
  const boltHoles: Array<{ y: number; z: number }> = [];

  for (let b = 0; b < boltCount; b++) {
    const angle = (b / boltCount) * 2 * Math.PI;

    // For circular/elliptical, use radial placement
    if (mouthMode === "circle" || mouthMode === "ellipse") {
      // Place holes midway between inner and outer radii
      const innerR = Math.sqrt(
        innerPoints[0].y * innerPoints[0].y + innerPoints[0].z * innerPoints[0].z,
      );
      const outerR = Math.sqrt(
        outerPoints[0].y * outerPoints[0].y + outerPoints[0].z * outerPoints[0].z,
      );
      const midR = (innerR + outerR) / 2;

      boltHoles.push({
        y: midR * Math.cos(angle),
        z: midR * Math.sin(angle),
      });
    } else {
      // For rectangular, place along the perimeter
      const segmentLength = perimeter / boltCount;
      const targetDistance = b * segmentLength;

      let currentDistance = 0;
      for (let i = 0; i < outerPoints.length; i++) {
        const p1 = outerPoints[i];
        const p2 = outerPoints[(i + 1) % outerPoints.length];
        const segDist = Math.sqrt((p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);

        if (currentDistance + segDist >= targetDistance) {
          const t = (targetDistance - currentDistance) / segDist;
          const midPoint = {
            y: p1.y + (p2.y - p1.y) * t,
            z: p1.z + (p2.z - p1.z) * t,
          };

          // Move bolt slightly inward
          const scale = 0.7; // Place at 70% of the distance from center
          boltHoles.push({
            y: midPoint.y * scale,
            z: midPoint.z * scale,
          });
          break;
        }
        currentDistance += segDist;
      }
    }
  }

  // Build vertex arrays
  let vertexIndex = 0;

  // Add inner edge vertices
  const innerStartIndex = vertexIndex;
  for (const point of innerPoints) {
    vertices.push(mouthPosition, point.y, point.z);
    normals.push(1, 0, 0);
    vertexIndex++;
  }

  // Add outer edge vertices
  const outerStartIndex = vertexIndex;
  for (const point of outerPoints) {
    vertices.push(mouthPosition, point.y, point.z);
    normals.push(1, 0, 0);
    vertexIndex++;
  }

  // Add vertices around each bolt hole
  const holeStartIndices: number[] = [];
  const holeVerticesPerHole = 16;

  for (const hole of boltHoles) {
    holeStartIndices.push(vertexIndex);
    for (let i = 0; i < holeVerticesPerHole; i++) {
      const angle = (i / holeVerticesPerHole) * 2 * Math.PI;
      vertices.push(
        mouthPosition,
        hole.y + boltHoleRadius * Math.cos(angle),
        hole.z + boltHoleRadius * Math.sin(angle),
      );
      normals.push(1, 0, 0);
      vertexIndex++;
    }
  }

  // Create triangulation connecting inner to outer while avoiding holes
  // Use a different strategy: for each hole, connect it to nearby vertices

  // First, create the base mesh between inner and outer edges
  for (let i = 0; i < resolution; i++) {
    const nextI = (i + 1) % resolution;

    const inner1 = innerStartIndex + i;
    const inner2 = innerStartIndex + nextI;
    const outer1 = outerStartIndex + i;
    const outer2 = outerStartIndex + nextI;

    // Check if this quad would intersect any hole
    const quadCenter = {
      y:
        (vertices[inner1 * 3 + 1] +
          vertices[outer1 * 3 + 1] +
          vertices[inner2 * 3 + 1] +
          vertices[outer2 * 3 + 1]) /
        4,
      z:
        (vertices[inner1 * 3 + 2] +
          vertices[outer1 * 3 + 2] +
          vertices[inner2 * 3 + 2] +
          vertices[outer2 * 3 + 2]) /
        4,
    };

    let nearestHole = -1;
    let minDist = Infinity;

    for (let h = 0; h < boltHoles.length; h++) {
      const dist = Math.sqrt(
        (quadCenter.y - boltHoles[h].y) ** 2 + (quadCenter.z - boltHoles[h].z) ** 2,
      );

      if (dist < boltHoleRadius * 3 && dist < minDist) {
        nearestHole = h;
        minDist = dist;
      }
    }

    if (nearestHole >= 0) {
      // This quad is near a hole - connect around it
      const holeStart = holeStartIndices[nearestHole];

      // Connect vertices to hole boundary
      // Determine which quadrant each vertex is in relative to the hole
      const holeCenter = boltHoles[nearestHole];

      for (let hv = 0; hv < holeVerticesPerHole; hv++) {
        const holeVertex = holeStart + hv;
        const nextHoleVertex = holeStart + ((hv + 1) % holeVerticesPerHole);

        // Get angle of this hole vertex
        const hvY = vertices[holeVertex * 3 + 1];
        const hvZ = vertices[holeVertex * 3 + 2];
        const hvAngle = Math.atan2(hvZ - holeCenter.z, hvY - holeCenter.y);
        const normalizedAngle = hvAngle < 0 ? hvAngle + 2 * Math.PI : hvAngle;

        // Connect to appropriate quad vertices based on angle
        if (normalizedAngle < Math.PI / 2) {
          // Top-right quadrant - connect to outer2
          if (hv < holeVerticesPerHole / 4) {
            indices.push(outer2, holeVertex, nextHoleVertex);
          }
        } else if (normalizedAngle < Math.PI) {
          // Top-left quadrant - connect to inner2
          if (hv >= holeVerticesPerHole / 4 && hv < holeVerticesPerHole / 2) {
            indices.push(inner2, holeVertex, nextHoleVertex);
          }
        } else if (normalizedAngle < (3 * Math.PI) / 2) {
          // Bottom-left quadrant - connect to inner1
          if (hv >= holeVerticesPerHole / 2 && hv < (3 * holeVerticesPerHole) / 4) {
            indices.push(inner1, holeVertex, nextHoleVertex);
          }
        } else {
          // Bottom-right quadrant - connect to outer1
          if (hv >= (3 * holeVerticesPerHole) / 4) {
            indices.push(outer1, holeVertex, nextHoleVertex);
          }
        }
      }

      // Add corner triangles to complete the mesh around the hole
      indices.push(inner1, outer1, holeStart + holeVerticesPerHole - 1);
      indices.push(inner2, holeStart + holeVerticesPerHole / 2 - 1, outer2);
      indices.push(outer1, holeStart + holeVerticesPerHole / 4 - 1, outer2);
      indices.push(inner1, holeStart + (3 * holeVerticesPerHole) / 4 - 1, inner2);
    } else {
      // No hole nearby - create normal quad
      indices.push(inner1, outer1, inner2);
      indices.push(inner2, outer1, outer2);
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

      // Bottom edge
      for (let i = 0; i <= pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: -halfWidth + t * 2 * halfWidth,
          z: -halfHeight,
        });
      }

      // Right edge
      for (let i = 1; i <= pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: halfWidth,
          z: -halfHeight + t * 2 * halfHeight,
        });
      }

      // Top edge
      for (let i = 1; i <= pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: halfWidth - t * 2 * halfWidth,
          z: halfHeight,
        });
      }

      // Left edge
      for (let i = 1; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          y: -halfWidth,
          z: halfHeight - t * 2 * halfHeight,
        });
      }

      // Ensure we have exactly 'resolution' points
      while (points.length < resolution) {
        points.push(points[points.length - 1]);
      }
      while (points.length > resolution) {
        points.pop();
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
