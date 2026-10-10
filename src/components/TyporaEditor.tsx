import React, { useState, useRef, useEffect, useMemo } from 'react';
import katex from 'katex';
import { MediaAsset } from '../types/note';
import {
  Check,
  Copy,
  Maximize2,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code2,
  Sigma,
  Table as TableIcon,
  ListChecks,
  Quote,
  WrapText,
  Move,
} from 'lucide-react';

export type ImageWrapMode = 'break' | 'wrap';
export type ImageWrapSide = 'left' | 'right';

export type MdBlockType =
  | 'heading'
  | 'paragraph'
  | 'math'
  | 'code'
  | 'table'
  | 'blockquote'
  | 'list'
  | 'hr'
  | 'image';

export interface MdBlock {
  id: string;
  type: MdBlockType;
  raw: string;
  startLine: number;
}

export function detectBlockType(raw: string): MdBlockType {
  const trimmedStart = raw.trimStart();
  const trimmed = raw.trim();
  const lines = raw.split('\n');

  if (trimmed.startsWith('```')) return 'code';
  if (trimmed.startsWith('$$')) return 'math';
  if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) return 'image';
  if (/^#{1,6}(\s|$)/.test(trimmedStart)) return 'heading';
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return 'hr';
  if (
    trimmed.startsWith('|') &&
    lines.length >= 2 &&
    /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[1])
  ) {
    return 'table';
  }
  if (trimmed.startsWith('>')) return 'blockquote';
  if (/^([-*+]|\d+\.)(\s|$)/.test(trimmedStart)) return 'list';
  return 'paragraph';
}

export function parseMarkdownIntoBlocks(markdown: string): MdBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const trimmedStart = line.trimStart();

    if (trimmed === '') {
      i++;
      continue;
    }

    const startLine = i;

    // 1. Code Block ```lang ... ```
    if (trimmed.startsWith('```')) {
      const buf: string[] = [line];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `blk-${startLine}`,
        type: 'code',
        raw: buf.join('\n'),
        startLine,
      });
      continue;
    }

    // 2. Math Block $$ ... $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        blocks.push({
          id: `blk-${startLine}`,
          type: 'math',
          raw: line,
          startLine,
        });
        i++;
        continue;
      }
      const buf: string[] = [line];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith('$$')) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `blk-${startLine}`,
        type: 'math',
        raw: buf.join('\n'),
        startLine,
      });
      continue;
    }

    // 3. Standalone Image Block ![alt|width](url)
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      blocks.push({
        id: `blk-${startLine}`,
        type: 'image',
        raw: trimmed,
        startLine,
      });
      i++;
      continue;
    }

    // 4. Heading (# to ######, including "# " or "#" while editing)
    if (/^#{1,6}(\s|$)/.test(trimmedStart)) {
      blocks.push({
        id: `blk-${startLine}`,
        type: 'heading',
        raw: line,
        startLine,
      });
      i++;
      continue;
    }

    // 5. Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({
        id: `blk-${startLine}`,
        type: 'hr',
        raw: '---',
        startLine,
      });
      i++;
      continue;
    }

    // 6. GFM Table
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])
    ) {
      const buf: string[] = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `blk-${startLine}`,
        type: 'table',
        raw: buf.join('\n'),
        startLine,
      });
      continue;
    }

    // 7. Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `blk-${startLine}`,
        type: 'blockquote',
        raw: buf.join('\n'),
        startLine,
      });
      continue;
    }

    // 8. List item (-, *, +, 1.)
    if (/^([-*+]|\d+\.)(\s|$)/.test(trimmedStart)) {
      const buf: string[] = [];
      while (
        i < lines.length &&
        /^([-*+]|\d+\.)(\s|$)/.test(lines[i].trimStart())
      ) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `blk-${startLine}`,
        type: 'list',
        raw: buf.join('\n'),
        startLine,
      });
      continue;
    }

    // 9. Paragraph (Guaranteed to consume at least the current line so `i` always advances)
    const buf: string[] = [lines[i]];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}(\s|$)/.test(lines[i].trimStart()) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('$$') &&
      !lines[i].trim().startsWith('>') &&
      !(
        lines[i].trim().startsWith('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])
      ) &&
      !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[i].trim()) &&
      !/^([-*+]|\d+\.)(\s|$)/.test(lines[i].trimStart()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({
      id: `blk-${startLine}`,
      type: 'paragraph',
      raw: buf.join('\n'),
      startLine,
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      id: 'blk-0',
      type: 'paragraph',
      raw: '',
      startLine: 0,
    });
  }

  return blocks;
}

export function serializeBlocksToMarkdown(blocks: MdBlock[]): string {
  return blocks.map((b) => b.raw).join('\n\n');
}

function renderLatexInline(latex: string, displayMode: boolean): string {
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

function renderInlineFormatting(
  text: string,
  assets: Record<string, MediaAsset>,
  onImageClick?: (src: string, alt: string) => void,
  keyPrefix = 'ty-inl'
): React.ReactNode[] {
  const pattern =
    /(!\[[^\]]*\]\([^)]+\)|\$[^$\n]+\$|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(pattern);
  return parts.map((part, idx) => {
    if (!part) return null;
    const key = `${keyPrefix}-${idx}`;

    // Inline image
    if (part.startsWith('![') && part.endsWith(')')) {
      const m = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (m) {
        const [altText, widthSpec] = m[1].includes('|')
          ? m[1].split('|').map((s) => s.trim())
          : [m[1].trim(), '100%'];
        let src = m[2].trim();
        if (src.startsWith('asset://')) {
          const id = src.replace('asset://', '').trim();
          if (assets[id]) src = assets[id].dataUrl;
        }
        return (
          <img
            key={key}
            src={src}
            alt={altText}
            referrerPolicy="no-referrer"
            style={{ width: widthSpec, maxWidth: '100%' }}
            onClick={(e) => {
              e.stopPropagation();
              onImageClick?.(src, altText);
            }}
            className="my-2 inline-block rounded-lg border border-[var(--adw-border)] object-cover"
          />
        );
      }
    }

    // Inline Math $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const html = renderLatexInline(part.slice(1, -1), false);
      return (
        <span
          key={key}
          className="inline-block rounded px-1 align-middle transition-colors hover:bg-[var(--adw-accent-soft)]"
          title={`LaTeX : ${part.slice(1, -1)}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Inline code `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    // Bold **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[var(--adw-fg)]">
          {renderInlineFormatting(
            part.slice(2, -2),
            assets,
            onImageClick,
            `${key}-b`
          )}
        </strong>
      );
    }

    // Italic *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={key}>
          {renderInlineFormatting(
            part.slice(1, -1),
            assets,
            onImageClick,
            `${key}-i`
          )}
        </em>
      );
    }

    // Strikethrough ~~...~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4) {
      return (
        <del key={key} className="opacity-65">
          {part.slice(2, -2)}
        </del>
      );
    }

    // Link [label](url)
    if (part.startsWith('[') && part.endsWith(')')) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        return (
          <a
            key={key}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-[var(--adw-accent)] underline decoration-[var(--adw-accent)]/40 underline-offset-3 hover:decoration-[var(--adw-accent)]"
          >
            {m[1]}
          </a>
        );
      }
    }

    return part;
  });
}

function getEditableSelectionOffsets(el: HTMLElement): {
  start: number;
  end: number;
} {
  const fullText = el.textContent || '';
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { start: fullText.length, end: fullText.length };
  }
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
    return { start: fullText.length, end: fullText.length };
  }

  const preStart = range.cloneRange();
  preStart.selectNodeContents(el);
  preStart.setEnd(range.startContainer, range.startOffset);
  const start = preStart.toString().length;

  const preEnd = range.cloneRange();
  preEnd.selectNodeContents(el);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const end = preEnd.toString().length;

  return { start, end };
}

