function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function normalizePdfArtifacts(text = "") {
    return String(text)
        .replace(/\r\n/g, "\n")
        .replace(/â€”/g, "—")
        .replace(/â€“/g, "–")
        .replace(/â€¢/g, "•")
        .replace(/â—¦/g, "◦")
        .replace(/â–ª/g, "▪")
        .replace(/â—/g, "●")
        .replace(/âž¤/g, "➤")
        .replace(/âž¢/g, "➢")
        .replace(/\u00a0/g, " ");
}

function normalizeBulletLines(text = "") {
    return normalizePdfArtifacts(text)
        .replace(/\s+(Statement\s+[IVX0-9]+(?:\s+is\s+(?:correct|incorrect))?:)/g, "\n$1")
        .replace(/\s+(Option\s+[A-ZIVX0-9]+(?:\s+is\s+(?:correct|incorrect))?:)/g, "\n$1")
        .replace(/\n([•◦▪●➤➢-])\s*\n/g, "\n$1 ")
        .replace(/\n([ivxIVX]+\.)\s*\n/g, "\n$1 ")
        .replace(/\n([a-dA-D]\))\s*\n/g, "\n$1 ")
        .replace(/\n(\([a-dA-D]\))\s*\n/g, "\n$1 ");
}

function isStructuredLine(line = "") {
    return /^([•◦▪●➤➢-]\s+|[ivxIVX]+\.\s+|[a-dA-D]\)\s+|\([a-dA-D]\)\s+|\d+\.\s+|Ans\)|Exp\)|Source:|Subject:|Topic:|Subtopic:|Option\s+[A-ZIVX0-9]+|Statement\s+[IVX0-9]+)/.test(line);
}

function reflowWrappedLines(text = "") {
    const rawLines = normalizeBulletLines(text).split("\n");
    const logicalLines = [];
    let currentLine = "";

    rawLines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            if (currentLine) {
                logicalLines.push(currentLine.trim());
                currentLine = "";
            }
            return;
        }

        if (!currentLine) {
            currentLine = line;
            return;
        }

        if (isStructuredLine(line)) {
            logicalLines.push(currentLine.trim());
            currentLine = line;
            return;
        }

        currentLine = `${currentLine} ${line}`.replace(/\s+/g, " ").trim();
    });

    if (currentLine) {
        logicalLines.push(currentLine.trim());
    }

    return logicalLines;
}

export function highlightText(text, terms = []) {
    if (!terms || !terms.length || !text) return escapeHtml(text);
    
    // Escape regex special characters in terms
    const escapedTerms = terms
        .filter(t => t.length > 2) // Only highlight terms longer than 2 chars to avoid noise
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
    if (!escapedTerms.length) return escapeHtml(text);
    
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
}

export function renderMultilineQuestion(lines, highlights = []) {
    return (lines || [])
        .map((line) => `<div class="question-line">${highlightText(line, highlights)}</div>`)
        .join("");
}

function renderQuestionTable(table, highlights = []) {
    if (!table || !Array.isArray(table.rows) || !table.rows.length) return "";
    const headers = Array.isArray(table.headers) ? table.headers : [];
    const headerHtml = headers.length
        ? `<thead><tr>${headers.map((header) => `<th>${highlightText(header, highlights)}</th>`).join("")}</tr></thead>`
        : "";
    const bodyHtml = table.rows.map((row) => {
        const cells = Array.isArray(row)
            ? row
            : row && typeof row === "object"
                ? (() => {
                    const orderedKeys = Object.keys(row)
                        .filter((key) => /^c\d+$/.test(key))
                        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
                    return orderedKeys.length ? orderedKeys.map((key) => row[key]) : Object.values(row);
                })()
                : [];
        return `<tr>${cells.map((cell) => `<td>${highlightText(cell, highlights)}</td>`).join("")}</tr>`;
    }).join("");
    const captionHtml = table.caption ? `<caption>${highlightText(table.caption, highlights)}</caption>` : "";
    return `
        <div class="question-table-wrap">
            <table class="question-table">
                ${captionHtml}
                ${headerHtml}
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
    `;
}

function renderQuestionBlock(block, highlights = []) {
    if (!block || typeof block !== "object") return "";
    if (block.type === "table") return renderQuestionTable(block, highlights);
    if (block.type === "text") {
        if (Array.isArray(block.lines)) return renderMultilineQuestion(block.lines, highlights);
        if (typeof block.text === "string") return renderMultilineQuestion(block.text.split("\n"), highlights);
        return "";
    }
    return "";
}

