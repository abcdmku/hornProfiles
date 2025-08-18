Awesome—here’s a tight **PRP (Product Requirements & Plan)** you can hand to Claude to scaffold a full Elmer-acoustics library inside your **existing Nx monorepo**, expose it via a server API, and make it callable from the **React app** in the same repo.

---

# PRP: Elmer Acoustics Library + Monorepo Integration (Nx)

## 1) Goal & Outcomes

**Goal:** Add a programmatic acoustics simulation pipeline using **Elmer FEM** to compute horn response/directivity from 2D horn profiles produced by an existing library.
**Outcomes:**

* A reusable **workspace library**: `@horn-sim/elmer` with APIs to:
  * Generate **Elmer .sif** inputs.
  * Run **ElmerSolver** in a containerized environment.
  * Parse Elmer outputs (SPL, impedance, far-field directivity) into JSON.
* A **client SDK** for turning horn profiles to meshes and   
* A **server app** exposing REST (and optional SSE) endpoints for simulations.
* A **client SDK** (`@horm-sim/client`) and **React hooks** for the monorepo app to call simulations and render graphs.

## 2) In-Scope / Out-of-Scope

**In-Scope**

* Elmer .sif templating for frequency-domain **Helmholtz** acoustics with rigid walls + piston source.
* Batch runs over frequency lists; return on-axis SPL + polar slices.
* Job orchestration (queued, cancellable), simple caching by geometry+params hash.
* Dockerfile(s) for local + serverless (Lambda container) runs.

**Out-of-Scope (v1)**

* Room acoustics, damping/porous materials.
* 3D balloon directivity (v1 returns polar slices; balloon optional).
* GPU acceleration.
* Multi-driver/multiphysics.

## 3) Target Tech & Constraints

* **Monorepo:** Nx (TS).
* **Server:** Node 20, **H3** (pick H3 for minimal footprint) expose REST + SSE.
* **Mesh:** Gmsh.
* **Solver:** ElmerGrid + ElmerSolver CLI.
* **Storage:** Local FS in dev; S3 in prod (abstract via provider).
* **Auth:** Pluggable; add a simple token middleware stub.
* **CI:** Build, lint, typecheck, unit tests, e2e (Playwright API tests).

## 4) Nx Workspace Layout

```
apps/
  api/            # Node server (H3/Fastify)
  web/            # React app
libs/
  horn-sim/elmer/   # Core library: mesh + .sif + run + parse
  horn-sim/client/  # Client SDK (fetch + DTOs + hooks)
  horn-sim/types/   # Shared types (DTOs, enums)
  horn-mesher/       # Input horn profiles, outputs 3d meshes
  utils/fs/          # Storage abstraction (FS/S3)
  utils/hash/        # Deterministic config hashing
  viewer-2d/         # existing lib
tools/
  generators/        # Nx generators for new sim types or routes
docker/
  elmer-runner/      # Dockerfile + entrypoint
```

## 5) Public APIs (TypeScript)

### `@horn-sim/types`

```ts
export type ProfilePoint = { x: number; y: number }; // mm
export type ProfileXY = ProfilePoint[];

export type CrossSectionMode = "circle" | "ellipse" | "superellipse" | "rectangular" | "stereographic";

export interface HornGeometry {
  mode: CrossSectionMode;
  profile: ProfileXY;              // axial profile
  width?: number; height?: number; // for non-circular mouths
  throatRadius: number;            // mm
}

export interface SimulationParams {
  frequencies: number[];           // Hz
  driverPistonRadius: number;      // mm
  medium: { rho: number; c: number }; // air density & speed
  mesh: { elementSize: number; curvatureRefine?: boolean };
  directivity: { anglesDeg: number[] }; // e.g. [-90..+90 step 5]
}

export interface SimulationRequest {
  geometry: HornGeometry;
  params: SimulationParams;
}

export interface SimulationResult {
  requestHash: string;
  frequencies: number[];
  onAxisSPL: number[]; // dB re 20 µPa @ 1m
  polar: Record<number /*deg*/, number[] /*SPL per freq*/>;
  impedance?: { Re: number[]; Im: number[] }; // optional
  meta: { meshElements: number; runtimeMs: number; version: string };
}
```

### `@horn-sim/elmer` (Node-only)

```ts
export interface ElmerRunner {
  run(req: SimulationRequest): Promise<SimulationResult>;
}

export const createElmerRunner: (opts?: {
  workdirRoot?: string;
  storage?: StorageProvider;
  elmerBin?: { elmerGrid: string; elmerSolver: string };
  gmshBin?: string;
}) => ElmerRunner;
```

