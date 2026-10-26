import React from 'react';

/**
 * A lightweight, zero-dependency Markdown renderer for Flux AI responses.
 * Renders headings, bold, italic, code blocks, bullet/numbered lists, tables, and blockquotes.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Split into blocks by double newlines or table/code fences
  const lines = content.split('\n');
  const elements = [];
  let index = 0;

  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeLanguage = '';

  let inTable = false;
  let tableHeader = [];
  let tableRows = [];

  let listType = null; // 'ul' or 'ol'
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`ul-${index++}`} className="my-2 space-y-1 list-disc list-inside text-slate-200">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{renderInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${index++}`} className="my-2 space-y-1 list-decimal list-inside text-slate-200">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{renderInline(item)}</li>
            ))}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (inTable && (tableHeader.length > 0 || tableRows.length > 0)) {
      elements.push(
        <div key={`table-${index++}`} className="my-3 overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/50">
          <table className="w-full text-left text-xs border-collapse">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-800/80 border-b border-slate-700/70 text-slate-300 font-semibold">
                <tr>
                  {tableHeader.map((th, i) => (
                    <th key={i} className="px-3 py-2">{renderInline(th.trim())}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                  {row.map((td, cIdx) => (
                    <td key={cIdx} className="px-3 py-2">{renderInline(td.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  const flushCode = () => {
    if (inCodeBlock) {
      elements.push(
        <pre key={`code-${index++}`} className="my-3 p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto">
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      );
      inCodeBlock = false;
      codeBlockLines = [];
      codeLanguage = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block fences
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if it's separator row (e.g. |---|---|)
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h4-${index++}`} className="text-sm font-bold text-slate-100 mt-3 mb-1 tracking-tight">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index++}`} className="text-base font-bold text-white mt-4 mb-1.5 tracking-tight border-b border-slate-800 pb-1">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index++}`} className="text-lg font-extrabold text-white mt-4 mb-2 tracking-tight">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`bq-${index++}`} className="border-l-2 border-indigo-500/70 pl-3 my-2 text-slate-400 italic text-xs leading-relaxed">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered lists (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered lists (1. or 2.)
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(olMatch[1]);
      continue;
    }

    // Regular empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${index++}`} className="my-1.5 text-slate-200 leading-relaxed text-sm">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();
  flushCode();

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Format inline markdown: bold (**text**), italic (*text*), inline code (`code`), citations ([Source N])
 */
function renderInline(text) {
  if (!text) return null;

  // Split tokens by bold, code, italic, citations
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[Source\s+\d+[^\]]*\])/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-xs border border-slate-750">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('[Source') && part.endsWith(']')) {
      return (
        <span key={i} className="inline-flex items-center px-1.5 py-0.2 mx-1 text-[11px] font-medium rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {part}
        </span>
      );
    }
    return part;
  });
}
