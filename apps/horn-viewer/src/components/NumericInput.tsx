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
  min,
  max,
  step = 1,
  onChange,
  placeholder,
  unit,
}: NumericInputProps): React.JSX.Element {
  const displayValue = value === "" ? "" : value.toString();

  return (
    <label htmlFor={id} className="block space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-medium text-slate-100">{label}</span>
        {unit ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{unit}</span>
        ) : null}
      </div>
      <div className="relative group">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-white/0 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100" />
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={displayValue}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="relative w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 focus:border-cyan-200/60 transition-all duration-200"
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}
