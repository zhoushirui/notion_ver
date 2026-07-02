import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace, loadDraft, saveDraft, clearDraft } from "../store";
import { Route } from "../useHashRoute";
import { DOC_TYPE_LABEL, DOC_TYPES, DocItem, DocType, Notebook } from "../types";
import { CharacterMenu } from "../components/CharacterMenu";
import { getCaretCoordinates } from "../utils/caretPosition";
import { countText, formatWordCount } from "../utils/wordCount";

const SPLIT_KEY = "nw:splitRatio";

function compactDisplayText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function EditorPage({
  notebook,
  doc,
  onNavigate,
}: {
  notebook: Notebook;
  doc: DocItem;
  onNavigate: (r: Route) => void;
}) {
  const {
    getDocumentsFor,
    appendToDocument,
    replaceDocumentContent,
    addCharacter,
    pinCharacter,
    deleteCharacter,
    addNotebookVariable,
    updateNotebookVariable,
    deleteNotebookVariable,
    addSnippetTemplate,
    updateSnippetTemplate,
    deleteSnippetTemplate,
  } = useWorkspace();

  const docs = getDocumentsFor(notebook.id);

  // --- split pane ---
  const [ratio, setRatio] = useState(() => {
    const saved = Number(localStorage.getItem(SPLIT_KEY));
    return saved && saved > 0.15 && saved < 0.85 ? saved : 0.42;
  });
  const [dragging, setDragging] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = splitRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let r = (e.clientX - rect.left) / rect.width;
      r = Math.min(0.75, Math.max(0.2, r));
      setRatio(r);
    };
    const onUp = () => {
      setDragging(false);
      localStorage.setItem(SPLIT_KEY, String(ratio));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // --- left pane: browse ---
  const [leftFilter, setLeftFilter] = useState<DocType | "all">("all");
  const [leftSearch, setLeftSearch] = useState("");
  const [leftSelectedId, setLeftSelectedId] = useState(doc.id);
  const [leftBrowserOpen, setLeftBrowserOpen] = useState(false);
  const [leftInfoOpen, setLeftInfoOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftEditing, setLeftEditing] = useState(false);
  const [leftEditText, setLeftEditText] = useState("");
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const keepLeftSlashOpenRef = useRef(false);

  useEffect(() => {
    setLeftSelectedId(doc.id);
  }, [doc.id]);

  const leftDocs = useMemo(() => {
    return docs.filter((d) => {
      if (leftFilter !== "all" && d.type !== leftFilter) return false;
      if (leftSearch.trim()) {
        const q = leftSearch.trim().toLowerCase();
        return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [docs, leftFilter, leftSearch]);

  const leftSelectedDoc = docs.find((d) => d.id === leftSelectedId) ?? doc;

  useEffect(() => {
    setLeftEditing(false);
    setLeftEditText(leftSelectedDoc?.content ?? "");
    setLeftInfoOpen(false);
  }, [leftSelectedDoc?.id]);

  // --- right pane: write ---
  const [writeTargetId, setWriteTargetId] = useState(doc.id);
  const [draftText, setDraftText] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<"variables" | "snippets" | null>(null);
  const [newVariableName, setNewVariableName] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("0");
  const [newSnippetName, setNewSnippetName] = useState("");
  const [newSnippetContent, setNewSnippetContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keepSlashOpenRef = useRef(false);

  useEffect(() => {
    setWriteTargetId(doc.id);
    setDraftText(loadDraft(doc.id));
  }, [doc.id]);

  const writeTargetDoc = docs.find((d) => d.id === writeTargetId);
  const variables = notebook.variables ?? [];
  const snippets = notebook.snippets ?? [];

  // --- slash character menu ---
  const [slash, setSlash] = useState<{ start: number; query: string; top: number; left: number } | null>(null);
  const [leftSlash, setLeftSlash] = useState<{ start: number; query: string; top: number; left: number } | null>(
    null
  );

  const updateSlashFromTextarea = (
    el: HTMLTextAreaElement,
    value: string,
    cursor: number,
    setter: React.Dispatch<React.SetStateAction<{ start: number; query: string; top: number; left: number } | null>>
  ) => {
    const lastSlash = value.lastIndexOf("/", cursor - 1);
    if (lastSlash === -1) {
      setter(null);
      return;
    }
    const query = value.slice(lastSlash + 1, cursor);
    if (/[\n\r/]/.test(query)) {
      setter(null);
      return;
    }
    const coords = getCaretCoordinates(el, cursor);
    setter({ start: lastSlash, query, top: coords.top + coords.height + 4, left: Math.min(coords.left, 380) });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setDraftText(value);
    saveDraft(doc.id, value);

    updateSlashFromTextarea(e.target, value, cursor, setSlash);
  };

  const handleLeftTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setLeftEditText(value);
    updateSlashFromTextarea(e.target, value, cursor, setLeftSlash);
  };

  const insertCharacter = (name: string) => {
    if (!slash || !textareaRef.current) return;
    const el = textareaRef.current;
    const replaceEnd = slash.start + slash.query.length + 1;
    const insertText = `【${name}】\n`;
    const newValue = draftText.slice(0, slash.start) + insertText + draftText.slice(replaceEnd);
    setDraftText(newValue);
    saveDraft(doc.id, newValue);
    setSlash(null);
    const newCursor = slash.start + insertText.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleAddNewCharacter = (name: string) => {
    addCharacter(notebook.id, name);
    insertCharacter(name);
  };

  const insertLeftCharacter = (name: string) => {
    if (!leftSlash || !leftTextareaRef.current) return;
    const el = leftTextareaRef.current;
    const scrollTop = el.scrollTop;
    const scrollLeft = el.scrollLeft;
    const replaceEnd = leftSlash.start + leftSlash.query.length + 1;
    const insertText = `【${name}】\n`;
    const newValue = leftEditText.slice(0, leftSlash.start) + insertText + leftEditText.slice(replaceEnd);
    setLeftEditText(newValue);
    setLeftSlash(null);
    const newCursor = leftSlash.start + insertText.length;
    requestAnimationFrame(() => {
      el.focus();
      el.scrollTop = scrollTop;
      el.scrollLeft = scrollLeft;
      el.setSelectionRange(newCursor, newCursor);
      el.scrollTop = scrollTop;
      el.scrollLeft = scrollLeft;
    });
  };

  const handleAddNewLeftCharacter = (name: string) => {
    addCharacter(notebook.id, name);
    insertLeftCharacter(name);
  };

  const handleLeftSave = () => {
    if (!leftSelectedDoc) return;
    replaceDocumentContent(leftSelectedDoc.id, leftEditText);
    setLeftEditing(false);
    setLeftSlash(null);
  };

  const handleSave = () => {
    if (!draftText.trim() || !writeTargetId) return;
    appendToDocument(writeTargetId, draftText);
    clearDraft(doc.id);
    setDraftText("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const handleAddVariable = () => {
    if (!newVariableName.trim()) return;
    addNotebookVariable(notebook.id, newVariableName.trim(), Number(newVariableValue) || 0);
    setNewVariableName("");
    setNewVariableValue("0");
  };

  const handleAddSnippet = () => {
    if (!newSnippetName.trim() || !newSnippetContent.trim()) return;
    addSnippetTemplate(notebook.id, newSnippetName.trim(), newSnippetContent);
    setNewSnippetName("");
    setNewSnippetContent("");
  };

  const insertSnippet = (content: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? draftText.length;
    const end = el?.selectionEnd ?? start;
    const newValue = draftText.slice(0, start) + content + draftText.slice(end);
    setDraftText(newValue);
    saveDraft(doc.id, newValue);
    const newCursor = start + content.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(newCursor, newCursor);
    });
  };

  const wordCount = countText(draftText);
  const leftDocWordCount = countText(leftSelectedDoc?.content ?? "");

  return (
    <div className="app-shell">
      {!leftCollapsed && (
        <div className="topbar">
          <div className="topbar-crumbs">
            <button className="crumb-link" onClick={() => onNavigate({ name: "notebooks" })}>
              全部笔记本
            </button>
            <span className="crumb-sep">/</span>
            <button className="crumb-link" onClick={() => onNavigate({ name: "documents", notebookId: notebook.id })}>
              {notebook.name}
            </button>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{doc.title}</span>
          </div>
        </div>
      )}

      <div className="editor-page">
        <div className="editor-split" ref={splitRef}>
          {!leftCollapsed && (
          <div className="editor-pane pane-left" style={{ flexBasis: `${ratio * 100}%` }}>
            <div className="pane-header">
              <div className="pane-header-actions">
                <div className="pane-tabs">
                  <button
                    className={`pane-tab${leftFilter === "all" ? " active" : ""}`}
                    onClick={() => {
                      setLeftFilter("all");
                      setLeftBrowserOpen(true);
                    }}
                  >
                    全部
                  </button>
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t}
                      className={`pane-tab${leftFilter === t ? " active" : ""}`}
                      onClick={() => {
                        setLeftFilter(t);
                        setLeftBrowserOpen(true);
                      }}
                    >
                      {DOC_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
                <button className="btn btn-quiet btn-sm" onClick={() => setLeftCollapsed(true)}>
                  收起
                </button>
              </div>
              {leftBrowserOpen && (
                <input
                  className="pane-search"
                  placeholder="搜索标题或正文…"
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                />
              )}
            </div>

            {leftBrowserOpen && (
              <div className="pane-doc-list">
                {leftDocs.length === 0 && <div className="char-menu-empty">没有匹配的文档</div>}
                {leftDocs.map((d) => (
                  <div
                    key={d.id}
                    className={`pane-doc-item${d.id === leftSelectedId ? " active" : ""}`}
                    onClick={() => {
                      setLeftSelectedId(d.id);
                      setLeftBrowserOpen(false);
                    }}
                  >
                    <span className="pane-doc-item-title">{d.title}</span>
                    <span className="doc-type-tag">{DOC_TYPE_LABEL[d.type]}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pane-content-wrap">
              {leftSelectedDoc ? (
                <>
                  <div className="pane-content-head">
                    <div className="pane-info-block">
                      <button
                        className="btn btn-quiet btn-sm"
                        onClick={() => setLeftInfoOpen((open) => !open)}
                      >
                        文档信息
                      </button>
                      <span className="pane-word-count">{formatWordCount(leftDocWordCount)}</span>
                      {leftInfoOpen && (
                        <div className="pane-info-detail">
                          <h3 className="pane-content-title">{leftSelectedDoc.title}</h3>
                          <div className="pane-content-meta">
                            {DOC_TYPE_LABEL[leftSelectedDoc.type]} · 更新于{" "}
                            {new Date(leftSelectedDoc.updatedAt).toLocaleString("zh-CN")}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="pane-content-actions">
                      {leftEditing ? (
                        <>
                          <button className="btn btn-quiet btn-sm" onClick={() => {
                            setLeftEditing(false);
                            setLeftEditText(leftSelectedDoc.content);
                            setLeftSlash(null);
                          }}>
                            取消
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={handleLeftSave}>
                            保存覆盖
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-sm" onClick={() => {
                          setLeftEditText(leftSelectedDoc.content);
                          setLeftEditing(true);
                        }}>
                          修改
                        </button>
                      )}
                    </div>
                  </div>
                  {leftEditing ? (
                    <div className="pane-left-edit-area">
                      <textarea
                        ref={leftTextareaRef}
                        className="pane-left-textarea"
                        value={leftEditText}
                        onChange={handleLeftTextChange}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setLeftSlash(null);
                        }}
                        onBlur={() =>
                          setTimeout(() => {
                            if (keepLeftSlashOpenRef.current) {
                              keepLeftSlashOpenRef.current = false;
                              return;
                            }
                            setLeftSlash(null);
                          }, 150)
                        }
                      />
                      {leftSlash && (
                        <CharacterMenu
                          characters={notebook.characters ?? []}
                          query={leftSlash.query}
                          position={{ top: leftSlash.top, left: leftSlash.left }}
                          onSelect={insertLeftCharacter}
                          onAddNew={handleAddNewLeftCharacter}
                          onPin={(id) => pinCharacter(notebook.id, id)}
                          onDelete={(id) => deleteCharacter(notebook.id, id)}
                          onInteractStart={() => {
                            keepLeftSlashOpenRef.current = true;
                          }}
                          onClose={() => setLeftSlash(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="pane-content">
                      {compactDisplayText(leftSelectedDoc.content) || <span className="pane-empty">这篇文档还没有内容</span>}
                    </div>
                  )}
                </>
              ) : (
                <div className="pane-empty">选择左侧文档以查看内容</div>
              )}
            </div>
          </div>
          )}

          {!leftCollapsed && (
            <div
              className={`pane-divider${dragging ? " dragging" : ""}`}
              onMouseDown={() => setDragging(true)}
            />
          )}

          <div className="editor-pane pane-right" style={{ flexBasis: leftCollapsed ? "100%" : `${(1 - ratio) * 100}%` }}>
            <div className="editor-toolbar">
              {leftCollapsed && (
                <button className="btn btn-sm" onClick={() => setLeftCollapsed(false)}>
                  展开阅读
                </button>
              )}
              <span className="toolbar-label">位置</span>
              <select value={writeTargetId} onChange={(e) => setWriteTargetId(e.target.value)}>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <button
                className={`btn btn-sm${activeToolPanel === "variables" ? " btn-primary" : ""}`}
                onClick={() => setActiveToolPanel((panel) => (panel === "variables" ? null : "variables"))}
              >
                数值
              </button>
              <button
                className={`btn btn-sm${activeToolPanel === "snippets" ? " btn-primary" : ""}`}
                onClick={() => setActiveToolPanel((panel) => (panel === "snippets" ? null : "snippets"))}
              >
                常用片段
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" disabled={!draftText.trim()} onClick={handleSave}>
                保存
              </button>
            </div>

            {activeToolPanel === "variables" && (
              <div className="tool-popover">
                <div className="tool-popover-head">
                  <strong>变量面板</strong>
                  <button className="icon-btn" onClick={() => setActiveToolPanel(null)}>
                    ✕
                  </button>
                </div>
                <div className="tool-popover-list">
                  {variables.length === 0 && <div className="tool-empty">还没有变量</div>}
                  {variables.map((variable) => (
                    <div className="variable-row" key={variable.id}>
                      <input
                        className="tool-input variable-name-input"
                        value={variable.name}
                        onChange={(e) =>
                          updateNotebookVariable(notebook.id, variable.id, { name: e.target.value })
                        }
                      />
                      <input
                        className="tool-input variable-value-input"
                        type="number"
                        value={variable.value}
                        onChange={(e) =>
                          updateNotebookVariable(notebook.id, variable.id, { value: Number(e.target.value) || 0 })
                        }
                      />
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          updateNotebookVariable(notebook.id, variable.id, { value: variable.value - 1 })
                        }
                      >
                        -1
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          updateNotebookVariable(notebook.id, variable.id, { value: variable.value + 1 })
                        }
                      >
                        +1
                      </button>
                      <button className="icon-btn" onClick={() => deleteNotebookVariable(notebook.id, variable.id)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tool-add-row">
                  <input
                    className="tool-input"
                    placeholder="变量名称"
                    value={newVariableName}
                    onChange={(e) => setNewVariableName(e.target.value)}
                  />
                  <input
                    className="tool-input variable-value-input"
                    type="number"
                    value={newVariableValue}
                    onChange={(e) => setNewVariableValue(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" disabled={!newVariableName.trim()} onClick={handleAddVariable}>
                    新增
                  </button>
                </div>
              </div>
            )}

            {activeToolPanel === "snippets" && (
              <div className="tool-popover snippet-popover">
                <div className="tool-popover-head">
                  <strong>常用片段</strong>
                  <button className="icon-btn" onClick={() => setActiveToolPanel(null)}>
                    ✕
                  </button>
                </div>
                <div className="tool-popover-list">
                  {snippets.length === 0 && <div className="tool-empty">还没有常用片段</div>}
                  {snippets.map((snippet) => (
                    <div className="snippet-row" key={snippet.id}>
                      <div className="snippet-row-head">
                        <button className="snippet-insert-btn" onClick={() => insertSnippet(snippet.content)}>
                          {snippet.name}
                        </button>
                        <button className="icon-btn" onClick={() => deleteSnippetTemplate(notebook.id, snippet.id)}>
                          ✕
                        </button>
                      </div>
                      <input
                        className="tool-input"
                        value={snippet.name}
                        onChange={(e) =>
                          updateSnippetTemplate(notebook.id, snippet.id, { name: e.target.value })
                        }
                      />
                      <textarea
                        className="tool-textarea"
                        value={snippet.content}
                        onChange={(e) =>
                          updateSnippetTemplate(notebook.id, snippet.id, { content: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="snippet-add-box">
                  <input
                    className="tool-input"
                    placeholder="片段名称"
                    value={newSnippetName}
                    onChange={(e) => setNewSnippetName(e.target.value)}
                  />
                  <textarea
                    className="tool-textarea"
                    placeholder="片段内容"
                    value={newSnippetContent}
                    onChange={(e) => setNewSnippetContent(e.target.value)}
                  />
                  <div className="tool-actions-right">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!newSnippetName.trim() || !newSnippetContent.trim()}
                      onClick={handleAddSnippet}
                    >
                      新增片段
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="editor-write-area">
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                placeholder="在这里写下新的内容…输入 / 可快速插入角色姓名"
                value={draftText}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSlash(null);
                }}
                onBlur={() =>
                  setTimeout(() => {
                    if (keepSlashOpenRef.current) {
                      keepSlashOpenRef.current = false;
                      return;
                    }
                    setSlash(null);
                  }, 150)
                }
              />
              {slash && (
                <CharacterMenu
                  characters={notebook.characters ?? []}
                  query={slash.query}
                  position={{ top: slash.top, left: slash.left }}
                  onSelect={insertCharacter}
                  onAddNew={handleAddNewCharacter}
                  onPin={(id) => pinCharacter(notebook.id, id)}
                  onDelete={(id) => deleteCharacter(notebook.id, id)}
                  onInteractStart={() => {
                    keepSlashOpenRef.current = true;
                  }}
                  onClose={() => setSlash(null)}
                />
              )}
            </div>

            <div className="editor-footer">
              <div className="editor-footer-stats">
                <span>{wordCount} 字</span>
                <span>
                  <span className={`status-dot${draftText ? " draft" : ""}`} />
                  {draftText ? "草稿已缓存" : "无草稿"}
                </span>
                {savedFlash && (
                  <span>
                    <span className="status-dot saved" />
                    已保存至「{writeTargetDoc?.title}」
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
