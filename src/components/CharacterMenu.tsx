import React, { useEffect, useRef, useState } from "react";
import { CharacterName } from "../types";

export function sortCharacters(chars: CharacterName[]): CharacterName[] {
  const pinned = chars.filter((c) => c.pinnedAt).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  const rest = chars.filter((c) => !c.pinnedAt);
  return [...pinned, ...rest];
}

interface Props {
  characters: CharacterName[];
  query: string;
  position: { top: number; left: number };
  onSelect: (name: string) => void;
  onAddNew: (name: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onInteractStart: () => void;
  onClose: () => void;
}

export function CharacterMenu({
  characters,
  query,
  position,
  onSelect,
  onAddNew,
  onPin,
  onDelete,
  onInteractStart,
  onClose,
}: Props) {
  const filtered = sortCharacters(characters).filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const [highlighted, setHighlighted] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState(query);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; char: CharacterName } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHighlighted(0);
  }, [query, characters.length]);

  useEffect(() => {
    if (adding) {
      setNewName(query);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  }, [adding, query]);

  useEffect(() => {
    const closeCtx = () => setCtxMenu(null);
    window.addEventListener("click", closeCtx);
    return () => window.removeEventListener("click", closeCtx);
  }, []);

  // expose keyboard handling to parent via window events would be messy; instead parent
  // forwards key events through onKeyDownCapture on the textarea using this component's ref API.
  // Simpler: attach a document-level keydown listener while menu is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (adding) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length)); // last index = "add new"
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlighted === filtered.length) {
          setAdding(true);
        } else if (filtered[highlighted]) {
          onSelect(filtered[highlighted].name);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [filtered, highlighted, adding, onSelect, onClose]);

  return (
    <div
      className="char-menu"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => {
        onInteractStart();
        e.stopPropagation();
      }}
    >
      {adding ? (
        <div style={{ padding: 4 }}>
          <input
            ref={addInputRef}
            className="modal-input"
            style={{ marginBottom: 6 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && newName.trim()) {
                onAddNew(newName.trim());
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="输入新角色姓名"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button className="btn btn-quiet btn-sm" onClick={() => setAdding(false)}>
              取消
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!newName.trim()}
              onClick={() => newName.trim() && onAddNew(newName.trim())}
            >
              添加
            </button>
          </div>
        </div>
      ) : (
        <>
          {filtered.length === 0 && <div className="char-menu-empty">没有匹配的姓名</div>}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className={`char-menu-item${i === highlighted ? " selected" : ""}`}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => onSelect(c.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, char: c });
              }}
            >
              <span>{c.name}</span>
              {c.pinnedAt && <span className="char-menu-pin">置顶</span>}
            </div>
          ))}
          <div className="char-menu-divider" />
          <div
            className={`char-menu-add${highlighted === filtered.length ? " selected" : ""}`}
            onMouseEnter={() => setHighlighted(filtered.length)}
            onClick={() => setAdding(true)}
          >
            + 添加新名字
          </div>
        </>
      )}

      {ctxMenu && (
        <div
          className="context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onMouseDown={(e) => {
            onInteractStart();
            e.stopPropagation();
          }}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              onPin(ctxMenu.char.id);
              setCtxMenu(null);
            }}
          >
            置顶
          </div>
          <div
            className="context-menu-item danger"
            onClick={() => {
              onDelete(ctxMenu.char.id);
              setCtxMenu(null);
            }}
          >
            删除
          </div>
        </div>
      )}
    </div>
  );
}