* Responsibilities:

  1. **Hash** request → check cache.
  2. **Mesh** with Gmsh:

     * Axisymmetric: revolve profile about X.
     * Non-radial: loft using cross-sections along profile.
  3. Generate `.sif` from template + params.
  4. `ElmerGrid` → convert mesh; `ElmerSolver` → run.
  5. Parse results (VTK/CSV) → SPL, polar, impedance.
  6. Store JSON in storage provider.

### `@horn-sim/client` (browser-safe)

```ts
export class AcousticsClient {
  constructor(opts: { baseUrl: string; token?: string });

  startSimulation(req: SimulationRequest): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<{ status: "queued"|"running"|"done"|"error"; result?: SimulationResult; error?: string }>;
  runSimulationBlocking(req: SimulationRequest): Promise<SimulationResult>; // server may block until done
  streamProgress(jobId: string, onMsg: (evt: { type: string; data: any }) => void): () => void; // SSE unsubscribe
}

// React helpers
export function useSimulation(): {
  run: (req: SimulationRequest) => Promise<SimulationResult>;
  status: "idle"|"loading"|"error";
  error?: string;
};
```

## 6) Server Endpoints (apps/api)

Base path: `/api`

* `POST /simulate` → `{ jobId }` (enqueues, returns quickly)
* `GET /simulate/:jobId` → job status/result
* `POST /simulate/blocking` → returns `SimulationResult` (long-poll)
* `GET /simulate/:jobId/events` → **SSE** progress events
* `POST /estimate` → dry-run mesh size + expected runtime

Auth: bearer token middleware (env `API_TOKEN`, optional).

## 7) Mesh Generation Details (browser-safe)

* **Axisymmetric** (fast path): revolve 2D polyline about X-axis to build 3D surface, then volume.
* **Rect/ellipse/superellipse**: generate a rail surface along the profile and **loft** cross-sections:

  * Sample stations along X.
  * Build cross-section curves (`rect`, `ellipse`, `superellipse(n)`).
  * Gmsh `ThruSections` (loft) → volume.
* Element size from `params.mesh.elementSize`; allow curvature-based refine near throat and edges.

Runs in browser and Node.

Uses either:
gmsh.js (WASM build of Gmsh) for meshing, or
A lightweight custom mesh generator (extrude + revolve 2D profile).
Exports:
generateHornMesh2D(profile: Point2D[], options): MeshData
meshToThree(mesh: MeshData): THREE.BufferGeometry
meshToGmsh(mesh: MeshData): string

Pure TypeScript/wasm lib.
Takes 2D horn profile ({x, y} points) as input.
Generates a watertight 3D mesh.
Exposes output in:
Three.js geometry format (for in-browser 3D visualization).
Gmsh .msh format (for Elmer input).
**CLI examples (pseudo):**

```
gmsh horn.geo -3 -o horn.msh -format msh2
ElmerGrid 14 2 horn.msh -autoclean
ElmerSolver case.sif
```

## 8) Elmer `.sif` Template (Helmholtz)

* **Physics:** Frequency-domain acoustics (Helmholtz), rigid horn walls (Neumann=0), **piston velocity** on throat, radiation into open domain.
* **Key blocks (sketch):**

```
Header
  CHECK KEYWORDS Warn
  Mesh DB "." "msh"
End

Simulation
  Max Output Level = 5
  Coordinate System = Cartesian 3D
  Simulation Type = Steady state
  Steady State Max Iterations = 1
End

Body 1
  Target Bodies(1) = 1  ! horn air domain
  Equation = 1
  Material = 1
  Body Force = 1
End

Equation 1
  Active Solvers(1) = 1
End

Material 1
  Density = $rho
  Sound Speed = $c
End

Body Force 1
  Angular Frequency = $omega
End

Boundary Condition 1        ! walls
  Target Boundaries = $WALL_TAGS
  Acoustic Normal Velocity = 0
End

Boundary Condition 2        ! throat piston
  Target Boundaries = $THROAT_TAG
  Acoustic Normal Velocity = $v_n   ! computed from source amplitude
End

Solver 1
  Equation = Helmholtz
  Variable = Pressure
  Linear System Solver = Iterative
  Linear System Iterative Method = BiCGStabl
  Linear System Preconditioning = ILU0
  Linear System Max Iterations = 10000
  Linear System Convergence Tolerance = 1.0e-10
End
```

