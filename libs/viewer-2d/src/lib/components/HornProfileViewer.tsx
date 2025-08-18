import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ProfileGeneratorResult } from "horn-profiles";

export interface HornProfileViewerProps {
  profile: ProfileGeneratorResult;
  width?: number | string;
  height?: number;
  showGrid?: boolean;
  strokeColor?: string;
}

export const HornProfileViewer: React.FC<HornProfileViewerProps> = ({
  profile,
  width = "100%",
  height = 600,
  showGrid = true,
  strokeColor = "#8884d8",
}) => {
  // Transform points for Recharts format and round to whole numbers
  const data = profile.points.map((point) => ({
    x: Math.round(point.x),
    y: Math.round(point.y),
    "-y": -Math.round(point.y), // Mirror for bottom half
  }));

  // Calculate the data extents
  const maxX = Math.max(...data.map((d) => d.x));
  const maxY = Math.max(...data.map((d) => Math.abs(d.y)));

  // We need to ensure the entire horn profile fits AND maintain equal scaling
  // Add some padding (10%) to ensure the profile isn't touching the edges
  const paddingFactor = 1.1;
  const requiredXRange = maxX * paddingFactor;
  const requiredYRange = maxY * 2 * paddingFactor; // *2 for positive and negative

  // To maintain equal scaling, we need the same mm-per-pixel ratio on both axes
  // We'll use the larger requirement to ensure everything fits
  const maxRange = Math.max(requiredXRange, requiredYRange);

  // Round up to nearest 50mm for cleaner scale
  const domainSize = Math.ceil(maxRange / 50) * 50;

  // Set domains with equal ranges
  const xDomain: [number, number] = [0, domainSize];
  const yDomain: [number, number] = [-domainSize / 2, domainSize / 2];

  // Custom tick formatter to show only whole numbers
  const formatTick = (value: number) => {
    return Math.round(value).toString();
  };

  // Generate tick marks at 50mm intervals
  const xTicks = Array.from({ length: Math.floor(domainSize / 50) + 1 }, (_, i) => i * 50);
  const yTicks = Array.from(
    { length: Math.floor(domainSize / 50) + 1 },
    (_, i) => -domainSize / 2 + i * 50,
  );

  return (
    <div className="horn-profile-viewer h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-cyan-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {profile.metadata.profileType.toUpperCase()} Profile
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-purple-300 bg-purple-500/20 px-2 py-1 rounded-full">
            {data.length} points
          </span>
        </div>
      </div>

      <div className="flex-1 bg-black/30 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <ResponsiveContainer width={width} height={height}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />}
            <XAxis
              dataKey="x"
              label={{
                value: "Length (mm)",
                position: "insideBottom",
                offset: -5,
                fill: "#E9D5FF",
              }}
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={formatTick}
              type="number"
              allowDataOverflow={false}
              stroke="#E9D5FF"
              tick={{ fill: "#E9D5FF" }}
            />
            <YAxis
              label={{ value: "Radius (mm)", angle: -90, position: "insideLeft", fill: "#E9D5FF" }}
              domain={yDomain}
              ticks={yTicks}
              tickFormatter={formatTick}
              type="number"
              allowDataOverflow={false}
              stroke="#E9D5FF"
              tick={{ fill: "#E9D5FF" }}
            />
            <Tooltip
              formatter={(value: number) => Math.round(value)}
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                backdropFilter: "blur(10px)",
              }}
              labelStyle={{ color: "#E9D5FF" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
            <Line
              type="monotone"
              dataKey="y"
              stroke="#A78BFA"
              name="Top Profile"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#8B5CF6" }}
            />
            <Line
              type="monotone"
              dataKey="-y"
              stroke="#60A5FA"
              name="Bottom Profile"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: "#3B82F6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
        <h4 className="text-sm font-semibold text-purple-300 mb-3">Calculated Values</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(profile.metadata.calculatedValues).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
              <span className="text-xs text-purple-200">{key}:</span>
              <span className="text-sm font-semibold text-white">
                {typeof value === "number"
                  ? Number.isInteger(value)
                    ? value
                    : value.toFixed(2)
                  : value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
