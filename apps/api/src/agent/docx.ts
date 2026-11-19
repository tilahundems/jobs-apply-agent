/** Converts the tailored CV markdown into a Word document recruiters can open. */
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"

function clean(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[*_`]/g, "")
    .trim()
}

export async function markdownToDocx(markdown: string): Promise<Buffer> {
  const children: Paragraph[] = []

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 120 } }))
      continue
    }

    if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: clean(trimmed.slice(4)), bold: true }),
          ],
          spacing: { before: 160, after: 80 },
        })
      )
      continue
    }

    if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: clean(trimmed.slice(3)),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
        })
      )
      continue
    }

    if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          text: clean(trimmed.slice(2)),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 80 },
        })
      )
      continue
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          text: clean(trimmed.replace(/^[-*•]\s+/, "")),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      )
      continue
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: clean(trimmed) })],
        spacing: { after: 80 },
      })
    )
  }

  const document = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  })

  return Packer.toBuffer(document)
}
