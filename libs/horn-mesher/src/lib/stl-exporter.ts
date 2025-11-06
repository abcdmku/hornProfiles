import type { MeshData } from "@horn-sim/types";

/**
 * Convert MeshData to binary STL format
 * Binary STL structure:
 * - 80-byte header
 * - 4-byte unsigned int: number of triangles
 * - For each triangle:
 *   - 12 bytes: normal vector (3 floats)
 *   - 12 bytes: vertex 1 (3 floats)
 *   - 12 bytes: vertex 2 (3 floats)
 *   - 12 bytes: vertex 3 (3 floats)
 *   - 2 bytes: attribute byte count (usually 0)
 */
export function meshToSTL(mesh: MeshData): ArrayBuffer {
  const triangleCount = mesh.indices.length / 3;

  // STL binary format:
  // 80 bytes header + 4 bytes count + (50 bytes * triangles)
  const bufferSize = 80 + 4 + triangleCount * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Write header (80 bytes) - can be any text, typically zeros or a description
  const header = "Binary STL exported from Horn Profile Viewer";
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(header);
  for (let i = 0; i < Math.min(80, headerBytes.length); i++) {
    view.setUint8(i, headerBytes[i]);
  }

  // Write triangle count (4 bytes, little-endian uint32)
  view.setUint32(80, triangleCount, true);

  // Write triangles
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const idx0 = mesh.indices[i * 3] * 3;
    const idx1 = mesh.indices[i * 3 + 1] * 3;
    const idx2 = mesh.indices[i * 3 + 2] * 3;

    // Get vertices
    const v0 = [mesh.vertices[idx0], mesh.vertices[idx0 + 1], mesh.vertices[idx0 + 2]];
    const v1 = [mesh.vertices[idx1], mesh.vertices[idx1 + 1], mesh.vertices[idx1 + 2]];
    const v2 = [mesh.vertices[idx2], mesh.vertices[idx2 + 1], mesh.vertices[idx2 + 2]];

    // Calculate normal from vertices (right-hand rule)
    // edge1 = v1 - v0, edge2 = v2 - v0, normal = edge1 × edge2
    const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

    const nx = edge1[1] * edge2[2] - edge1[2] * edge2[1];
    const ny = edge1[2] * edge2[0] - edge1[0] * edge2[2];
    const nz = edge1[0] * edge2[1] - edge1[1] * edge2[0];

    // Normalize
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const normal = len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 1];

    // Write normal (12 bytes)
    view.setFloat32(offset, normal[0], true);
    view.setFloat32(offset + 4, normal[1], true);
    view.setFloat32(offset + 8, normal[2], true);
    offset += 12;

    // Write vertex 1 (12 bytes)
    view.setFloat32(offset, v0[0], true);
    view.setFloat32(offset + 4, v0[1], true);
    view.setFloat32(offset + 8, v0[2], true);
    offset += 12;

    // Write vertex 2 (12 bytes)
    view.setFloat32(offset, v1[0], true);
    view.setFloat32(offset + 4, v1[1], true);
    view.setFloat32(offset + 8, v1[2], true);
    offset += 12;

    // Write vertex 3 (12 bytes)
    view.setFloat32(offset, v2[0], true);
    view.setFloat32(offset + 4, v2[1], true);
    view.setFloat32(offset + 8, v2[2], true);
    offset += 12;

    // Write attribute byte count (2 bytes) - typically 0
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Create a downloadable STL blob from mesh data
 */
export function createSTLBlob(mesh: MeshData): Blob {
  const buffer = meshToSTL(mesh);
  return new Blob([buffer], { type: "application/sla" });
}

/**
 * Trigger browser download of STL file
 */
export function downloadSTL(mesh: MeshData, filename = "horn-mesh.stl"): void {
  const blob = createSTLBlob(mesh);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}
