import React, { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

interface HornViewer3DProps {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  wireframe?: boolean;
  showGrid?: boolean;
  gridPosition?: [number, number, number];
}

function Mesh({
  positions,
  indices,
  normals,
  wireframe = false,
}: {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  wireframe: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = React.useMemo(() => {
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    bufferGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    bufferGeometry.computeBoundingBox();
    return bufferGeometry;
  }, [positions, indices, normals]);

  // Remove automatic rotation
  // useFrame((_, delta) => {
  //   if (meshRef.current) {
  //     meshRef.current.rotation.y += delta * 0.2;
  //   }
  // });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color="#c4c7ff"
        wireframe={wireframe}
        side={THREE.DoubleSide}
        metalness={0.8}
        roughness={0.5}
      />
    </mesh>
  );
}

export const HornViewer3D: React.FC<HornViewer3DProps> = ({
  positions,
  indices,
  normals,
  wireframe = false,
  showGrid = true,
  gridPosition = [0, 0, 0],
}) => {
  return (
    <Canvas
      shadows
      camera={{ position: [500, 300, 800], fov: 65, near: 0.1, far: 1000000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <OrbitControls enableDamping dampingFactor={0.05} enableZoom={true} enablePan={true} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <Mesh positions={positions} indices={indices} normals={normals} wireframe={wireframe} />
      {showGrid && (
        <Grid
          args={[10000, 10000]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#303047"
          sectionSize={100}
          sectionThickness={1}
          sectionColor="#3d3e58"
          fadeDistance={3000}
          fadeStrength={1}
          position={gridPosition}
        />
      )}
    </Canvas>
  );
};