function normalizedMeta(text = "") {
    return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanedQuestionLines(question = {}) {
    const rawLines = Array.isArray(question.statementLines)
        ? question.statementLines
        : [question.questionText].filter(Boolean);
    if (rawLines.length <= 1) return rawLines;

    const firstLine = String(rawLines[0] || "").trim();
    const firstNormalized = normalizedMeta(firstLine);
    const metadataHints = [
        question.source?.sourceText,
        question.__studyTestTitle,
        question.__tagTestTitle,
        question.__revisionTestTitle,
        question.__folderTestTitle,
        question.__inspectionTestTitle,
        question.provider,
        question.__studyProvider,
        question.__tagProvider
    ]
        .filter(Boolean)
        .map((item) => normalizedMeta(item))
        .filter(Boolean);

    const looksLikeMetadata = metadataHints.some((hint) => hint && firstNormalized.includes(hint))
        || (/pyq|onlyias|vision|forum|vajiram|test\s+\d+/i.test(firstLine) && !/[?]$/.test(firstLine));

    return looksLikeMetadata ? rawLines.slice(1) : rawLines;
}

export function renderQuestionContent(questionOrLines) {
    const highlights = questionOrLines?.__terms ? Object.keys(questionOrLines.__terms) : [];
    
    if (Array.isArray(questionOrLines)) {
        return renderMultilineQuestion(questionOrLines, highlights);
    }

    if (!questionOrLines || typeof questionOrLines !== "object") {
        return "";
    }

    if (Array.isArray(questionOrLines.questionBlocks) && questionOrLines.questionBlocks.length) {
        return questionOrLines.questionBlocks.map((block) => renderQuestionBlock(block, highlights)).join("");
    }

    if (questionOrLines.questionTable && Array.isArray(questionOrLines.questionTable.rows)) {
        const introLines = cleanedQuestionLines(questionOrLines);
        const prefixLines = introLines.slice(0, Math.max(0, introLines.length - 1));
        const suffixLine = introLines.length ? introLines[introLines.length - 1] : "";
        return [
            prefixLines.length ? renderMultilineQuestion(prefixLines, highlights) : "",
            renderQuestionTable(questionOrLines.questionTable, highlights),
            suffixLine ? renderMultilineQuestion([suffixLine], highlights) : ""
        ].join("");
    }

    return renderMultilineQuestion(cleanedQuestionLines(questionOrLines), highlights);
}

export function renderAnswerConflictWarning(question) {
    // 1. Check for multi-source conflicts (from canonical merging)
    if (question && question.__hasAnswerConflict && question.__conflictAnswers) {
        const lines = question.__conflictAnswers.map(ca => `<li><strong>${ca.provider}:</strong> ${ca.ans}</li>`).join("");
        return `
            <div class="answer-conflict-warning" style="background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 0.85rem; color: #9b2c2c;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <strong style="color: #c53030;">⚠️ Multi-Source Conflict</strong>
                </div>
                <p style="margin: 0; font-size: 0.8rem; opacity: 0.9;">Providers suggest different correct answers:</p>
                <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.8rem;">${lines}</ul>
            </div>
        `;
    }

    // 2. Existing logic for Coaching vs Official
    if (!question || !question.officialAnswer || question.correctAnswer === question.officialAnswer) {
        return "";
    }
    
    return `
        <div class="answer-conflict-warning" style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 0.85rem;
            color: #856404;
        ">
            <strong style="color: #dc3545;">Answer Conflict Detected:</strong> 
            Coaching answer (${question.correctAnswer}) differs from official answer (${question.officialAnswer}).
            Official answer is used for scoring.
        </div>
    `;
}

export function renderExplanationSourceSwitcher(question) {
    const multiMerged = Array.isArray(question.mergedExplanations) && question.mergedExplanations.length > 1;
    const fromMerged =
        multiMerged && (!question.availableSources || question.availableSources.length <= 1)
            ? [...new Set(question.mergedExplanations.map((e) => e.provider).filter(Boolean))]
            : [];
    const sourceList =
        question.availableSources && question.availableSources.length > 1 ? question.availableSources : fromMerged;
    if (!sourceList || sourceList.length <= 1) {
        return "";
    }
    const activeSource = question.activeExplanationSource || question.selectedSource || sourceList[0];

    // Mapping: For Official PYQs, show the Exam Group (e.g., UPSC CSE) instead of internal source titles
    const displaySourceName = (source) => {
        if (question.isPyq && question.pyqMeta?.group) {
            return question.pyqMeta.group;
        }
        return source;
    };

    return `
        <div class="explanation-source-hub" style="
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
            background: var(--surface-strong);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">🏛️</span>
                    <span style="font-weight: 700; color: var(--text); font-size: 0.95rem;">Select Discussion Source</span>
                </div>
                <span style="background: var(--accent); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                    ${sourceList.length} Experts
                </span>
            </div>
            
            <div class="source-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">
                ${sourceList.map((source) => `
                    <div 
                        class="source-card ${source === activeSource ? 'active' : ''}"
                        data-question-id="${escapeHtml(String(question.id))}"
                        data-source="${escapeHtml(String(source))}"
                        style="
                            padding: 12px;
                            border: 2px solid ${source === activeSource ? 'var(--accent)' : 'var(--line)'};
                            border-radius: 10px;
                            background: ${source === activeSource ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--surface)'};
                            cursor: pointer;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            display: flex;
                            flex-direction: column;
                            gap: 4px;
                            position: relative;
                            overflow: hidden;
                        "
                    >
                        ${source === activeSource ? `<div style="position: absolute; top: -5px; right: -5px; background: var(--accent); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✓</div>` : ""}
                        <span style="font-size: 0.85rem; font-weight: 700; color: ${source === activeSource ? 'var(--accent)' : 'var(--text)'};">${displaySourceName(source)}</span>
                        <span style="font-size: 0.7rem; font-weight: 500; color: var(--muted);">${source === activeSource ? 'Currently Viewing' : 'Switch Source'}</span>
                    </div>
                `).join('')}
            </div>
            <style>
                .source-card:hover { 
                    transform: translateY(-2px); 
                    border-color: var(--accent); 
                    background: rgba(var(--accent-rgb), 0.05);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .source-card.active { 
                    border-color: var(--accent); 
                    animation: subtlePulse 2s infinite ease-in-out;
                }
                @keyframes subtlePulse {
                    0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.2); }
                    70% { box-shadow: 0 0 0 10px rgba(var(--accent-rgb), 0); }
                    100% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0); }
                }
            </style>
        </div>
    `;
}

export function renderAlsoAppearsIn(question, canonicalDatabase) {
    const inlineProviders = Array.isArray(question.appearsInProviders)
        ? question.appearsInProviders.filter((provider) => provider && provider !== question.selectedSource && provider !== "PYQ")
        : [];
    if (inlineProviders.length) {
        return `
            <div class="also-appears-in" style="
                background: var(--accent-light);
                border-left: 4px solid var(--accent);
                padding: 8px 12px;
                margin-top: 12px;
                font-size: 0.85rem;
                color: var(--text);
            ">
                <strong>Also appears in:</strong> ${inlineProviders.join(", ")}
            </div>
        `;
    }
    if (!question.canonicalId || !canonicalDatabase) {
        return "";
    }
    
    const canonicalQuestion = canonicalDatabase.find(cq => cq.canonicalId === question.canonicalId);
    if (!canonicalQuestion || canonicalQuestion.sources.length <= 1) {
        return "";
    }
    
    const otherSources = canonicalQuestion.sources
        .filter(source => source.sourceName !== question.selectedSource && source.sourceName !== "Official")
        .map(source => source.sourceName);
    
    if (otherSources.length === 0) {
        return "";
    }
    
    return `
        <div class="also-appears-in" style="
            background: var(--accent-light);
            border-left: 4px solid var(--accent);
            padding: 8px 12px;
            margin-top: 12px;
            font-size: 0.85rem;
            color: var(--text);
        ">
            <strong>Also appears in:</strong> ${otherSources.join(", ")}
        </div>
    `;
}

export function renderSimpleMarkdown(markdown) {
    if (!markdown) return "";
    const lines = reflowWrappedLines(markdown);
    const html = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            html.push("</ul>");
            inList = false;
        }
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            closeList();
            return;
        }

        const escaped = escapeHtml(line).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        if (/^(•|◦|▪|●|➤|➢|-)\s+/.test(line)) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
            }
            html.push(`<li>${escaped.replace(/^(•|◦|▪|●|➤|➢|-)\s+/, "")}</li>`);
            return;
        }

        closeList();
        html.push(`<p>${escaped}</p>`);
    });

    closeList();
    return html.join("");
}

export function formatDuration(startedAt, submittedAt) {
    if (!startedAt || !submittedAt) return "Not available";
    const start = new Date(startedAt).getTime();
    const end = new Date(submittedAt).getTime();
    const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}
