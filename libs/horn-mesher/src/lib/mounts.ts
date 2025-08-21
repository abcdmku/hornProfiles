import type {
  DriverMountConfig,
  HornMountConfig,
  MeshData,
  CrossSectionMode,
} from "@horn-sim/types";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Point2D {
  x: number;
  y: number;
}

// Calculate bolt positions on a circle
function calculateBoltPositions(
  centerX: number,
  centerY: number,
  radius: number,
  count: number,
  startAngle = 0,
): Point2D[] {
  const positions: Point2D[] = [];
  const angleStep = (2 * Math.PI) / count;

  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep;
    positions.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
  return positions;
}

// Check if a point is inside any of the holes
function isPointInHoles(point: Point2D, holePositions: Point2D[], holeRadius: number): boolean {
  for (const holePos of holePositions) {
    const dx = point.x - holePos.x;
    const dy = point.y - holePos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= holeRadius * holeRadius) {
      return true;
    }
  }
  return false;
}

// Generate vertices for an annular surface (ring) with bolt holes
function createAnnularSurfaceWithHoles(
  innerRadius: number,
  outerRadius: number,
  holePositions: Point2D[],
  holeRadius: number,
  resolution: number,
  xPosition = 0,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // We'll create a grid of points and triangulate them
  // avoiding the hole areas

  const radialSteps = Math.max(8, Math.floor((outerRadius - innerRadius) / 10));
  const angularSteps = resolution;

  // Generate grid vertices
  const gridVertices: Point3D[][] = [];

  for (let r = 0; r <= radialSteps; r++) {
    const radius = innerRadius + (outerRadius - innerRadius) * (r / radialSteps);
    const ringVerts: Point3D[] = [];

    for (let a = 0; a < angularSteps; a++) {
      const angle = (a / angularSteps) * 2 * Math.PI;
      const y = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);

      ringVerts.push({
        x: xPosition,
        y: y,
        z: z,
      });
    }
    gridVertices.push(ringVerts);
  }

  // Also add vertices around each hole for better triangulation
  const holeVerticesSets: Point3D[][] = [];
  const holeResolution = 16; // Good resolution for smooth holes

  for (const holePos of holePositions) {
    const holeVerts: Point3D[] = [];
    const angleStep = (2 * Math.PI) / holeResolution;

    for (let i = 0; i < holeResolution; i++) {
      const angle = i * angleStep;
      holeVerts.push({
        x: xPosition,
        y: holePos.x + holeRadius * Math.cos(angle),
        z: holePos.y + holeRadius * Math.sin(angle),
      });
    }
    holeVerticesSets.push(holeVerts);
  }

  // Build vertex array and mapping
  let vertexIndex = 0;

  // Add grid vertices (excluding those inside holes)
  const gridIndices: (number | null)[][] = [];

  for (let r = 0; r <= radialSteps; r++) {
    const ringIndices: (number | null)[] = [];

    for (let a = 0; a < angularSteps; a++) {
      const v = gridVertices[r][a];
      const point2D = { x: v.y, y: v.z };

      if (!isPointInHoles(point2D, holePositions, holeRadius * 1.1)) {
        // Point is not inside a hole, add it
        vertices.push(v.x, v.y, v.z);
        normals.push(-1, 0, 0);
        ringIndices.push(vertexIndex);
        vertexIndex++;
      } else {
        // Point is inside a hole, mark as null
        ringIndices.push(null);
      }
    }
    gridIndices.push(ringIndices);
  }

  // Add hole boundary vertices
  const holeStartIndices: number[] = [];
  for (const holeVerts of holeVerticesSets) {
    holeStartIndices.push(vertexIndex);
    for (const v of holeVerts) {
      vertices.push(v.x, v.y, v.z);
      normals.push(-1, 0, 0);
      vertexIndex++;
    }
  }

  // Create triangulation between grid points
  for (let r = 0; r < radialSteps; r++) {
    for (let a = 0; a < angularSteps; a++) {
      const nextA = (a + 1) % angularSteps;

      const v00 = gridIndices[r][a];
      const v01 = gridIndices[r][nextA];
      const v10 = gridIndices[r + 1][a];
      const v11 = gridIndices[r + 1][nextA];

      // Only create triangles if all vertices exist (not in holes)
      if (v00 !== null && v01 !== null && v10 !== null) {
        // Check if triangle center is not in a hole
        const centerY =
          (gridVertices[r][a].y + gridVertices[r][nextA].y + gridVertices[r + 1][a].y) / 3;
        const centerZ =
          (gridVertices[r][a].z + gridVertices[r][nextA].z + gridVertices[r + 1][a].z) / 3;

        if (!isPointInHoles({ x: centerY, y: centerZ }, holePositions, holeRadius * 0.9)) {
          indices.push(v00, v10, v01);
        }
      }

      if (v01 !== null && v10 !== null && v11 !== null) {
        // Check if triangle center is not in a hole
        const centerY =
          (gridVertices[r][nextA].y + gridVertices[r + 1][a].y + gridVertices[r + 1][nextA].y) / 3;
        const centerZ =
          (gridVertices[r][nextA].z + gridVertices[r + 1][a].z + gridVertices[r + 1][nextA].z) / 3;

        if (!isPointInHoles({ x: centerY, y: centerZ }, holePositions, holeRadius * 0.9)) {
          indices.push(v01, v10, v11);
        }
      }
    }
  }

  // Connect hole boundaries to the surrounding mesh
  // For each hole, we'll connect nearby grid vertices to the hole boundary
  for (let h = 0; h < holePositions.length; h++) {
    const holeStart = holeStartIndices[h];
    const holePos = holePositions[h];

    // Create a list of grid vertices that are near this hole
    const nearbyGridVerts: { idx: number; angle: number; dist: number }[] = [];

    for (let r = 0; r <= radialSteps; r++) {
      for (let a = 0; a < angularSteps; a++) {
        const gridIdx = gridIndices[r][a];
        if (gridIdx !== null) {
          const gridV = gridVertices[r][a];
          const dx = gridV.y - holePos.x;
          const dy = gridV.z - holePos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // If this vertex is near the hole edge
          if (dist > holeRadius * 1.2 && dist < holeRadius * 2.5) {
            const angle = Math.atan2(dy, dx);
            nearbyGridVerts.push({
              idx: gridIdx,
              angle: angle < 0 ? angle + 2 * Math.PI : angle,
              dist: dist,
            });
          }
        }
      }
    }

    // Sort nearby vertices by angle
    nearbyGridVerts.sort((a, b) => a.angle - b.angle);

    // Connect hole boundary to nearby grid vertices
    if (nearbyGridVerts.length > 0) {
      for (let i = 0; i < holeResolution; i++) {
        const holeV = holeStart + i;
        const nextHoleV = holeStart + ((i + 1) % holeResolution);

        // Find the angle of this hole vertex
        const holeAngle = i * ((2 * Math.PI) / holeResolution);

        // Find the closest grid vertex by angle
        let closestGrid = nearbyGridVerts[0];
        let minAngleDiff = Math.PI * 2;

        for (const gridVert of nearbyGridVerts) {
          const angleDiff = Math.abs(gridVert.angle - holeAngle);
          const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
          if (normalizedDiff < minAngleDiff) {
            minAngleDiff = normalizedDiff;
            closestGrid = gridVert;
          }
        }

        // Create triangles connecting hole edge to grid
        if (minAngleDiff < Math.PI / 4) {
          // Only connect if angles are close
          indices.push(holeV, closestGrid.idx, nextHoleV);
        }
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// Generate driver mount mesh (circular outer edge, throat-shaped inner edge)
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

  // Calculate bolt positions on a circle
  const boltPositions = calculateBoltPositions(
    0,
    0,
    config.boltCircleDiameter / 2,
    config.boltCount,
  );

  // Generate inner edge vertices matching throat shape
  const innerVertices: Point3D[] = [];

  if (throatMode === "circle") {
    const radius = throatWidth / 2;
    for (let i = 0; i < resolution; i++) {
      const angle = (i / resolution) * 2 * Math.PI;
      innerVertices.push({
        x: throatPosition,
        y: radius * Math.cos(angle),
        z: radius * Math.sin(angle),
      });
    }
  } else if (throatMode === "ellipse") {
    for (let i = 0; i < resolution; i++) {
      const angle = (i / resolution) * 2 * Math.PI;
      innerVertices.push({
        x: throatPosition,
        y: (throatWidth / 2) * Math.cos(angle),
        z: (throatHeight / 2) * Math.sin(angle),
      });
    }
  } else if (throatMode === "rectangular") {
    // Create rectangular inner edge
    const halfW = throatWidth / 2;
    const halfH = throatHeight / 2;
    const pointsPerSide = Math.floor(resolution / 4);

    // Bottom edge
    for (let i = 0; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: throatPosition,
        y: -halfW + t * 2 * halfW,
        z: -halfH,
      });
    }
    // Right edge
    for (let i = 1; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: throatPosition,
        y: halfW,
        z: -halfH + t * 2 * halfH,
      });
    }
    // Top edge
    for (let i = 1; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: throatPosition,
        y: halfW - t * 2 * halfW,
        z: halfH,
      });
    }
    // Left edge
    for (let i = 1; i < pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: throatPosition,
        y: -halfW,
        z: halfH - t * 2 * halfH,
      });
    }
  }

  // Generate outer edge vertices (always circular)
  const outerVertices: Point3D[] = [];
  const outerRadius = config.outerDiameter / 2;

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;
    outerVertices.push({
      x: throatPosition,
      y: outerRadius * Math.cos(angle),
      z: outerRadius * Math.sin(angle),
    });
  }

  // Build mesh with proper hole cutouts
  let vertexIndex = 0;

  // Add inner vertices
  const innerStartIndex = vertexIndex;
  for (const v of innerVertices) {
    vertices.push(v.x, v.y, v.z);
    normals.push(-1, 0, 0);
    vertexIndex++;
  }

  // Add outer vertices
  const outerStartIndex = vertexIndex;
  for (const v of outerVertices) {
    vertices.push(v.x, v.y, v.z);
    normals.push(-1, 0, 0);
    vertexIndex++;
  }

  // Add vertices around each bolt hole
  const holeStartIndices: number[] = [];
  const holeResolution = 16;

  for (const holePos of boltPositions) {
    holeStartIndices.push(vertexIndex);
    for (let i = 0; i < holeResolution; i++) {
      const angle = (i / holeResolution) * 2 * Math.PI;
      vertices.push(
        throatPosition,
        holePos.x + (config.boltHoleDiameter / 2) * Math.cos(angle),
        holePos.y + (config.boltHoleDiameter / 2) * Math.sin(angle),
      );
      normals.push(-1, 0, 0);
      vertexIndex++;
    }
  }

  // Create triangulation
  const innerCount = innerVertices.length;
  const outerCount = outerVertices.length;

  // Simple triangulation between inner and outer edges
  // This needs to handle different vertex counts for rect vs circle
  if (innerCount === outerCount) {
    // Same number of vertices, simple connection
    for (let i = 0; i < innerCount; i++) {
      const nextI = (i + 1) % innerCount;

      const innerV = innerStartIndex + i;
      const innerNextV = innerStartIndex + nextI;
      const outerV = outerStartIndex + i;
      const outerNextV = outerStartIndex + nextI;

      // Check if this quad would intersect a bolt hole
      const quadCenter = {
        x:
          (innerVertices[i].y +
            innerVertices[nextI].y +
            outerVertices[i].y +
            outerVertices[nextI].y) /
          4,
        y:
          (innerVertices[i].z +
            innerVertices[nextI].z +
            outerVertices[i].z +
            outerVertices[nextI].z) /
          4,
      };

      if (!isPointInHoles(quadCenter, boltPositions, (config.boltHoleDiameter / 2) * 1.2)) {
        indices.push(innerV, outerV, outerNextV);
        indices.push(innerV, outerNextV, innerNextV);
      }
    }
  } else {
    // Different vertex counts, need more complex triangulation
    // For now, use a simple radial connection
    // This is a simplified approach - could be improved
    for (let i = 0; i < outerCount; i++) {
      const nextI = (i + 1) % outerCount;
      const innerI = Math.floor((i / outerCount) * innerCount);
      const innerNextI = Math.floor(((i + 1) / outerCount) * innerCount) % innerCount;

      const innerV = innerStartIndex + innerI;
      const innerNextV = innerStartIndex + innerNextI;
      const outerV = outerStartIndex + i;
      const outerNextV = outerStartIndex + nextI;

      indices.push(innerV, outerV, outerNextV);
      if (innerNextI !== innerI) {
        indices.push(innerV, outerNextV, innerNextV);
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// Generate horn mount mesh (flange at mouth with extension)
export function generateHornMount(
  mouthPosition: number,
  mouthWidth: number,
  mouthHeight: number,
  mode: CrossSectionMode,
  config: HornMountConfig,
  resolution: number,
): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  // Calculate extended dimensions
  const extendedWidth = mouthWidth + config.widthExtension * 2;
  const extendedHeight = mouthHeight + config.widthExtension * 2;

  // For rectangular/elliptical mouths, calculate perimeter for bolt spacing
  let perimeter: number;
  if (mode === "rectangular") {
    perimeter = 2 * (extendedWidth + extendedHeight);
  } else {
    // Approximate perimeter for ellipse/circle
    const a = extendedWidth / 2;
    const b = extendedHeight / 2;
    // Ramanujan's approximation
    perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }

  // Calculate number of bolts based on spacing
  const boltCount = Math.max(4, Math.floor(perimeter / config.boltSpacing));

  // Calculate bolt positions evenly spaced around the perimeter
  const boltPositions: Point2D[] = [];
  if (mode === "circle" || mode === "ellipse") {
    // For circular/elliptical mounts, place bolts on an ellipse
    const boltRadiusX = (mouthWidth + config.widthExtension) / 2;
    const boltRadiusY = (mouthHeight + config.widthExtension) / 2;

    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * 2 * Math.PI;
      boltPositions.push({
        x: boltRadiusX * Math.cos(angle),
        y: boltRadiusY * Math.sin(angle),
      });
    }
  } else if (mode === "rectangular") {
    // For rectangular mounts, distribute bolts around the perimeter
    const halfW = (mouthWidth + config.widthExtension) / 2;
    const halfH = (mouthHeight + config.widthExtension) / 2;
    const perimeterStep = perimeter / boltCount;

    for (let i = 0; i < boltCount; i++) {
      const distance = i * perimeterStep;

      // Calculate position along perimeter
      let x = 0,
        y = 0;
      if (distance < extendedWidth) {
        // Bottom edge
        x = -halfW + distance;
        y = -halfH;
      } else if (distance < extendedWidth + extendedHeight) {
        // Right edge
        x = halfW;
        y = -halfH + (distance - extendedWidth);
      } else if (distance < 2 * extendedWidth + extendedHeight) {
        // Top edge
        x = halfW - (distance - extendedWidth - extendedHeight);
        y = halfH;
      } else {
        // Left edge
        x = -halfW;
        y = halfH - (distance - 2 * extendedWidth - extendedHeight);
      }

      boltPositions.push({ x, y });
    }
  }

  // Generate mount surface vertices based on mode
  if (mode === "circle" || mode === "ellipse") {
    // If it's actually circular (not elliptical), use the annular surface function
    if (
      Math.abs(mouthWidth - mouthHeight) < 0.01 &&
      Math.abs(extendedWidth - extendedHeight) < 0.01
    ) {
      // Use the annular surface with holes for true circles
      return createAnnularSurfaceWithHoles(
        mouthWidth / 2,
        extendedWidth / 2,
        boltPositions,
        config.boltHoleDiameter / 2,
        resolution,
        mouthPosition,
      );
    }

    // For elliptical shapes, we need custom handling
    const innerVertices: Point3D[] = [];
    const outerVertices: Point3D[] = [];
    const angleStep = (2 * Math.PI) / resolution;

    for (let i = 0; i < resolution; i++) {
      const angle = i * angleStep;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Inner edge (mouth shape)
      innerVertices.push({
        x: mouthPosition,
        y: (mouthWidth / 2) * cos,
        z: (mouthHeight / 2) * sin,
      });

      // Outer edge (extended)
      outerVertices.push({
        x: mouthPosition,
        y: (extendedWidth / 2) * cos,
        z: (extendedHeight / 2) * sin,
      });
    }

    // Add vertices and create triangulation
    let vertexIndex = 0;

    // Add inner vertices
    const innerStartIndex = vertexIndex;
    for (const v of innerVertices) {
      vertices.push(v.x, v.y, v.z);
      normals.push(1, 0, 0); // Normal pointing forward (away from horn)
      vertexIndex++;
    }

    // Add outer vertices (excluding those inside holes)
    const outerIndices: (number | null)[] = [];

    for (const v of outerVertices) {
      const point2D = { x: v.y, y: v.z };
      if (!isPointInHoles(point2D, boltPositions, (config.boltHoleDiameter / 2) * 1.1)) {
        vertices.push(v.x, v.y, v.z);
        normals.push(1, 0, 0);
        outerIndices.push(vertexIndex);
        vertexIndex++;
      } else {
        outerIndices.push(null);
      }
    }

    // Create triangulation avoiding holes
    for (let i = 0; i < resolution; i++) {
      const nextI = (i + 1) % resolution;

      const outerI = outerIndices[i];
      const outerNextI = outerIndices[nextI];

      if (outerI !== null && outerNextI !== null) {
        // Check if the triangle center is not in a hole
        const centerY = (innerVertices[i].y + outerVertices[i].y + outerVertices[nextI].y) / 3;
        const centerZ = (innerVertices[i].z + outerVertices[i].z + outerVertices[nextI].z) / 3;

        if (
          !isPointInHoles(
            { x: centerY, y: centerZ },
            boltPositions,
            (config.boltHoleDiameter / 2) * 0.9,
          )
        ) {
          // Triangle 1
          indices.push(innerStartIndex + i, outerNextI, outerI);

          // Triangle 2
          indices.push(innerStartIndex + i, innerStartIndex + nextI, outerNextI);
        }
      }
    }
  } else if (mode === "rectangular") {
    // Create rectangular mount
    // Define corners for inner and outer rectangles
    const innerHalfW = mouthWidth / 2;
    const innerHalfH = mouthHeight / 2;
    const outerHalfW = extendedWidth / 2;
    const outerHalfH = extendedHeight / 2;

    // Create vertices along the perimeter
    const pointsPerSide = Math.floor(resolution / 4);
    const innerVertices: Point3D[] = [];
    const outerVertices: Point3D[] = [];

    // Generate vertices for each side
    // Bottom side
    for (let i = 0; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: mouthPosition,
        y: -innerHalfW + t * 2 * innerHalfW,
        z: -innerHalfH,
      });
      outerVertices.push({
        x: mouthPosition,
        y: -outerHalfW + t * 2 * outerHalfW,
        z: -outerHalfH,
      });
    }

    // Right side
    for (let i = 1; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: mouthPosition,
        y: innerHalfW,
        z: -innerHalfH + t * 2 * innerHalfH,
      });
      outerVertices.push({
        x: mouthPosition,
        y: outerHalfW,
        z: -outerHalfH + t * 2 * outerHalfH,
      });
    }

    // Top side
    for (let i = 1; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: mouthPosition,
        y: innerHalfW - t * 2 * innerHalfW,
        z: innerHalfH,
      });
      outerVertices.push({
        x: mouthPosition,
        y: outerHalfW - t * 2 * outerHalfW,
        z: outerHalfH,
      });
    }

    // Left side
    for (let i = 1; i < pointsPerSide; i++) {
      const t = i / pointsPerSide;
      innerVertices.push({
        x: mouthPosition,
        y: -innerHalfW,
        z: innerHalfH - t * 2 * innerHalfH,
      });
      outerVertices.push({
        x: mouthPosition,
        y: -outerHalfW,
        z: outerHalfH - t * 2 * outerHalfH,
      });
    }

    // Add vertices and create triangulation
    let vertexIndex = 0;

    // Add inner vertices
    const innerStartIndex = vertexIndex;
    for (const v of innerVertices) {
      vertices.push(v.x, v.y, v.z);
      normals.push(1, 0, 0);
      vertexIndex++;
    }

    // Add outer vertices (check if they're inside bolt holes)
    const outerIndices: (number | null)[] = [];

    for (const v of outerVertices) {
      const point2D = { x: v.y, y: v.z };
      if (!isPointInHoles(point2D, boltPositions, (config.boltHoleDiameter / 2) * 1.1)) {
        vertices.push(v.x, v.y, v.z);
        normals.push(1, 0, 0);
        outerIndices.push(vertexIndex);
        vertexIndex++;
      } else {
        outerIndices.push(null);
      }
    }

    // Add bolt hole boundary vertices
    const holeStartIndices: number[] = [];
    const holeResolution = 16;

    for (const holePos of boltPositions) {
      holeStartIndices.push(vertexIndex);
      for (let i = 0; i < holeResolution; i++) {
        const angle = (i / holeResolution) * 2 * Math.PI;
        vertices.push(
          mouthPosition,
          holePos.x + (config.boltHoleDiameter / 2) * Math.cos(angle),
          holePos.y + (config.boltHoleDiameter / 2) * Math.sin(angle),
        );
        normals.push(1, 0, 0);
        vertexIndex++;
      }
    }

    // Create triangulation avoiding holes
    const totalVerts = innerVertices.length;
    for (let i = 0; i < totalVerts; i++) {
      const nextI = (i + 1) % totalVerts;

      if (outerIndices[i] !== null && outerIndices[nextI] !== null) {
        // Check if triangle center is not in a hole
        const centerY = (innerVertices[i].y + outerVertices[i].y + outerVertices[nextI].y) / 3;
        const centerZ = (innerVertices[i].z + outerVertices[i].z + outerVertices[nextI].z) / 3;

        if (
          !isPointInHoles(
            { x: centerY, y: centerZ },
            boltPositions,
            (config.boltHoleDiameter / 2) * 0.9,
          )
        ) {
          // Triangle 1
          indices.push(
            innerStartIndex + i,
            outerIndices[nextI] as number,
            outerIndices[i] as number,
          );

          // Triangle 2
          indices.push(innerStartIndex + i, innerStartIndex + nextI, outerIndices[nextI] as number);
        }
      }
    }
  }

  // Note: Bolt holes are simplified here - in production, would need proper
  // triangulation that excludes hole areas

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

