import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { title, content, context } = req.body;
    const sections = content.split(/\n\n+/).filter(s => s.trim());
    const children = [];
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title || 'Retention Intelligence Report', bold: true, size: 32, font: 'Arial' })] }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Generated: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), size: 20, font: 'Arial', color: '666666' })] }));
    if (context) children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Dashboard context: ', bold: true, size: 20, font: 'Arial', color: '666666' }), new TextRun({ text: context, size: 20, font: 'Arial', color: '666666' })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 1 } }, children: [] }));
    sections.forEach(function(section) {
      var trimmed = section.trim();
      if (trimmed.length < 80 && !trimmed.includes('.') && !trimmed.startsWith('-')) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: trimmed, bold: true, size: 26, font: 'Arial' })] }));
        return;
      }
      var lines = trimmed.split('\n');
      var isBullets = lines.every(function(l) { return l.trim().startsWith('-') || l.trim().startsWith('\u2022') || l.trim() === ''; });
      if (isBullets) {
        lines.forEach(function(line) {
          var clean = line.trim().replace(/^[-\u2022]\s*/, '');
          if (!clean) return;
          var ci = clean.indexOf(':');
          if (ci > 0 && ci < 40) {
            children.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: '\u2022 ', size: 22, font: 'Arial' }), new TextRun({ text: clean.substring(0, ci + 1), bold: true, size: 22, font: 'Arial' }), new TextRun({ text: clean.substring(ci + 1), size: 22, font: 'Arial' })] }));
          } else {
            children.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: '\u2022 ' + clean, size: 22, font: 'Arial' })] }));
          }
        });
        return;
      }
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: trimmed.replace(/\*\*/g, '').split('\n').join(' '), size: 22, font: 'Arial' })] }));
    });
    children.push(new Paragraph({ spacing: { before: 400 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } }, children: [new TextRun({ text: 'Source: Nintex Retention Intelligence Dashboard. Data from Databricks finance.arr_monthly and finance.retention_arr_fact.', size: 16, font: 'Arial', color: '999999', italics: true })] }));
    const doc = new Document({ styles: { default: { document: { run: { font: 'Arial', size: 22 } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Retention_Report.docx"');
    res.status(200).send(buffer);
  } catch (err) { res.status(500).json({ error: err.message }); }
}
