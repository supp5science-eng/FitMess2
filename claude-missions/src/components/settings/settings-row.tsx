import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// A single settings row: leading icon + label (+ optional secondary value or
// description), optional trailing content, and a chevron affordance when the
// row navigates. Renders as a `next/link` (internal), an `<a>` (external /
// download), or a plain non-interactive row, depending on props. Theme-token
// styled for light + dark. `danger` tints it destructive (e.g. delete).

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface BaseProps {
  icon?: IconType;
  label: string;
  /** Small value/description shown under (or beside) the label. */
  description?: string;
  /** Right-aligned value (e.g. current phone number), muted. */
  value?: string;
  /** Custom trailing node (overrides the default chevron). */
  trailing?: ReactNode;
  danger?: boolean;
}

interface LinkRowProps extends BaseProps {
  href: string;
  /** Render as a plain `<a>` (external URL, download, mailto) instead of
   * `next/link`. */
  external?: boolean;
}

function RowInner({
  icon: Icon,
  label,
  description,
  value,
  trailing,
  danger,
  interactive,
}: BaseProps & { interactive: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {Icon ? (
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            danger
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground"
          }`}
        >
          <Icon className="size-[18px]" aria-hidden={true} />
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-sm font-medium ${
            danger ? "text-destructive" : "text-foreground"
          }`}
        >
          {label}
        </span>
        {description ? (
          <span className="truncate text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>

      {value ? (
        <span className="shrink-0 truncate text-sm text-muted-foreground">
          {value}
        </span>
      ) : null}

      {trailing ??
        (interactive ? (
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden={true}
          />
        ) : null)}
    </div>
  );
}

/** A navigating settings row. */
export function SettingsLinkRow({ href, external, ...rest }: LinkRowProps) {
  const inner = <RowInner {...rest} interactive />;
  const className =
    "block transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

  if (external) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/** A non-navigating row that just displays info (e.g. account email,
 * app version) -- no chevron, not focusable. */
export function SettingsInfoRow(props: BaseProps) {
  return <RowInner {...props} interactive={false} />;
}
