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

  // For equal scaling, we need the same mm range on both axes
  // The chart area (excluding margins) should have equal pixel-per-mm ratio
  const chartMargins = { top: 20, right: 30, left: 50, bottom: 40 };
  const chartWidth = 800; // Approximate usable width
  const chartHeight = height - chartMargins.top - chartMargins.bottom;

  // Calculate the aspect ratio of available space
  const aspectRatio = chartWidth / chartHeight;

  // Determine domains to maintain equal scaling
  let xDomain: [number, number];
  let yDomain: [number, number];

  // We want to show the full horn profile, so start with the data requirements
  const requiredXRange = Math.ceil(maxX / 50) * 50;
  const requiredYRange = Math.ceil((maxY * 2) / 50) * 50; // *2 for positive and negative

  // Adjust domains to maintain equal scaling
  if (requiredXRange / requiredYRange > aspectRatio) {
    // X is the limiting factor
    xDomain = [0, requiredXRange];
    const yRange = requiredXRange / aspectRatio;
    yDomain = [-yRange / 2, yRange / 2];
  } else {
    // Y is the limiting factor
    const yRange = requiredYRange;
    yDomain = [-yRange / 2, yRange / 2];
    xDomain = [0, yRange * aspectRatio];
  }

  // Round domains to nearest 50mm for clean ticks
  xDomain[1] = Math.ceil(xDomain[1] / 50) * 50;
  yDomain[0] = -Math.ceil(Math.abs(yDomain[0]) / 50) * 50;
  yDomain[1] = Math.ceil(yDomain[1] / 50) * 50;

  // Custom tick formatter to show only whole numbers
  const formatTick = (value: number) => {
    return Math.round(value).toString();
  };

  // Generate tick marks at 50mm intervals
  const xTicks = Array.from({ length: Math.floor(xDomain[1] / 50) + 1 }, (_, i) => i * 50);
  const yTicks = Array.from(
    { length: Math.floor((yDomain[1] - yDomain[0]) / 50) + 1 },
    (_, i) => yDomain[0] + i * 50,
  );

  return (
    <div className="horn-profile-viewer">
      <h3>{profile.metadata.profileType.toUpperCase()} Profile</h3>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data} margin={chartMargins}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="x"
            label={{ value: "Length (mm)", position: "insideBottom", offset: -5 }}
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={formatTick}
          />
          <YAxis
            label={{ value: "Radius (mm)", angle: -90, position: "insideLeft" }}
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={formatTick}
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
