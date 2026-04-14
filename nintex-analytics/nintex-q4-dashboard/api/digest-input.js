// api/digest-input.js
// Vercel serverless function: reads and writes contributor inputs for the
// Wednesday Digest tab (digest_inputs table in Supabase).
//
// GET  /api/digest-input?week_date=YYYY-MM-DD
//      Returns all inputs for the given week, grouped by account_name.
//
// GET  /api/digest-input?week_date=YYYY-MM-DD&account_name=Acme+Corp
//      Returns inputs for a single account in a given week.
//
// POST /api/digest-input
//      Body: { week_date, account_name, contributor_name, contributor_role, response_text }
//      Upserts: if a row already exists for (week_date, account_name, contributor_name),
//      it is updated. Otherwise a new row is inserted.
//
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url    = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !apiKey) {
    return res.status(500).json({ error: 'Supabase environment variables not configured.' });
  }

  const headers = {
    'apikey':        apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type':  'application/json',
  };

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { week_date, account_name } = req.query;

    if (!week_date) {
      return res.status(400).json({ error: 'week_date query param is required.' });
    }

    let endpoint = `${url}/rest/v1/digest_inputs?select=*&week_date=eq.${week_date}&order=created_at.asc`;
    if (account_name) {
      endpoint += `&account_name=eq.${encodeURIComponent(account_name)}`;
    }

    try {
      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(502).json({ error: `Supabase returned ${resp.status}`, detail: text });
      }
      const rows = await resp.json();

      // Group by account_name for convenient consumption by the frontend
      const grouped = {};
      for (const row of rows) {
        const key = row.account_name || '__general__';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }

      return res.status(200).json({ rows, grouped });

    } catch (err) {
      console.error('digest-input GET error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { week_date, account_name, contributor_name, contributor_role, response_text } = req.body || {};

    // Validate required fields
    if (!week_date) return res.status(400).json({ error: 'week_date is required.' });
    if (!contributor_name?.trim()) return res.status(400).json({ error: 'contributor_name is required.' });
    if (!response_text?.trim()) return res.status(400).json({ error: 'response_text is required.' });

    // Validate week_date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week_date)) {
      return res.status(400).json({ error: 'week_date must be in YYYY-MM-DD format.' });
    }

    const payload = {
      week_date,
      account_name:      account_name || null,   // null = general/overall read
      contributor_name:  contributor_name.trim(),
      contributor_role:  contributor_role?.trim() || null,
      response_text:     response_text.trim(),
      updated_at:        new Date().toISOString(),
    };

    // Upsert: match on (week_date, account_name, contributor_name).
    // If account_name is null, match on (week_date, contributor_name) only — this
    // is the "overall read" slot, one per contributor per week.
    const endpoint = `${url}/rest/v1/digest_inputs?on_conflict=week_date,account_name,contributor_name`;

    try {
      const resp = await fetch(endpoint, {
        method:  'POST',
        headers: {
          ...headers,
          // Upsert on the composite unique key; update all non-key columns on conflict
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error('Supabase upsert error:', resp.status, text);
        return res.status(502).json({ error: `Supabase returned ${resp.status}`, detail: text });
      }

      const saved = await resp.json();
      return res.status(200).json({ ok: true, row: Array.isArray(saved) ? saved[0] : saved });

    } catch (err) {
      console.error('digest-input POST error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
