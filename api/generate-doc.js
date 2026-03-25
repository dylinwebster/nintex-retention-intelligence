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
      if (t.match(/^#{1,3}\s+/)) {
        const text = t.replace(/^#{1,3}\s+/, '');
        body += '<h2 style="font-family:Arial;color:#1a1a2e;margin:18px 0 8px;">' + text + '</h2>';
        return;
      }
      if (t.match(/^\d+[.)]\s/) && t.length < 80) {
        body += '<h2 style="font-family:Arial;color:#333;margin:18px 0 8px;">' + t + '</h2>';
        return;
      }
      if (t.match(/^[-\u2022*]\s+/) || t.match(/^\d+\.\s+/)) {
        const bt = t.replace(/^[-\u2022*]\s+/, '').replace(/^\d+\.\s+/, '');
        const ci = bt.indexOf(':');
        if (ci > 0 && ci < 50) {
          body += '<p style="font-family:Arial;font-size:11pt;margin:4px 0 4px 24px;">\u2022 <b>' + bt.substring(0, ci + 1) + '</b>' + bt.substring(ci + 1) + '</p>';
        } else {
          body += '<p style="font-family:Arial;font-size:11pt;margin:4px 0 4px 24px;">\u2022 ' + bt + '</p>';
        }
        return;
      }
      body += '<p style="font-family:Arial;font-size:11pt;margin:6px 0;">' + t + '</p>';
    });

    const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial;max-width:700px;margin:40px auto;">'
      + '<h1 style="color:#1a1a2e;border-bottom:3px solid #2E75B6;padding-bottom:8px;">' + (title || 'Retention Intelligence Report') + '</h1>'
      + '<p style="color:#666;font-size:10pt;">Generated: ' + new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) + (context ? ' | Context: ' + context : '') + '</p>'
      + '<hr style="border:none;border-top:1px solid #ccc;margin:16px 0;"/>'
      + body
      + '<hr style="border:none;border-top:1px solid #ccc;margin:24px 0 8px;"/>'
      + '<p style="font-size:8pt;color:#999;font-style:italic;">Source: Nintex Retention Intelligence Dashboard. Databricks finance.arr_monthly and finance.retention_arr_fact.</p>'
      + '</body></html>';

    const base64 = Buffer.from(html).toString('base64');
    res.status(200).json({ base64, filename: 'Retention_Report.doc' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
