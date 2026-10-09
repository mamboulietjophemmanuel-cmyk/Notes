import React, { useState } from 'react';
import { MarkdownDocument, OpenTab, ProjectFolder } from '../types/note';
import { X, Plus, Pin, Search, FileText } from 'lucide-react';
import { computeDocumentStats } from '../utils/markdownParser';

interface TabOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  openTabs: OpenTab[];
  activeDocId: string;
  documents: MarkdownDocument[];
  projects: ProjectFolder[];
  onSelectTab: (docId: string) => void;
  onCloseTab: (docId: string) => void;
  onTogglePinTab: (docId: string) => void;
  onNewTab: () => void;
}

export const TabOverviewModal: React.FC<TabOverviewModalProps> = ({
  isOpen,
  onClose,
  openTabs,
  activeDocId,
  documents,
  projects,
  onSelectTab,
  onCloseTab,
  onTogglePinTab,
  onNewTab,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const tabDocs = openTabs
    .map((tab) => {
      const doc = documents.find((d) => d.id === tab.docId);
      if (!doc) return null;
      return { tab, doc };
    })
    .filter((item): item is { tab: OpenTab; doc: MarkdownDocument } => item !== null)
    .filter(({ doc }) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        doc.filename.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q)
      );
    });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--adw-window-bg)]/95 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      {/* Top AdwTabOverview Bar */}
      <div
        className="flex items-center justify-between border-b border-[var(--adw-border)] bg-[var(--adw-headerbar-bg)] px-6 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewTab();
              onClose();
            }}
            className="adw-btn adw-btn-suggested px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel onglet .md</span>
          </button>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--adw-fg-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher parmi les onglets ouverts..."
            autoFocus
            className="w-full rounded-lg border border-[var(--adw-border)] bg-[var(--adw-view-bg)] py-1.5 pr-3 pl-9 text-xs text-[var(--adw-fg)] focus:border-[var(--adw-accent)] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="adw-btn px-3 py-1.5 text-xs font-medium"
        >
          <span>Fermer la vue</span>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid of Open Tabs */}
      <div
        className="flex-1 overflow-y-auto p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between text-xs text-[var(--adw-fg-muted)]">
            <span>
              {tabDocs.length} document{tabDocs.length > 1 ? 's' : ''} ouvert
              {tabDocs.length > 1 ? 's' : ''} simultanément
            </span>
            <span>Astuce : Épinglez un onglet pour le conserver en tête de barre</span>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tabDocs.map(({ tab, doc }) => {
              const project = projects.find((p) => p.id === doc.projectId);
              const stats = computeDocumentStats(doc.content);
              const isActive = doc.id === activeDocId;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    onSelectTab(doc.id);
                    onClose();
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-transform duration-150 hover:-translate-y-0.5 ${
                    isActive
                      ? 'border-[var(--adw-accent)] bg-[var(--adw-card-bg)] ring-2 ring-[var(--adw-accent)]/25'
                      : 'border-[var(--adw-border)] bg-[var(--adw-card-bg)] hover:border-[var(--adw-fg-muted)]/40'
                  }`}
                >
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--adw-accent)]" />
                        <h3 className="truncate text-sm font-semibold text-[var(--adw-fg)]">
                          {doc.filename}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinTab(doc.id);
                          }}
                          className={`adw-btn p-1.5 ${
                            tab.pinned
                              ? 'text-[var(--adw-accent)]'
                              : 'text-[var(--adw-fg-muted)] opacity-0 group-hover:opacity-100'
                          }`}
                          title={tab.pinned ? 'Désépingler l’onglet' : 'Épingler l’onglet'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        {openTabs.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseTab(doc.id);
                            }}
                            className="adw-btn p-1.5 text-[var(--adw-fg-muted)] opacity-0 group-hover:opacity-100 hover:text-red-500"
                            title="Fermer cet onglet"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mini Document Preview Snippet */}
                    <div className="mb-4 h-28 overflow-hidden rounded-xl border border-[var(--adw-border-subtle)] bg-[var(--adw-view-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--adw-fg-secondary)]">
                      {doc.content.slice(0, 280)}
                    </div>
                  </div>

                  {/* Unboxed Metadata Footer */}
                  <div className="flex items-center justify-between text-xs text-[var(--adw-fg-muted)] tabular-nums">
                    <span className="truncate">{project?.name || 'Espace local'}</span>
                    <span>
                      {stats.words} mots · {doc.updatedAt}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
