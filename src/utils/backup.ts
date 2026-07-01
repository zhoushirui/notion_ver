import { saveAs } from "file-saver";
import { Workspace } from "../types";

const BACKUP_VERSION = 1;

interface BackupFile {
  app: "novel-workspace";
  version: number;
  exportedAt: string;
  workspace: Workspace;
}

export function exportBackup(workspace: Workspace) {
  const payload: BackupFile = {
    app: "novel-workspace",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `写作工作台备份_${stamp}.json`);
}

export async function importBackupFile(file: File): Promise<Workspace> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const workspace: Workspace | undefined = parsed?.workspace ?? parsed;
  if (!workspace || !Array.isArray(workspace.notebooks) || !Array.isArray(workspace.documents)) {
    throw new Error("备份文件格式不正确");
  }
  return workspace;
}
