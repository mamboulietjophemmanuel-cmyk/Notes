import React from 'react';
import katex from 'katex';
import { HeadingItem, MediaAsset } from '../types/note';
import { Check, Copy, Maximize2, Image as ImageIcon } from 'lucide-react';

export function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split('\n');
  const headings: HeadingItem[] = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].replace(/[*_`~]/g, '').trim();
      const id = `heading-${index}-${rawText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;
      headings.push({
        id,
        level,
        text: rawText,
        lineIndex: index,
      });
    }
  });

  return headings;
}

export function computeDocumentStats(markdown: string) {
  const clean = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/[#*_`>|~-]/g, ' ')
    .trim();

  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const chars = markdown.length;
  const lines = markdown.split('\n').length;
  const readingMinutes = Math.max(1, Math.ceil(words / 200));

  return { words, chars, lines, readingMinutes };
}

function renderLatexToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

interface InlineRenderProps {
  text: string;
  assets: Record<string, MediaAsset>;
  onImageClick?: (src: string, alt: string, rawMatch: string) => void;
  onImageResize?: (rawMatch: string, newWidth: string) => void;
}

function renderInlineElements(
  text: string,
  props: InlineRenderProps,
  keyPrefix = 'inl'
): React.ReactNode[] {
  // Tokenize inline images, inline math ($...$), inline code (`...`), bold (**...**), italic (*...*), links ([...](...))
  const pattern =
    /(!\[[^\]]*\]\([^)]+\)|\$[^$\n]+\$|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (!part) return null;
    const key = `${keyPrefix}-${idx}`;

    // 1. Image: ![alt|width](url)
    if (part.startsWith('![') && part.endsWith(')')) {
      const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        const rawAlt = imgMatch[1];
        const rawUrl = imgMatch[2].trim();
        const [altText, widthSpec] = rawAlt.includes('|')
          ? rawAlt.split('|').map((s) => s.trim())
          : [rawAlt.trim(), '100%'];

        let resolvedSrc = rawUrl;
        let assetMeta: MediaAsset | undefined;
        if (rawUrl.startsWith('asset://')) {
          const assetId = rawUrl.replace('asset://', '').trim();
          assetMeta = props.assets[assetId];
          if (assetMeta) {
            resolvedSrc = assetMeta.dataUrl;
          }
        }

        const validWidths = ['25%', '50%', '75%', '100%'];
        const normalizedWidth = validWidths.includes(widthSpec) ? widthSpec : '100%';

        return (
          <span
            key={key}
            className="group relative my-4 block rounded-xl border border-[var(--adw-border)] bg-[var(--adw-code-bg)] p-2 transition-colors"
            style={{ width: normalizedWidth, maxWidth: '100%' }}
          >
            {resolvedSrc && !resolvedSrc.startsWith('asset://') ? (
              <img
                src={resolvedSrc}
                alt={altText || 'Illustration de la note'}
                referrerPolicy="no-referrer"
                onClick={() => props.onImageClick?.(resolvedSrc, altText, part)}
                className="w-full cursor-zoom-in rounded-lg object-cover transition-opacity hover:opacity-95"
              />
            ) : (
              <span className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 text-xs text-[var(--adw-fg-muted)]">
                <ImageIcon className="h-7 w-7 opacity-60" />
                <span>Image introuvable ({rawUrl})</span>
              </span>
            )}

            {/* Hover Controls for Image Width & Zoom */}
            <span className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--adw-fg-muted)]">
              <span className="truncate font-medium text-[var(--adw-fg-secondary)]">
                {altText || assetMeta?.name || 'Illustration'}
              </span>
              <span className="flex items-center gap-1">
                {props.onImageResize &&
                  validWidths.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onImageResize?.(part, w);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums transition-colors ${
                        normalizedWidth === w
                          ? 'bg-[var(--adw-accent)] text-white font-semibold'
                          : 'hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-muted)]'
                      }`}
                      title={`Redimensionner à ${w}`}
                    >
                      {w}
                    </button>
                  ))}
                {resolvedSrc && !resolvedSrc.startsWith('asset://') && (
                  <button
                    type="button"
                    onClick={() => props.onImageClick?.(resolvedSrc, altText, part)}
                    className="ml-1 rounded p-1 hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-secondary)]"
                    title="Agrandir l'image"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </span>
          </span>
        );
      }
    }

    // 2. Inline Math: $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const formula = part.slice(1, -1);
      const html = renderLatexToHtml(formula, false);
      return (
        <span
          key={key}
          className="inline-block px-0.5 align-middle"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // 3. Inline Code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    // 4. Bold: **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[var(--adw-fg)]">
          {renderInlineElements(part.slice(2, -2), props, `${key}-b`)}
        </strong>
      );
    }

    // 5. Italic: *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{renderInlineElements(part.slice(1, -1), props, `${key}-i`)}</em>;
    }

    // 6. Strikethrough: ~~...~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={key} className="opacity-65">
          {part.slice(2, -2)}
        </del>
      );
    }

    // 7. Link: [label](url)
    if (part.startsWith('[') && part.endsWith(')')) {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--adw-accent)] underline decoration-[var(--adw-accent)]/40 underline-offset-3 hover:decoration-[var(--adw-accent)]"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    return part;
  });
}

function CodeBlockView({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[var(--adw-border)] bg-[var(--adw-code-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--adw-border-subtle)] px-3.5 py-1.5 text-xs text-[var(--adw-fg-muted)]">
        <span className="font-mono">{language || 'texte'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="adw-btn px-2 py-1 text-xs text-[var(--adw-fg-secondary)]"
          title="Copier le bloc de code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copié</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      <pre className="!my-0 !rounded-none !border-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  markdown: string;
  assets: Record<string, MediaAsset>;
  serifMode?: boolean;
  onToggleTask?: (lineIndex: number) => void;
  onImageClick?: (src: string, alt: string, rawMatch: string) => void;
  onImageResize?: (rawMatch: string, newWidth: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  markdown,
  assets,
  serifMode = false,
  onToggleTask,
  onImageClick,
  onImageResize,
}) => {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  const inlineProps: InlineRenderProps = {
    text: '',
    assets,
    onImageClick,
    onImageResize,
  };

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Code Block ```lang ... ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      elements.push(
        <CodeBlockView key={`code-${i}`} code={codeLines.join('\n')} language={lang} />
      );
      continue;
    }

    // 2. Display Math Block $$ ... $$
    if (trimmed.startsWith('$$')) {
      let mathContent = '';
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        mathContent = trimmed.slice(2, -2);
        i++;
      } else {
        const mathLines: string[] = [trimmed.slice(2)];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          mathLines.push(lines[i].trim().slice(0, -2));
          i++;
        }
        mathContent = mathLines.join('\n');
      }
      const html = renderLatexToHtml(mathContent, true);
      elements.push(
        <div
          key={`math-${i}`}
          className="adw-math-block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      continue;
    }

    // 3. Headings (# to ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const rawText = content.replace(/[*_`~]/g, '').trim();
      const id = `heading-${i}-${rawText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;

      const renderedContent = renderInlineElements(content, inlineProps, `h-${i}`);
      if (level === 1) {
        elements.push(
          <h1 key={id} id={id}>
            {renderedContent}
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2 key={id} id={id}>
            {renderedContent}
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3 key={id} id={id}>
            {renderedContent}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={id} id={id}>
            {renderedContent}
          </h4>
        );
      }
      i++;
      continue;
    }

    // 4. Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} />);
      i++;
      continue;
    }

    // 5. GFM Table: | col1 | col2 |
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])
    ) {
      const parseRow = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(lines[i]);
      const alignSpec = parseRow(lines[i + 1]);
      const alignments = alignSpec.map((spec) => {
        if (spec.startsWith(':') && spec.endsWith(':')) return 'center';
        if (spec.endsWith(':')) return 'right';
        return 'left';
      });

      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(parseRow(lines[i]));
        i++;
      }

      elements.push(
        <div key={`table-${i}`} className="table-wrapper">
          <table>
            <thead>
              <tr>
                {headers.map((header, colIdx) => (
                  <th
                    key={`th-${colIdx}`}
                    style={{ textAlign: alignments[colIdx] || 'left' }}
                  >
                    {renderInlineElements(header, inlineProps, `th-${i}-${colIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`}>
                  {headers.map((_, colIdx) => (
                    <td
                      key={`td-${rowIdx}-${colIdx}`}
                      style={{ textAlign: alignments[colIdx] || 'left' }}
                    >
                      {renderInlineElements(
                        row[colIdx] ?? '',
                        inlineProps,
                        `td-${i}-${rowIdx}-${colIdx}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 6. Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`}>
          <p>{renderInlineElements(quoteLines.join(' '), inlineProps, `q-${i}`)}</p>
        </blockquote>
      );
      continue;
    }

    // 7. Task List or Unordered List (- ..., * ...)
    if (/^[-*+]\s+/.test(trimmed)) {
      const listItems: { text: string; lineIdx: number; isTask: boolean; checked: boolean }[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const rawItem = lines[i].trim().replace(/^[-*+]\s+/, '');
        const taskMatch = rawItem.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          listItems.push({
            text: taskMatch[2],
            lineIdx: i,
            isTask: true,
            checked: taskMatch[1].toLowerCase() === 'x',
          });
        } else {
          listItems.push({
            text: rawItem,
            lineIdx: i,
            isTask: false,
            checked: false,
          });
        }
        i++;
      }

      const hasTasks = listItems.some((item) => item.isTask);
      elements.push(
        <ul
          key={`ul-${i}`}
          className={hasTasks ? '!list-none !pl-1 space-y-2' : undefined}
        >
          {listItems.map((item) =>
            item.isTask ? (
              <li
                key={`li-${item.lineIdx}`}
                className="flex items-start gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--adw-hover-bg)]"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => onToggleTask?.(item.lineIdx)}
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--adw-border)] accent-[var(--adw-accent)]"
                />
                <span
                  className={
                    item.checked ? 'line-through text-[var(--adw-fg-muted)]' : undefined
                  }
                >
                  {renderInlineElements(item.text, inlineProps, `task-${item.lineIdx}`)}
                </span>
              </li>
            ) : (
              <li key={`li-${item.lineIdx}`}>
                {renderInlineElements(item.text, inlineProps, `li-${item.lineIdx}`)}
              </li>
            )
          )}
        </ul>
      );
      continue;
    }

    // 8. Ordered List (1. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: { text: string; lineIdx: number }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push({
          text: lines[i].trim().replace(/^\d+\.\s+/, ''),
          lineIdx: i,
        });
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`}>
          {listItems.map((item) => (
            <li key={`oli-${item.lineIdx}`}>
              {renderInlineElements(item.text, inlineProps, `oli-${item.lineIdx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Standard Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    elements.push(
      <p key={`p-${i}`}>
        {renderInlineElements(paraLines.join(' '), inlineProps, `p-${i}`)}
      </p>
    );
  }

  return (
    <div className={`adw-markdown ${serifMode ? 'adw-markdown-serif' : ''}`}>
      {elements}
    </div>
  );
};
