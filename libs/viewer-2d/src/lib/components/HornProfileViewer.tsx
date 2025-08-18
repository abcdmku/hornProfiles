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
    <div className="horn-profile-viewer">
      <h3>{profile.metadata.profileType.toUpperCase()} Profile</h3>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 50, bottom: 40 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="x"
            label={{ value: "Length (mm)", position: "insideBottom", offset: -5 }}
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={formatTick}
            type="number"
            allowDataOverflow={false}
          />
          <YAxis
            label={{ value: "Radius (mm)", angle: -90, position: "insideLeft" }}
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={formatTick}
            type="number"
            allowDataOverflow={false}
          />
          <Tooltip formatter={(value: number) => Math.round(value)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="y"
            stroke={strokeColor}
            name="Top Profile"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="-y"
            stroke={strokeColor}
            name="Bottom Profile"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="profile-metadata">
        <h4>Calculated Values:</h4>
        <ul>
          {Object.entries(profile.metadata.calculatedValues).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong>{" "}
              {typeof value === "number"
                ? Number.isInteger(value)
                  ? value
                  : value.toFixed(2)
                : value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
