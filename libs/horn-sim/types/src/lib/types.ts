export type ProfilePoint = { x: number; y: number }; // mm
export type ProfileXY = ProfilePoint[];

export type CrossSectionMode = "ellipse" | "superellipse" | "rectangular" | "stereographic";

export interface DriverMountConfig {
  enabled: boolean;
  outerDiameter: number; // mm
  boltHoleDiameter: number; // mm
  boltCircleDiameter: number; // mm
  boltCount: number; // Number of bolts
  thickness: number; // mm - mount thickness/offset from throat
}

export interface HornMountConfig {
  enabled: boolean;
  widthExtension: number; // mm added to mouth width
  boltSpacing: number; // max mm between bolts
  boltHoleDiameter: number; // mm
  thickness: number; // mm - mount thickness/offset from mouth
}

export interface MountOffsets {
  driverMountOffset?: number; // Distance from throat
  hornMountOffset?: number; // Distance from mouth
}

export interface ShapePoint {
  x: number; // Axial position
  shape: CrossSectionMode | "morphed";
  morphingFactor: number; // 0 = throat shape, 1 = mouth shape
  width: number;
  height: number;
}

export interface HornGeometry {
  mode: CrossSectionMode;
  profile: ProfileXY; // axial profile
  widthProfile?: ProfileXY; // separate width profile for non-circular horns
  heightProfile?: ProfileXY; // separate height profile for non-circular horns
  shapeProfile?: ShapePoint[]; // shape at each axial position for morphing
  width?: number; // mm, for non-circular mouths
  height?: number; // mm, for non-circular mouths
  throatRadius: number; // mm
  throatWidth?: number; // mm, throat width for non-circular throats
  throatHeight?: number; // mm, throat height for non-circular throats
  wallThickness?: number; // mm - horn wall thickness
  throatShape?: CrossSectionMode; // shape at throat
  mouthShape?: CrossSectionMode; // shape at mouth
  driverMount?: DriverMountConfig;
  hornMount?: HornMountConfig;
}

export interface SimulationParams {
  frequencies: number[]; // Hz
  driverPistonRadius: number; // mm
  medium: {
    rho: number; // air density kg/m³
    c: number; // speed of sound m/s
  };
  mesh: {
    elementSize: number; // mm
    curvatureRefine?: boolean;
  };
  directivity: {
    anglesDeg: number[]; // e.g. [-90..+90 step 5]
  };
}

export interface SimulationRequest {
  geometry: HornGeometry;
  params: SimulationParams;
}

export interface SimulationResult {
  requestHash: string;
  frequencies: number[];
  onAxisSPL: number[]; // dB re 20 µPa @ 1m
  polar: Record<number, number[]>; // anglesDeg -> SPL per freq
  impedance?: {
    Re: number[];
    Im: number[];
  };
  meta: {
    meshElements: number;
    runtimeMs: number;
    version: string;
  };
}

export interface JobStatus {
  jobId: string;
  status: "queued" | "running" | "done" | "error";
  result?: SimulationResult;
  error?: string;
  progress?: {
    stage: string;
    percentage: number;
  };
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
}

export interface ElmerMeshData {
  nodes: Array<{ id: number; x: number; y: number; z: number }>;
  elements: Array<{
    id: number;
    type: string;
    nodes: number[];
    material?: number;
  }>;
  boundaries: Array<{
    id: number;
    name: string;
    elements: number[];
  }>;
}

export interface SimulationConfig {
  workdirRoot?: string;
  storage?: StorageProvider;
  elmerBin?: {
    elmerGrid: string;
    elmerSolver: string;
  };
  gmshBin?: string;
  timeout?: number;
  maxConcurrency?: number;
}

export interface StorageProvider {
  exists(key: string): Promise<boolean>;
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export interface SimulationEvent {
  type: "queued" | "meshing" | "solving" | "parsing" | "done" | "error";
  data?: unknown;
  timestamp: number;
}
