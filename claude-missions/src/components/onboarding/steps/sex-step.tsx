"use client";

import type { Sex } from "@/lib/types/db";
import { useT } from "@/components/i18n/locale-provider";
import { FieldError } from "@/components/onboarding/field-error";
import { IconOptionGroup } from "@/components/onboarding/icon-option-group";

/** Hand-rolled Mars (♂) / Venus (♀) glyphs -- no icon-lib dependency, matching
 *  this codebase's "charts are hand-rolled SVG" convention. `aria-hidden` so the
 *  option's accessible name stays the label text alone. */
function SexIcon({ sex }: { sex: Sex }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-5",
    "aria-hidden": true,
  };
  return sex === "male" ? (
    <svg {...common}>
      <circle cx="10" cy="14" r="6" />
      <path d="M14.5 9.5 21 3" />
      <path d="M17 3h4v4" />
    </svg>
  ) : (
    <svg {...common}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 19h6" />
    </svg>
  );
}

/** F015 step 1 (pol) -- AS-019: collects sex. Icon-card single-select (a gender
 *  glyph, the label, and a radio dot); the picked card gets a bold border. */
export function SexStep({
  value,
  onChange,
  error,
}: {
  value: Sex | null;
  onChange: (value: Sex) => void;
  error?: string;
}) {
  const { t } = useT();
  const SEX_OPTIONS: { value: Sex; label: string; icon: React.ReactNode }[] = [
    { value: "male", label: t("onboarding.sex.male"), icon: <SexIcon sex="male" /> },
    {
      value: "female",
      label: t("onboarding.sex.female"),
      icon: <SexIcon sex="female" />,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("onboarding.sex.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.sex.subtitle")}
        </p>
      </div>
      <IconOptionGroup
        legend={t("onboarding.sex.legend")}
        options={SEX_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}
