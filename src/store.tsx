import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CharacterName, DocItem, DocType, Notebook, Workspace, emptyWorkspace } from "./types";
import { makeId } from "./utils/id";

const STORAGE_KEY = "nw:workspace:v1";

function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.notebooks) || !Array.isArray(parsed.documents)) {
      return emptyWorkspace();
    }
    return normalizeWorkspace(parsed as Workspace);
  } catch {
    return emptyWorkspace();
  }
}

function normalizeWorkspace(ws: Workspace): Workspace {
  return {
    notebooks: ws.notebooks.map((n) => ({ ...n, characters: Array.isArray(n.characters) ? n.characters : [] })),
    documents: ws.documents.map((d) => ({ ...d, type: normalizeDocType(d.type) })),
  };
}

function normalizeDocType(type: unknown): DocType {
  if (type === "chapter" || type === "outline" || type === "inspiration" || type === "trash") return type;
  if (type === "setting") return "outline";
  if (type === "fragment" || type === "note") return "inspiration";
  return "chapter";
}

interface WorkspaceContextValue {
  workspace: Workspace;
  replaceWorkspace: (ws: Workspace) => void;

  createNotebook: (name: string) => Notebook;
  renameNotebook: (id: string, name: string) => void;
  deleteNotebook: (id: string) => void;

  createDocument: (notebookId: string, title: string, type: DocType, content?: string) => DocItem;
  renameDocument: (id: string, title: string) => void;
  setDocumentType: (id: string, type: DocType) => void;
  deleteDocument: (id: string) => void;
  appendToDocument: (id: string, text: string) => void;
  replaceDocumentContent: (id: string, text: string) => void;

  addCharacter: (notebookId: string, name: string) => CharacterName;
  pinCharacter: (notebookId: string, characterId: string) => void;
  deleteCharacter: (notebookId: string, characterId: string) => void;

  getNotebook: (id: string) => Notebook | undefined;
  getDocumentsFor: (notebookId: string) => DocItem[];
  getDocument: (id: string) => DocItem | undefined;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // storage full or unavailable — silently ignore, export/backup remains the source of truth
    }
  }, [workspace]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const replaceWorkspace = (ws: Workspace) => setWorkspace(normalizeWorkspace(ws));

    const createNotebook = (name: string) => {
      const nb: Notebook = { id: makeId(), name: name.trim() || "未命名笔记本", createdAt: Date.now(), characters: [] };
      setWorkspace((w) => ({ ...w, notebooks: [nb, ...w.notebooks] }));
      return nb;
    };

    const renameNotebook = (id: string, name: string) => {
      setWorkspace((w) => ({
        ...w,
        notebooks: w.notebooks.map((n) => (n.id === id ? { ...n, name: name.trim() || n.name } : n)),
      }));
    };

    const deleteNotebook = (id: string) => {
      setWorkspace((w) => ({
        notebooks: w.notebooks.filter((n) => n.id !== id),
        documents: w.documents.filter((d) => d.notebookId !== id),
      }));
    };

    const createDocument = (notebookId: string, title: string, type: DocType, content = "") => {
      const doc: DocItem = {
        id: makeId(),
        notebookId,
        title: title.trim() || "未命名文档",
        type,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setWorkspace((w) => ({ ...w, documents: [doc, ...w.documents] }));
      return doc;
    };

    const renameDocument = (id: string, title: string) => {
      setWorkspace((w) => ({
        ...w,
        documents: w.documents.map((d) => (d.id === id ? { ...d, title: title.trim() || d.title } : d)),
      }));
    };

    const setDocumentType = (id: string, type: DocType) => {
      setWorkspace((w) => ({
        ...w,
        documents: w.documents.map((d) => (d.id === id ? { ...d, type } : d)),
      }));
    };

    const deleteDocument = (id: string) => {
      setWorkspace((w) => ({ ...w, documents: w.documents.filter((d) => d.id !== id) }));
    };

    const appendToDocument = (id: string, text: string) => {
      setWorkspace((w) => ({
        ...w,
        documents: w.documents.map((d) => {
          if (d.id !== id) return d;
          const separator = d.content.trim().length ? "\n\n" : "";
          return { ...d, content: d.content + separator + text, updatedAt: Date.now() };
        }),
      }));
    };

    const replaceDocumentContent = (id: string, text: string) => {
      setWorkspace((w) => ({
        ...w,
        documents: w.documents.map((d) => (d.id === id ? { ...d, content: text, updatedAt: Date.now() } : d)),
      }));
    };

    const addCharacter = (notebookId: string, name: string) => {
      const trimmed = name.trim();
      const char: CharacterName = { id: makeId(), name: trimmed };
      setWorkspace((w) => ({
        ...w,
        notebooks: w.notebooks.map((n) =>
          n.id === notebookId ? { ...n, characters: [...(n.characters ?? []), char] } : n
        ),
      }));
      return char;
    };

    const pinCharacter = (notebookId: string, characterId: string) => {
      setWorkspace((w) => ({
        ...w,
        notebooks: w.notebooks.map((n) =>
          n.id === notebookId
            ? {
                ...n,
                characters: (n.characters ?? []).map((c) =>
                  c.id === characterId ? { ...c, pinnedAt: Date.now() } : c
                ),
              }
            : n
        ),
      }));
    };

    const deleteCharacter = (notebookId: string, characterId: string) => {
      setWorkspace((w) => ({
        ...w,
        notebooks: w.notebooks.map((n) =>
          n.id === notebookId ? { ...n, characters: (n.characters ?? []).filter((c) => c.id !== characterId) } : n
        ),
      }));
    };

    const getNotebook = (id: string) => workspace.notebooks.find((n) => n.id === id);
    const getDocumentsFor = (notebookId: string) =>
      workspace.documents
        .filter((d) => d.notebookId === notebookId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    const getDocument = (id: string) => workspace.documents.find((d) => d.id === id);

    return {
      workspace,
      replaceWorkspace,
      createNotebook,
      renameNotebook,
      deleteNotebook,
      createDocument,
      renameDocument,
      setDocumentType,
      deleteDocument,
      appendToDocument,
      replaceDocumentContent,
      addCharacter,
      pinCharacter,
      deleteCharacter,
      getNotebook,
      getDocumentsFor,
      getDocument,
    };
  }, [workspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// --- draft cache: protects the right-hand input box only, keyed by document id ---
export function loadDraft(docId: string): string {
  try {
    return localStorage.getItem(`nw:draft:${docId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(docId: string, text: string) {
  try {
    if (text) localStorage.setItem(`nw:draft:${docId}`, text);
    else localStorage.removeItem(`nw:draft:${docId}`);
  } catch {
    // ignore
  }
}

export function clearDraft(docId: string) {
  try {
    localStorage.removeItem(`nw:draft:${docId}`);
  } catch {
    // ignore
  }
}
