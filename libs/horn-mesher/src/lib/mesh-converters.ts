import type { MeshData, ElmerMeshData } from "@horn-sim/types";
import type { ThreeMeshData } from "./types";
import { meshToSTL, createSTLBlob, downloadSTL } from "./stl-exporter";

/**
 * Convert mesh data to Three.js format
 */
export function meshToThree(mesh: MeshData): ThreeMeshData {
  return {
    positions: mesh.vertices,
    indices: mesh.indices,
    normals: mesh.normals || new Float32Array(mesh.vertices.length),
  };
}

/**
 * Convert mesh data to Gmsh format string
 */
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

/**
 * Convert mesh data to Elmer format
 */
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

// Re-export STL conversion functions
export { meshToSTL, createSTLBlob, downloadSTL };
