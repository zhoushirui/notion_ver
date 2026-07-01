import React from "react";

export function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function PromptModal({
  title,
  label,
  placeholder,
  initialValue = "",
  confirmText = "确定",
  onConfirm,
  onClose,
  extra,
}: {
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{title}</h3>
      {label && <p className="modal-hint">{label}</p>}
      <input
        ref={inputRef}
        className="modal-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onClose();
        }}
      />
      {extra}
      <div className="modal-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" onClick={submit}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmModal({
  title,
  description,
  confirmText = "删除",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="modal-title">{title}</h3>
      {description && <p className="modal-hint">{description}</p>}
      <div className="modal-actions">
        <button className="btn btn-quiet" onClick={onClose}>
          取消
        </button>
        <button
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