function setEditableSelectionOffsets(
  el: HTMLElement,
  start: number,
  end: number = start
) {
  const sel = window.getSelection();
  if (!sel) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let currentNode = walker.nextNode() as Text | null;

  if (!currentNode) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  let charIndex = 0;
  let startNode: Node = currentNode;
  let startOffset = 0;
  let endNode: Node = currentNode;
  let endOffset = 0;
  let foundStart = false;
  let foundEnd = false;

  while (currentNode) {
    const nodeLen = currentNode.length;
    if (!foundStart && start <= charIndex + nodeLen) {
      startNode = currentNode;
      startOffset = Math.max(0, start - charIndex);
      foundStart = true;
    }
    if (!foundEnd && end <= charIndex + nodeLen) {
      endNode = currentNode;
      endOffset = Math.max(0, end - charIndex);
      foundEnd = true;
      break;
    }
    charIndex += nodeLen;
    endNode = currentNode;
    endOffset = nodeLen;
    currentNode = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  sel.removeAllRanges();
  sel.addRange(range);
}

const AutoTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  onSplitBlock: (before: string, after: string) => void;
  onMergePrev: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onPasteImage?: (e: React.ClipboardEvent<HTMLElement>) => void;
  initialClickPoint?: { x: number; y: number } | null;
  initialCaretOffset?: number | null;
  onConsumeInitialCaret?: () => void;
  className?: string;
  placeholder?: string;
}> = ({
  value,
  onChange,
  onBlur,
  onSplitBlock,
  onMergePrev,
  onMovePrev,
  onMoveNext,
  onPasteImage,
  initialClickPoint,
  initialCaretOffset,
  onConsumeInitialCaret,
  className = '',
  placeholder,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null
  );

  // Sync external value changes without clobbering active typing selection
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((el.textContent || '') !== value) {
      el.textContent = value;
      if (pendingSelectionRef.current) {
        setEditableSelectionOffsets(
          el,
          pendingSelectionRef.current.start,
          pendingSelectionRef.current.end
        );
        pendingSelectionRef.current = null;
      }
    } else if (pendingSelectionRef.current) {
      setEditableSelectionOffsets(
        el,
        pendingSelectionRef.current.start,
        pendingSelectionRef.current.end
      );
      pendingSelectionRef.current = null;
    }
  }, [value]);

  // Focus and place caret at click location (or explicit offset / end of block) on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((el.textContent || '') !== value) {
      el.textContent = value;
    }
    el.focus();

    if (typeof initialCaretOffset === 'number') {
      const clamped = Math.max(0, Math.min(value.length, initialCaretOffset));
      setEditableSelectionOffsets(el, clamped, clamped);
      onConsumeInitialCaret?.();
      return;
    }

    if (initialClickPoint && value.length > 0 && document.caretRangeFromPoint) {
      try {
        const clickedRange = document.caretRangeFromPoint(
          initialClickPoint.x,
          initialClickPoint.y
        );
        if (clickedRange && el.contains(clickedRange.startContainer)) {
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(clickedRange);
            onConsumeInitialCaret?.();
            return;
          }
        }
      } catch {
        // Fallback to end of text
      }
    }

    setEditableSelectionOffsets(el, value.length, value.length);
    if (initialClickPoint) {
      onConsumeInitialCaret?.();
    }
  }, []);

  const applyProgrammaticChange = (
    nextVal: string,
    nextCaretStart: number,
    nextCaretEnd: number = nextCaretStart
  ) => {
    const el = ref.current;
    pendingSelectionRef.current = { start: nextCaretStart, end: nextCaretEnd };
    if (el) {
      el.textContent = nextVal;
      setEditableSelectionOffsets(el, nextCaretStart, nextCaretEnd);
    }
    onChange(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    const { start: selectionStart, end: selectionEnd } =
      getEditableSelectionOffsets(el);

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        const sel = value.slice(selectionStart, selectionEnd) || 'texte';
        const next =
          value.slice(0, selectionStart) +
          `**${sel}**` +
          value.slice(selectionEnd);
        applyProgrammaticChange(
          next,
          selectionStart + 2,
          selectionStart + 2 + sel.length
        );
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        const sel = value.slice(selectionStart, selectionEnd) || 'texte';
        const next =
          value.slice(0, selectionStart) +
          `*${sel}*` +
          value.slice(selectionEnd);
        applyProgrammaticChange(
          next,
          selectionStart + 1,
          selectionStart + 1 + sel.length
        );
        return;
      }
    }

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const next =
        value.slice(0, selectionStart) + '\n' + value.slice(selectionEnd);
      applyProgrammaticChange(next, selectionStart + 1);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);
      const currentLine = before.split('\n').pop() || '';

      if (value.trim() === '$$') {
        e.preventDefault();
        onChange(
          '$$\n\\int_{-\\infty}^{+\\infty} e^{-x^2}\\, \\mathrm{d}x = \\sqrt{\\pi}\n$$'
        );
        return;
      }
      if (value.trim().startsWith('```') && !value.includes('\n')) {
        e.preventDefault();
        const lang = value.trim().slice(3) || 'json';
        onChange(`\`\`\`${lang}\n\n\`\`\``);
        return;
      }

      const taskMatch = currentLine.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      const bulletMatch = currentLine.match(/^(\s*[-*+]\s+)(.*)$/);
      const numMatch = currentLine.match(/^(\s*)(\d+)(\.\s+)(.*)$/);

      if (taskMatch) {
        e.preventDefault();
        if (!taskMatch[2].trim() && after.trim() === '') {
          const trimmedBefore = before.replace(
            /\n?\s*[-*+]\s+\[[ xX]\]\s*$/,
            ''
          );
          onSplitBlock(trimmedBefore, '');
        } else {
          const insert = `\n- [ ] `;
          const next = `${before}${insert}${after}`;
          applyProgrammaticChange(next, before.length + insert.length);
        }
        return;
      }

      if (bulletMatch) {
        e.preventDefault();
        if (!bulletMatch[2].trim() && after.trim() === '') {
          const trimmedBefore = before.replace(/\n?\s*[-*+]\s*$/, '');
          onSplitBlock(trimmedBefore, '');
        } else {
          const insert = `\n${bulletMatch[1]}`;
          const next = `${before}${insert}${after}`;
          applyProgrammaticChange(next, before.length + insert.length);
        }
        return;
      }

      if (numMatch) {
        e.preventDefault();
        if (!numMatch[4].trim() && after.trim() === '') {
          const trimmedBefore = before.replace(/\n?\s*\d+\.\s*$/, '');
          onSplitBlock(trimmedBefore, '');
        } else {
          const nextNum = parseInt(numMatch[2], 10) + 1;
          const insert = `\n${numMatch[1]}${nextNum}${numMatch[3]}`;
          const next = `${before}${insert}${after}`;
          applyProgrammaticChange(next, before.length + insert.length);
        }
        return;
      }

      e.preventDefault();
      onSplitBlock(before, after);
      return;
    }

    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      e.preventDefault();
      onMergePrev();
      return;
    }

    if (e.key === 'ArrowUp' && selectionStart === 0) {
      e.preventDefault();
      onMovePrev();
      return;
    }

    if (e.key === 'ArrowDown' && selectionEnd === value.length) {
      e.preventDefault();
      onMoveNext();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      onBlur();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    const rawText = el.textContent || '';
    if (!rawText && el.innerHTML !== '') {
      el.innerHTML = '';
    }
    onChange(rawText);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLSpanElement>) => {
    onPasteImage?.(e);
    if (e.defaultPrevented) return;

    e.preventDefault();
    const pastedText = e.clipboardData
      .getData('text/plain')
      .replace(/\r\n/g, '\n');
    if (!pastedText) return;

    const el = e.currentTarget;
    const { start, end } = getEditableSelectionOffsets(el);
    const next = value.slice(0, start) + pastedText + value.slice(end);
    applyProgrammaticChange(next, start + pastedText.length);
  };

  return (
    <>
      <span
        ref={ref}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        spellCheck={true}
        onInput={handleInput}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`inline whitespace-pre-wrap break-words rounded bg-[var(--adw-accent-soft)]/30 px-1 -mx-1 py-0.5 box-decoration-clone caret-[var(--adw-accent)] focus:outline-none ${className}`}
      />
      {!value && placeholder && (
        <span
          onMouseDown={(e) => {
            e.preventDefault();
            ref.current?.focus();
          }}
          className="pointer-events-none select-none text-[var(--adw-fg-muted)] opacity-60"
        >
          {placeholder}
        </span>
      )}
    </>
  );
};

