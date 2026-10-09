export type ThemePreference = 'system' | 'light' | 'dark';

export type EditorViewMode = 'typora' | 'source';

export interface ProjectFolder {
  id: string;
  name: string;
  description: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MarkdownDocument {
  id: string;
  filename: string; // e.g., "Optique & Dispersion.md"
  projectId: string;
  content: string;
  updatedAt: string;
  pinnedInSidebar?: boolean;
  isDirty?: boolean;
}

export interface OpenTab {
  docId: string;
  pinned?: boolean;
}

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  lineIndex: number;
}
