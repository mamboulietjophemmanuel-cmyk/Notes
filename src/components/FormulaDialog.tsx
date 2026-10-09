import React, { useState } from 'react';
import katex from 'katex';

interface FormulaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latexSnippet: string) => void;
}

const FORMULA_PRESETS = [
  {
    label: 'Intégrale de Gauss',
    latex: '\\int_{-\\infty}^{+\\infty} e^{-x^2}\\, \\mathrm{d}x = \\sqrt{\\pi}',
  },
  {
    label: 'Équation de Maxwell-Faraday',
    latex: '\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}',
  },
  {
    label: 'Loi de Snell-Descartes',
    latex: 'n_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)',
  },
  {
    label: 'Matrice 2×2',
    latex: '\\begin{pmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{pmatrix}',
  },
  {
    label: 'Développement en série de Taylor',
    latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n',
  },
  {
    label: 'Équation de Schrödinger',
    latex: 'i\\hbar \\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat{H}\\Psi(\\mathbf{r},t)',
  },
];

export const FormulaDialog: React.FC<FormulaDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [latex, setLatex] = useState(
    '\\mathcal{F}\\{f(t)\\}(\\omega) = \\int_{-\\infty}^{+\\infty} f(t)\\, e^{-i\\omega t}\\, \\mathrm{d}t'
  );
  const [mode, setMode] = useState<'block' | 'inline'>('block');

  if (!isOpen) return null;

  let renderedHtml = '';
  try {
    renderedHtml = katex.renderToString(latex || '\\text{Saisissez une équation LaTeX}', {
      displayMode: mode === 'block',
      throwOnError: false,
    });
  } catch {
    renderedHtml = '<code>Erreur de syntaxe LaTeX</code>';
  }

  const handleConfirm = () => {
    if (!latex.trim()) return;
    const formatted =
      mode === 'block' ? `\n$$\n${latex.trim()}\n$$\n` : `$${latex.trim()}$`;
    onInsert(formatted);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] shadow-2xl"
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
            Insérer une formule mathématique (LaTeX)
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            className="adw-btn adw-btn-suggested px-3.5 py-1.5 text-xs font-semibold"
          >
            Insérer
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--adw-fg-secondary)]">
              Disposition dans le document
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-[var(--adw-code-bg)] p-1 border border-[var(--adw-border-subtle)]">
              <button
                type="button"
                onClick={() => setMode('block')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === 'block'
                    ? 'bg-[var(--adw-card-bg)] text-[var(--adw-fg)] shadow-xs'
                    : 'text-[var(--adw-fg-muted)] hover:text-[var(--adw-fg)]'
                }`}
              >
                Bloc centré ($$)
              </button>
              <button
                type="button"
                onClick={() => setMode('inline')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === 'inline'
                    ? 'bg-[var(--adw-card-bg)] text-[var(--adw-fg)] shadow-xs'
                    : 'text-[var(--adw-fg-muted)] hover:text-[var(--adw-fg)]'
                }`}
              >
                En ligne ($)
              </button>
            </div>
          </div>

          {/* Preset equations */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-[var(--adw-fg-muted)]">
              Modèles scientifiques rapides
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setLatex(preset.latex)}
                  className="adw-btn border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-2.5 py-1 text-xs text-[var(--adw-fg-secondary)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* LaTeX Input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--adw-fg-secondary)]">
              Expression LaTeX
            </label>
            <textarea
              rows={3}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="\int_0^\infty e^{-x} dx"
              className="w-full rounded-xl border border-[var(--adw-border)] bg-[var(--adw-view-bg)] p-3 font-mono text-xs text-[var(--adw-fg)] focus:border-[var(--adw-accent)] focus:outline-none"
            />
          </div>

          {/* Live KaTeX Preview */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-[var(--adw-fg-muted)]">
              Aperçu temps réel (KaTeX)
            </div>
            <div
              className="flex min-h-[76px] items-center justify-center overflow-x-auto rounded-xl border border-[var(--adw-border)] bg-[var(--adw-code-bg)] p-4 text-[var(--adw-fg)]"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
