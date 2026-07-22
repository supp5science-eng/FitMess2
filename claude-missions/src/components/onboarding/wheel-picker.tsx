"use client";

import { FieldError } from "@/components/onboarding/field-error";
import { Label } from "@/components/ui/label";
import {
  WheelColumn,
  WHEEL_ITEM_H,
  WHEEL_VISIBLE_ROWS,
} from "@/components/onboarding/wheel-column";

/**
 * F015: an inline single-column scroll wheel for a numeric onboarding step
 * (Cal-AI look). The visible wheel is `WheelColumn` (pure scroll, no native
 * picker); the source of truth is a visually-hidden labeled `<input>` that
 * mirrors the value — that's what assistive tech and `getByLabelText` drive.
 * Store stays metric; `renderOption` only changes the display.
 */
export function WheelPicker({
  id,
  label,
  value,
  onChange,
  options,
  error,
  renderOption,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: number[];
  error?: string;
  renderOption?: (value: number) => string;
}) {
  const errorId = `${id}-error`;
  const format = (v: number) => (renderOption ? renderOption(v) : String(v));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>

      {/* Source of truth: accessible + test-driven, visually hidden. */}
      <input
        id={id}
        name={id}
        type="text"
        inputMode="none"
        value={value === null ? "" : String(value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        className="sr-only"
      />

      {/* Visual wheel (decorative — the input above owns semantics). */}
      <div
        aria-hidden
        className="relative select-none"
        style={{ height: WHEEL_VISIBLE_ROWS * WHEEL_ITEM_H }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-2xl bg-muted"
          style={{ height: WHEEL_ITEM_H }}
        />
        <WheelColumn
          options={options.map((o) => ({ key: String(o), label: format(o) }))}
          selectedKey={value === null ? null : String(value)}
          onSelect={(key) => onChange(Number(key))}
        />
      </div>

      <FieldError message={error} id={errorId} />
    </div>
  );
}