// Merge multiple mesh data into a single mesh
export function mergeMeshData(meshes: MeshData[]): MeshData {
  // Calculate total sizes
  let totalVertices = 0;
  let totalIndices = 0;

  for (const mesh of meshes) {
    totalVertices += mesh.vertices.length;
    totalIndices += mesh.indices.length;
  }

  // Allocate arrays
  const mergedVertices = new Float32Array(totalVertices);
  const mergedIndices = new Uint32Array(totalIndices);
  const mergedNormals = new Float32Array(totalVertices);

  // Merge meshes
  let vertexOffset = 0;
  let indexOffset = 0;
  let vertexIndexOffset = 0;

  for (const mesh of meshes) {
    // Copy vertices
    mergedVertices.set(mesh.vertices, vertexOffset);

    // Copy normals if present
    if (mesh.normals) {
      mergedNormals.set(mesh.normals, vertexOffset);
    }

    // Copy indices with offset
    for (let i = 0; i < mesh.indices.length; i++) {
      mergedIndices[indexOffset + i] = mesh.indices[i] + vertexIndexOffset;
    }

    // Update offsets
    vertexOffset += mesh.vertices.length;
    indexOffset += mesh.indices.length;
    vertexIndexOffset += mesh.vertices.length / 3; // 3 components per vertex
  }

  return {
    vertices: mergedVertices,
    indices: mergedIndices,
    normals: mergedNormals,
  };
}
