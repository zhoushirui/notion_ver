import React, { useRef, useState } from "react";
import { useWorkspace } from "../store";
import { Route } from "../useHashRoute";
import { PromptModal, ConfirmModal } from "../components/Modal";
import { exportBackup, importBackupFile } from "../utils/backup";
import { Notebook } from "../types";
import { extractTextFromDocx, normalizeImportedText } from "../utils/docxImport";

const SUPPORTED_FOLDER_EXTENSIONS = [".docx", ".txt", ".md"];

function getFolderFilePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function getFileTitle(file: File): string {
  return file.name.replace(/\.(docx|txt|md)$/i, "");
}

async function extractFolderFileText(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) return extractTextFromDocx(file);
  return normalizeImportedText(await file.text());
}

export default function NotebooksPage({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { workspace, createNotebook, createDocument, renameNotebook, deleteNotebook, replaceWorkspace } =
    useWorkspace();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Notebook | null>(null);
  const [deleting, setDeleting] = useState<Notebook | null>(null);
  const [importingFolder, setImportingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const notebooks = [...workspace.notebooks].sort((a, b) => b.createdAt - a.createdAt);

  const handleImportBackup = async (file: File) => {
    try {
      const ws = await importBackupFile(file);
      replaceWorkspace(ws);
    } catch (e) {
      alert("导入失败：备份文件格式不正确。");
    }
  };

  const handleImportFolder = async (files: FileList | null) => {
    const importable = Array.from(files ?? [])
      .filter((file) => SUPPORTED_FOLDER_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)))
      .sort((a, b) => getFolderFilePath(a).localeCompare(getFolderFilePath(b), "zh-CN", { numeric: true }));

    if (importable.length === 0) {
      alert("这个文件夹里没有可导入的 .docx、.txt 或 .md 文件。");
      return;
    }

    setImportingFolder(true);
    try {
      const firstPath = getFolderFilePath(importable[0]);
      const folderName = firstPath.includes("/") ? firstPath.split("/")[0] : "导入的文件夹";
      const nb = createNotebook(folderName);

      for (const file of importable) {
        const content = await extractFolderFileText(file);
        createDocument(nb.id, getFileTitle(file), "chapter", content);
      }
      onNavigate({ name: "documents", notebookId: nb.id });
    } catch {
      alert("导入文件夹失败，请确认文件没有损坏。");
    } finally {
      setImportingFolder(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-crumbs">
          <span className="crumb-current home-brand">notion_ver</span>
        </div>
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          导入备份
        </button>
        <button className="btn" disabled={importingFolder} onClick={() => folderInputRef.current?.click()}>
          {importingFolder ? "导入中…" : "批量导入"}
        </button>
        <button className="btn" onClick={() => exportBackup(workspace)}>
          导出备份
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportBackup(f);
            e.target.value = "";
          }}
        />
        <input
          ref={(el) => {
            folderInputRef.current = el;
            el?.setAttribute("webkitdirectory", "");
            el?.setAttribute("directory", "");
          }}
          type="file"
          multiple
          accept=".docx,.txt,.md"
          style={{ display: "none" }}
          onChange={(e) => {
            handleImportFolder(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="page-body">
        <div className="notebooks-page">
          <div className="notebooks-header">
            <div>
              <h1 className="notebooks-title">工作台</h1>
            </div>
          </div>

          {notebooks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">还没有笔记本</div>
              <p>新建一本，开始你的第一章</p>
              <div style={{ marginTop: 18 }}>
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                  新建笔记本
                </button>
              </div>
            </div>
          ) : (
            <div className="notebook-grid">
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  className="notebook-card"
                  onClick={() => onNavigate({ name: "documents", notebookId: nb.id })}
                >
                  <div className="notebook-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title="重命名" onClick={() => setRenaming(nb)}>
                      ✎
                    </button>
                    <button className="icon-btn" title="删除" onClick={() => setDeleting(nb)}>
                      ✕
                    </button>
                  </div>
                  <h3 className="notebook-card-name">{nb.name}</h3>
                  <div className="notebook-card-meta">
                    {new Date(nb.createdAt).toLocaleDateString("zh-CN")} 创建
                  </div>
                </div>
              ))}
              <div className="new-notebook-card" onClick={() => setCreating(true)}>
                + 新建笔记本
              </div>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <PromptModal
          title="新建笔记本"
          placeholder="例如：末世苟命指南"
          onConfirm={(name) => {
            const nb = createNotebook(name);
            onNavigate({ name: "documents", notebookId: nb.id });
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {renaming && (
        <PromptModal
          title="重命名笔记本"
          initialValue={renaming.name}
          onConfirm={(name) => renameNotebook(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`删除「${deleting.name}」？`}
          description="笔记本内的所有文档也会被一并删除，且无法恢复。请确认已导出需要保留的内容。"
          onConfirm={() => deleteNotebook(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
