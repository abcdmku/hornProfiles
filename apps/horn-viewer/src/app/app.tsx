import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { generateProfile, HornProfileParameters, getAvailableProfiles } from "horn-profiles";
import { HornViewer3D } from "@horn-sim/viewer-3d";
import { generateHornMesh3D, meshToThree, downloadSTL } from "@horn-sim/mesher";
import type { HornGeometry, DriverMountConfig, HornMountConfig } from "@horn-sim/types";
import { NumericInput } from "../components/NumericInput";
import { PARAMETER_CONSTRAINTS } from "../utils/constants";
import hoqsLogo from "../assets/hoqs-logo.svg";

const DEFAULT_INPUTS = {
  throatWidth: "50",
  throatHeight: "50",
  mouthWidth: "600",
  mouthHeight: "600",
  length: "500",
  resolution: "100",
  cutoffFrequency: "100",
  speedOfSound: "343.2",
  transitionLength: "50",
};

const DEFAULT_DRIVER_MOUNT: DriverMountConfig = {
  enabled: true,
  outerDiameter: 120,
  boltHoleDiameter: 7,
  boltCircleDiameter: 102,
  boltCount: 4,
  thickness: 0,
};

const DEFAULT_HORN_MOUNT: HornMountConfig = {
  enabled: false,
  widthExtension: 50,
  boltSpacing: 100,
  boltHoleDiameter: 8,
  thickness: 0,
};

const formatNumber = (value: number, digits = 0): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

type CadProfileViewProps = {
  profile: ReturnType<typeof generateProfile> | null;
  parameters: HornProfileParameters;
  showMirror: boolean;
};

