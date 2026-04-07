// api/chat.js
// Vercel serverless function: proxies chat requests to Anthropic API.
// Enriches the system prompt server-side with live account-level data
// from Vercel Blob (q4_data.json), so the agent can answer medium-depth
// questions about specific accounts, pipeline status, and risk signals.
//
// Environment variables required:
//   ANTHROPIC_API_KEY      — Anthropic API key
//   BLOB_READ_WRITE_TOKEN  — Vercel Blob read token

const { head, getDownloadUrl } = require('@vercel/blob');

// ─── Fetch live q4_data.json from Vercel Blob ─────────────────────────────────
async function fetchQ4Data() {
  try {
    // Fetch from the fixed blob URL directly — same URL the extract script uploads to.
    // Private blobs require the token as a query param or Authorization header.
    const url = 'https://c7xixtsp9yzahqvo.private.blob.vercel-storage.com/q4_data.json';
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });
    if (!res.ok) {
      console.warn('Blob fetch failed:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn('Could not fetch q4_data from Blob:', e.message);
    return null;
  }
}

// ─── Build the enriched system prompt ────────────────────────────────────────
function buildEnrichedSystem(frontendSystem, q4) {
  // Start with whatever context the frontend built (tab name, rate arrays)
  let s = frontendSystem || '';

  if (!q4) {
    s += '\n\n[NOTE: Live pipeline data unavailable. Answer from historical retention rates only. Flag this limitation explicitly in your response.]';
    return s;
  }

  // ── Quarter attainment hero metrics ──────────────────────────────────────
  if (q4.pipeline_summary) {
    const ps = q4.pipeline_summary;
    s += `\n\n=== Q4 FY26 PIPELINE SUMMARY (live as of ${q4.extracted_at || 'recent extract'}) ===`;
    s += `\nTotal RevOps ATR: $${ps.total_atr ? (ps.total_atr / 1e6).toFixed(1) + 'M' : 'N/A'}`;
    s += `\nClosed Won (Booked): $${ps.closed_won ? (ps.closed_won / 1e6).toFixed(1) + 'M' : 'N/A'}`;
    s += `\nClosed Lost (Confirmed Churn): $${ps.closed_lost ? (ps.closed_lost / 1e6).toFixed(1) + 'M' : 'N/A'}`;
    s += `\nOpen Pipeline: $${ps.open_pipeline ? (ps.open_pipeline / 1e6).toFixed(1) + 'M' : 'N/A'}`;
    s += `\nAttainment: ${ps.attainment_pct ? ps.attainment_pct.toFixed(1) + '%' : 'N/A'} of ATR`;
    s += `\nCommit + Best Case (open): $${ps.commit_best_case ? (ps.commit_best_case / 1e6).toFixed(1) + 'M' : 'N/A'}`;
    if (ps.by_stage) {
      s += '\nBreakdown by stage: ' + JSON.stringify(ps.by_stage);
    }
  }

  // ── Top 50 accounts ───────────────────────────────────────────────────────
  if (q4.top_accounts && q4.top_accounts.length) {
    s += '\n\n=== TOP ACCOUNTS (up to 50, by current ARR) ===';
    s += '\nFields: account_name, current_arr, product, opp_id, stage, forecast_category, risk_type, risk_color, renewal_date, arr_divergence_pct, days_since_stage_change, exec_sponsor';
    s += '\nData quality note: arr_divergence_pct is SFDC renewal_software_acv vs finance.arr_monthly. Values >10% indicate SFDC data quality risk; treat SFDC ARR with caution for those accounts.';
    s += '\nStaleness note: days_since_stage_change >= 30 is a risk signal independent of stage name.';
    s += '\n' + JSON.stringify(q4.top_accounts);
  }

  // ── Account dimensions ────────────────────────────────────────────────────
  if (q4.account_dimensions && q4.account_dimensions.length) {
    // Trim to top 50 by ARR and drop fields that are null-heavy or low-value
    // for agent Q&A to stay within 200K token context limit.
    const KEEP = new Set([
      'account_name','industry','region','customer_segment',
      'csm_name','renewal_specialist_email',
      'tenure_years','customer_since_date',
      'current_arr','arr_trend_direction','arr_trend_pct',
      'active_products',
      'last_contact_date','days_since_last_contact','engagement_status',
      'gong_calls_last_90d','cs_touches_last_90d',
      'sfdc_churn_risk_renewal','cs_churn_risk','cs_churn_risk_trend',
      'red_zone_flag','red_zone_reason',
      'csm_health_score','csm_health_trend',
      'exec_sponsor','high_potential_flag'
    ]);
    const dims = q4.account_dimensions
      .sort((a, b) => (b.current_arr || 0) - (a.current_arr || 0))
      .slice(0, 50)
      .map(r => Object.fromEntries(
        Object.entries(r).filter(([k, v]) => KEEP.has(k) && v !== null && v !== '' && v !== 0)
      ));
    s += '\n\n=== ACCOUNT DIMENSIONS (enriched profile per Q4 renewal account) ===';
    s += '\nSource: salesforce.account + finance.retention_arr_fact + finance.arr_monthly + gong.call + salesforce.task';
    s += '\nFields: account_name, industry, region, billing_country, customer_segment, sbi_segment,';
    s += ' employee_count, csm_name, csm_email, renewal_specialist_email,';
    s += ' customer_since_date, tenure_years, next_renewal_date,';
    s += ' current_arr, arr_3q_ago, arr_trend_direction, arr_trend_pct,';
    s += ' active_products, product_count,';
    s += ' last_gong_call_date, gong_calls_last_90d, gong_calls_last_12m, last_gong_rep,';
    s += ' last_task_date, cs_touches_last_90d, cs_touches_last_12m, last_activity_type,';
    s += ' last_contact_date, days_since_last_contact, engagement_status,';
    s += ' sfdc_churn_risk, sfdc_churn_risk_renewal, sfdc_churn_risk_trend,';
    s += ' cs_churn_risk, cs_churn_risk_trend,';
    s += ' red_zone_flag, red_zone_reason, red_zone_category,';
    s += ' csm_health_score, csm_health_trend, health_detail_notes,';
    s += ' exec_sponsor, cs_coverage_model, cs_engagement_level, high_potential_flag';
    s += '\nengagement_status values: active (<=30d), cooling (31-90d), at_risk_engagement (91-180d), dark (180d+), no_record';
    s += '\ncsm_health_score: 0-100 numeric, CSM-entered. Interim Tingono substitute. Null = not entered.';
    s += '\narr_trend_direction: growing (>5% vs 3Q ago), shrinking (<-5%), flat, new';
    s += '\nData quality note: customer_since_date has ~23% population rate overall; higher for established accounts.';
    s += '\nTingono health scores: permissions pending IT approval. Add after Friday meeting.';
    s += '\n' + JSON.stringify(dims);
  }

  // ── At-risk accounts ─────────────────────────────────────────────────────
  if (q4.at_risk && q4.at_risk.length) {
    s += '\n\n=== AT-RISK ACCOUNTS (open Q4 opps with risk_type set) ===';
    s += '\nFields: account_name, current_arr, risk_type, risk_color, stage, renewal_date, opp_id, arr_divergence_pct, product';
    s += '\n' + JSON.stringify(q4.at_risk);
  }

  // ── Week-over-week stage movements ────────────────────────────────────────
  if (q4.wow_movement && q4.wow_movement.length) {
    s += '\n\n=== WEEK-OVER-WEEK STAGE MOVEMENTS (current week vs prior week) ===';
    s += '\nFields: account_name, opp_id, prev_stage, curr_stage, prev_forecast_category, curr_forecast_category, arr';
    s += '\n' + JSON.stringify(q4.wow_movement);
  }

  // ── Known risk signals (hardcoded, analyst-validated) ────────────────────
  s += `\n\n=== KNOWN RISK SIGNALS (analyst-validated as of Q4 FY26 start) ===`;
  s += `\nCE RPA: Annualized GRR ~73.5%, NRR ~78.5%. Base shrinking ~20% annually. Critical risk product. Flag any CE RPA account in top accounts as elevated risk.`;
  s += `\nSalesforce Apps: GRR dropped from 97-99% range (FY25) to 90.5% in FY26 Q2. Cause under investigation. Treat Salesforce Apps renewals as requiring scrutiny.`;
  s += `\nK2 Workflow: Most stable core product. Annualized GRR 83.8%, NRR 95.9%.`;
  s += `\nMicrosoft Power Automate displacement: 16 accounts, ~$13M ARR at risk in Top 30. If asked about PA displacement, reference this figure.`;
  s += `\n$100K+ accounts: Only ARR tier generating net-positive quarterly economics. Prioritize retention effort here.`;
  s += `\nH1 FY26 renewal rate: 85% including price increase, 65% excluding it.`;
  s += `\nFY26 Q2 churn spike: $10.1M single-quarter logo churn, largest in 8-quarter window.`;

  // ── GRR methodology reminder ─────────────────────────────────────────────
  s += `\n\n=== GRR METHODOLOGY ===`;
  s += `\nTrailing 4Q annualized GRR = Q1 x Q2 x Q3 x Q4 (each as decimal). Do not average.`;
  s += `\nFY26 working targets: 82.5% pure GRR, 86.0% GRR + price increase combined.`;
  s += `\nRevOps ATR uses execution date as denominator (includes pull-forwards, multi-year).`;
  s += `\nCS/Finance GRR ATR uses scheduled renewal date, annual contracts only.`;
  s += `\nSFDC CPQ migration note: renewal revenue may appear under different opp IDs than originally forecast. Never state SFDC ARR as definitive without noting this caveat.`;

  // ── Behavior instructions ─────────────────────────────────────────────────
  s += `\n\n=== RESPONSE INSTRUCTIONS ===`;
  s += `\nYou are a retention analytics assistant for Dylin Webster, VP Customer Success at Nintex.`;
  s += `\nAnswer with specific numbers from the data above. Do not invent account names, ARR figures, or opp IDs not present in the data.`;
  s += `\nWhen SFDC fields are involved (opp_id, stage, arr_divergence), note the CPQ migration caveat if the divergence is >10% or if the question involves revenue figures.`;
  s += `\nFlag stale opps (days_since_stage_change >= 30) as a risk signal when discussing specific accounts.`;
  s += `\nDo not use em dashes. Use commas, colons, or semicolons instead.`;
  s += `\nBe direct. No filler. Present risks and opportunities with equal weight.`;

  return s;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Fetch live data and build enriched system prompt in parallel with nothing
  const q4 = await fetchQ4Data();
  const enrichedSystem = buildEnrichedSystem(system, q4);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: enrichedSystem,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
