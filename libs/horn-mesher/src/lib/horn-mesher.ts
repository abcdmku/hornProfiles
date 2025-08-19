import type {
  ProfileXY,
  CrossSectionMode,
  MeshData,
  ElmerMeshData,
  HornGeometry,
} from "@horn-sim/types";

export interface MeshGenerationOptions {
  resolution: number;
  elementSize: number;
  curvatureRefine?: boolean;
}

export function generateHornMesh2D(profile: ProfileXY, options: MeshGenerationOptions): MeshData {
  const { resolution = 50 } = options;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const thetaSteps = resolution;
  const profileSteps = profile.length;

  for (let i = 0; i < profileSteps; i++) {
    const point = profile[i];
    const radius = point.y;

    for (let j = 0; j <= thetaSteps; j++) {
      const theta = (j / thetaSteps) * 2 * Math.PI;
      const x = point.x;
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);

      vertices.push(x, y, z);

      const nx = 0;
      const ny = Math.cos(theta);
      const nz = Math.sin(theta);
      normals.push(nx, ny, nz);
    }
  }

  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < thetaSteps; j++) {
      const a = i * (thetaSteps + 1) + j;
      const b = a + 1;
      const c = a + thetaSteps + 1;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

export function generateHornMesh3D(
  geometry: HornGeometry,
  options: MeshGenerationOptions,
): MeshData {
  const { mode, profile, widthProfile, heightProfile } = geometry;

  if (mode === "circle" && !widthProfile && !heightProfile) {
    return generateHornMesh2D(profile, options);
  }

  const { resolution = 50 } = options;
  const vertices: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  const circumferenceSteps = resolution;
  const profileSteps = profile.length;

  for (let i = 0; i < profileSteps; i++) {
    const point = profile[i];
    const x = point.x;
    const baseRadius = point.y;

    // Use profile-specific dimensions if available
    const width = widthProfile ? widthProfile[i].y * 2 : geometry.width;
    const height = heightProfile ? heightProfile[i].y * 2 : geometry.height;

    const crossSection = generateCrossSection(mode, baseRadius, width, height, circumferenceSteps);

    for (const csPoint of crossSection) {
      vertices.push(x, csPoint.y, csPoint.z);
      const len = Math.sqrt(csPoint.y * csPoint.y + csPoint.z * csPoint.z);
      normals.push(0, csPoint.y / len, csPoint.z / len);
    }
  }

  for (let i = 0; i < profileSteps - 1; i++) {
    for (let j = 0; j < circumferenceSteps; j++) {
      const a = i * circumferenceSteps + j;
      const b = i * circumferenceSteps + ((j + 1) % circumferenceSteps);
      const c = (i + 1) * circumferenceSteps + j;
      const d = (i + 1) * circumferenceSteps + ((j + 1) % circumferenceSteps);

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
  };
}

function generateCrossSection(
  mode: CrossSectionMode,
  radius: number,
  width?: number,
  height?: number,
  steps: number = 50,
): Array<{ y: number; z: number }> {
  const points: Array<{ y: number; z: number }> = [];

  switch (mode) {
    case "circle": {
      for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        points.push({
          y: radius * Math.cos(theta),
          z: radius * Math.sin(theta),
        });
      }
      break;
    }

    case "ellipse": {
      const a = width ? width / 2 : radius;
      const b = height ? height / 2 : radius;
      for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        points.push({
          y: a * Math.cos(theta),
          z: b * Math.sin(theta),
        });
      }
      break;
    }

    case "rectangular": {
      const w = width || radius * 2;
      const h = height || radius * 2;

      // We need exactly 'steps' points to match the mesh index generation
      // Reserve 4 points for corners, distribute the rest along edges
      const cornersCount = 4;
      const edgePoints = Math.max(0, steps - cornersCount);

      // Distribute edge points proportionally to edge length
      const perimeter = 2 * (w + h);
      const wRatio = w / perimeter;
      const hRatio = h / perimeter;

      // Calculate points per edge (excluding corners)
      const bottomEdgePoints = Math.round(edgePoints * wRatio);
      const rightEdgePoints = Math.round(edgePoints * hRatio);
      const topEdgePoints = Math.round(edgePoints * wRatio);
      const leftEdgePoints = edgePoints - bottomEdgePoints - rightEdgePoints - topEdgePoints;

      // Bottom-left corner
      points.push({ y: -w / 2, z: -h / 2 });

      // Bottom edge (excluding corners)
      for (let i = 1; i <= bottomEdgePoints; i++) {
        const t = i / (bottomEdgePoints + 1);
        points.push({
          y: -w / 2 + t * w,
          z: -h / 2,
        });
      }

      // Bottom-right corner
      points.push({ y: w / 2, z: -h / 2 });

      // Right edge (excluding corners)
      for (let i = 1; i <= rightEdgePoints; i++) {
        const t = i / (rightEdgePoints + 1);
        points.push({
          y: w / 2,
          z: -h / 2 + t * h,
        });
      }

      // Top-right corner
      points.push({ y: w / 2, z: h / 2 });

      // Top edge (excluding corners)
      for (let i = 1; i <= topEdgePoints; i++) {
        const t = i / (topEdgePoints + 1);
        points.push({
          y: w / 2 - t * w,
          z: h / 2,
        });
      }

      // Top-left corner
      points.push({ y: -w / 2, z: h / 2 });

      // Left edge (excluding corners)
      for (let i = 1; i <= leftEdgePoints; i++) {
        const t = i / (leftEdgePoints + 1);
        points.push({
          y: -w / 2,
          z: h / 2 - t * h,
        });
      }

      // Ensure we have exactly 'steps' points
      while (points.length < steps) {
        // Add a point on the longest edge if we're short
        points.push({ y: 0, z: -h / 2 });
      }

      // Trim if we have too many (shouldn't happen with the logic above)
      while (points.length > steps) {
        points.pop();
      }

      break;
    }

    case "superellipse": {
      const a = width ? width / 2 : radius;
      const b = height ? height / 2 : radius;
      const n = 2.5; // Superellipse parameter

      for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        const x = a * Math.sign(cosTheta) * Math.pow(Math.abs(cosTheta), 2 / n);
        const y = b * Math.sign(sinTheta) * Math.pow(Math.abs(sinTheta), 2 / n);

        points.push({ y: x, z: y });
      }
      break;
    }

    default:
      throw new Error(`Unsupported cross-section mode: ${mode}`);
  }

  return points;
}

