export type PdfPaperStyle = 'plain' | 'lined' | 'grid' | 'dots';
export type PdfTheme = 'modern' | 'sepia' | 'historical';
export type PdfSpacing = 'compact' | 'comfortable';
export type PdfFontFamily = 'sans' | 'handwriting';

export interface PdfChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface PdfExportEntry {
  id: string;
  type: 'microTopicHeading' | 'highlight';
  text: string;
  color?: string;
  sourceLabel?: string;
}

export interface NotesPdfEngineConfig {
  fontSize: number;
  subheadingColor: string;
  paperStyle: PdfPaperStyle;
  theme: PdfTheme;
  watermark: string;
  footerText: string;
  showTOC: boolean;
  includeChecklist: boolean;
  spacing: PdfSpacing;
  fontFamily: PdfFontFamily;
  pageBreakBetweenHeadings?: boolean;
}

export interface NotesPdfEngineInput {
  title: string;
  subject?: string;
  content?: string;
  entries: PdfExportEntry[];
  checklist?: PdfChecklistItem[];
  selectedHeadingIds?: Set<string> | string[];
  columns: 1 | 2;
  config: NotesPdfEngineConfig;
}

const parseMD = (txt: string) => {
  if (!txt) return '';
  return txt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/^\s*[\-\*]\s+(.*)/gm, 'ΓÇó $1')
    .replace(/\n/g, '<br/>');
};

