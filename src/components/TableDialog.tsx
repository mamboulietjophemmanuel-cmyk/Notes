import React, { useState } from 'react';
import { X, Plus, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdownTable: string) => void;
}

type ColumnAlign = 'left' | 'center' | 'right';

export const TableDialog: React.FC<TableDialogProps> = ({ isOpen, onClose, onInsert }) => {
  const [headers, setHeaders] = useState<string[]>(['Paramètre', 'Unité', 'Valeur nominale']);
  const [alignments, setAlignments] = useState<ColumnAlign[]>(['left', 'center', 'right']);
  const [rows, setRows] = useState<string[][]>([
    ['Fréquence d’échantillonnage', 'kHz', '48.0'],
    ['Latence tampon', 'ms', '2.4'],
    ['Rapport signal/bruit', 'dB', '114.0'],
  ]);

  if (!isOpen) return null;

  const addColumn = () => {
    setHeaders([...headers, `Colonne ${headers.length + 1}`]);
    setAlignments([...alignments, 'left']);
    setRows(rows.map((r) => [...r, '']));
  };

  const removeColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    setHeaders(headers.filter((_, i) => i !== colIdx));
    setAlignments(alignments.filter((_, i) => i !== colIdx));
    setRows(rows.map((r) => r.filter((_, i) => i !== colIdx)));
  };

  const addRow = () => {
    setRows([...rows, headers.map(() => '')]);
  };

  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  const updateHeader = (colIdx: number, val: string) => {
    const next = [...headers];
    next[colIdx] = val;
    setHeaders(next);
  };

  const cycleAlignment = (colIdx: number) => {
    const order: ColumnAlign[] = ['left', 'center', 'right'];
    const next = [...alignments];
    const currentIdx = order.indexOf(next[colIdx]);
    next[colIdx] = order[(currentIdx + 1) % order.length];
    setAlignments(next);
  };

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const next = rows.map((r) => [...r]);
    next[rowIdx][colIdx] = val;
    setRows(next);
  };

  const handleGenerate = () => {
    const headerLine = `| ${headers.map((h) => h.trim() || ' ').join(' | ')} |`;
    const alignLine = `| ${alignments
      .map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---'))
      .join(' | ')} |`;
    const bodyLines = rows.map(
      (row) => `| ${row.map((cell) => cell.trim() || ' ').join(' | ')} |`
    );

    const markdown = `\n${headerLine}\n${alignLine}\n${bodyLines.join('\n')}\n`;
    onInsert(markdown);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* AdwDialog HeaderBar */}
        <div className="flex items-center justify-between border-b border-[var(--adw-border)] bg-[var(--adw-headerbar-bg)] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="adw-btn px-3 py-1.5 text-xs font-medium"
          >
            Annuler
          </button>
          <span className="text-sm font-semibold text-[var(--adw-fg)]">
            Insérer un tableau Markdown
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            className="adw-btn adw-btn-suggested px-3.5 py-1.5 text-xs font-semibold"
          >
            Insérer
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[var(--adw-fg-muted)]">
              Cliquez sur l’icône d’alignement d’une colonne pour basculer entre gauche, centré et droite (chiffres).
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addColumn}
                className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Colonne</span>
              </button>
              <button
                type="button"
                onClick={addRow}
                className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Ligne</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--adw-border)] bg-[var(--adw-card-bg)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--adw-border)] bg-[var(--adw-code-bg)]">
                  {headers.map((h, colIdx) => (
                    <th key={colIdx} className="p-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => updateHeader(colIdx, e.target.value)}
                          placeholder="En-tête"
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-[var(--adw-fg)] focus:border-[var(--adw-accent)] focus:bg-[var(--adw-view-bg)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => cycleAlignment(colIdx)}
                          className="adw-btn p-1 text-[var(--adw-fg-muted)]"
                          title={`Alignement : ${alignments[colIdx]}`}
                        >
                          {alignments[colIdx] === 'left' && <AlignLeft className="h-3.5 w-3.5" />}
                          {alignments[colIdx] === 'center' && (
                            <AlignCenter className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
                          )}
                          {alignments[colIdx] === 'right' && (
                            <AlignRight className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
                          )}
                        </button>
                        {headers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(colIdx)}
                            className="adw-btn p-1 text-[var(--adw-fg-muted)] hover:text-red-500"
                            title="Supprimer cette colonne"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="border-b border-[var(--adw-border-subtle)] last:border-none"
                  >
                    {row.map((cell, colIdx) => (
                      <td key={colIdx} className="p-1.5">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          placeholder="..."
                          style={{ textAlign: alignments[colIdx] }}
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-mono tabular-nums text-[var(--adw-fg)] focus:border-[var(--adw-accent)] focus:bg-[var(--adw-view-bg)] focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="p-1.5 text-center">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(rowIdx)}
                          className="adw-btn p-1 text-[var(--adw-fg-muted)] hover:text-red-500"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
