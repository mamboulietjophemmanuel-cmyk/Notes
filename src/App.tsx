/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  SquarePlus,
  Search,
  FileText,
  X,
  Table as TableIcon,
  Sigma,
  Image as ImageIcon,
  Menu,
  Sun,
  Moon,
  Monitor,
  Check,
  Trash2,
  Upload,
  Copy,
  Download,
  FolderOpen,
  FileSearch,
} from 'lucide-react';
import {
  MarkdownDocument,
  MediaAsset,
  OpenTab,
  ThemePreference,
} from './types/note';
import { INITIAL_ASSETS, INITIAL_DOCUMENTS } from './data/initialNotes';
import { computeDocumentStats } from './utils/markdownParser';
import { TyporaEditor } from './components/TyporaEditor';
import { TableDialog } from './components/TableDialog';
import { FormulaDialog } from './components/FormulaDialog';

const STORAGE_KEY_DOCS = 'adwnotes_documents_v2';
const STORAGE_KEY_TABS = 'adwnotes_tabs_v2';
const STORAGE_KEY_THEME = 'adwnotes_theme_pref_v2';

export default function App() {
  // 1. Theme State (Auto-sync with Windows/device prefers-color-scheme + manual override)
  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const effectiveDark = themePref === 'system' ? systemDark : themePref === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY_THEME, themePref);
  }, [effectiveDark, themePref]);

  // 2. Documents, Media Assets & Open Tabs State (No projects, pure minimalism)
  const [documents, setDocuments] = useState<MarkdownDocument[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS);
      return raw ? JSON.parse(raw) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  const [assets, setAssets] = useState<Record<string, MediaAsset>>(INITIAL_ASSETS);

  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TABS);
      if (raw) {
        const parsed: OpenTab[] = JSON.parse(raw);
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      { docId: 'doc-optics' },
      { docId: 'doc-architecture' },
      { docId: 'doc-guide' },
    ];
  });

  const [activeDocId, setActiveDocId] = useState<string>('doc-optics');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(openTabs));
    } catch {
      // storage quota fallback
    }
  }, [documents, openTabs]);

  // 3. Minimalist GNOME Text Editor Popovers & Modals
  const [openPopoverVisible, setOpenPopoverVisible] = useState<boolean>(false);
  const [openPopoverSearch, setOpenPopoverSearch] = useState<string>('');
  const [primaryMenuOpen, setPrimaryMenuOpen] = useState<boolean>(false);
  const [insertPopoverOpen, setInsertPopoverOpen] = useState<boolean>(false);
  const [serifTypography, setSerifTypography] = useState<boolean>(false);

  const [tableModalOpen, setTableModalOpen] = useState<boolean>(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(
    null
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag & Drop + Inline Title Rename
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isRenamingTitle, setIsRenamingTitle] = useState<boolean>(false);
  const [filenameDraft, setFilenameDraft] = useState<string>('');

  const mdFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const openPopoverRef = useRef<HTMLDivElement | null>(null);
  const primaryMenuRef = useRef<HTMLDivElement | null>(null);
  const insertPopoverRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2400);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openPopoverRef.current && !openPopoverRef.current.contains(target)) {
        setOpenPopoverVisible(false);
      }
      if (primaryMenuRef.current && !primaryMenuRef.current.contains(target)) {
        setPrimaryMenuOpen(false);
      }
      if (insertPopoverRef.current && !insertPopoverRef.current.contains(target)) {
        setInsertPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Active document
  const activeDocument = useMemo(() => {
    return (
      documents.find((d) => d.id === activeDocId) ||
      documents.find((d) => openTabs.some((t) => t.docId === d.id)) ||
      documents[0]
    );
  }, [documents, activeDocId, openTabs]);

  const stats = useMemo(
    () =>
      activeDocument
        ? computeDocumentStats(activeDocument.content)
        : { words: 0, chars: 0, lines: 0, readingMinutes: 1 },
    [activeDocument]
  );

  // Update active document content
  const updateActiveContent = useCallback(
    (newContent: string) => {
      if (!activeDocument) return;
      const nowStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === activeDocument.id
            ? {
                ...doc,
                content: newContent,
                updatedAt: `Aujourd’hui · ${nowStr}`,
              }
            : doc
        )
      );
    },
    [activeDocument]
  );

  // Append block snippet to active document
  const appendBlockSnippet = useCallback(
    (snippet: string) => {
      if (!activeDocument) return;
      const base = activeDocument.content.trimEnd();
      updateActiveContent(`${base}\n\n${snippet.trim()}\n`);
    },
    [activeDocument, updateActiveContent]
  );

  // Open a document in a tab
  const openDocumentInTab = useCallback((docId: string) => {
    setOpenTabs((prev) => {
      if (prev.some((t) => t.docId === docId)) return prev;
      return [...prev, { docId }];
    });
    setActiveDocId(docId);
    setOpenPopoverVisible(false);
  }, []);

  // Create a new .md document in a new tab
  const handleCreateNewDocument = useCallback(() => {
    const untitledCount =
      documents.filter((d) => d.filename.startsWith('Sans titre')).length + 1;
    const newDoc: MarkdownDocument = {
      id: `doc-${Date.now()}`,
      filename: `Sans titre ${untitledCount}.md`,
      projectId: 'default',
      updatedAt: 'À l’instant',
      content: `# Sans titre ${untitledCount}\n\nCliquez ici pour rédiger votre note en **Markdown** avec rendu fluide.\n`,
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setOpenTabs((prev) => [...prev, { docId: newDoc.id }]);
    setActiveDocId(newDoc.id);
  }, [documents]);

  // Close a tab
  const handleCloseTab = useCallback(
    (docId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (openTabs.length <= 1) {
        // If closing the very last tab, reset to a fresh empty note like GNOME Text Editor
        handleCreateNewDocument();
        setOpenTabs((prev) => prev.filter((t) => t.docId !== docId));
        return;
      }
      const idx = openTabs.findIndex((t) => t.docId === docId);
      const nextTabs = openTabs.filter((t) => t.docId !== docId);
      setOpenTabs(nextTabs);

      if (activeDocId === docId && nextTabs.length > 0) {
        const fallbackIdx = Math.max(0, idx - 1);
        setActiveDocId(nextTabs[fallbackIdx].docId);
      }
    },
    [openTabs, activeDocId, handleCreateNewDocument]
  );

  // Delete a saved document from recent list
  const handleDeleteDocument = useCallback(
    (docId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (documents.length <= 1) return;
      const remaining = documents.filter((d) => d.id !== docId);
      setDocuments(remaining);
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.docId !== docId);
        return next.length > 0 ? next : [{ docId: remaining[0].id }];
      });
      if (activeDocId === docId) {
        setActiveDocId(remaining[0].id);
      }
    },
    [documents, activeDocId]
  );

  // Save/Download active .md file to Windows
  const handleDownloadMarkdown = useCallback(
    (embedAssetsAsBase64 = true) => {
      if (!activeDocument) return;
      let finalContent = activeDocument.content;

      if (embedAssetsAsBase64) {
        Object.values(assets).forEach((asset) => {
          finalContent = finalContent.replaceAll(
            `asset://${asset.id}`,
            asset.dataUrl
          );
        });
      }

      const blob = new Blob([finalContent], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeDocument.filename.endsWith('.md')
        ? activeDocument.filename
        : `${activeDocument.filename}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Enregistré sous « ${a.download} »`);
    },
    [activeDocument, assets, showToast]
  );

  // Process incoming files (both .md documents and images via Drag-and-Drop or File Picker)
  const processIncomingFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      files.forEach((file) => {
        const lowerName = file.name.toLowerCase();

        // Case 1: Image file (.png, .jpg, .jpeg, .webp, .gif, .svg)
        if (
          file.type.startsWith('image/') ||
          /\.(png|jpe?g|webp|gif|svg)$/.test(lowerName)
        ) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const assetId = `img-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 6)}`;
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
            const newAsset: MediaAsset = {
              id: assetId,
              name: file.name,
              dataUrl,
              mimeType: file.type || 'image/png',
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
            };

            setAssets((prev) => ({ ...prev, [assetId]: newAsset }));
            appendBlockSnippet(`![${cleanTitle}|100%](asset://${assetId})`);
            showToast(`Image « ${file.name} » insérée`);
          };
          reader.readAsDataURL(file);
          return;
        }

        // Case 2: Markdown or text document (.md, .markdown, .txt)
        if (
          /\.(md|markdown|txt)$/.test(lowerName) ||
          file.type === 'text/markdown' ||
          file.type === 'text/plain'
        ) {
          const reader = new FileReader();
          reader.onload = () => {
            const content = reader.result as string;
            const normalizedName = file.name.endsWith('.md')
              ? file.name
              : `${file.name.replace(/\.[^/.]+$/, '')}.md`;

            const newDoc: MarkdownDocument = {
              id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              filename: normalizedName,
              projectId: 'default',
              content,
              updatedAt: 'Importé à l’instant',
            };

            setDocuments((prev) => [newDoc, ...prev]);
            setOpenTabs((prev) => [...prev, { docId: newDoc.id }]);
            setActiveDocId(newDoc.id);
            showToast(`« ${normalizedName} » ouvert dans un nouvel onglet`);
          };
          reader.readAsText(file);
        }
      });
    },
    [appendBlockSnippet, showToast]
  );

  // Handle clipboard paste of images
  const handleEditorPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const f = items[i].getAsFile();
          if (f) imageFiles.push(f);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        processIncomingFiles(imageFiles);
      }
    },
    [processIncomingFiles]
  );

  // Windows Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          handleDownloadMarkdown(true);
        } else if (key === 'n' || key === 't') {
          e.preventDefault();
          handleCreateNewDocument();
        } else if (key === 'o') {
          e.preventDefault();
          mdFileInputRef.current?.click();
        } else if (key === 'w') {
          e.preventDefault();
          if (activeDocument) handleCloseTab(activeDocument.id);
        }
      } else if (e.key === 'Escape') {
        setLightboxImage(null);
        setTableModalOpen(false);
        setFormulaModalOpen(false);
        setOpenPopoverVisible(false);
        setPrimaryMenuOpen(false);
        setInsertPopoverOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleDownloadMarkdown,
    handleCreateNewDocument,
    handleCloseTab,
    activeDocument,
  ]);

  // Filtered recent documents in the "Open v" popover
  const filteredRecentDocs = useMemo(() => {
    if (!openPopoverSearch.trim()) return documents;
    const q = openPopoverSearch.toLowerCase();
    return documents.filter(
      (d) =>
        d.filename.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    );
  }, [documents, openPopoverSearch]);

  const commitTitleRename = () => {
    if (!activeDocument) return;
    const trimmed = filenameDraft.trim();
    if (trimmed) {
      const finalName = trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDocument.id ? { ...d, filename: finalName } : d
        )
      );
    }
    setIsRenamingTitle(false);
  };

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--adw-window-bg)] text-[var(--adw-fg)] select-none"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDraggingOver) setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer?.files?.length) {
          processIncomingFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Hidden File Inputs for Windows File Explorer */}
      <input
        ref={mdFileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processIncomingFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processIncomingFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Full-Window Drag-and-Drop Overlay (.md & Images) */}
      {isDraggingOver && (
        <div className="pointer-events-none fixed inset-3 z-50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--adw-accent)] bg-[var(--adw-window-bg)]/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-card-bg)] px-8 py-6 shadow-xl">
            <Upload className="h-10 w-10 text-[var(--adw-accent)]" />
            <p className="text-base font-semibold text-[var(--adw-fg)]">
              Déposez vos fichiers Markdown (.md) ou vos images ici
            </p>
            <p className="text-xs text-[var(--adw-fg-muted)]">
              Les fichiers .md s’ouvrent dans de nouveaux onglets · Les images sont intégrées au document
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          1. GNOME TEXT EDITOR HEADERBAR (Exact match to Screenshot 2)
             Left: [Open ▾] [+]
             Center: Document Title (README.md) + Path subtitle (~/Documents)
             Right: [Insert/Properties icon] [☰] [✕]
         ===================================================================== */}
      <header
        data-tauri-drag-region
        className="relative flex h-[46px] shrink-0 items-center justify-between border-b border-[var(--adw-border)] bg-[var(--adw-headerbar-bg)] px-2.5"
      >
        {/* Left Zone: "Ouvrir ▾" popover button + "[+]" new tab button */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative" ref={openPopoverRef}>
            <button
              type="button"
              onClick={() => setOpenPopoverVisible((v) => !v)}
              className={`adw-btn px-2.5 py-1.5 text-[13px] font-semibold ${
                openPopoverVisible ? 'adw-btn-active' : ''
              }`}
              title="Ouvrir un document récent ou parcourir Windows (Ctrl+O)"
            >
              <span>Ouvrir</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {/* GNOME Text Editor "Open ▾" Popover */}
            {openPopoverVisible && (
              <div
                className="absolute left-0 z-50 mt-2 w-80 rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] p-2.5"
                style={{ boxShadow: 'var(--adw-shadow-popover)' }}
              >
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--adw-fg-muted)]" />
                  <input
                    type="text"
                    value={openPopoverSearch}
                    onChange={(e) => setOpenPopoverSearch(e.target.value)}
                    placeholder="Rechercher un document .md..."
                    autoFocus
                    className="w-full rounded-lg border border-[var(--adw-border)] bg-[var(--adw-view-bg)] py-1.5 pr-3 pl-8 text-xs text-[var(--adw-fg)] focus:border-[var(--adw-accent)] focus:outline-none"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5 py-1">
                  {filteredRecentDocs.map((doc) => {
                    const isOpen = openTabs.some((t) => t.docId === doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => openDocumentInTab(doc.id)}
                        className="group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-[var(--adw-hover-bg)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--adw-fg-muted)]" />
                            <span className="truncate font-semibold text-[var(--adw-fg)]">
                              {doc.filename}
                            </span>
                          </div>
                          <div className="mt-0.5 pl-5.5 text-[11px] text-[var(--adw-fg-muted)]">
                            ~/Documents · {doc.updatedAt}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isOpen && (
                            <span className="text-[10px] font-medium text-[var(--adw-accent)]">
                              Ouvert
                            </span>
                          )}
                          {documents.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDocument(doc.id, e)}
                              className="rounded p-1 text-[var(--adw-fg-muted)] opacity-0 group-hover:opacity-100 hover:text-red-500"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-1.5 border-t border-[var(--adw-border-subtle)] pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPopoverVisible(false);
                      mdFileInputRef.current?.click();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--adw-border)] bg-[var(--adw-card-bg)] py-1.5 text-xs font-semibold text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Parcourir les fichiers (.md)...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCreateNewDocument}
            className="adw-btn p-1.5"
            title="Nouvel onglet (Ctrl+N)"
          >
            <SquarePlus className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Center Zone: AdwWindowTitle (Filename + Path Subtitle) */}
        <div
          data-tauri-drag-region
          className="flex flex-1 flex-col items-center justify-center min-w-0 px-4"
        >
          {isRenamingTitle && activeDocument ? (
            <input
              type="text"
              value={filenameDraft}
              onChange={(e) => setFilenameDraft(e.target.value)}
              onBlur={commitTitleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitleRename();
                if (e.key === 'Escape') setIsRenamingTitle(false);
              }}
              autoFocus
              className="rounded border border-[var(--adw-accent)] bg-[var(--adw-view-bg)] px-2 py-0.5 text-center text-xs font-bold text-[var(--adw-fg)] focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!activeDocument) return;
                setFilenameDraft(activeDocument.filename.replace(/\.md$/i, ''));
                setIsRenamingTitle(true);
              }}
              className="truncate text-[13px] font-bold leading-tight text-[var(--adw-fg)] hover:opacity-80"
              title="Cliquer pour renommer le fichier"
            >
              {activeDocument?.filename || 'Sans titre.md'}
            </button>
          )}
          <span
            data-tauri-drag-region
            className="pointer-events-none truncate text-[11px] leading-tight text-[var(--adw-fg-muted)]"
          >
            ~/Documents
          </span>
        </div>

        {/* Right Zone: Document Insert/Tools Icon + Hamburger Menu (☰) + Circular Close Button (✕) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Insert / Document Info Popover Button (matches the page-magnifying-glass icon in GNOME Text Editor) */}
          <div className="relative" ref={insertPopoverRef}>
            <button
              type="button"
              onClick={() => setInsertPopoverOpen((v) => !v)}
              className={`adw-btn p-1.5 ${insertPopoverOpen ? 'adw-btn-active' : ''}`}
              title="Insérer un élément Markdown (Tableau, Formule, Image)"
            >
              <FileSearch className="h-[17px] w-[17px]" />
            </button>

            {insertPopoverOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] p-2"
                style={{ boxShadow: 'var(--adw-shadow-popover)' }}
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[var(--adw-fg-muted)]">
                  Insérer dans le document
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInsertPopoverOpen(false);
                    setTableModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <TableIcon className="h-4 w-4 text-[var(--adw-accent)]" />
                  <span>Insérer un tableau...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsertPopoverOpen(false);
                    setFormulaModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <Sigma className="h-4 w-4 text-[var(--adw-accent)]" />
                  <span>Insérer une formule LaTeX...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInsertPopoverOpen(false);
                    imageFileInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <ImageIcon className="h-4 w-4 text-[var(--adw-accent)]" />
                  <span>Insérer une image...</span>
                </button>

                <div className="my-1.5 border-t border-[var(--adw-border-subtle)]" />
                <div className="px-2.5 py-1 text-[11px] text-[var(--adw-fg-muted)] tabular-nums">
                  {stats.words} mots · {stats.lines} lignes · {stats.chars} caractères
                </div>
              </div>
            )}
          </div>

          {/* Primary Menu Button (☰) */}
          <div className="relative" ref={primaryMenuRef}>
            <button
              type="button"
              onClick={() => setPrimaryMenuOpen((prev) => !prev)}
              className={`adw-btn p-1.5 ${primaryMenuOpen ? 'adw-btn-active' : ''}`}
              title="Menu principal"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            {primaryMenuOpen && (
              <div
                className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] p-2"
                style={{ boxShadow: 'var(--adw-shadow-popover)' }}
              >
                {/* Libadwaita Theme Switcher (Système / Clair / Sombre) */}
                <div className="mb-1.5 border-b border-[var(--adw-border-subtle)] px-2 pt-1.5 pb-3">
                  <div className="mb-2 text-[11px] font-medium text-[var(--adw-fg-muted)]">
                    Thème d’apparence
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setThemePref('system')}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors ${
                        themePref === 'system'
                          ? 'border-[var(--adw-accent)] bg-[var(--adw-accent-soft)] font-semibold text-[var(--adw-fg)]'
                          : 'border-[var(--adw-border)] hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-secondary)]'
                      }`}
                    >
                      <Monitor className="h-4 w-4" />
                      <span>Système</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemePref('light')}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors ${
                        themePref === 'light'
                          ? 'border-[var(--adw-accent)] bg-[var(--adw-accent-soft)] font-semibold text-[var(--adw-fg)]'
                          : 'border-[var(--adw-border)] hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-secondary)]'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      <span>Clair</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemePref('dark')}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors ${
                        themePref === 'dark'
                          ? 'border-[var(--adw-accent)] bg-[var(--adw-accent-soft)] font-semibold text-[var(--adw-fg)]'
                          : 'border-[var(--adw-border)] hover:bg-[var(--adw-hover-bg)] text-[var(--adw-fg-secondary)]'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      <span>Sombre</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSerifTypography((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <span>Police de lecture Serif</span>
                  {serifTypography && (
                    <Check className="h-3.5 w-3.5 text-[var(--adw-accent)]" />
                  )}
                </button>

                <div className="my-1 border-t border-[var(--adw-border-subtle)]" />

                <button
                  type="button"
                  onClick={() => {
                    handleDownloadMarkdown(true);
                    setPrimaryMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <span>Enregistrer sous (.md)</span>
                  <Download className="h-3.5 w-3.5 text-[var(--adw-fg-muted)]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeDocument) {
                      navigator.clipboard.writeText(activeDocument.content);
                      showToast('Markdown copié dans le presse-papiers');
                    }
                    setPrimaryMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--adw-fg)] hover:bg-[var(--adw-hover-bg)]"
                >
                  <span>Copier le code Markdown</span>
                  <Copy className="h-3.5 w-3.5 text-[var(--adw-fg-muted)]" />
                </button>
              </div>
            )}
          </div>

          {/* Iconic GNOME Libadwaita Circular Close Button on the far right */}
          <button
            type="button"
            onClick={() => {
              const tauriInternals = (
                window as unknown as {
                  __TAURI_INTERNALS__?: {
                    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
                  };
                }
              ).__TAURI_INTERNALS__;

              if (tauriInternals?.invoke) {
                tauriInternals.invoke('plugin:window|close', { label: 'main' }).catch(() => {
                  if (activeDocument) handleCloseTab(activeDocument.id);
                });
              } else if (activeDocument) {
                handleCloseTab(activeDocument.id);
              }
            }}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--adw-active-bg)] text-[var(--adw-fg)] transition-colors hover:bg-[var(--adw-fg)]/20"
            title="Fermer la fenêtre"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. GNOME LIBADWAITA FULL-WIDTH EQUAL TAB BAR (AdwTabBar)
             Matches Screenshot 2: Equal-width stretched tabs, centered labels,
             subtle vertical separators between inactive tabs, and active pill highlight!
         ===================================================================== */}
      {openTabs.length > 0 && (
        <div className="flex h-[38px] shrink-0 items-center border-b border-[var(--adw-border)] bg-[var(--adw-headerbar-bg)] px-1.5">
          <div className="flex w-full items-center overflow-x-auto no-scrollbar">
            {openTabs.map((tab, idx) => {
              const doc = documents.find((d) => d.id === tab.docId);
              if (!doc) return null;
              const isActive = doc.id === activeDocument?.id;

              return (
                <React.Fragment key={doc.id}>
                  <div
                    onClick={() => setActiveDocId(doc.id)}
                    onAuxClick={(e) => {
                      if (e.button === 1) handleCloseTab(doc.id, e);
                    }}
                    className={`group relative flex h-[30px] min-w-[140px] flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-[12.5px] transition-colors ${
                      isActive
                        ? 'bg-[var(--adw-active-bg)] font-semibold text-[var(--adw-fg)]'
                        : 'font-medium text-[var(--adw-fg-secondary)] hover:bg-[var(--adw-hover-bg)]'
                    }`}
                  >
                    <span className="truncate px-5 text-center">
                      {doc.filename}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(doc.id, e)}
                      className={`absolute right-2 rounded-full p-0.5 transition-opacity hover:bg-[var(--adw-active-bg)] ${
                        isActive
                          ? 'opacity-80 hover:opacity-100'
                          : 'opacity-0 group-hover:opacity-75'
                      }`}
                      title="Fermer l’onglet"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Subtle vertical divider between tabs when neither adjacent tab is active */}
                  {idx < openTabs.length - 1 && (
                    <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--adw-border)]" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. PURE UNCLUTTERED WYSIWYG CANVAS (Starts immediately below TabBar)
         ===================================================================== */}
      <main className="flex-1 overflow-y-auto bg-[var(--adw-view-bg)]">
        {activeDocument && (
          <TyporaEditor
            markdown={activeDocument.content}
            assets={assets}
            serifMode={serifTypography}
            onChange={updateActiveContent}
            onImageClick={(src, alt) => setLightboxImage({ src, alt })}
            onPasteImage={handleEditorPaste}
            onOpenTableModal={() => setTableModalOpen(true)}
            onOpenFormulaModal={() => setFormulaModalOpen(true)}
            onTriggerImageUpload={() => imageFileInputRef.current?.click()}
          />
        )}
      </main>

      {/* =====================================================================
          4. MODALS & OVERLAYS (Table Builder, Formula Editor, Lightbox, Toast)
         ===================================================================== */}
      <TableDialog
        isOpen={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={(mdTable) => appendBlockSnippet(mdTable)}
      />

      <FormulaDialog
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        onInsert={(latex) => appendBlockSnippet(latex)}
      />

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[var(--adw-card-bg)] p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-medium text-[var(--adw-fg)]">
                {lightboxImage.alt || 'Aperçu de l’illustration'}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="adw-btn p-1.5 text-xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              referrerPolicy="no-referrer"
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Libadwaita AdwToast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--adw-border)] bg-[var(--adw-popover-bg)] px-4 py-2 text-xs font-medium text-[var(--adw-fg)] shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