export function buildNotesPdfHtml(input: NotesPdfEngineInput) {
  const {
    title,
    subject,
    content,
    entries,
    checklist = [],
    selectedHeadingIds,
    columns,
    config,
  } = input;

  const selected = Array.isArray(selectedHeadingIds)
    ? new Set(selectedHeadingIds)
    : selectedHeadingIds ?? new Set(entries.filter((i) => i.type === 'microTopicHeading').map((i) => i.id));

  const filteredEntries = (() => {
    let currentHeadingId = '';
    let isExporting = true;

    return entries.filter((item) => {
      if (item.type === 'microTopicHeading') {
        currentHeadingId = item.id;
        isExporting = selected.has(item.id);
        return isExporting;
      }
      if (!currentHeadingId) return true;
      return isExporting;
    });
  })();

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { margin: 10mm 5mm; }
          body {
            font-family: ${config.fontFamily === 'handwriting' ? "'Caveat', cursive" : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'};
            padding: 0;
            margin: 0;
            color: ${config.theme === 'sepia' ? '#433422' : config.theme === 'historical' ? '#2d2419' : '#374151'};
            font-size: ${config.fontSize}px;
            line-height: 1.5;
            background-color: ${config.theme === 'sepia' ? '#F4ECD8' : config.theme === 'historical' ? '#fdf6e3' : '#ffffff'};
            background-image: ${
              config.paperStyle === 'lined' ? 'linear-gradient(#e5e7eb 1px, transparent 1px)' :
              config.paperStyle === 'grid' ? 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)' :
              config.paperStyle === 'dots' ? 'radial-gradient(#e5e7eb 1px, transparent 1px)' : 'none'
            };
            background-size: ${
              config.paperStyle === 'lined' ? '100% 24px' :
              config.paperStyle === 'grid' ? '24px 24px' :
              config.paperStyle === 'dots' ? '24px 24px' : 'auto'
            };
          }
          .subject-badge {
            color: #6366f1;
            font-weight: 800;
            font-size: 0.8em;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          h1 {
            font-size: 2.2em;
            font-weight: 900;
            margin: 0 0 20px 0;
            color: #111827;
            letter-spacing: -1px;
          }
          .section-label {
            font-size: 0.7em;
            font-weight: 800;
            color: #9ca3af;
            letter-spacing: 2px;
            text-transform: uppercase;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 8px;
            margin: 30px 0 20px 0;
          }
          .main-content {
            margin-bottom: ${config.spacing === 'compact' ? '15px' : '30px'};
            color: inherit;
          }
          .highlights-grid {
            display: ${columns === 2 ? 'grid' : 'block'};
            ${columns === 2 ? 'grid-template-columns: 1fr 1fr; grid-gap: 20px;' : ''}
            width: 100%;
          }
          .highlight-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: ${config.spacing === 'compact' ? '8px' : '15px'};
            padding: ${config.spacing === 'compact' ? '8px 12px' : '12px 16px'};
            background: ${config.theme === 'modern' ? '#fff' : 'rgba(255,255,255,0.4)'};
            border: 1px solid ${config.theme === 'modern' ? '#f3f4f6' : 'rgba(0,0,0,0.05)'};
            border-left: 4px solid #6366f1;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          .highlight-text {
            margin-bottom: 8px;
            color: #1f2937;
            display: flex;
            gap: 10px;
          }
          .bullet {
            font-size: 0.8em;
            line-height: 1.8;
          }
          .highlight-source {
            font-size: 0.65em;
            font-weight: 700;
            color: #6366f1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .group-heading {
            break-after: avoid;
            ${columns === 2 ? 'grid-column: 1 / -1;' : ''}
            font-weight: 900;
            font-size: 1.1em;
            color: inherit;
            margin: ${config.spacing === 'compact' ? '15px 0 8px 0' : '30px 0 15px 0'};
            padding: 8px 16px;
            background: ${config.subheadingColor};
            border-radius: 12px;
            display: block;
            text-transform: uppercase;
          }
          .group-heading.page-break { page-break-before: always; }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            font-weight: 900;
            color: rgba(0,0,0,0.03);
            white-space: nowrap;
            pointer-events: none;
            z-index: -1;
          }
          .footer {
            position: fixed;
            bottom: -10mm;
            left: 0;
            right: 0;
            font-size: 10px;
            color: #9ca3af;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .toc-container {
            margin-bottom: 40px;
            padding: 20px;
            background: rgba(0,0,0,0.02);
            border-radius: 12px;
          }
          .toc-title { font-weight: 900; font-size: 14px; margin-bottom: 12px; color: inherit; }
          .toc-item { display: block; font-size: 12px; color: inherit; text-decoration: none; margin-bottom: 6px; border-bottom: 1px dashed rgba(0,0,0,0.1); }
          .checklist-pdf { margin-top: 40px; }
          .checklist-item-pdf { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
          .checkbox-pdf { width: 14px; height: 14px; border: 1px solid #9ca3af; border-radius: 3px; }
          .checkbox-pdf.checked { background: #6366f1; border-color: #6366f1; }
          * { -webkit-print-color-adjust: exact; box-sizing: border-box; }
        </style>
      </head>
      <body>
        ${config.watermark ? `<div class="watermark">${config.watermark}</div>` : ''}
        <div class="footer">${config.footerText} ΓÇó ${new Date().toLocaleDateString()}</div>

        <div class="subject-badge">${subject || 'General'}</div>
        <h1>${title || 'Untitled Note'}</h1>

        ${config.showTOC ? `
          <div class="toc-container">
            <div class="toc-title">Table of Contents</div>
            ${filteredEntries
              .filter((i) => i.type === 'microTopicHeading')
              .map((i) => `<div class="toc-item">${parseMD(i.text)}</div>`)
              .join('')}
          </div>
        ` : ''}

        ${content ? `<div class="main-content">${parseMD(content)}</div>` : ''}

        <div class="section-label">Practice Highlights</div>

        <div class="highlights-grid">
          ${(() => {
            let headingIndex = -1;

            return filteredEntries.map((item) => {
              if (item.type === 'microTopicHeading') {
                headingIndex += 1;
                const pageBreakClass = config.pageBreakBetweenHeadings && headingIndex > 0 ? 'page-break' : '';
                return `<div class="group-heading ${pageBreakClass}">${parseMD(item.text)}</div>`;
              }

              const cardColor = item.color || '#6366f1';
              return `
                <div class="highlight-card" style="border-left-color: ${cardColor}">
                  <div class="highlight-text">
                    <span class="bullet" style="color: ${cardColor}">ΓùÅ</span>
                    <div>${parseMD(item.text)}</div>
                  </div>
                  ${item.sourceLabel ? `<div class="highlight-source">${parseMD(item.sourceLabel)}</div>` : ''}
                </div>
              `;
            }).join('');
          })()}
        </div>

        ${config.includeChecklist && checklist.length > 0 ? `
          <div class="checklist-pdf">
            <div class="section-label">Checklist / Tasks</div>
            ${checklist.map(c => `
              <div class="checklist-item-pdf">
                <div class="checkbox-pdf ${c.checked ? 'checked' : ''}"></div>
                <div style="${c.checked ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${parseMD(c.text)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </body>
    </html>
  `;
}
