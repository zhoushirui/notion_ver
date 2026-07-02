export function countText(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function formatWordCount(count: number): string {
  return `${count} 字`;
}