export function meshToThree(mesh: MeshData): {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
} {
  return {
    positions: mesh.vertices,
    indices: mesh.indices,
    normals: mesh.normals || new Float32Array(mesh.vertices.length),
  };
}

export function meshToGmsh(mesh: MeshData): string {
  const lines: string[] = [];

  lines.push("$MeshFormat");
  lines.push("2.2 0 8");
  lines.push("$EndMeshFormat");

  lines.push("$Nodes");
  const numNodes = mesh.vertices.length / 3;
  lines.push(numNodes.toString());

  for (let i = 0; i < numNodes; i++) {
    const x = mesh.vertices[i * 3];
    const y = mesh.vertices[i * 3 + 1];
    const z = mesh.vertices[i * 3 + 2];
    lines.push(`${i + 1} ${x} ${y} ${z}`);
  }
  lines.push("$EndNodes");

  lines.push("$Elements");
  const numElements = mesh.indices.length / 3;
  lines.push(numElements.toString());

  for (let i = 0; i < numElements; i++) {
    const a = mesh.indices[i * 3] + 1;
    const b = mesh.indices[i * 3 + 1] + 1;
    const c = mesh.indices[i * 3 + 2] + 1;
    lines.push(`${i + 1} 2 2 0 1 ${a} ${b} ${c}`);
  }
  lines.push("$EndElements");

  return lines.join("\n");
}

export function meshToElmer(mesh: MeshData): ElmerMeshData {
  const nodes = [];
  const elements = [];
  const boundaries = [];

  const numNodes = mesh.vertices.length / 3;
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      id: i + 1,
      x: mesh.vertices[i * 3],
      y: mesh.vertices[i * 3 + 1],
      z: mesh.vertices[i * 3 + 2],
    });
  }

  const numElements = mesh.indices.length / 3;
  for (let i = 0; i < numElements; i++) {
    elements.push({
      id: i + 1,
      type: "triangle",
      nodes: [mesh.indices[i * 3] + 1, mesh.indices[i * 3 + 1] + 1, mesh.indices[i * 3 + 2] + 1],
      material: 1,
    });
  }

  boundaries.push({
    id: 1,
    name: "walls",
    elements: [],
  });

  boundaries.push({
    id: 2,
    name: "throat",
    elements: [],
  });

  boundaries.push({
    id: 3,
    name: "mouth",
    elements: [],
  });

  return {
    nodes,
    elements,
    boundaries,
  };
}
