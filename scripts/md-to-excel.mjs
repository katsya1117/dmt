#!/usr/bin/env node
// docs/ 配下の各 .md を、同名の .xlsx として同じフォルダに書き出す。
// 見出し構造はセルに展開、表は Excel の表として再現。
// Mermaid 図は省略し、注記のみ残す（他のコードブロックはそのまま等幅テキストで保持）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');

/** @typedef {{type:'heading', level:number, text:string}} HeadingBlock */
/** @typedef {{type:'paragraph', text:string}} ParagraphBlock */
/** @typedef {{type:'list', items:{level:number, text:string, ordered:boolean}[]}} ListBlock */
/** @typedef {{type:'table', headers:string[], rows:string[][]}} TableBlock */
/** @typedef {{type:'code', lang:string, text:string}} CodeBlock */
/** @typedef {{type:'hr'}} HrBlock */
/** @typedef {HeadingBlock|ParagraphBlock|ListBlock|TableBlock|CodeBlock|HrBlock} Block */

function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
    .trim();
}

function parseMarkdown(src) {
  const lines = src.split('\n');
  /** @type {Block[]} */
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // 水平線
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // コードブロック（mermaid含む）
    const fenceMatch = line.match(/^```\s*(\S*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 閉じ```をスキップ
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    // 見出し
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: stripInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    // 表（| ... | の行が続き、2行目が区切り行 |---|---|）
    if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const headerCells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => stripInlineMarkdown(c));
      i += 2; // ヘッダ行 + 区切り行
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => stripInlineMarkdown(c));
        rows.push(cells);
        i++;
      }
      blocks.push({ type: 'table', headers: headerCells, rows });
      continue;
    }

    // リスト（箇条書き・番号付き、ネストはインデント幅で判定）
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        const indent = m[1].length;
        const ordered = /\d+\./.test(m[2]);
        items.push({ level: Math.floor(indent / 2), text: stripInlineMarkdown(m[3]), ordered });
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // 段落（空行・次の特殊行まで連結）
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i + 1] && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i + 1] || '')) &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
      !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: stripInlineMarkdown(paraLines.join('\n')) });
    }
  }

  return blocks;
}

function maxTableColumns(blocks) {
  let max = 1;
  for (const b of blocks) {
    if (b.type === 'table') {
      max = Math.max(max, b.headers.length);
    }
  }
  return max;
}

const HEADING_STYLE = {
  1: { size: 16, fill: 'FFD9E2F3' },
  2: { size: 14, fill: 'FFE8EEF9' },
  3: { size: 12, fill: null },
  4: { size: 11, fill: null },
  5: { size: 11, fill: null },
  6: { size: 11, fill: null },
};

function buildWorksheet(workbook, sheetName, blocks) {
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Sheet1');
  const cols = maxTableColumns(blocks);

  sheet.columns = Array.from({ length: cols }, (_, idx) => ({
    width: cols === 1 ? 120 : idx === 0 ? 40 : 30,
  }));

  const addMergedRow = (text, { bold = false, italic = false, size = 11, fill = null, fontName = null, indent = 0 } = {}) => {
    const row = sheet.addRow([text]);
    if (cols > 1) sheet.mergeCells(row.number, 1, row.number, cols);
    const cell = row.getCell(1);
    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent };
    cell.font = { bold, italic, size, name: fontName || undefined };
    if (fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    }
    return row;
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      const style = HEADING_STYLE[block.level] || HEADING_STYLE[6];
      addMergedRow(block.text, { bold: true, size: style.size, fill: style.fill });
      continue;
    }

    if (block.type === 'paragraph') {
      addMergedRow(block.text, { size: 11 });
      continue;
    }

    if (block.type === 'list') {
      for (const item of block.items) {
        const bullet = item.ordered ? '' : '・';
        addMergedRow(`${bullet}${item.text}`, { size: 11, indent: item.level + 1 });
      }
      continue;
    }

    if (block.type === 'code') {
      if (block.lang === 'mermaid') {
        addMergedRow('［Mermaid図は省略｜元のMarkdownファイルを参照］', { italic: true, size: 10 });
      } else {
        addMergedRow(block.text, { size: 10, fontName: 'Courier New' });
      }
      continue;
    }

    if (block.type === 'table') {
      const headerRow = sheet.addRow(block.headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
        cell.alignment = { wrapText: true, vertical: 'top' };
        cell.border = { bottom: { style: 'thin' } };
      });
      for (const r of block.rows) {
        const row = sheet.addRow(r);
        row.eachCell((cell) => {
          cell.alignment = { wrapText: true, vertical: 'top' };
        });
      }
      continue;
    }

    if (block.type === 'hr') {
      sheet.addRow([]);
      continue;
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 0 }];
}

async function convertFile(mdPath) {
  const src = fs.readFileSync(mdPath, 'utf-8');
  const blocks = parseMarkdown(src);
  const workbook = new ExcelJS.Workbook();
  const baseName = path.basename(mdPath, '.md');
  buildWorksheet(workbook, baseName, blocks);
  const outPath = path.join(path.dirname(mdPath), `${baseName}.xlsx`);
  await workbook.xlsx.writeFile(outPath);
  return outPath;
}

function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const targetArg = process.argv[2];
  const files = targetArg
    ? [path.resolve(process.cwd(), targetArg)]
    : findMarkdownFiles(DOCS_DIR);

  for (const file of files) {
    const outPath = await convertFile(file);
    console.log(`✓ ${path.relative(DOCS_DIR, file)} → ${path.relative(DOCS_DIR, outPath)}`);
  }
  console.log(`\n${files.length} 件変換しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