const WysiwygTableBlock: React.FC<{
  raw: string;
  assets: Record<string, MediaAsset>;
  onChange: (newRaw: string) => void;
  onDeleteBlock: () => void;
}> = ({ raw, assets, onChange, onDeleteBlock }) => {
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(
    null
  );
  const [showRaw, setShowRaw] = useState(false);

  const parsed = useMemo(() => {
    const lines = raw.trim().split('\n');
    const parseRow = (rowStr: string) =>
      rowStr
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());

    const headers = lines[0] ? parseRow(lines[0]) : ['Colonne 1', 'Colonne 2'];
    const alignSpec = lines[1] ? parseRow(lines[1]) : headers.map(() => ':---');
    const alignments: ('left' | 'center' | 'right')[] = alignSpec.map((spec) => {
      if (spec.startsWith(':') && spec.endsWith(':')) return 'center';
      if (spec.endsWith(':')) return 'right';
      return 'left';
    });

    const rows = lines.slice(2).map(parseRow);
    return { headers, alignments, rows };
  }, [raw]);

  const rebuildTableMarkdown = (
    headers: string[],
    alignments: ('left' | 'center' | 'right')[],
    rows: string[][]
  ) => {
    const hLine = `| ${headers.map((h) => h || ' ').join(' | ')} |`;
    const aLine = `| ${alignments
      .map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---'))
      .join(' | ')} |`;
    const rLines = rows.map(
      (r) => `| ${headers.map((_, i) => r[i] || ' ').join(' | ')} |`
    );
    onChange([hLine, aLine, ...rLines].join('\n'));
  };

  if (showRaw) {
    return (
      <div className="my-4 rounded-xl border border-[var(--adw-accent)] bg-[var(--adw-code-bg)] p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--adw-fg-muted)]">
          <span className="font-mono">Source Markdown du tableau</span>
          <button
            type="button"
            onClick={() => setShowRaw(false)}
            className="adw-btn adw-btn-suggested px-2.5 py-1 text-xs font-medium"
          >
            Retour au tableau visuel
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(4, raw.split('\n').length)}
          className="w-full resize-y rounded-lg border border-[var(--adw-border)] bg-[var(--adw-view-bg)] p-2.5 font-mono text-xs text-[var(--adw-fg)] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group/table relative my-5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 opacity-0 transition-opacity group-hover/table:opacity-100 focus-within:opacity-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const nextRows = [...parsed.rows, parsed.headers.map(() => 'Nouvelle valeur')];
              rebuildTableMarkdown(parsed.headers, parsed.alignments, nextRows);
            }}
            className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2 py-0.5 text-[11px] font-medium"
          >
            <Plus className="h-3 w-3" />
            <span>Ligne</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const nextHeaders = [...parsed.headers, `Col ${parsed.headers.length + 1}`];
              const nextAligns: ('left' | 'center' | 'right')[] = [
                ...parsed.alignments,
                'left',
              ];
              const nextRows = parsed.rows.map((r) => [...r, '-']);
              rebuildTableMarkdown(nextHeaders, nextAligns, nextRows);
            }}
            className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2 py-0.5 text-[11px] font-medium"
          >
            <Plus className="h-3 w-3" />
            <span>Colonne</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowRaw(true)}
            className="adw-btn px-2 py-0.5 text-[11px] text-[var(--adw-fg-muted)]"
            title="Voir la syntaxe Markdown du tableau"
          >
            <Code2 className="h-3 w-3" />
            <span>Markdown</span>
          </button>
          <button
            type="button"
            onClick={onDeleteBlock}
            className="adw-btn p-1 text-[var(--adw-fg-muted)] hover:text-red-500"
            title="Supprimer le tableau"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="table-wrapper !my-0">
        <table>
          <thead>
            <tr>
              {parsed.headers.map((header, colIdx) => {
                const align = parsed.alignments[colIdx] || 'left';
                const isEditing =
                  editingCell?.r === -1 && editingCell?.c === colIdx;
                return (
                  <th
                    key={`th-${colIdx}`}
                    style={{ textAlign: align }}
                    onClick={() => setEditingCell({ r: -1, c: colIdx })}
                    className="group/th relative cursor-text"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={header}
                        autoFocus
                        onChange={(e) => {
                          const nextH = [...parsed.headers];
                          nextH[colIdx] = e.target.value;
                          rebuildTableMarkdown(
                            nextH,
                            parsed.alignments,
                            parsed.rows
                          );
                        }}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape')
                            setEditingCell(null);
                        }}
                        style={{ textAlign: align }}
                        className="w-full rounded bg-[var(--adw-view-bg)] px-1.5 py-0.5 text-xs font-semibold text-[var(--adw-fg)] ring-1 ring-[var(--adw-accent)] focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex-1">
                          {renderInlineFormatting(header, assets)}
                        </span>
                        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/th:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const order: ('left' | 'center' | 'right')[] = [
                                'left',
                                'center',
                                'right',
                              ];
                              const nextA = [...parsed.alignments];
                              nextA[colIdx] =
                                order[(order.indexOf(align) + 1) % 3];
                              rebuildTableMarkdown(
                                parsed.headers,
                                nextA,
                                parsed.rows
                              );
                            }}
                            className="rounded p-0.5 hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-muted)]"
                            title="Changer l'alignement de la colonne"
                          >
                            {align === 'left' && <AlignLeft className="h-3 w-3" />}
                            {align === 'center' && (
                              <AlignCenter className="h-3 w-3 text-[var(--adw-accent)]" />
                            )}
                            {align === 'right' && (
                              <AlignRight className="h-3 w-3 text-[var(--adw-accent)]" />
                            )}
                          </button>
                          {parsed.headers.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextH = parsed.headers.filter(
                                  (_, i) => i !== colIdx
                                );
                                const nextA = parsed.alignments.filter(
                                  (_, i) => i !== colIdx
                                );
                                const nextR = parsed.rows.map((r) =>
                                  r.filter((_, i) => i !== colIdx)
                                );
                                rebuildTableMarkdown(nextH, nextA, nextR);
                              }}
                              className="rounded p-0.5 hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-muted)] hover:text-red-500"
                              title="Supprimer cette colonne"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, rowIdx) => (
              <tr key={`tr-${rowIdx}`} className="group/tr">
                {parsed.headers.map((_, colIdx) => {
                  const align = parsed.alignments[colIdx] || 'left';
                  const cellVal = row[colIdx] ?? '';
                  const isEditing =
                    editingCell?.r === rowIdx && editingCell?.c === colIdx;

                  return (
                    <td
                      key={`td-${rowIdx}-${colIdx}`}
                      style={{ textAlign: align }}
                      onClick={() => setEditingCell({ r: rowIdx, c: colIdx })}
                      className="relative cursor-text"
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={cellVal}
                          autoFocus
                          onChange={(e) => {
                            const nextR = parsed.rows.map((r) => [...r]);
                            nextR[rowIdx][colIdx] = e.target.value;
                            rebuildTableMarkdown(
                              parsed.headers,
                              parsed.alignments,
                              nextR
                            );
                          }}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape')
                              setEditingCell(null);
                          }}
                          style={{ textAlign: align }}
                          className="w-full rounded bg-[var(--adw-view-bg)] px-1.5 py-0.5 font-mono text-xs tabular-nums text-[var(--adw-fg)] ring-1 ring-[var(--adw-accent)] focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <span className="flex-1">
                            {renderInlineFormatting(cellVal, assets)}
                          </span>
                          {colIdx === parsed.headers.length - 1 &&
                            parsed.rows.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextR = parsed.rows.filter(
                                    (_, i) => i !== rowIdx
                                  );
                                  rebuildTableMarkdown(
                                    parsed.headers,
                                    parsed.alignments,
                                    nextR
                                  );
                                }}
                                className="rounded p-0.5 opacity-0 transition-opacity group-hover/tr:opacity-100 hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-muted)] hover:text-red-500"
                                title="Supprimer cette ligne"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IMAGE_WRAP_OPTIONS: {
  id: ImageWrapMode;
  label: string;
  shortLabel: string;
  desc: string;
}[] = [
  {
    id: 'break',
    label: 'Haut et bas',
    shortLabel: 'Haut et bas',
    desc: 'L’image occupe sa propre ligne, le texte reste au-dessus et en dessous.',
  },
  {
    id: 'wrap',
    label: 'Épouser le texte',
    shortLabel: 'Épouser',
    desc: 'Déplacez l’image avec sa pastille supérieure : le texte s’organise dynamiquement autour d’elle.',
  },
];

function parseImageMeta(rawAlt: string): {
  caption: string;
  widthPct: number;
  wrapMode: ImageWrapMode;
  wrapSide: ImageWrapSide;
} {
  const parts = rawAlt.split('|').map((s) => s.trim());
  const caption = parts[0] || '';
  let widthPct = 100;
  if (parts[1]) {
    const num = parseInt(parts[1].replace('%', ''), 10);
    if (!Number.isNaN(num)) {
      widthPct = Math.min(100, Math.max(15, num));
    }
  }

  let wrapMode: ImageWrapMode = 'break';
  let wrapSide: ImageWrapSide = 'left';

  const rawMode = parts[2] || '';
  if (rawMode === 'wrap' || rawMode === 'wrap-left') {
    wrapMode = 'wrap';
    wrapSide = 'left';
  } else if (rawMode === 'wrap-right') {
    wrapMode = 'wrap';
    wrapSide = 'right';
  }

  if (parts[3] === 'left' || parts[3] === 'right') {
    wrapSide = parts[3];
  }

  return { caption, widthPct, wrapMode, wrapSide };
}

function serializeImageMarkdown(
  caption: string,
  widthPct: number,
  wrapMode: ImageWrapMode,
  wrapSide: ImageWrapSide,
  rawUrl: string
): string {
  const clamped = Math.min(100, Math.max(15, Math.round(widthPct)));
  if (wrapMode === 'break') {
    return `![${caption}|${clamped}%](${rawUrl})`;
  }
  return `![${caption}|${clamped}%|wrap|${wrapSide}](${rawUrl})`;
}

const WysiwygImageBlock: React.FC<{
  raw: string;
  assets: Record<string, MediaAsset>;
  onChange: (newRaw: string) => void;
  onDelete: () => void;
  onMoveWrapVertical?: (clientY: number, updatedRaw: string) => void;
  onImageClick?: (src: string, alt: string) => void;
}> = ({
  raw,
  assets,
  onChange,
  onDelete,
  onMoveWrapVertical,
  onImageClick,
}) => {
  const imgMatch = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  const rawAlt = imgMatch ? imgMatch[1] : '';
  const rawUrl = imgMatch ? imgMatch[2].trim() : '';

  const parsed = useMemo(() => parseImageMeta(rawAlt), [rawAlt]);
  const [liveWidth, setLiveWidth] = useState<number>(parsed.widthPct);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [liveSide, setLiveSide] = useState<ImageWrapSide>(parsed.wrapSide);
  const [isDraggingPos, setIsDraggingPos] = useState<boolean>(false);
  const [wrapMenuOpen, setWrapMenuOpen] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onMoveWrapVerticalRef = useRef(onMoveWrapVertical);

  useEffect(() => {
    onChangeRef.current = onChange;
    onMoveWrapVerticalRef.current = onMoveWrapVertical;
  }, [onChange, onMoveWrapVertical]);

  useEffect(() => {
    if (!isResizing) setLiveWidth(parsed.widthPct);
  }, [parsed.widthPct, isResizing]);

  useEffect(() => {
    if (!isDraggingPos) {
      setLiveSide(parsed.wrapSide);
    }
  }, [parsed.wrapSide, isDraggingPos]);

  useEffect(() => {
    if (!wrapMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setWrapMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [wrapMenuOpen]);

  let resolvedSrc = rawUrl;
  if (rawUrl.startsWith('asset://')) {
    const assetId = rawUrl.replace('asset://', '').trim();
    const assetMeta = assets[assetId];
    if (assetMeta) resolvedSrc = assetMeta.dataUrl;
  }

  const handleCornerResizeStart = (
    e: React.MouseEvent,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const editorContainer =
      (cardEl.closest('.adw-markdown') as HTMLElement | null) ||
      cardEl.parentElement;
    const parentWidth = editorContainer
      ? editorContainer.clientWidth - 64
      : 720;
    const startX = e.clientX;
    const startWidthPx = cardEl.getBoundingClientRect().width;
    const isLeftCorner = corner === 'nw' || corner === 'sw';

    setIsResizing(true);
    let latestPct = liveWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = isLeftCorner
        ? startX - moveEvent.clientX
        : moveEvent.clientX - startX;
      const multiplier = parsed.wrapMode === 'break' ? 1.5 : 1.0;
      const nextWidthPx = startWidthPx + deltaX * multiplier;
      const nextPct = Math.min(
        100,
        Math.max(15, Math.round((nextWidthPx / Math.max(240, parentWidth)) * 100))
      );
      latestPct = nextPct;
      setLiveWidth(nextPct);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onChange(
        serializeImageMarkdown(
          parsed.caption,
          latestPct,
          parsed.wrapMode,
          liveSide,
          rawUrl
        )
      );
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Dragging via the top pill ("Déplacer")
  const handlePillDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const cardEl = cardRef.current;
    if (!cardEl) return;
    const editorContainer = cardEl.closest(
      '.adw-markdown'
    ) as HTMLElement | null;

    setIsDraggingPos(true);
    let currentSide: ImageWrapSide = liveSide;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (parsed.wrapMode === 'wrap' && editorContainer) {
        const rect = editorContainer.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const nextSide: ImageWrapSide =
          moveEvent.clientX < midX ? 'left' : 'right';
        if (nextSide !== currentSide) {
          currentSide = nextSide;
          setLiveSide(nextSide);
        }
      }

      const nextRaw = serializeImageMarkdown(
        parsed.caption,
        liveWidth,
        parsed.wrapMode,
        currentSide,
        rawUrl
      );
      onMoveWrapVerticalRef.current?.(moveEvent.clientY, nextRaw);
    };

    const onMouseUp = () => {
      setIsDraggingPos(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onChangeRef.current(
        serializeImageMarkdown(
          parsed.caption,
          liveWidth,
          parsed.wrapMode,
          currentSide,
          rawUrl
        )
      );
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const selectWrapMode = (newMode: ImageWrapMode) => {
    setWrapMenuOpen(false);
    const targetWidth =
      newMode === 'wrap' && liveWidth > 75 ? 45 : liveWidth;

    setLiveWidth(targetWidth);
    onChange(
      serializeImageMarkdown(
        parsed.caption,
        targetWidth,
        newMode,
        liveSide,
        rawUrl
      )
    );
  };

  const cardStyle: React.CSSProperties = {
    width: `${liveWidth}%`,
    maxWidth: '100%',
  };

  if (parsed.wrapMode === 'wrap') {
    if (liveSide === 'left') {
      cardStyle.float = 'left';
      cardStyle.marginRight = '1.5rem';
      cardStyle.marginBottom = '0.85rem';
      cardStyle.marginTop = '0.5rem';
      cardStyle.shapeOutside = 'margin-box';
    } else {
      cardStyle.float = 'right';
      cardStyle.marginLeft = '1.5rem';
      cardStyle.marginBottom = '0.85rem';
      cardStyle.marginTop = '0.5rem';
      cardStyle.shapeOutside = 'margin-box';
    }
  }

  const activeWrapMeta =
    IMAGE_WRAP_OPTIONS.find((o) => o.id === parsed.wrapMode) ||
    IMAGE_WRAP_OPTIONS[0];

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className={`group relative z-20 rounded-xl border border-[var(--adw-border)] bg-[var(--adw-code-bg)] p-2.5 transition-shadow select-none hover:border-[var(--adw-accent)]/60 ${
        parsed.wrapMode === 'break' ? 'my-5 mx-auto clear-both' : ''
      } ${
        isResizing || isDraggingPos ? 'ring-2 ring-[var(--adw-accent)]' : ''
      }`}
    >
      {/* Top Floating Control Pill ("Déplacer") */}
      <div
        onMouseDown={handlePillDragStart}
        title={
          parsed.wrapMode === 'wrap'
            ? 'Maintenir et glisser pour déplacer l’image (gauche, droite, haut ou bas autour du texte)'
            : 'Maintenir et glisser pour déplacer l’image entre les paragraphes'
        }
        className="
          pointer-events-auto absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 cursor-grab
          items-center gap-1 rounded-full border border-[var(--adw-border)] bg-[var(--adw-card-bg)]
          px-2.5 py-0.5 text-[10px] font-medium text-[var(--adw-fg-secondary)] shadow-md
          opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing
        "
      >
        <Move className="h-3 w-3 text-[var(--adw-accent)]" />
        <span>Déplacer</span>
      </div>

      {/* 4 Corner Drag-Resize Handles */}
      <div
        onMouseDown={(e) => handleCornerResizeStart(e, 'nw')}
        title="Maintenir et glisser pour redimensionner l’image"
        className="
          pointer-events-auto absolute -top-1.5 -left-1.5 z-30 h-3.5 w-3.5 cursor-nwse-resize
          rounded-full border-2 border-white bg-[var(--adw-accent)] shadow
          opacity-0 transition-opacity group-hover:opacity-100
        "
      />
      <div
        onMouseDown={(e) => handleCornerResizeStart(e, 'ne')}
        title="Maintenir et glisser pour redimensionner l’image"
        className="
          pointer-events-auto absolute -top-1.5 -right-1.5 z-30 h-3.5 w-3.5 cursor-nesw-resize
          rounded-full border-2 border-white bg-[var(--adw-accent)] shadow
          opacity-0 transition-opacity group-hover:opacity-100
        "
      />
      <div
        onMouseDown={(e) => handleCornerResizeStart(e, 'sw')}
        title="Maintenir et glisser pour redimensionner l’image"
        className="
          pointer-events-auto absolute -bottom-1.5 -left-1.5 z-30 h-3.5 w-3.5 cursor-nesw-resize
          rounded-full border-2 border-white bg-[var(--adw-accent)] shadow
          opacity-0 transition-opacity group-hover:opacity-100
        "
      />
      <div
        onMouseDown={(e) => handleCornerResizeStart(e, 'se')}
        title="Maintenir et glisser pour redimensionner l’image"
        className="
          pointer-events-auto absolute -bottom-1.5 -right-1.5 z-30 h-3.5 w-3.5 cursor-nwse-resize
          rounded-full border-2 border-white bg-[var(--adw-accent)] shadow
          opacity-0 transition-opacity group-hover:opacity-100
        "
      />

      {/* Live Indicator Badge while resizing or dragging */}
      {(isResizing || isDraggingPos) && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="rounded-lg bg-black/75 px-3 py-1 font-mono text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
            {isResizing
              ? `${liveWidth}%`
              : parsed.wrapMode === 'wrap'
              ? `Épouser (${liveSide === 'left' ? 'Gauche' : 'Droite'})`
              : 'Déplacement...'}
          </span>
        </div>
      )}

      {/* Main Image Graphic */}
      {resolvedSrc && !resolvedSrc.startsWith('asset://') ? (
        <img
          src={resolvedSrc}
          alt={parsed.caption || 'Illustration'}
          referrerPolicy="no-referrer"
          draggable={false}
          onClick={() => onImageClick?.(resolvedSrc, parsed.caption)}
          className="w-full cursor-zoom-in rounded-lg object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs text-[var(--adw-fg-muted)]">
          <ImageIcon className="h-7 w-7 opacity-60" />
          <span>Image introuvable ({rawUrl})</span>
        </div>
      )}

      {/* Clean Minimalist Footer: Caption + Wrap Mode + Fullscreen + Delete */}
      <div className="pointer-events-auto relative z-30 mt-2 flex items-center justify-between gap-1.5 px-0.5 text-xs">
        <input
          type="text"
          value={parsed.caption}
          onChange={(e) => {
            onChange(
              serializeImageMarkdown(
                e.target.value,
                liveWidth,
                parsed.wrapMode,
                liveSide,
                rawUrl
              )
            );
          }}
          placeholder="Légende..."
          className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-[var(--adw-fg-secondary)] focus:border-[var(--adw-accent)] focus:bg-[var(--adw-view-bg)] focus:outline-none"
        />

        <div className="relative flex shrink-0 items-center gap-0.5">
          {/* Habillage du texte (2 options : Haut et bas / Épouser le texte) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWrapMenuOpen((prev) => !prev);
            }}
            className={`flex items-center gap-1 rounded p-1 text-[11px] transition-colors ${
              parsed.wrapMode !== 'break'
                ? 'bg-[var(--adw-accent-soft)] text-[var(--adw-accent)] font-medium'
                : 'text-[var(--adw-fg-secondary)] hover:bg-[var(--adw-hover-bg)]'
            }`}
            title={`Habillage du texte : ${activeWrapMeta.label}`}
          >
            <WrapText className="h-3.5 w-3.5" />
          </button>

          {/* Popover menu for the 2 wrapping options */}
          {wrapMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full z-50 mb-2 w-60 rounded-xl border border-[var(--adw-border)] bg-[var(--adw-card-bg)] p-1.5 shadow-xl"
            >
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-[var(--adw-fg-muted)] uppercase">
                Habillage du texte
              </div>
              {IMAGE_WRAP_OPTIONS.map((opt) => {
                const isSelected = parsed.wrapMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectWrapMode(opt.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--adw-accent-soft)] text-[var(--adw-accent)]'
                        : 'text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {opt.id === 'break' && <AlignCenter className="h-3.5 w-3.5" />}
                      {opt.id === 'wrap' && <WrapText className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span>{opt.label}</span>
                        {isSelected && <Check className="h-3 w-3 shrink-0" />}
                      </div>
                      <p className="mt-0.5 text-[10px] leading-tight text-[var(--adw-fg-muted)]">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Fullscreen Preview Button */}
          {resolvedSrc && !resolvedSrc.startsWith('asset://') && (
            <button
              type="button"
              onClick={() => onImageClick?.(resolvedSrc, parsed.caption)}
              className="rounded p-1 text-[var(--adw-fg-secondary)] hover:bg-[var(--adw-hover-bg)]"
              title="Aperçu plein écran"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Delete Image Button */}
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-[var(--adw-fg-muted)] hover:bg-[var(--adw-hover-bg)] hover:text-red-500"
            title="Supprimer l’image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface TyporaEditorProps {
  markdown: string;
  assets: Record<string, MediaAsset>;
  serifMode?: boolean;
  onChange: (newMarkdown: string) => void;
  onImageClick?: (src: string, alt: string) => void;
  onPasteImage?: (e: React.ClipboardEvent<HTMLElement>) => void;
  onOpenTableModal?: () => void;
  onOpenFormulaModal?: () => void;
  onTriggerImageUpload?: () => void;
}

export const TyporaEditor: React.FC<TyporaEditorProps> = ({
  markdown,
  assets,
  serifMode = false,
  onChange,
  onImageClick,
  onPasteImage,
  onOpenTableModal,
  onOpenFormulaModal,
  onTriggerImageUpload,
}) => {
  // Keep blocks in state while editing so clearing a block's text never causes it to vanish mid-typing
  const [blocks, setBlocks] = useState<MdBlock[]>(() =>
    parseMarkdownIntoBlocks(markdown)
  );
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [lastClickPoint, setLastClickPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [initialCaretOffset, setInitialCaretOffset] = useState<number | null>(
    null
  );
  const [copiedBlockIdx, setCopiedBlockIdx] = useState<number | null>(null);
  const lastEmittedMarkdownRef = useRef<string>(markdown);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const blocksRef = useRef<MdBlock[]>(blocks);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const clearInitialCaret = () => {
    setLastClickPoint(null);
    setInitialCaretOffset(null);
  };

  useEffect(() => {
    if (markdown !== lastEmittedMarkdownRef.current) {
      lastEmittedMarkdownRef.current = markdown;
      setBlocks(parseMarkdownIntoBlocks(markdown));
      setFocusedIndex(null);
    }
  }, [markdown]);

  const commitBlocks = (nextBlocks: MdBlock[]) => {
    const safeBlocks =
      nextBlocks.length > 0
        ? nextBlocks
        : [{ id: 'blk-0', type: 'paragraph' as const, raw: '', startLine: 0 }];
    blocksRef.current = safeBlocks;
    setBlocks(safeBlocks);
    const serialized = serializeBlocksToMarkdown(safeBlocks);
    lastEmittedMarkdownRef.current = serialized;
    onChange(serialized);
  };

  const updateBlockAt = (idx: number, newRaw: string) => {
    const next = blocks.map((b, i) =>
      i === idx
        ? { ...b, raw: newRaw, type: detectBlockType(newRaw) }
        : b
    );
    commitBlocks(next);
  };

  const deleteBlockAt = (idx: number) => {
    if (blocks.length <= 1) {
      updateBlockAt(0, '');
      return;
    }
    const next = blocks.filter((_, i) => i !== idx);
    commitBlocks(next);
    setLastClickPoint(null);
    setInitialCaretOffset(null);
    setFocusedIndex(Math.max(0, idx - 1));
  };

  const mergeWithPrevAt = (idx: number) => {
    const current = blocks[idx];
    if (!current) return;
    if (current.raw.trim() === '') {
      deleteBlockAt(idx);
      return;
    }
    if (idx === 0) return;
    const prev = blocks[idx - 1];
    if (
      prev &&
      (prev.type === 'paragraph' || prev.type === 'heading') &&
      current.type === 'paragraph'
    ) {
      const joinOffset = prev.raw.length;
      const mergedRaw = prev.raw ? `${prev.raw}${current.raw}` : current.raw;
      const next = [...blocks];
      next[idx - 1] = {
        ...prev,
        raw: mergedRaw,
        type: detectBlockType(mergedRaw),
      };
      next.splice(idx, 1);
      commitBlocks(next);
      setLastClickPoint(null);
      setInitialCaretOffset(joinOffset);
      setFocusedIndex(idx - 1);
    }
  };

  const splitBlockAt = (idx: number, before: string, after: string) => {
    const next = [...blocks];
    next[idx] = {
      ...next[idx],
      raw: before,
      type: detectBlockType(before),
    };
    const newBlock: MdBlock = {
      id: `blk-new-${Date.now()}`,
      type: detectBlockType(after),
      raw: after,
      startLine: next[idx].startLine + 1,
    };
    next.splice(idx + 1, 0, newBlock);
    commitBlocks(next);
    setLastClickPoint(null);
    setInitialCaretOffset(0);
    setFocusedIndex(idx + 1);
  };

  const insertBlockBelow = (idx: number, rawSnippet: string, focusNew = true) => {
    const next = [...blocks];
    next.splice(idx + 1, 0, {
      id: `blk-ins-${Date.now()}`,
      type: detectBlockType(rawSnippet),
      raw: rawSnippet,
      startLine: 0,
    });
    commitBlocks(next);
    if (focusNew) {
      setLastClickPoint(null);
      setInitialCaretOffset(null);
      setFocusedIndex(idx + 1);
    }
  };

  return (
    <div
      ref={editorContainerRef}
      className={`adw-markdown relative mx-auto max-w-4xl px-8 py-8 md:px-14 after:block after:clear-both ${
        serifMode ? 'adw-markdown-serif' : ''
      }`}
    >
      {blocks.map((block, idx) => {
        const isFocused = focusedIndex === idx;

        // 1. HEADING BLOCK (# to ######)
        if (block.type === 'heading') {
          const match = block.raw.match(/^(#{1,6})(?:\s+(.*))?$/);
          const level = match ? Math.min(4, match[1].length) : 1;
          const text = match ? match[2] || '' : block.raw;
          const cleanId = `heading-${block.startLine}-${text
            .replace(/[*_`~]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')}`;

          const Tag = (`h${level}` as unknown) as React.ElementType;
          if (isFocused) {
            return (
              <Tag
                key={block.id}
                id={cleanId}
                className="group cursor-text rounded-lg transition-colors min-h-[1.4em]"
              >
                <AutoTextarea
                  value={block.raw}
                  onChange={(val) => updateBlockAt(idx, val)}
                  onBlur={() => setFocusedIndex(null)}
                  onSplitBlock={(before, after) => splitBlockAt(idx, before, after)}
                  onMergePrev={() => deleteBlockAt(idx)}
                  onMovePrev={() => {
                    setLastClickPoint(null);
                    setFocusedIndex(Math.max(0, idx - 1));
                  }}
                  onMoveNext={() => {
                    setLastClickPoint(null);
                    setFocusedIndex(Math.min(blocks.length - 1, idx + 1));
                  }}
                  onPasteImage={onPasteImage}
                  initialClickPoint={lastClickPoint}
                  initialCaretOffset={initialCaretOffset}
                  onConsumeInitialCaret={clearInitialCaret}
                  className="font-sans font-bold tracking-tight text-[var(--adw-fg)]"
                />
              </Tag>
            );
          }

          return (
            <Tag
              key={block.id}
              id={cleanId}
              onClick={(e: React.MouseEvent) => {
                setInitialCaretOffset(null);
                setLastClickPoint({ x: e.clientX, y: e.clientY });
                setFocusedIndex(idx);
              }}
              className="group cursor-text rounded-lg transition-colors min-h-[1.4em]"
            >
              {text.trim() ? (
                renderInlineFormatting(text, assets, onImageClick, `h-${idx}`)
              ) : (
                <span className="text-[var(--adw-fg-muted)] opacity-50">
                  Titre vide...
                </span>
              )}
            </Tag>
          );
        }

        // 2. MATH BLOCK ($$ ... $$)
        if (block.type === 'math') {
          const innerLatex = block.raw
            .trim()
            .replace(/^\$\$\r?\n?/, '')
            .replace(/\r?\n?\$\$$/, '');
          const html = renderLatexInline(innerLatex, true);

          if (isFocused) {
            return (
              <div
                key={block.id}
                className="my-4 overflow-hidden rounded-xl border border-[var(--adw-accent)] bg-[var(--adw-card-bg)] shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-[var(--adw-border-subtle)] bg-[var(--adw-code-bg)] px-3 py-1.5 text-xs text-[var(--adw-fg-muted)]">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Sigma className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
                    <span>Bloc d’équation LaTeX ($$)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusedIndex(null)}
                    className="adw-btn adw-btn-suggested px-2.5 py-0.5 text-xs font-medium"
                  >
                    Terminer (Échap)
                  </button>
                </div>
                <div className="p-3">
                  <AutoTextarea
                    value={innerLatex}
                    onChange={(val) => updateBlockAt(idx, `$$\n${val}\n$$`)}
                    onBlur={() => setFocusedIndex(null)}
                    onSplitBlock={() => setFocusedIndex(null)}
                    onMergePrev={() => deleteBlockAt(idx)}
                    onMovePrev={() => setFocusedIndex(Math.max(0, idx - 1))}
                    onMoveNext={() =>
                      setFocusedIndex(Math.min(blocks.length - 1, idx + 1))
                    }
                    className="font-mono text-xs text-[var(--adw-fg)]"
                  />
                </div>
                <div
                  className="border-t border-[var(--adw-border-subtle)] bg-[var(--adw-code-bg)]/60 p-4 text-center"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            );
          }

          return (
            <div
              key={block.id}
              onClick={() => setFocusedIndex(idx)}
              title="Cliquer pour modifier l’équation LaTeX"
              className="adw-math-block group relative cursor-pointer transition-colors hover:border-[var(--adw-accent)]/60"
            >
              <span className="absolute top-2 right-2.5 rounded bg-[var(--adw-card-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--adw-fg-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                $$ LaTeX
              </span>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        // 3. STANDALONE IMAGE BLOCK (![alt|width|wrapMode](url))
        if (block.type === 'image') {
          return (
            <WysiwygImageBlock
              key={block.id}
              raw={block.raw}
              assets={assets}
              onChange={(newRaw) => updateBlockAt(idx, newRaw)}
              onDelete={() => deleteBlockAt(idx)}
              onMoveWrapVertical={(clientY, updatedRaw) => {
                const container = editorContainerRef.current;
                const currentBlocks = blocksRef.current;
                const currentIdx = currentBlocks.findIndex(
                  (b) => b.id === block.id
                );
                if (!container || currentIdx === -1) return;

                const children = Array.from(container.children) as HTMLElement[];
                let targetIdx = currentIdx;
                for (let c = 0; c < children.length; c++) {
                  if (c >= currentBlocks.length || c === currentIdx) continue;
                  const rect = children[c].getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  if (c < currentIdx && clientY < midY) {
                    targetIdx = c;
                    break;
                  }
                  if (c > currentIdx && clientY > midY) {
                    targetIdx = c;
                  }
                }
                if (targetIdx !== currentIdx) {
                  const next = [...currentBlocks];
                  const [moved] = next.splice(currentIdx, 1);
                  moved.raw = updatedRaw;
                  next.splice(targetIdx, 0, moved);
                  commitBlocks(next);
                } else if (currentBlocks[currentIdx].raw !== updatedRaw) {
                  const next = currentBlocks.map((b, i) =>
                    i === currentIdx
                      ? { ...b, raw: updatedRaw, type: detectBlockType(updatedRaw) }
                      : b
                  );
                  commitBlocks(next);
                }
              }}
              onImageClick={onImageClick}
            />
          );
        }

        // 4. TABLE BLOCK
        if (block.type === 'table') {
          return (
            <WysiwygTableBlock
              key={block.id}
              raw={block.raw}
              assets={assets}
              onChange={(newRaw) => updateBlockAt(idx, newRaw)}
              onDeleteBlock={() => deleteBlockAt(idx)}
            />
          );
        }

        // 5. CODE BLOCK
        if (block.type === 'code') {
          const lines = block.raw.split('\n');
          const firstLine = lines[0]?.trim() || '```';
          const lang = firstLine.slice(3).trim();
          const innerCode = lines
            .slice(1, lines[lines.length - 1]?.trim().startsWith('```') ? -1 : undefined)
            .join('\n');

          return (
            <div
              key={block.id}
              className="my-4 overflow-hidden rounded-xl border border-[var(--adw-border)] bg-[var(--adw-code-bg)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--adw-border-subtle)] px-3.5 py-1.5 text-xs text-[var(--adw-fg-muted)]">
                <input
                  type="text"
                  value={lang}
                  onChange={(e) =>
                    updateBlockAt(
                      idx,
                      `\`\`\`${e.target.value}\n${innerCode}\n\`\`\``
                    )
                  }
                  placeholder="langage..."
                  className="w-36 rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-xs text-[var(--adw-fg-secondary)] focus:border-[var(--adw-accent)] focus:bg-[var(--adw-view-bg)] focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(innerCode);
                      setCopiedBlockIdx(idx);
                      setTimeout(() => setCopiedBlockIdx(null), 1500);
                    }}
                    className="adw-btn px-2 py-0.5 text-xs text-[var(--adw-fg-secondary)]"
                  >
                    {copiedBlockIdx === idx ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBlockAt(idx)}
                    className="adw-btn p-1 text-[var(--adw-fg-muted)] hover:text-red-500"
                    title="Supprimer le bloc de code"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <textarea
                value={innerCode}
                onChange={(e) =>
                  updateBlockAt(idx, `\`\`\`${lang}\n${e.target.value}\n\`\`\``)
                }
                rows={Math.max(2, innerCode.split('\n').length)}
                spellCheck={false}
                className="w-full resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[var(--adw-fg)] focus:outline-none"
              />
            </div>
          );
        }

        // 6. BLOCKQUOTE
        if (block.type === 'blockquote') {
          if (isFocused) {
            return (
              <blockquote
                key={block.id}
                className="ring-1 ring-[var(--adw-accent)]"
              >
                <AutoTextarea
                  value={block.raw}
                  onChange={(val) => updateBlockAt(idx, val)}
                  onBlur={() => setFocusedIndex(null)}
                  onSplitBlock={(before, after) => splitBlockAt(idx, before, after)}
                  onMergePrev={() => deleteBlockAt(idx)}
                  onMovePrev={() => setFocusedIndex(Math.max(0, idx - 1))}
                  onMoveNext={() =>
                    setFocusedIndex(Math.min(blocks.length - 1, idx + 1))
                  }
                  onPasteImage={onPasteImage}
                  className="text-[var(--adw-fg-secondary)]"
                />
              </blockquote>
            );
          }

          const cleanQuote = block.raw
            .split('\n')
            .map((l) => l.trim().replace(/^>\s?/, ''))
            .join(' ');

          return (
            <blockquote
              key={block.id}
              onClick={() => setFocusedIndex(idx)}
              className="cursor-text transition-colors hover:border-[var(--adw-accent)]/50"
            >
              <p>
                {renderInlineFormatting(
                  cleanQuote,
                  assets,
                  onImageClick,
                  `q-${idx}`
                )}
              </p>
            </blockquote>
          );
        }

        // 7. LIST BLOCK
        if (block.type === 'list') {
          if (isFocused) {
            return (
              <div
                key={block.id}
                className="my-3 rounded-xl border border-[var(--adw-accent)]/50 bg-[var(--adw-accent-soft)]/20 p-3"
              >
                <AutoTextarea
                  value={block.raw}
                  onChange={(val) => updateBlockAt(idx, val)}
                  onBlur={() => setFocusedIndex(null)}
                  onSplitBlock={(before, after) => splitBlockAt(idx, before, after)}
                  onMergePrev={() => deleteBlockAt(idx)}
                  onMovePrev={() => setFocusedIndex(Math.max(0, idx - 1))}
                  onMoveNext={() =>
                    setFocusedIndex(Math.min(blocks.length - 1, idx + 1))
                  }
                  onPasteImage={onPasteImage}
                  className="font-sans text-[15px] leading-relaxed text-[var(--adw-fg)]"
                />
              </div>
            );
          }

          const listLines = block.raw.split('\n');
          const isOrdered = /^\d+\.\s+/.test(listLines[0]?.trim() || '');
          const items = listLines.map((line, lineIdx) => {
            const rawItem = line.trim().replace(/^([-*+]|\d+\.)\s*/, '');
            const taskMatch = rawItem.match(/^\[([ xX])\]\s*(.*)$/);
            if (taskMatch) {
              const checked = taskMatch[1].toLowerCase() === 'x';
              return {
                lineIdx,
                isTask: true,
                checked,
                text: taskMatch[2],
              };
            }
            return {
              lineIdx,
              isTask: false,
              checked: false,
              text: rawItem,
            };
          });

          const hasTasks = items.some((it) => it.isTask);

          if (isOrdered) {
            return (
              <ol
                key={block.id}
                onClick={() => setFocusedIndex(idx)}
                className="cursor-text rounded-lg transition-colors hover:bg-[var(--adw-hover-bg)]/40 py-1"
              >
                {items.map((it) => (
                  <li key={it.lineIdx}>
                    {renderInlineFormatting(
                      it.text,
                      assets,
                      onImageClick,
                      `ol-${idx}-${it.lineIdx}`
                    )}
                  </li>
                ))}
              </ol>
            );
          }

          return (
            <ul
              key={block.id}
              className={
                hasTasks
                  ? '!list-none !pl-1 space-y-1.5 my-3'
                  : 'cursor-text rounded-lg transition-colors hover:bg-[var(--adw-hover-bg)]/40 py-1'
              }
            >
              {items.map((it) =>
                it.isTask ? (
                  <li
                    key={it.lineIdx}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--adw-hover-bg)]"
                  >
                    <input
                      type="checkbox"
                      checked={it.checked}
                      onChange={(e) => {
                        e.stopPropagation();
                        const updatedLines = [...listLines];
                        const target = updatedLines[it.lineIdx];
                        if (/\[ \]/i.test(target)) {
                          updatedLines[it.lineIdx] = target.replace(/\[ \]/, '[x]');
                        } else {
                          updatedLines[it.lineIdx] = target.replace(/\[x\]/i, '[ ]');
                        }
                        updateBlockAt(idx, updatedLines.join('\n'));
                      }}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--adw-border)] accent-[var(--adw-accent)]"
                    />
                    <span
                      onClick={() => setFocusedIndex(idx)}
                      className={`flex-1 cursor-text ${
                        it.checked ? 'line-through text-[var(--adw-fg-muted)]' : ''
                      }`}
                    >
                      {renderInlineFormatting(
                        it.text,
                        assets,
                        onImageClick,
                        `tsk-${idx}-${it.lineIdx}`
                      )}
                    </span>
                  </li>
                ) : (
                  <li key={it.lineIdx} onClick={() => setFocusedIndex(idx)}>
                    {renderInlineFormatting(
                      it.text,
                      assets,
                      onImageClick,
                      `ul-${idx}-${it.lineIdx}`
                    )}
                  </li>
                )
              )}
            </ul>
          );
        }

        // 8. HORIZONTAL RULE
        if (block.type === 'hr') {
          return (
            <div
              key={block.id}
              onClick={() => setFocusedIndex(idx)}
              className="group relative py-2 cursor-pointer"
            >
              <hr className="!my-2 group-hover:border-[var(--adw-accent)]" />
            </div>
          );
        }

        // 9. STANDARD PARAGRAPH BLOCK
        if (isFocused) {
          return (
            <p
              key={block.id}
              className="cursor-text rounded-lg py-0.5 transition-colors min-h-[1.7em]"
            >
              <AutoTextarea
                value={block.raw}
                onChange={(val) => updateBlockAt(idx, val)}
                onBlur={() => setFocusedIndex(null)}
                onSplitBlock={(before, after) => splitBlockAt(idx, before, after)}
                onMergePrev={() => mergeWithPrevAt(idx)}
                onMovePrev={() => {
                  clearInitialCaret();
                  setFocusedIndex(Math.max(0, idx - 1));
                }}
                onMoveNext={() => {
                  clearInitialCaret();
                  setFocusedIndex(Math.min(blocks.length - 1, idx + 1));
                }}
                onPasteImage={onPasteImage}
                initialClickPoint={lastClickPoint}
                initialCaretOffset={initialCaretOffset}
                onConsumeInitialCaret={clearInitialCaret}
                placeholder="Écrivez en Markdown (ex: # Titre, **gras**, $formule$, ou déposez une image)..."
                className="text-[15.5px] leading-[1.68] text-[var(--adw-fg)]"
              />
            </p>
          );
        }

        return (
          <p
            key={block.id}
            onClick={(e) => {
              setInitialCaretOffset(null);
              setLastClickPoint({ x: e.clientX, y: e.clientY });
              setFocusedIndex(idx);
            }}
            className="cursor-text rounded-lg py-0.5 transition-colors min-h-[1.7em]"
          >
            {block.raw.trim() ? (
              renderInlineFormatting(
                block.raw.split('\n').join(' '),
                assets,
                onImageClick,
                `p-${idx}`
              )
            ) : (
              <span className="text-[var(--adw-fg-muted)] opacity-60">
                Cliquez pour rédiger votre note...
              </span>
            )}
          </p>
        );
      })}

      {/* Subtle Typora-style bottom insertion bar on hover */}
      <div className="group mt-8 flex items-center justify-center gap-2 py-4 opacity-0 transition-opacity hover:opacity-100">
        <button
          type="button"
          onClick={() => insertBlockBelow(blocks.length - 1, 'Nouveau paragraphe...')}
          className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Paragraphe</span>
        </button>
        {onOpenTableModal && (
          <button
            type="button"
            onClick={onOpenTableModal}
            className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
          >
            <TableIcon className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
            <span>Tableau</span>
          </button>
        )}
        {onOpenFormulaModal && (
          <button
            type="button"
            onClick={onOpenFormulaModal}
            className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
          >
            <Sigma className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
            <span>Formule</span>
          </button>
        )}
        {onTriggerImageUpload && (
          <button
            type="button"
            onClick={onTriggerImageUpload}
            className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
          >
            <ImageIcon className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
            <span>Image</span>
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            insertBlockBelow(
              blocks.length - 1,
              '- [ ] Nouvelle tâche à accomplir',
              false
            )
          }
          className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
        >
          <ListChecks className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
          <span>Tâches</span>
        </button>
        <button
          type="button"
          onClick={() =>
            insertBlockBelow(
              blocks.length - 1,
              '> Remarque ou citation importante',
              false
            )
          }
          className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
        >
          <Quote className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
          <span>Citation</span>
        </button>
      </div>
    </div>
  );
};