* For **frequency sweep**: write multiple `.sif` or parameterize `Angular Frequency` and loop at the runner level.

## 9) Result Extraction

* Configure Elmer to output **VTK** fields (pressure magnitude/phase).
* Post-process:

  * Sample **far-field** on a spherical surface (create a “probe” sphere in mesh or integrate pressure → SPL @ 1 m).
  * Compute **polar** at requested angles by tracing rays / sampling arc points.
  * On-axis SPL = value at 0°.
* Return `SimulationResult`.

## 10) Caching & Deterministic Hashing

* Create a stable JSON of `{ geometry, params, Elmer version, mesher version }`.
* `requestHash = sha256(stableJson)`.
* Store artifacts at: `/storage/<hash>/{req.json, horn.geo, horn.msh, case.sif, result.json}`.
* On `run(req)`, if `result.json` exists → return immediately.

## 11) Job Execution & Progress

* Default: in-process queue with concurrency=1..N (config).
* Each stage emits SSE events: `queued`, `meshing`, `solving[fi]`, `parsing`, `done`.
* Optional adapter for Redis/BullMQ later (keep interface clean).

## 12) Docker & Serverless

* **Image:** `docker/elmer-runner/Dockerfile`

  * Base: `debian:stable-slim`
  * Install: `elmerfem`, `gmsh`, `nodejs` runtime dependencies.
  * Copy apps/api bundle and libs.
* Provide **AWS Lambda container** variant:

  * Base: `public.ecr.aws/lambda/nodejs:20`
  * Layer Elmer + Gmsh binaries into `/opt`.
  * Handler wraps the same `ElmerRunner`.

## 13) Client Integration (React)

* `@horn-sim/client` exports `useSimulation()` hook.
* Example usage in `apps/web`:

```tsx
const { run, status, error } = useSimulation();
const onSubmit = async () => {
  const result = await run(mySimulationRequest);
  // render plots
};
```

* Provide small **plot components** (polar chart & SPL chart) using `recharts`.

## 14) Testing

* **Unit:**

  * Hashing, DTO validation (zod), sif templating expansion, parsers.
* **Integration (API):**

  * Mock runner; then real runner in CI “simulation” job (small mesh).
* **E2E:**

  * Web triggers `/simulate/blocking` on a tiny test horn and checks charts render.

## 15) DX & Nx Targets

Add Nx targets:

* `build`, `lint`, `test` for libs/apps.
* `api:serve` → runs server with local Elmer.
* `api:simulate` → CLI to run a JSON request file and print result.
* `docker:build` & `docker:run`.

## 16) Security & Resource Limits

* Validate inputs (max frequencies, mesh density caps).
* Timeouts & kill stray processes.
* Disk quota per job; periodic cleanup.
* Optional API token check.

## 17) Performance Guidance

* Element size \~ λ/6 at highest frequency.
* Suggest adaptive coarsening below throat; finer near edges.
* Limit sweep count per job; or chunk sweeps (events per freq).

## 18) Acceptance Criteria

* Given a valid `SimulationRequest`, `/simulate/blocking` returns `SimulationResult` with:

  * Non-empty `frequencies`, `onAxisSPL`, `polar` for requested angles.
  * `meta.meshElements > 0`, `runtimeMs` populated.
* Results are **cacheable** (same request → cache hit).
* React demo page can run a small simulation and render **SPL** and **polar** plots.
* Docker image builds and runs end-to-end locally.

---

## 19) Starter Tasks for Claude

1. **Scaffold Nx libs/apps** per layout above.
2. Implement `@horn-sim/types` and zod schemas.
3. Implement `@horn-sim/elmer`:

   * Hashing, workdir, storage abstraction.
   * Gmsh `.geo` generator (axisymmetric + rectangular loft).
   * `.sif` templating and runner (ElmerGrid/Solver).
   * VTK/CSV parsers → `SimulationResult`.
4. Implement `apps/api` routes + SSE.
5. Implement `@horn-sim/client` + `useSimulation`.
6. Demo page in `apps/web` with a simple horn and plots.
7. Dockerfile(s) + GitHub Actions (build, test, docker).
8. A tiny canonical test horn + golden snapshot for CI.

---

If you want, I can also drop in a **minimal `.geo` and `.sif` example** with placeholders wired to your DTOs so Claude has concrete templates to start from.
