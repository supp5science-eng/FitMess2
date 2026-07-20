import { Fragment, type ReactNode } from "react";

// A deliberately tiny, dependency-free renderer for the light markdown Lofi
// uses: **bold**, `- ` bullet lists, and blank-line-separated paragraphs.
// It builds React nodes directly (never dangerouslySetInnerHTML), so model
// output can never inject markup.

/** Parses `**bold**` spans within a single line into React nodes. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={key++}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET = /^\s*[-•*]\s+(.*)$/;

/** Renders Lofi's reply as paragraphs + bullet lists with inline bold. */
export function LofiRichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    blocks.push(
      <ul key={key++} className="flex flex-col gap-1 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span>{inline(item)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bulletMatch = line.match(BULLET);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]!);
      continue;
    }
    flushBullets();
    if (line.trim() === "") continue;
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {inline(line)}
      </p>
    );
  }
  flushBullets();

  return <Fragment>{blocks}</Fragment>;
}
