// api/digest.js
// Vercel serverless function: fetches the current (or most recent) weekly
// digest from Supabase for the Wednesday Digest tab.
//
// GET /api/digest              — returns the most recent week's digest row
// GET /api/digest?date=YYYY-MM-DD — returns a specific week by date
//
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !apiKey) {
    return res.status(500).json({ error: 'Supabase environment variables not configured.' });
  }

  const { date } = req.query;

  // Build Supabase REST query
  // Select the digest row; if a specific date is requested filter on it,
  // otherwise return the most recent row by week_date descending.
  let endpoint = `${url}/rest/v1/digest_weekly?select=*`;
  if (date) {
    endpoint += `&week_date=eq.${date}`;
  } else {
    endpoint += `&order=week_date.desc&limit=1`;
  }

  try {
    const resp = await fetch(endpoint, {
      headers: {
        'apikey':        apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Supabase fetch error:', resp.status, text);
      return res.status(502).json({ error: `Supabase returned ${resp.status}`, detail: text });
    }

    const rows = await resp.json();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No digest found.', hint: 'Run wednesday_digest.py to generate one.' });
    }

    return res.status(200).json(rows[0]);

  } catch (err) {
    console.error('digest.js error:', err);
    return res.status(500).json({ error: err.message });
  }
};
