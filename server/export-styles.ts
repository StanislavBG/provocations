/**
 * HTML template and CSS for PDF export rendering.
 * Matches the app's design system: Source Serif 4 body, Libre Baskerville headings,
 * JetBrains Mono code, warm amber accent.
 */

export function wrapInPdfHtml(title: string, htmlBody: string, options?: { pageSize?: "letter" | "a4" }): string {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    .page-content {
      padding: 0.5in 0 0 0;
    }

    /* Title block */
    .doc-title {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 24pt;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4pt;
      line-height: 1.3;
    }

    .doc-meta {
      font-size: 10pt;
      color: #666;
      margin-bottom: 24pt;
      padding-bottom: 12pt;
      border-bottom: 1px solid #e5e5e5;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Libre Baskerville', Georgia, serif;
      color: #1a1a1a;
      margin-top: 18pt;
      margin-bottom: 8pt;
      line-height: 1.3;
      page-break-after: avoid;
    }

    h1 { font-size: 20pt; }
    h2 { font-size: 16pt; border-bottom: 1px solid #e5e5e5; padding-bottom: 4pt; }
    h3 { font-size: 13pt; }
    h4 { font-size: 12pt; }
    h5, h6 { font-size: 11pt; }

    /* Paragraphs */
    p {
      margin-bottom: 10pt;
    }

    /* Links */
    a {
      color: #B35C1E;
      text-decoration: underline;
    }

    /* Bold and italic */
    strong { font-weight: 700; }
    em { font-style: italic; }

    /* Lists */
    ul, ol {
      margin-bottom: 10pt;
      padding-left: 24pt;
    }

    li {
      margin-bottom: 4pt;
    }

    li > ul, li > ol {
      margin-bottom: 0;
      margin-top: 4pt;
    }

    /* Blockquotes */
    blockquote {
      border-left: 3px solid #B35C1E;
      padding: 8pt 16pt;
      margin: 10pt 0;
      background: #fdf8f4;
      color: #333;
      font-style: italic;
    }

    blockquote p:last-child {
      margin-bottom: 0;
    }

    /* Code */
    code {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 9.5pt;
      background: #f5f5f5;
      padding: 1pt 4pt;
      border-radius: 3pt;
      color: #333;
    }

    pre {
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4pt;
      padding: 12pt;
      margin: 10pt 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 9pt;
      line-height: 1.5;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 10.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #d0d0d0;
      padding: 6pt 10pt;
      text-align: left;
    }

    th {
      background: #f5f0eb;
      font-weight: 700;
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 10pt;
    }

    tr:nth-child(even) {
      background: #fafafa;
    }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4pt;
      margin: 8pt 0;
    }

    /* Horizontal rules */
    hr {
      border: none;
      border-top: 1px solid #d0d0d0;
      margin: 16pt 0;
    }
  </style>
</head>
<body>
  <div class="page-content">
    <div class="doc-title">${escapeHtml(title)}</div>
    <div class="doc-meta">Exported ${now} &middot; Provocations</div>
    ${htmlBody}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
