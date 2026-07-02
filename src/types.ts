export type DocType = "chapter" | "outline" | "inspiration" | "trash";

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  chapter: "章节",
  outline: "大纲",
  inspiration: "灵感",
  trash: "废纸篓",
};

export const DOC_TYPES: DocType[] = ["chapter", "outline", "inspiration", "trash"];

export interface CharacterName {
  id: string;
  name: string;
  pinnedAt?: number;
}

export interface NotebookVariable {
  id: string;
  name: string;
  value: number;
}

export interface SnippetTemplate {
  id: string;
  name: string;
  content: string;
}

export interface DocItem {
  id: string;
  notebookId: string;
  title: string;
  type: DocType;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: number;
  characters: CharacterName[];
  variables: NotebookVariable[];
  snippets: SnippetTemplate[];
  docOrder: string[];
}

export interface Workspace {
  notebooks: Notebook[];
  documents: DocItem[];
}

export const emptyWorkspace = (): Workspace => ({ notebooks: [], documents: [] });
