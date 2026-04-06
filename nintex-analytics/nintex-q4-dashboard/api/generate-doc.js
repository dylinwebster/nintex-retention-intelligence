// api/generate-doc.js
// Vercel serverless function: generates a branded Nintex Word document
// from a chat conversation or single response.
// Requires: docx package (add to package.json dependencies)

const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType,
} = require('docx');

// ─── Brand tokens (Nintex style guide) ───────────────────────────────────────
const NAVY    = '060D3F';
const ORANGE  = 'F26522';
const PINK    = 'F02D8A';
const PURPLE  = '7B3A9E';
const GREY    = '888888';
const DARK    = '222222';
const FAINT   = 'F5F5F5';

// docx size is in half-points: 22 = 11pt, 24 = 12pt, 32 = 16pt, 40 = 20pt
const PT = n => n * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSpacer(ptAfter = 120) {
  return new Paragraph({ spacing: { after: ptAfter } });
}

function makeOrangeDivider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ORANGE } },
    spacing: { before: 40, after: 240 },
  });
}

function makeH1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: PT(20), color: NAVY, font: 'Aptos' })],
    spacing: { before: 360, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE } },
  });
}

function makeH2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: PT(14), color: NAVY, font: 'Aptos' })],
    spacing: { before: 280, after: 80 },
  });
}

function makeH3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: PT(12), color: PURPLE, font: 'Aptos' })],
    spacing: { before: 200, after: 60 },
  });
}

function makeBody(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      size: PT(11),
      color: opts.color || DARK,
      bold: opts.bold || false,
      italics: opts.italic || false,
      font: 'Aptos',
    })],
    spacing: { after: opts.spaceAfter || 80 },
    indent: opts.indent ? { left: 360 } : {},
  });
}

function makeCaption(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: PT(9), color: GREY, italics: true, font: 'Aptos' })],
    spacing: { after: 60 },
  });
}

function makeFooter() {
  return new Paragraph({
    children: [
      new TextRun({ text: 'Nintex Customer Success  |  Q4 FY26 Renewal Intelligence  |  Confidential', size: PT(9), color: GREY, italics: true, font: 'Aptos' }),
    ],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' } },
    spacing: { before: 480, after: 80 },
    alignment: AlignmentType.CENTER,
  });
}

// Parse a single chat message text into document paragraphs.
// Handles: markdown bold (**text**), headings (## text), bullets (- text / • text).
function parseMessageToParagraphs(text, isUser) {
  const paras = [];
  const lines = text.split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      paras.push(makeSpacer(60));
      continue;
    }

    // Heading lines
    if (line.startsWith('### ')) {
      paras.push(makeH3(line.slice(4).replace(/\*\*/g, '')));
      continue;
    }
    if (line.startsWith('## ')) {
      paras.push(makeH2(line.slice(3).replace(/\*\*/g, '')));
      continue;
    }
    if (line.startsWith('# ')) {
      paras.push(makeH1(line.slice(2).replace(/\*\*/g, '')));
      continue;
    }

    // Bullet lines
    const bulletMatch = line.match(/^(\s*)([-•*]|\d+[.)]) (.+)/);
    if (bulletMatch) {
      const content = bulletMatch[3];
      const runs = parseInlineMarkdown(content, isUser);
      paras.push(new Paragraph({
        children: runs,
        spacing: { after: 60 },
        indent: { left: 360, hanging: 200 },
      }));
      continue;
    }

    // Normal paragraph with possible inline bold
    const runs = parseInlineMarkdown(line, isUser);
    paras.push(new Paragraph({
      children: runs,
      spacing: { after: 80 },
      indent: isUser ? {} : { left: 0 },
    }));
  }

  return paras;
}

// Split a line on **bold** markers and return TextRun array.
function parseInlineMarkdown(text, isUser) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: PT(11), color: DARK, font: 'Aptos' }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: PT(11), color: DARK, font: 'Aptos' }));
    }
  }
  return runs.length ? runs : [new TextRun({ text, size: PT(11), color: DARK, font: 'Aptos' })];
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, title, context } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const children = [];
    const exportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // ── Cover block ──────────────────────────────────────────────────────────
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'nintex', bold: true, size: PT(18), color: ORANGE, font: 'Aptos' }),
          new TextRun({ text: '  |  Q4 FY26 Renewal Intelligence', size: PT(14), color: NAVY, font: 'Aptos' }),
        ],
        spacing: { after: 80 },
      }),
      makeOrangeDivider(),
      new Paragraph({
        children: [new TextRun({
          text: title || 'Chat Export',
          bold: true, size: PT(20), color: NAVY, font: 'Aptos',
        })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: `Exported: ${exportDate}`,
          size: PT(10), color: GREY, italics: true, font: 'Aptos',
        })],
        spacing: { after: context ? 80 : 200 },
      }),
    );

    if (context) {
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: `Context: ${context}`,
            size: PT(10), color: PURPLE, italics: true, font: 'Aptos',
          })],
          spacing: { after: 200 },
        }),
      );
    }

    // ── Conversation ─────────────────────────────────────────────────────────
    children.push(makeH1('Conversation'));

    for (const msg of messages) {
      const isUser = msg.role === 'user';
      const text   = msg.content || msg.text || '';

      // Role label
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: isUser ? 'You' : 'Nintex AI Assistant',
            bold: true, size: PT(11),
            color: isUser ? NAVY : PURPLE,
            font: 'Aptos',
          })],
          spacing: { before: 200, after: 60 },
          shading: isUser
            ? undefined
            : { type: ShadingType.CLEAR, fill: 'F0EBF8', color: 'auto' },
        }),
      );

      // Message content
      const msgParas = parseMessageToParagraphs(text, isUser);
      children.push(...msgParas);

      // Thin separator between messages
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' } },
          spacing: { before: 120, after: 120 },
        }),
      );
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    children.push(makeFooter());

    // ── Build doc ─────────────────────────────────────────────────────────────
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1" margins
          },
        },
        children,
      }],
      styles: {
        default: {
          document: { run: { font: 'Aptos', size: PT(11), color: DARK } },
        },
      },
    });

    const buffer = await Packer.toBuffer(doc);
    const base64  = buffer.toString('base64');
    const dateStr = new Date().toISOString().slice(0, 10);

    return res.status(200).json({
      base64,
      filename: `nintex_q4_chat_${dateStr}.docx`,
    });

  } catch (err) {
    console.error('generate-doc error:', err);
    return res.status(500).json({ error: err.message });
  }
};
