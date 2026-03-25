import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, LevelFormat } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { title, content, context } = req.body;

    // Clean markdown
    const clean = content.replace(/\*\*/g, '');

    // Split into lines for better parsing
    const lines = clean.split('\n');
    const children = [];

    // Title
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title || 'Retention Intelligence Report', bold: true, size: 32, font: 'Arial' })] }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Generated: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), size: 20, font: 'Arial', color: '666666' })] }));
    if (context) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Dashboard context: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: context, size: 20, font: 'Arial', color: '666666' })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 1 } }, children: [] }));

    let paraBuffer = '';

    function flushPara() {
      if (paraBuffer.trim()) {
        children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: paraBuffer.trim(), size: 22, font: 'Arial' })] }));
        paraBuffer = '';
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Empty line: flush paragraph
      if (!line) {
        flushPara();
        continue;
      }

      // Heading: starts with # or is short with no period and followed by content
      if (line.match(/^#{1,3}\s+/)) {
        flushPara();
        const level = line.startsWith('###') ? HeadingLevel.HEADING_3 : line.startsWith('##') ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_2;
        const text = line.replace(/^#{1,3}\s+/, '');
        children.push(new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: text, bold: true, size: level === HeadingLevel.HEADING_3 ? 24 : 26, font: 'Arial' })] }));
        continue;
      }

      // Numbered heading like "1." or "1)" at start of a short line
      if (line.match(/^\d+[.)]\s/) && line.length < 80 && !line.includes(',')) {
        flushPara();
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: line, bold: true, size: 26, font: 'Arial' })] }));
        continue;
      }

      // Bullet point: starts with -, *, or bullet char
      if (line.match(/^[-\u2022*]\s+/) || line.match(/^\d+\.\s+/)) {
        flushPara();
        const bulletText = line.replace(/^[-\u2022*]\s+/, '').replace(/^\d+\.\s+/, '');

        // Check for "Label: value" pattern
        const colonIdx = bulletText.indexOf(':');
        if (colonIdx > 0 && colonIdx < 50) {
          children.push(new Paragraph({
            spacing: { after: 80 },
            indent: { left: 420, hanging: 200 },
            children: [
              new TextRun({ text: '\u2022  ', size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText.substring(0, colonIdx + 1), bold: true, size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText.substring(colonIdx + 1), size: 22, font: 'Arial' })
            ]
          }));
        } else {
          children.push(new Paragraph({
            spacing: { after: 80 },
            indent: { left: 420, hanging: 200 },
            children: [
              new TextRun({ text: '\u2022  ', size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText, size: 22, font: 'Arial' })
            ]
          }));
        }
        continue;
      }

      // Regular text: accumulate into paragraph
      paraBuffer += (paraBuffer ? ' ' : '') + line;
    }

    flushPara();

    // Footer
    children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
      spacing: { before: 100 },
      children: [new TextRun({ text: 'Source: Nintex Retention Intelligence Dashboard. Data from Databricks finance.arr_monthly and finance.retention_arr_fact, enriched with Salesforce account fields.', size: 16, font: 'Arial', color: '999999', italics: true })]
    }));

    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 32, bold: true, font: 'Arial', color: '1A1A2E' },
            paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 26, bold: true, font: 'Arial', color: '333333' },
            paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
          { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: '





cat > api/generate-doc.js << 'DOCEOF'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, LevelFormat } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { title, content, context } = req.body;

    // Clean markdown
    const clean = content.replace(/\*\*/g, '');

    // Split into lines for better parsing
    const lines = clean.split('\n');
    const children = [];

    // Title
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title || 'Retention Intelligence Report', bold: true, size: 32, font: 'Arial' })] }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Generated: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), size: 20, font: 'Arial', color: '666666' })] }));
    if (context) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Dashboard context: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: context, size: 20, font: 'Arial', color: '666666' })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 1 } }, children: [] }));

    let paraBuffer = '';

    function flushPara() {
      if (paraBuffer.trim()) {
        children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: paraBuffer.trim(), size: 22, font: 'Arial' })] }));
        paraBuffer = '';
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Empty line: flush paragraph
      if (!line) {
        flushPara();
        continue;
      }

      // Heading: starts with # or is short with no period and followed by content
      if (line.match(/^#{1,3}\s+/)) {
        flushPara();
        const level = line.startsWith('###') ? HeadingLevel.HEADING_3 : line.startsWith('##') ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_2;
        const text = line.replace(/^#{1,3}\s+/, '');
        children.push(new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: text, bold: true, size: level === HeadingLevel.HEADING_3 ? 24 : 26, font: 'Arial' })] }));
        continue;
      }

      // Numbered heading like "1." or "1)" at start of a short line
      if (line.match(/^\d+[.)]\s/) && line.length < 80 && !line.includes(',')) {
        flushPara();
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: line, bold: true, size: 26, font: 'Arial' })] }));
        continue;
      }

      // Bullet point: starts with -, *, or bullet char
      if (line.match(/^[-\u2022*]\s+/) || line.match(/^\d+\.\s+/)) {
        flushPara();
        const bulletText = line.replace(/^[-\u2022*]\s+/, '').replace(/^\d+\.\s+/, '');

        // Check for "Label: value" pattern
        const colonIdx = bulletText.indexOf(':');
        if (colonIdx > 0 && colonIdx < 50) {
          children.push(new Paragraph({
            spacing: { after: 80 },
            indent: { left: 420, hanging: 200 },
            children: [
              new TextRun({ text: '\u2022  ', size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText.substring(0, colonIdx + 1), bold: true, size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText.substring(colonIdx + 1), size: 22, font: 'Arial' })
            ]
          }));
        } else {
          children.push(new Paragraph({
            spacing: { after: 80 },
            indent: { left: 420, hanging: 200 },
            children: [
              new TextRun({ text: '\u2022  ', size: 22, font: 'Arial' }),
              new TextRun({ text: bulletText, size: 22, font: 'Arial' })
            ]
          }));
        }
        continue;
      }

      // Regular text: accumulate into paragraph
      paraBuffer += (paraBuffer ? ' ' : '') + line;
    }

    flushPara();

    // Footer
    children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
      spacing: { before: 100 },
      children: [new TextRun({ text: 'Source: Nintex Retention Intelligence Dashboard. Data from Databricks finance.arr_monthly and finance.retention_arr_fact, enriched with Salesforce account fields.', size: 16, font: 'Arial', color: '999999', italics: true })]
    }));

    const doc = new Document({
      styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 32, bold: true, font: 'Arial', color: '1A1A2E' },
            paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 26, bold: true, font: 'Arial', color: '333333' },
            paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 } },
          { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 24, bold: true, font: 'Arial', color: '555555' },
            paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } }
        ]
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');
    res.status(200).json({ base64: base64, filename: 'Retention_Report.docx' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
