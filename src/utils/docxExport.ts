import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { DocItem, DOC_TYPE_LABEL, Notebook } from "../types";

function contentToParagraphs(content: string): Paragraph[] {
  const lines = content.split("\n");
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
    return [new Paragraph({ children: [new TextRun("")] })];
  }
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 160, line: 360 },
        children: [new TextRun({ text: line, size: 24 })],
      })
  );
}

export function buildDocxDocument(doc: DocItem): Document {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 },
            children: [new TextRun({ text: doc.title, bold: true })],
          }),
          new Paragraph({
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: `类型：${DOC_TYPE_LABEL[doc.type]}`,
                italics: true,
                color: "8B8479",
                size: 20,
              }),
            ],
          }),
          ...contentToParagraphs(doc.content),
        ],
      },
    ],
  });
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled";
}

export async function exportSingleDocx(doc: DocItem) {
  const docx = buildDocxDocument(doc);
  const blob = await Packer.toBlob(docx);
  saveAs(blob, `${safeFileName(doc.title)}.docx`);
}

export async function exportManyDocx(docs: DocItem[], zipName: string) {
  if (docs.length === 1) {
    await exportSingleDocx(docs[0]);
    return;
  }
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const doc of docs) {
    const docx = buildDocxDocument(doc);
    const blob = await Packer.toBlob(docx);
    let name = `${safeFileName(doc.title)}.docx`;
    let i = 2;
    while (usedNames.has(name)) {
      name = `${safeFileName(doc.title)}_${i}.docx`;
      i++;
    }
    usedNames.add(name);
    zip.file(name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, `${safeFileName(zipName)}.zip`);
}

export async function exportNotebookDocx(notebook: Notebook, docs: DocItem[]) {
  await exportManyDocx(docs, notebook.name);
}
