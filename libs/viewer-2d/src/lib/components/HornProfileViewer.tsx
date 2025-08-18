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

  // Calculate the maximum extent for equal scaling
  const maxX = Math.max(...data.map((d) => d.x));
  const maxY = Math.max(...data.map((d) => Math.abs(d.y)));
  const maxExtent = Math.max(maxX, maxY * 2); // *2 because we show both positive and negative y

  // Round up to nearest 50mm for cleaner scale
  const domainMax = Math.ceil(maxExtent / 50) * 50;

  // Custom tick formatter to show only whole numbers
  const formatTick = (value: number) => {
    return Math.round(value).toString();
  };

  return (
    <div className="horn-profile-viewer">
      <h3>{profile.metadata.profileType.toUpperCase()} Profile</h3>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="x"
            label={{ value: "Length (mm)", position: "insideBottom", offset: -5 }}
            domain={[0, domainMax]}
            ticks={Array.from({ length: Math.floor(domainMax / 50) + 1 }, (_, i) => i * 50)}
            tickFormatter={formatTick}
          />
          <YAxis
            label={{ value: "Radius (mm)", angle: -90, position: "insideLeft" }}
            domain={[-domainMax / 2, domainMax / 2]}
            ticks={Array.from(
              { length: Math.floor(domainMax / 50) + 1 },
              (_, i) => -domainMax / 2 + i * 50,
            )}
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
