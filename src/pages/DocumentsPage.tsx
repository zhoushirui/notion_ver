import React, { useRef, useState } from "react";
import { useWorkspace } from "../store";
import { Route } from "../useHashRoute";
import { Modal, ConfirmModal, PromptModal } from "../components/Modal";
import { DOC_TYPE_LABEL, DOC_TYPES, DocItem, DocType, Notebook } from "../types";
import { exportManyDocx, exportSingleDocx } from "../utils/docxExport";
import { extractTextFromDocx } from "../utils/docxImport";

function NewDocumentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, type: DocType) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("chapter");
  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">新建文档</h3>
      <input
        className="modal-input"
        placeholder="文档标题，例如：第一章 荒原"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && title.trim() && onCreate(title.trim(), type)}
      />
      <select className="modal-select" value={type} onChange={(e) => setType(e.target.value as DocType)}>
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOC_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <div className="modal-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          disabled={!title.trim()}
          onClick={() => title.trim() && onCreate(title.trim(), type)}
        >
          创建
        </button>
      </div>
    </Modal>
  );
}

function ImportDocxModal({
  notebook,
  docs,
  onClose,
  onImportedAsNew,
  onImportedAppend,
}: {
  notebook: Notebook;
  docs: DocItem[];
  onClose: () => void;
  onImportedAsNew: (title: string, type: DocType, content: string) => void;
  onImportedAppend: (docId: string, content: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"new" | "append">("new");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("chapter");
  const [targetId, setTargetId] = useState(docs[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await extractTextFromDocx(file);
      if (mode === "new") {
        onImportedAsNew(title.trim() || file.name.replace(/\.docx$/i, ""), type, text);
      } else if (targetId) {
        onImportedAppend(targetId, text);
      }
      onClose();
    } catch (e) {
      alert("导入失败，请确认文件为有效的 .docx 文件。");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">从本地导入 .docx</h3>
      <input
        type="file"
        accept=".docx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ marginBottom: 14, fontSize: 13 }}
      />
      <div className="checkbox-row" style={{ marginBottom: 10, gap: 16 }}>
        <label className="checkbox-row">
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> 新建为文档
        </label>
        <label className="checkbox-row">
          <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> 追加到已有文档
        </label>
      </div>
      {mode === "new" ? (
        <>
          <input
            className="modal-input"
            placeholder="文档标题（留空则使用文件名）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="modal-select" value={type} onChange={(e) => setType(e.target.value as DocType)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </>
      ) : (
        <select className="modal-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {docs.length === 0 && <option value="">该笔记本暂无文档</option>}
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      )}
      <div className="modal-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" disabled={!file || busy || (mode === "append" && !targetId)} onClick={handleImport}>
          {busy ? "导入中…" : "导入"}
        </button>
      </div>
    </Modal>
  );
}

export default function DocumentsPage({
  notebook,
  onNavigate,
}: {
  notebook: Notebook;
  onNavigate: (r: Route) => void;
}) {
  const { getDocumentsFor, createDocument, renameDocument, setDocumentType, deleteDocument, appendToDocument } =
    useWorkspace();
  const docs = getDocumentsFor(notebook.id);

  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<DocItem | null>(null);
  const [deleting, setDeleting] = useState<DocItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDocs = docs.filter((d) => selected.has(d.id));

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-crumbs">
          <button className="crumb-link" onClick={() => onNavigate({ name: "notebooks" })}>
            全部笔记本
          </button>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{notebook.name}</span>
        </div>
      </div>

      <div className="page-body">
        <div className="documents-page">
          <div className="documents-toolbar">
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + 新建文档
            </button>
            <button className="btn" onClick={() => setImporting(true)}>
              导入 .docx
            </button>
            <div style={{ flex: 1 }} />
            {selected.size > 0 && (
              <button className="btn" onClick={() => exportManyDocx(selectedDocs, `${notebook.name}_已选文档`)}>
                导出所选（{selected.size}）
              </button>
            )}
            <button
              className="btn"
              disabled={docs.length === 0}
              onClick={() => exportManyDocx(docs, notebook.name)}
            >
              一键导出全部为 docx
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">这本笔记本还是空的</div>
              <p>新建第一篇文档，或从本地导入 .docx</p>
            </div>
          ) : (
            <div className="doc-table">
              <div className="doc-row header-row">
                <span />
                <span>标题</span>
                <span>类型</span>
                <span>更新时间</span>
                <span />
              </div>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="doc-row"
                  onClick={() => onNavigate({ name: "editor", notebookId: notebook.id, docId: doc.id })}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(doc.id)}
                  />
                  <span className="doc-title">{doc.title}</span>
                  <select
                    className="doc-type-select"
                    value={doc.type}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDocumentType(doc.id, e.target.value as DocType)}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {DOC_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <span className="doc-meta">{new Date(doc.updatedAt).toLocaleString("zh-CN")}</span>
                  <div className="doc-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" title="导出" onClick={() => exportSingleDocx(doc)}>
                      ⇩
                    </button>
                    <button className="icon-btn" title="重命名" onClick={() => setRenaming(doc)}>
                      ✎
                    </button>
                    <button className="icon-btn" title="删除" onClick={() => setDeleting(doc)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {creating && (
        <NewDocumentModal
          onClose={() => setCreating(false)}
          onCreate={(title, type) => {
            const doc = createDocument(notebook.id, title, type);
            onNavigate({ name: "editor", notebookId: notebook.id, docId: doc.id });
          }}
        />
      )}

      {importing && (
        <ImportDocxModal
          notebook={notebook}
          docs={docs}
          onClose={() => setImporting(false)}
          onImportedAsNew={(title, type, content) => createDocument(notebook.id, title, type, content)}
          onImportedAppend={(docId, content) => appendToDocument(docId, content)}
        />
      )}

      {renaming && (
        <PromptModal
          title="重命名文档"
          initialValue={renaming.title}
          onConfirm={(title) => renameDocument(renaming.id, title)}
          onClose={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title={`删除「${deleting.title}」？`}
          description="删除后无法恢复，请确认已导出需要保留的内容。"
          onConfirm={() => deleteDocument(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
