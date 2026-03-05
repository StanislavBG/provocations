/**
 * PDF export via Playwright.
 * Renders styled HTML from markdown content and prints to PDF.
 */
import { wrapInPdfHtml } from "./export-styles";

/** Convert markdown to HTML server-side using a simple regex-based converter.
 *  We avoid pulling in heavy markdown libraries — the content is already
 *  well-structured markdown from the editor. */
function markdownToHtml(md: string): string {
  let html = md;

  // Escape HTML entities first (but preserve existing HTML-like content)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```) — must be before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Images: ![alt](src)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr />");

  // Bold and italic (order matters: bold-italic first)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes (consecutive lines)
  html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, "");

  // Tables: detect header row + separator + data rows
  html = html.replace(
    /^(\|.+\|)\s*\n\|[\s:|-]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm,
    (_match, headerLine: string, bodyBlock: string) => {
      const headers = headerLine.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
      const rows = bodyBlock.trim().split("\n").map((row: string) => {
        const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
        return `<tr>${cells}</tr>`;
      }).join("\n");
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  // Unordered lists (- or * at start of line)
  // Process blocks of consecutive list items
  html = html.replace(/((?:^[\t ]*[-*]\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map(line => {
      const content = line.replace(/^[\t ]*[-*]\s+/, "");
      return `<li>${content}</li>`;
    }).join("\n");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists (1. 2. etc)
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map(line => {
      const content = line.replace(/^\d+\.\s+/, "");
      return `<li>${content}</li>`;
    }).join("\n");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: wrap remaining text blocks (lines not already in block elements)
  const lines = html.split("\n");
  const result: string[] = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isBlockElement = /^<(h[1-6]|pre|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|hr|img|div)/.test(trimmed) ||
                           /^<\/(h[1-6]|pre|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|div)>/.test(trimmed);

    if (!trimmed) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      continue;
    }

    if (isBlockElement) {
      if (inParagraph) {
        result.push("</p>");
        inParagraph = false;
      }
      result.push(line);
    } else {
      if (!inParagraph) {
        result.push("<p>");
        inParagraph = true;
      }
      result.push(line);
    }
  }
  if (inParagraph) {
    result.push("</p>");
  }

  return result.join("\n");
}

export interface PdfExportOptions {
  title: string;
  content: string;
  pageSize?: "letter" | "a4";
}

export async function renderPdf(options: PdfExportOptions): Promise<Buffer> {
  const { title, content, pageSize = "letter" } = options;

  const htmlBody = markdownToHtml(content);
  const fullHtml = wrapInPdfHtml(title, htmlBody, { pageSize });

  // Dynamic import to avoid loading Playwright at startup
  const { chromium } = await import("playwright-core");

  const browserPath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome";

  const browser = await chromium.launch({
    executablePath: browserPath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle" });

    // Wait for fonts to load
    await page.waitForTimeout(1000);

    const pdfBuffer = await page.pdf({
      format: pageSize === "a4" ? "A4" : "Letter",
      margin: { top: "0.75in", bottom: "0.75in", left: "1in", right: "1in" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width: 100%; font-size: 8pt; color: #999; padding: 0 1in; display: flex; justify-content: space-between;">
          <span>${title.replace(/"/g, "&quot;")}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
