export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { title, content, context } = req.body;
    const clean = (content || '').replace(/\*\*/g, '');
    const lines = clean.split('\n');
    let body = '';

    lines.forEach(line => {
      const t = line.trim();
      if (!t) { body += '<br/>'; return; }

      // H1-style: markdown ### or short numbered headers
      if (t.match(/^###\s+/)) {
        const text = t.replace(/^###\s+/, '');
        body += '<h3 style="font-family:Aptos,Calibri,sans-serif;font-size:13pt;color:#1B1464;margin:14px 0 6px;border-left:4px solid #E91E8C;padding-left:10px;">' + text + '</h3>';
        return;
      }
      if (t.match(/^##\s+/)) {
        const text = t.replace(/^##\s+/, '');
        body += '<h2 style="font-family:Aptos,Calibri,sans-serif;font-size:15pt;color:#1B1464;margin:20px 0 8px;border-bottom:2px solid #E91E8C;padding-bottom:4px;">' + text + '</h2>';
        return;
      }
      if (t.match(/^#\s+/)) {
        const text = t.replace(/^#\s+/, '');
        body += '<h1 style="font-family:Aptos,Calibri,sans-serif;font-size:18pt;color:#1B1464;margin:24px 0 10px;">' + text + '</h1>';
        return;
      }

      // Numbered section headers (1. Title, 2. Title)
      if (t.match(/^\d+[.)]\s/) && t.length < 100 && !t.includes(',')) {
        body += '<h2 style="font-family:Aptos,Calibri,sans-serif;font-size:15pt;color:#1B1464;margin:20px 0 8px;border-bottom:2px solid #E91E8C;padding-bottom:4px;">' + t + '</h2>';
        return;
      }

      // Bold-like section labels (short lines ending with colon)
      if (t.endsWith(':') && t.length < 60) {
        body += '<h3 style="font-family:Aptos,Calibri,sans-serif;font-size:13pt;color:#1B1464;margin:16px 0 6px;border-left:4px solid #E91E8C;padding-left:10px;">' + t + '</h3>';
        return;
      }

      // Bullet points
      if (t.match(/^[-\u2022*]\s+/) || t.match(/^\d+\.\s+/)) {
        const bt = t.replace(/^[-\u2022*]\s+/, '').replace(/^\d+\.\s+/, '');
        const ci = bt.indexOf(':');
        if (ci > 0 && ci < 50) {
          body += '<p style="font-family:Aptos,Calibri,sans-serif;font-size:11pt;margin:4px 0 4px 28px;line-height:1.6;"><span style="color:#E91E8C;font-weight:bold;margin-right:6px;">\u2022</span><b style="color:#1B1464;">' + bt.substring(0, ci + 1) + '</b>' + bt.substring(ci + 1) + '</p>';
        } else {
          body += '<p style="font-family:Aptos,Calibri,sans-serif;font-size:11pt;margin:4px 0 4px 28px;line-height:1.6;"><span style="color:#E91E8C;font-weight:bold;margin-right:6px;">\u2022</span>' + bt + '</p>';
        }
        return;
      }

      // Regular paragraph
      body += '<p style="font-family:Aptos,Calibri,sans-serif;font-size:11pt;margin:6px 0;line-height:1.6;">' + t + '</p>';
    });

    const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const htmlDoc = '<html><head><meta charset="utf-8"></head><body style="font-family:Aptos,Calibri,sans-serif;max-width:700px;margin:40px auto;">'
      + '<div style="border-bottom:4px solid #1B1464;padding-bottom:12px;margin-bottom:6px;">'
      + '<h1 style="font-size:22pt;color:#1B1464;margin:0;">' + (title || 'Retention Intelligence Report') + '</h1>'
      + '<p style="color:#9B2FAE;font-size:10pt;margin:4px 0 0;">nintex retention intelligence</p>'
      + '</div>'
      + '<p style="color:#666;font-size:9pt;margin:8px 0 16px;">' + dateStr + (context ? ' &nbsp;|&nbsp; Context: ' + context : '') + '</p>'
      + body
      + '<div style="border-top:2px solid #E91E8C;margin:30px 0 8px;padding-top:8px;">'
      + '<p style="font-size:8pt;color:#999;font-style:italic;">Source: Nintex Retention Intelligence Dashboard. Databricks finance.arr_monthly and finance.retention_arr_fact, enriched with Salesforce account fields.</p>'
      + '</div>'
      + '</body></html>';

    const base64 = Buffer.from(htmlDoc).toString('base64');
    res.status(200).json({ base64, filename: 'Retention_Report.doc' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
