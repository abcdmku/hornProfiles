import React from "react";

interface NumericInputProps {
  id: string;
  label: string;
  value: number | "";
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
}

export function NumericInput({
  id,
  label,
  value,
  min: _min,
  max: _max,
  step = 1,
  onChange,
  placeholder,
  unit,
}: NumericInputProps): React.JSX.Element {
  const displayValue = value === "" ? "" : value.toString();

  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-400 mb-1">
        {label} {unit && <span className="text-slate-500">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        value={displayValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        placeholder={placeholder}
      />
    </div>
  );
}
