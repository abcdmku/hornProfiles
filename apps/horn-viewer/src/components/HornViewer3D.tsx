import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { ProfileGeneratorResult } from "horn-profiles";
import { generateHornMesh3D, meshToThree } from "@horn-sim/mesher";
import type { HornGeometry } from "@horn-sim/types";

interface HornViewer3DProps {
  profileResult: ProfileGeneratorResult | null;
  mode?: "circle" | "ellipse" | "rectangular";
  wireframe?: boolean;
  autoRotate?: boolean;
}

function HornMesh({
  profileResult,
  mode = "circle",
  wireframe = false,
}: {
  profileResult: ProfileGeneratorResult;
  mode: "circle" | "ellipse" | "rectangular";
  wireframe: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const hornGeometry: HornGeometry = {
      mode,
      profile: profileResult.points,
      throatRadius: profileResult.metadata.parameters.throatRadius,
    };

    const meshData = generateHornMesh3D(hornGeometry, {
      resolution: 50,
      elementSize: 5,
    });

    const { positions, indices, normals } = meshToThree(meshData);

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    bufferGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    bufferGeometry.computeBoundingBox();

    return bufferGeometry;
  }, [profileResult, mode]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color="#4a90e2"
        wireframe={wireframe}
        side={THREE.DoubleSide}
        metalness={0.4}
        roughness={0.5}
      />
    </mesh>
  );
}

export const HornViewer3D: React.FC<HornViewer3DProps> = ({
  profileResult,
  mode = "circle",
  wireframe = false,
  autoRotate = true,
}) => {
  if (!profileResult) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <p className="text-gray-500">Generate a profile to view 3D model</p>
      </div>
    );
  }

  return (
    <div className="h-96 bg-gray-50 rounded-lg overflow-hidden">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[500, 300, 500]} fov={45} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
        />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <HornMesh profileResult={profileResult} mode={mode} wireframe={wireframe} />
        <Grid
          args={[1000, 1000]}
          cellSize={50}
          cellThickness={0.5}
          cellColor="#888888"
          sectionSize={200}
          sectionThickness={1}
          sectionColor="#666666"
          fadeDistance={2000}
          fadeStrength={1}
          position={[0, -profileResult.metadata.parameters.throatRadius, 0]}
        />
      </Canvas>
    </div>
  );
};