function CadProfileView({
  profile,
  parameters,
  showMirror,
}: CadProfileViewProps): React.JSX.Element {
  if (
    !profile ||
    !profile.widthProfile ||
    !profile.heightProfile ||
    !profile.points ||
    profile.widthProfile.length === 0 ||
    profile.heightProfile.length === 0
  ) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Invalid parameters - adjust values to generate profile.
      </div>
    );
  }

  const safeNumber = (n: unknown, fallback = 0): number =>
    typeof n === "number" && Number.isFinite(n) ? n : fallback;

  const sampleCount = Math.min(
    profile.widthProfile.length,
    profile.heightProfile.length,
    profile.points.length,
  );
  const length = Math.max(safeNumber(parameters.length, 0), 1);

  if (sampleCount <= 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Invalid parameters - adjust values to generate profile.
      </div>
    );
  }

  const samples = Array.from({ length: sampleCount }).map((_, i) => {
    const t = sampleCount > 1 ? i / (sampleCount - 1) : 0;
    const widthPoint = profile.widthProfile?.[i] ?? profile.points[i];
    const heightPoint = profile.heightProfile?.[i] ?? profile.points[i];
    const x = safeNumber(widthPoint?.x ?? heightPoint?.x, length * t);
    // Profile generators already return half-dimensions (radius), so use y directly.
    const halfWidth = safeNumber(widthPoint?.y, 0);
    const halfHeight = safeNumber(heightPoint?.y, 0);
    return { x, halfWidth, halfHeight };
  });

  const maxHalfDimension = Math.max(
    ...samples.map((s) =>
      Math.max(Math.abs(safeNumber(s.halfWidth, 0)), Math.abs(safeNumber(s.halfHeight, 0))),
    ),
    safeNumber(parameters.mouthWidth, 0) / 2,
    safeNumber(parameters.mouthHeight, 0) / 2,
    safeNumber(parameters.throatWidth, 0) / 2,
    safeNumber(parameters.throatHeight, 0) / 2,
    1,
  );

  const minX = 0;
  const maxX = length;
  const minY = -maxHalfDimension;
  const maxY = maxHalfDimension;

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const margin = Math.max(40, Math.max(spanX, spanY) * 0.1);
  const strokePadding = 6;

  const baseWidth = spanX + margin * 2 + strokePadding * 2;
  const baseHeight = spanY + margin * 2 + strokePadding * 2;
  const baseMinX = minX - margin - strokePadding;
  const baseMinY = minY - margin - strokePadding;

  const [camera, setCamera] = useState({ zoom: 1, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ panX: 0, panY: 0 });

  const viewWidth = baseWidth / camera.zoom;
  const viewHeight = baseHeight / camera.zoom;
  const viewBoxX = baseMinX + camera.panX;
  const viewBoxY = baseMinY + camera.panY;

  const offsetX = 0; // points use true coordinates; viewBox handles offset
  const offsetY = 0;
  const centerY = 0; // y=0

  const toPoint = (x: number, y: number): string => `${offsetX + x},${offsetY + y}`;

  const widthTopPoints = samples.map((s) => toPoint(s.x, -safeNumber(s.halfWidth, 0))).join(" ");
  const widthBottomPoints = samples.map((s) => toPoint(s.x, safeNumber(s.halfWidth, 0))).join(" ");
  const heightTopPoints = samples.map((s) => toPoint(s.x, -safeNumber(s.halfHeight, 0))).join(" ");
  const heightBottomPoints = samples
    .map((s) => toPoint(s.x, safeNumber(s.halfHeight, 0)))
    .join(" ");

  const throatLabel = `${formatNumber(parameters.throatWidth, 0)} x ${formatNumber(
    parameters.throatHeight,
    0,
  )} mm`;
  const mouthLabel = `${formatNumber(parameters.mouthWidth, 0)} x ${formatNumber(
    parameters.mouthHeight,
    0,
  )} mm`;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

  const labelMinX = baseMinX + margin * 0.25;
  const labelMaxX = baseMinX + baseWidth - margin * 0.25;
  const labelMinY = baseMinY + margin * 0.25;
  const labelMaxY = baseMinY + baseHeight - margin * 0.25;

  const throatLabelX = clamp(minX + 8, labelMinX, labelMaxX);
  const throatLabelY = clamp(-safeNumber(parameters.throatHeight, 0) / 2 - 10, labelMinY, labelMaxY);
  const mouthLabelX = clamp(maxX - 140, labelMinX, labelMaxX);
  const mouthLabelY = clamp(-safeNumber(parameters.mouthHeight, 0) / 2 - 10, labelMinY, labelMaxY);

  useEffect(() => {
    setCamera({ zoom: 1, panX: 0, panY: 0 });
  }, [length, maxHalfDimension, showMirror]);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = clamp(camera.zoom * zoomFactor, 0.2, 10);
    if (nextZoom === camera.zoom) return;

    const pointerX = viewBoxX + ((e.clientX - rect.left) / rect.width) * viewWidth;
    const pointerY = viewBoxY + ((e.clientY - rect.top) / rect.height) * viewHeight;

    const nextViewWidth = baseWidth / nextZoom;
    const nextViewHeight = baseHeight / nextZoom;

    const nextViewBoxX = pointerX - (pointerX - viewBoxX) * (nextViewWidth / viewWidth);
    const nextViewBoxY = pointerY - (pointerY - viewBoxY) * (nextViewHeight / viewHeight);

    setCamera({
      zoom: nextZoom,
      panX: nextViewBoxX - baseMinX,
      panY: nextViewBoxY - baseMinY,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    cameraStart.current = { panX: camera.panX, panY: camera.panY };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dxPx = e.clientX - panStart.current.x;
    const dyPx = e.clientY - panStart.current.y;

    const dx = (dxPx / rect.width) * viewWidth;
    const dy = (dyPx / rect.height) * viewHeight;

    setCamera((prev) => ({
      ...prev,
      panX: cameraStart.current.panX - dx,
      panY: cameraStart.current.panY - dy,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    isPanning.current = false;
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="h-full w-full p-6">
      <svg
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: "none" }}
      >
      <defs>
        <linearGradient id="gridFade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
      </defs>

      <rect width={viewWidth} height={viewHeight} fill="transparent" />

      {/* Axes */}
      <line
        x1={offsetX + minX}
        y1={centerY}
        x2={offsetX + maxX}
        y2={centerY}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      <line
        x1={offsetX + minX}
        y1={offsetY + minY}
        x2={offsetX + minX}
        y2={offsetY + maxY}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />

      {/* Width profiles */}
      <polyline
        points={widthTopPoints}
        fill="none"
        stroke="#6fffe9"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {showMirror && (
        <polyline
          points={widthBottomPoints}
          fill="none"
          stroke="#6fffe9"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}

      {/* Height profiles */}
      <polyline
        points={heightTopPoints}
        fill="none"
        stroke="#f2c14f"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeDasharray="6 6"
      />
      {showMirror && (
        <polyline
          points={heightBottomPoints}
          fill="none"
          stroke="#f2c14f"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeDasharray="6 6"
        />
      )}

      {/* Dimension callouts */}
      <text
        x={throatLabelX}
        y={throatLabelY}
        fill="#c8e7ff"
        fontSize="12"
        fontFamily="Space Grotesk, sans-serif"
      >
        Throat {throatLabel}
      </text>
      <text
        x={mouthLabelX}
        y={mouthLabelY}
        fill="#c8e7ff"
        fontSize="12"
        fontFamily="Space Grotesk, sans-serif"
      >
        Mouth {mouthLabel}
      </text>
      </svg>
    </div>
  );
}

export function App(): React.JSX.Element {
  const [profileType, setProfileType] = useState("conical");
  const [inputValues, setInputValues] = useState(() => ({ ...DEFAULT_INPUTS }));
  const [throatShape, setThroatShape] = useState<"ellipse" | "rectangular" | "superellipse">(
    "ellipse",
  );
  const [mouthShape, setMouthShape] = useState<"ellipse" | "rectangular" | "superellipse">(
    "ellipse",
  );
  const [morphingFunction, setMorphingFunction] = useState<"linear" | "cubic" | "sigmoid">(
    "linear",
  );
  const [throatLocked, setThroatLocked] = useState(true);
  const [mouthLocked, setMouthLocked] = useState(true);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [wireframe, setWireframe] = useState(false);
  const [showMirror, setShowMirror] = useState(true);
  const [meshResolution, setMeshResolution] = useState(50);
  const [wallThickness, setWallThickness] = useState(3);
  const [driverMount, setDriverMount] = useState<DriverMountConfig>(() => ({
    ...DEFAULT_DRIVER_MOUNT,
  }));
  const [hornMount, setHornMount] = useState<HornMountConfig>(() => ({ ...DEFAULT_HORN_MOUNT }));

  const is3D = viewMode === "3d";

  // Always default to mirrored when entering 2D mode so both halves are visible
  useEffect(() => {
    if (viewMode === "2d") {
      setShowMirror(true);
    }
  }, [viewMode]);

  const controlInputStyles =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/50 focus:border-cyan-200/60 transition-all duration-200";

  const parameters = useMemo((): HornProfileParameters => {
    const safeFloat = (value: string, defaultValue: number, min = 0.1, max = 50000): number => {
      const num = parseFloat(value);
      if (isNaN(num) || !isFinite(num)) return defaultValue;
      return Math.max(min, Math.min(max, num));
    };

    try {
      const params = {
        throatWidth: safeFloat(inputValues.throatWidth, 50, 1, 1000),
        throatHeight: safeFloat(inputValues.throatHeight, 50, 1, 1000),
        mouthWidth: safeFloat(inputValues.mouthWidth, 600, 10, 5000),
        mouthHeight: safeFloat(inputValues.mouthHeight, 600, 10, 5000),
        length: safeFloat(inputValues.length, 500, 10, 10000),
        resolution: safeFloat(inputValues.resolution, 100, 10, 500),
        cutoffFrequency: safeFloat(inputValues.cutoffFrequency, 100, 20, 20000),
        speedOfSound: safeFloat(inputValues.speedOfSound, 343.2, 100, 500),
        transitionLength: safeFloat(inputValues.transitionLength, 500, 10, 10000),
        throatShape,
        mouthShape,
        morphingFunction,
      };

      if (
        params.mouthWidth !== undefined &&
        params.throatWidth !== undefined &&
        params.mouthWidth < params.throatWidth
      ) {
        params.mouthWidth = Math.max(params.throatWidth * 1.1, params.mouthWidth);
      }
      if (
        params.mouthHeight !== undefined &&
        params.throatHeight !== undefined &&
        params.mouthHeight < params.throatHeight
      ) {
        params.mouthHeight = Math.max(params.throatHeight * 1.1, params.mouthHeight);
      }

      return params;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Parameter validation failed, using defaults:", error);
      return {
        throatWidth: 50,
        throatHeight: 50,
        mouthWidth: 600,
        mouthHeight: 600,
        length: 500,
        resolution: 100,
        cutoffFrequency: 100,
        speedOfSound: 343.2,
        transitionLength: 50,
        throatShape: "ellipse",
        mouthShape: "ellipse",
        morphingFunction: "linear",
      };
    }
  }, [inputValues, throatShape, mouthShape, morphingFunction]);

  const profile = useMemo(() => {
    try {
      if (
        !parameters ||
        parameters.throatWidth === undefined ||
        parameters.throatHeight === undefined ||
        parameters.mouthWidth === undefined ||
        parameters.mouthHeight === undefined ||
        !isFinite(parameters.throatWidth) ||
        !isFinite(parameters.throatHeight) ||
        !isFinite(parameters.mouthWidth) ||
        !isFinite(parameters.mouthHeight) ||
        !isFinite(parameters.length) ||
        parameters.throatWidth <= 0 ||
        parameters.throatHeight <= 0 ||
        parameters.mouthWidth <= 0 ||
        parameters.mouthHeight <= 0 ||
        parameters.length <= 0
      ) {
        return null;
      }

      return generateProfile(profileType, parameters);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Profile generation failed:", error);
      return null;
    }
  }, [profileType, parameters]);

  const availableProfiles = getAvailableProfiles();

  const rawMeshData = useMemo(() => {
    if (
      !profile ||
      !profile.points ||
      !profile.widthProfile ||
      !profile.heightProfile ||
      !profile.metadata?.parameters
    ) {
      return null;
    }

    try {
      const hornGeometry: HornGeometry = {
        mode: throatShape as "ellipse" | "rectangular",
        profile: profile.points,
        widthProfile: profile.widthProfile,
        heightProfile: profile.heightProfile,
        shapeProfile: profile.shapeProfile,
        throatRadius:
          Math.min(
            profile.metadata.parameters.throatWidth || 50,
            profile.metadata.parameters.throatHeight || 50,
          ) / 2,
        throatWidth: profile.metadata.parameters.throatWidth || 50,
        throatHeight: profile.metadata.parameters.throatHeight || 50,
        width: profile.metadata.parameters.mouthWidth || 600,
        height: profile.metadata.parameters.mouthHeight || 600,
        throatShape: throatShape as "ellipse" | "rectangular",
        mouthShape: mouthShape as "ellipse" | "rectangular",
        wallThickness: wallThickness > 0 ? wallThickness : undefined,
        driverMount: driverMount.enabled ? driverMount : undefined,
        hornMount: hornMount.enabled ? hornMount : undefined,
      };

      return generateHornMesh3D(hornGeometry, {
        resolution: meshResolution,
        elementSize: 5,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Mesh generation failed:", error);
      return null;
    }
  }, [profile, throatShape, mouthShape, meshResolution, wallThickness, driverMount, hornMount]);

  const handleDownloadSTL = useCallback(() => {
    if (!rawMeshData) return;

    const filename = `horn-${profileType}-${Date.now()}.stl`;
    downloadSTL(rawMeshData, filename);
  }, [rawMeshData, profileType]);

  const meshData = useMemo(() => {
    if (
      !profile ||
      !profile.points ||
      !profile.widthProfile ||
      !profile.heightProfile ||
      !profile.metadata?.parameters
    ) {
      return null;
    }

    try {
      const hornGeometry: HornGeometry = {
        mode: throatShape as "ellipse" | "rectangular",
        profile: profile.points,
        widthProfile: profile.widthProfile,
        heightProfile: profile.heightProfile,
        shapeProfile: profile.shapeProfile,
        throatRadius:
          Math.min(
            profile.metadata.parameters.throatWidth || 50,
            profile.metadata.parameters.throatHeight || 50,
          ) / 2,
        throatWidth: profile.metadata.parameters.throatWidth || 50,
        throatHeight: profile.metadata.parameters.throatHeight || 50,
        width: profile.metadata.parameters.mouthWidth || 600,
        height: profile.metadata.parameters.mouthHeight || 600,
        throatShape: throatShape as "ellipse" | "rectangular",
        mouthShape: mouthShape as "ellipse" | "rectangular",
        wallThickness: wallThickness > 0 ? wallThickness : undefined,
        driverMount: driverMount.enabled ? driverMount : undefined,
        hornMount: hornMount.enabled ? hornMount : undefined,
      };

      const mesh = generateHornMesh3D(hornGeometry, {
        resolution: meshResolution,
        elementSize: 5,
      });

      return meshToThree(mesh);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Mesh generation failed:", error);
      return null;
    }
  }, [profile, throatShape, mouthShape, meshResolution, wallThickness, driverMount, hornMount]);

  const handleParameterChange = useCallback(
    (key: string, value: string): void => {
      setInputValues((prev) => {
        const newValues = { ...prev };

        if (key in newValues) {
          (newValues as Record<string, string>)[key] = value;
        }

        const numValue = parseFloat(value);
        const hasValidNumber = !isNaN(numValue) && isFinite(numValue) && numValue > 0;

        if (hasValidNumber) {
          if (throatLocked && (key === "throatWidth" || key === "throatHeight")) {
            const prevWidth = parseFloat(prev.throatWidth);
            const prevHeight = parseFloat(prev.throatHeight);

            let ratio = 1;
            if (!isNaN(prevWidth) && !isNaN(prevHeight) && prevWidth > 0 && prevHeight > 0) {
              ratio = key === "throatWidth" ? prevHeight / prevWidth : prevWidth / prevHeight;
            }

            if (key === "throatWidth") {
              newValues.throatHeight = (numValue * ratio).toString();
            } else {
              newValues.throatWidth = (numValue * ratio).toString();
            }
          } else if (mouthLocked && (key === "mouthWidth" || key === "mouthHeight")) {
            const prevWidth = parseFloat(prev.mouthWidth);
            const prevHeight = parseFloat(prev.mouthHeight);

            let ratio = 1;
            if (!isNaN(prevWidth) && !isNaN(prevHeight) && prevWidth > 0 && prevHeight > 0) {
              ratio = key === "mouthWidth" ? prevHeight / prevWidth : prevWidth / prevHeight;
            }

            if (key === "mouthWidth") {
              newValues.mouthHeight = (numValue * ratio).toString();
            } else {
              newValues.mouthWidth = (numValue * ratio).toString();
            }
          }
        } else if (value === "") {
          if (throatLocked && key === "throatWidth") {
            newValues.throatHeight = "";
          } else if (throatLocked && key === "throatHeight") {
            newValues.throatWidth = "";
          } else if (mouthLocked && key === "mouthWidth") {
            newValues.mouthHeight = "";
          } else if (mouthLocked && key === "mouthHeight") {
            newValues.mouthWidth = "";
          }
        }

        return newValues;
      });
    },
    [throatLocked, mouthLocked],
  );

  const resetToDefaults = useCallback(() => {
    setProfileType("conical");
    setInputValues({ ...DEFAULT_INPUTS });
    setThroatShape("ellipse");
    setMouthShape("ellipse");
    setMorphingFunction("linear");
    setThroatLocked(true);
    setMouthLocked(true);
    setViewMode("2d");
    setWireframe(false);
    setMeshResolution(50);
    setWallThickness(3);
    setDriverMount({ ...DEFAULT_DRIVER_MOUNT });
    setHornMount({ ...DEFAULT_HORN_MOUNT });
  }, []);

  const throatArea = parameters.throatWidth * parameters.throatHeight;
  const mouthArea = parameters.mouthWidth * parameters.mouthHeight;
  const mouthToThroat =
    parameters.throatWidth > 0 ? parameters.mouthWidth / parameters.throatWidth : 0;

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full bg-amber-300/10 blur-[120px]" />
        <div className="absolute inset-0 grid-overlay opacity-40" />
        <div className="absolute inset-0 noise-overlay opacity-30 mix-blend-soft-light" />
      </div>

      <div className="relative h-screen w-full px-5 py-4 flex flex-col gap-3">
        <header className="rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <img src={hoqsLogo} alt="HOQS logo" className="h-10 w-10 object-contain" />
              <h1 className="flex flex-wrap items-baseline gap-2 text-xl md:text-2xl font-display leading-tight text-white">
                <span>HOQS</span>
                <span className="text-slate-200">Horn Studio</span>
              </h1>
            </div>
            <button
              onClick={resetToDefaults}
              className="text-[11px] uppercase tracking-[0.18em] text-slate-200 px-3 py-1.5 rounded-full border border-white/15 hover:border-white/35 hover:text-white transition"
            >
              Reset
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <div className="grid h-full grid-rows-1 gap-4 xl:grid-cols-[420px,1fr]">
            <div className="space-y-4 overflow-y-auto pr-1">
            <section className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-tech">
                    Profile
                  </p>
                  <h2 className="text-xl font-display text-white">Contour + core dimensions</h2>
                </div>
                <div className="glass-chip rounded-full px-3 py-1.5 text-xs text-slate-200">
                  {profile ? "Ready" : "Awaiting valid inputs"}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr,auto] items-center">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">Profile type</label>
                    <select
                      value={profileType}
                      onChange={(e) => setProfileType(e.currentTarget.value)}
                      className={`${controlInputStyles} font-display uppercase tracking-[0.12em]`}
                    >
                      {availableProfiles.map((type) => (
                        <option key={type} value={type} className="bg-gray-900">
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-slate-400 font-tech">
                    {parameters.resolution} segments
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-200">Throat dimensions (mm)</p>
                    <button
                      onClick={() => setThroatLocked(!throatLocked)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${
                        throatLocked
                          ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/40"
                          : "border border-white/15 text-slate-200 hover:border-white/35"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {throatLocked ? "Locked" : "Free"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumericInput
                      id="throat-width"
                      label="Width"
                      value={
                        inputValues.throatWidth === ""
                          ? ""
                          : parseFloat(inputValues.throatWidth) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.throatWidth.min}
                      max={PARAMETER_CONSTRAINTS.throatWidth.max}
                      onChange={(value) => handleParameterChange("throatWidth", value)}
                      unit="mm"
                    />
                    <NumericInput
                      id="throat-height"
                      label="Height"
                      value={
                        inputValues.throatHeight === ""
                          ? ""
                          : parseFloat(inputValues.throatHeight) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.throatHeight.min}
                      max={PARAMETER_CONSTRAINTS.throatHeight.max}
                      onChange={(value) => handleParameterChange("throatHeight", value)}
                      unit="mm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-200">Mouth dimensions (mm)</p>
                    <button
                      onClick={() => setMouthLocked(!mouthLocked)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${
                        mouthLocked
                          ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/40"
                          : "border border-white/15 text-slate-200 hover:border-white/35"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {mouthLocked ? "Locked" : "Free"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumericInput
                      id="mouth-width"
                      label="Width"
                      value={
                        inputValues.mouthWidth === ""
                          ? ""
                          : parseFloat(inputValues.mouthWidth) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.mouthWidth.min}
                      max={PARAMETER_CONSTRAINTS.mouthWidth.max}
                      onChange={(value) => handleParameterChange("mouthWidth", value)}
                      unit="mm"
                    />
                    <NumericInput
                      id="mouth-height"
                      label="Height"
                      value={
                        inputValues.mouthHeight === ""
                          ? ""
                          : parseFloat(inputValues.mouthHeight) || ""
                      }
                      min={PARAMETER_CONSTRAINTS.mouthHeight.min}
                      max={PARAMETER_CONSTRAINTS.mouthHeight.max}
                      onChange={(value) => handleParameterChange("mouthHeight", value)}
                      unit="mm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <NumericInput
                    id="length"
                    label="Length"
                    value={inputValues.length === "" ? "" : parseFloat(inputValues.length) || ""}
                    min={PARAMETER_CONSTRAINTS.length.min}
                    max={PARAMETER_CONSTRAINTS.length.max}
                    onChange={(value) => handleParameterChange("length", value)}
                    unit="mm"
                  />
                  <NumericInput
                    id="resolution"
                    label="Profile resolution"
                    value={
                      inputValues.resolution === "" ? "" : parseFloat(inputValues.resolution) || ""
                    }
                    min={PARAMETER_CONSTRAINTS.resolution.min}
                    max={PARAMETER_CONSTRAINTS.resolution.max}
                    onChange={(value) => handleParameterChange("resolution", value)}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <NumericInput
                    id="cutoff-frequency"
                    label="Cutoff frequency"
                    value={
                      inputValues.cutoffFrequency === ""
                        ? ""
                        : parseFloat(inputValues.cutoffFrequency) || ""
                    }
                    min={PARAMETER_CONSTRAINTS.cutoffFrequency.min}
                    max={PARAMETER_CONSTRAINTS.cutoffFrequency.max}
                    onChange={(value) => handleParameterChange("cutoffFrequency", value)}
                    unit="Hz"
                  />
                  <NumericInput
                    id="speed-of-sound"
                    label="Speed of sound"
                    value={
                      inputValues.speedOfSound === ""
                        ? ""
                        : parseFloat(inputValues.speedOfSound) || ""
                    }
                    min={PARAMETER_CONSTRAINTS.speedOfSound.min}
                    max={PARAMETER_CONSTRAINTS.speedOfSound.max}
                    onChange={(value) => handleParameterChange("speedOfSound", value)}
                    unit="m/s"
                  />
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-tech">
                    Morphing
                  </p>
                  <h2 className="text-xl font-display text-white">Shape transition</h2>
                  <p className="text-xs text-slate-400">
                    Blend throat to mouth while maintaining acoustic intent.
                  </p>
                </div>
                <div className="glass-chip rounded-full px-3 py-1.5 text-xs text-slate-200">
                  {morphingFunction === "linear"
                    ? "Linear"
                    : morphingFunction === "cubic"
                    ? "Cubic easing"
                    : "Sigmoid S-curve"}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">Throat shape</label>
                    <select
                      value={throatShape}
                      onChange={(e) =>
                        setThroatShape(
                          e.currentTarget.value as "ellipse" | "rectangular" | "superellipse",
                        )
                      }
                      className={controlInputStyles}
                    >
                      <option value="ellipse">Ellipse</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="superellipse">Superellipse</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">Mouth shape</label>
                    <select
                      value={mouthShape}
                      onChange={(e) =>
                        setMouthShape(
                          e.currentTarget.value as "ellipse" | "rectangular" | "superellipse",
                        )
                      }
                      className={controlInputStyles}
                    >
                      <option value="ellipse">Ellipse</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="superellipse">Superellipse</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <NumericInput
                    id="transition-length"
                    label="Transition length"
                    value={
                      inputValues.transitionLength === ""
                        ? ""
                        : parseFloat(inputValues.transitionLength) || ""
                    }
                    min={10}
                    max={10000}
                    onChange={(value) => handleParameterChange("transitionLength", value)}
                    unit="mm"
                  />

                  <div className="space-y-2">
                    <label className="text-sm text-slate-200">Transition style</label>
                    <select
                      value={morphingFunction}
                      onChange={(e) =>
                        setMorphingFunction(e.currentTarget.value as "linear" | "cubic" | "sigmoid")
                      }
                      className={controlInputStyles}
                    >
                      <option value="linear">Linear</option>
                      <option value="cubic">Smooth (Cubic)</option>
                      <option value="sigmoid">S-curve (Sigmoid)</option>
                    </select>
                    <p className="text-xs text-slate-500">
                      Controls how fast the cross-section morphs along the length.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-3xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-tech">
                    Fabrication
                  </p>
                  <h2 className="text-xl font-display text-white">Mesh & mounting</h2>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                    className="rounded border-white/30 bg-white/10 text-cyan-400 focus:ring-cyan-400"
                    disabled={!is3D}
                  />
                  <span className={is3D ? "" : "text-slate-500"}>Wireframe preview</span>
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Mesh quality</span>
                    <span className="font-tech text-slate-300">{meshResolution} segments</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <input
                      id="mesh-resolution"
                      type="range"
                      min="10"
                      max="250"
                      step="10"
                      value={meshResolution}
                      onChange={(e) => setMeshResolution(Number(e.currentTarget.value))}
                      className="w-full accent-cyan-300"
                    />
                    <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <span>Coarse</span>
                      <span>Detailed</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="wall-thickness"
                    className="flex items-center justify-between text-sm text-slate-200"
                  >
                    Wall thickness
                    <span className="text-xs text-slate-400">(mm)</span>
                  </label>
                  <input
                    id="wall-thickness"
                    type="number"
                    min="0"
                    step="0.5"
                    value={wallThickness}
                    onChange={(e) => {
                      const val = parseFloat(e.currentTarget.value);
                      setWallThickness(isNaN(val) ? 3 : val);
                    }}
                    className={controlInputStyles}
                    placeholder="3mm (recommended for 3D printing)"
                  />
                  <div className="text-xs text-slate-500">
                    {wallThickness > 0
                      ? `${wallThickness}mm wall thickness`
                      : "0mm = single surface mesh"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadSTL}
                  disabled={!rawMeshData}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    rawMeshData
                      ? "bg-gradient-to-r from-cyan-400/70 to-amber-300/70 text-slate-950 hover:from-cyan-300 hover:to-amber-300"
                      : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Download STL</span>
                </button>
                <button
                  onClick={() => setViewMode(is3D ? "2d" : "3d")}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 hover:border-white/40 transition"
                >
                  Switch to {is3D ? "2D" : "3D"} view
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={driverMount.enabled}
                      onChange={(e) =>
                        setDriverMount({ ...driverMount, enabled: e.target.checked })
                      }
                      className="rounded border-white/30 bg-white/10 text-cyan-400 focus:ring-cyan-400"
                    />
                    Driver mount (throat)
                  </label>

                  {driverMount.enabled && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="driver-outer-diameter"
                            className="text-xs text-slate-400"
                          >
                            Outer diameter
                          </label>
                          <input
                            id="driver-outer-diameter"
                            type="number"
                            value={driverMount.outerDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                outerDiameter: isNaN(val) ? 0 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                        <div>
                          <label htmlFor="driver-thickness" className="text-xs text-slate-400">
                            Mount thickness
                          </label>
                          <input
                            id="driver-thickness"
                            type="number"
                            value={driverMount.thickness}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                thickness: isNaN(val) ? 0 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor="driver-bolt-circle"
                            className="text-xs text-slate-400"
                          >
                            Bolt circle (mm)
                          </label>
                          <input
                            id="driver-bolt-circle"
                            type="number"
                            value={driverMount.boltCircleDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                boltCircleDiameter: isNaN(val) ? 0 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                        <div>
                          <label htmlFor="driver-bolt-hole" className="text-xs text-slate-400">
                            Hole dia (mm)
                          </label>
                          <input
                            id="driver-bolt-hole"
                            type="number"
                            value={driverMount.boltHoleDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                boltHoleDiameter: isNaN(val) ? 6 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="driver-bolt-count" className="text-xs text-slate-400">
                            Bolt count
                          </label>
                          <input
                            id="driver-bolt-count"
                            type="number"
                            min="3"
                            max="12"
                            value={driverMount.boltCount}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setDriverMount({
                                ...driverMount,
                                boltCount: isNaN(val) ? 4 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                        <div className="flex items-end text-xs text-slate-500">
                          Match your driver spec to avoid stress on the throat mount.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={hornMount.enabled}
                      onChange={(e) => setHornMount({ ...hornMount, enabled: e.target.checked })}
                      className="rounded border-white/30 bg-white/10 text-cyan-400 focus:ring-cyan-400"
                    />
                    Horn mount (mouth)
                  </label>

                  {hornMount.enabled && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="horn-width-ext" className="text-xs text-slate-400">
                            Width extension
                          </label>
                          <input
                            id="horn-width-ext"
                            type="number"
                            value={hornMount.widthExtension}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({
                                ...hornMount,
                                widthExtension: isNaN(val) ? 50 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                        <div>
                          <label htmlFor="horn-thickness" className="text-xs text-slate-400">
                            Mount thickness
                          </label>
                          <input
                            id="horn-thickness"
                            type="number"
                            value={hornMount.thickness}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({ ...hornMount, thickness: isNaN(val) ? 10 : val });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="horn-bolt-spacing" className="text-xs text-slate-400">
                            Bolt spacing
                          </label>
                          <input
                            id="horn-bolt-spacing"
                            type="number"
                            value={hornMount.boltSpacing}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({ ...hornMount, boltSpacing: isNaN(val) ? 100 : val });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                        <div>
                          <label htmlFor="horn-bolt-hole" className="text-xs text-slate-400">
                            Hole dia (mm)
                          </label>
                          <input
                            id="horn-bolt-hole"
                            type="number"
                            value={hornMount.boltHoleDiameter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setHornMount({
                                ...hornMount,
                                boltHoleDiameter: isNaN(val) ? 8 : val,
                              });
                            }}
                            className={controlInputStyles}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
          <div className="flex h-full flex-col space-y-4 overflow-hidden pl-1">
            <section className="glass-panel relative flex h-full flex-col overflow-hidden rounded-3xl p-0">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 py-2 bg-gradient-to-b from-black/45 via-black/20 to-transparent">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-300 font-tech">
                    Preview
                  </p>
                  <h2 className="text-base md:text-lg font-display text-white">Live profile</h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
                  {viewMode === "2d" && (
                    <button
                      type="button"
                      onClick={() => setShowMirror((prev) => !prev)}
                      aria-pressed={showMirror}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition border ${
                        showMirror
                          ? "border-cyan-300/60 bg-cyan-300/10 text-slate-50 shadow-cyan-500/10"
                          : "border-white/20 text-slate-100 hover:border-white/40"
                      }`}
                      title="Show mirrored top/bottom halves of the horn profile"
                    >
                      <span className="uppercase tracking-[0.08em]">Mirrored</span>
                      <span
                        className={`h-4 w-8 rounded-full transition ${
                          showMirror ? "bg-cyan-400/80" : "bg-slate-500/50"
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
                            showMirror ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setViewMode("2d")}
                    className={`rounded-full px-3.5 py-1.5 text-xs md:text-sm font-medium transition ${
                      viewMode === "2d"
                        ? "bg-white text-slate-950 shadow-lg shadow-cyan-500/20"
                        : "border border-white/20 text-slate-100 hover:border-white/40"
                    }`}
                  >
                    2D contour
                  </button>
                  <button
                    onClick={() => setViewMode("3d")}
                    className={`rounded-full px-3.5 py-1.5 text-xs md:text-sm font-medium transition ${
                      viewMode === "3d"
                        ? "bg-white text-slate-950 shadow-lg shadow-amber-400/20"
                        : "border border-white/20 text-slate-100 hover:border-white/40"
                    }`}
                  >
                    3D mesh
                  </button>
                  <button
                    onClick={handleDownloadSTL}
                    disabled={!rawMeshData}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs md:text-sm transition ${
                      rawMeshData
                        ? "border border-white/20 text-slate-100 hover:border-white/40"
                        : "border border-white/10 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v12m0 0l-4-4m4 4l4-4m-9 6h10"
                      />
                    </svg>
                    STL
                  </button>
                </div>
              </div>

              <div className="relative flex-1">
                {viewMode === "2d" ? (
                  <CadProfileView profile={profile} parameters={parameters} showMirror={showMirror} />
                ) : meshData ? (
                  <div className="absolute inset-0">
                    <HornViewer3D
                      positions={meshData.positions}
                      indices={meshData.indices}
                      normals={meshData.normals}
                      wireframe={wireframe}
                      showGrid={true}
                      background={null}
                      gridPosition={[
                        0,
                        -Math.min(parameters.throatWidth || 50, parameters.throatHeight || 50) / 2,
                        0,
                      ]}
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    {profile ? "Generating 3D model..." : "Invalid parameters - adjust values to generate model."}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

export default App;
