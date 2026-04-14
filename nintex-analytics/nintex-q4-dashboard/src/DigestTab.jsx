// src/DigestTab.jsx
// Wednesday Digest tab — collaborative weekly briefing surface.
//
// Fetches the current week's digest from /api/digest (Supabase-backed).
// Fetches all contributor inputs from /api/digest-input.
// Contributors can submit their read on each account and an overall read.
// All inputs are visible to all viewers in real time (on next fetch/refresh).

import { useState, useEffect, useCallback } from 'react';

// ── Brand tokens (match existing dashboard) ─────────────────────────────────
const C = {
  navy:    '#060D3F',
  orange:  '#F26522',
  pink:    '#F02D8A',
  purple:  '#7B3A9E',
  ink:     '#222222',
  muted:   '#888888',
  surf:    '#F5F6FA',
  card:    '#FFFFFF',
  bdr:     '#E2E5ED',
  green:   '#1D6F42',
  red:     '#A32D2D',
  amber:   '#854F0B',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(v) {
  if (v == null) return 'N/A';
  return `$${(v / 1e6).toFixed(1)}M`;
}

function fmtPct(v) {
  if (v == null) return 'N/A';
  return `${Number(v).toFixed(1)}%`;
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return s; }
}

function riskColor(riskType) {
  if (!riskType) return C.muted;
  const r = riskType.toLowerCase();
  if (r.includes('churn')) return C.red;
  if (r.includes('downsell')) return C.amber;
  return C.muted;
}

function engBadgeStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'dark') return { background: '#FEE2E2', color: C.red };
  if (s === 'at_risk_engagement') return { background: '#FEF3C7', color: C.amber };
  if (s === 'cooling') return { background: '#FFF7ED', color: '#9A3412' };
  if (s === 'active') return { background: '#DCFCE7', color: C.green };
  return { background: C.surf, color: C.muted };
}

const ROLES = ['CSM', 'Renewal Specialist', 'CS Leader', 'VP CS', 'Other'];

// ── Styles (inline, scoped) ──────────────────────────────────────────────────

const s = {
  wrap: {
    fontFamily: "'Aptos', 'Calibri', Arial, sans-serif",
    color: C.ink,
    maxWidth: 900,
    margin: '0 auto',
    paddingBottom: 80,
  },
  // Header bar
  headerBar: {
    background: C.navy,
    borderRadius: 12,
    padding: '18px 24px',
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: -0.3,
    margin: 0,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'monospace',
  },
  headerBadge: {
    background: C.orange,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 20,
    alignSelf: 'center',
    whiteSpace: 'nowrap',
  },
  // Forecast table
  forecastCard: {
    background: C.card,
    border: `1px solid ${C.bdr}`,
    borderRadius: 12,
    padding: '18px 22px',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: C.muted,
    marginBottom: 12,
  },
  forecastGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    marginBottom: 16,
  },
  kpi: {
    background: C.surf,
    borderRadius: 8,
    padding: '10px 12px',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: C.muted,
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: C.navy,
  },
  kpiSub: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
  narrativeBox: {
    background: '#F0F4FF',
    border: `1px solid #C7D2FE`,
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13,
    lineHeight: 1.65,
    color: C.navy,
  },
  // Account cards
  accountCard: {
    background: C.card,
    border: `1px solid ${C.bdr}`,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  accountHeader: {
    padding: '14px 20px',
    borderBottom: `1px solid ${C.bdr}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    background: '#FAFBFF',
  },
  accountName: {
    fontSize: 15,
    fontWeight: 700,
    color: C.navy,
    margin: 0,
  },
  accountMeta: {
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 14px',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
    whiteSpace: 'nowrap',
  },
  actionPill: {
    background: '#EDE9FE',
    color: C.purple,
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 20,
    alignSelf: 'flex-start',
    whiteSpace: 'nowrap',
  },
  accountBody: {
    padding: '14px 20px',
  },
  questionsBlock: {
    marginBottom: 14,
  },
  questionsList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 12,
    color: C.ink,
    lineHeight: 1.8,
  },
  // Existing inputs feed
  inputsFeed: {
    marginBottom: 14,
  },
  inputFeedLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: C.muted,
    marginBottom: 8,
  },
  inputBubble: {
    background: C.surf,
    border: `1px solid ${C.bdr}`,
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 1.6,
  },
  inputBubbleMeta: {
    fontSize: 10,
    color: C.muted,
    marginBottom: 4,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  inputBubbleRolePill: {
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 8,
    background: '#EDE9FE',
    color: C.purple,
  },
  noInputs: {
    fontSize: 12,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  // Input form
  formBlock: {
    background: '#FFFBF5',
    border: `1px solid #F9D4A8`,
    borderRadius: 8,
    padding: '14px 16px',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.orange,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  input: {
    border: `1px solid ${C.bdr}`,
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
    color: C.ink,
    outline: 'none',
    flex: 1,
    minWidth: 120,
  },
  select: {
    border: `1px solid ${C.bdr}`,
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
    color: C.ink,
    outline: 'none',
  },
  textarea: {
    border: `1px solid ${C.bdr}`,
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    background: '#fff',
    color: C.ink,
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    minHeight: 80,
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: C.navy,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: 'inherit',
  },
  submitBtnDisabled: {
    background: C.muted,
    cursor: 'not-allowed',
  },
  successNote: {
    fontSize: 11,
    color: C.green,
    marginTop: 6,
    fontWeight: 600,
  },
  errorNote: {
    fontSize: 11,
    color: C.red,
    marginTop: 6,
  },
  // Decision ask section
  decisionCard: {
    background: C.card,
    border: `2px solid ${C.orange}`,
    borderRadius: 12,
    padding: '18px 22px',
    marginBottom: 20,
  },
  decisionDraft: {
    fontSize: 14,
    fontWeight: 600,
    color: C.navy,
    fontStyle: 'italic',
    margin: '8px 0 14px',
    lineHeight: 1.6,
  },
  // Overall read section
  overallCard: {
    background: C.card,
    border: `1px solid ${C.bdr}`,
    borderRadius: 12,
    padding: '18px 22px',
    marginBottom: 20,
  },
  // Empty / loading states
  stateBox: {
    textAlign: 'center',
    padding: '60px 20px',
    color: C.muted,
    fontSize: 13,
  },
  refreshBtn: {
    background: 'none',
    border: `1px solid ${C.bdr}`,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 11,
    color: C.muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 8,
  },
  divider: {
    border: 'none',
    borderTop: `1px solid ${C.bdr}`,
    margin: '14px 0',
  },
};

// ── AccountCard ──────────────────────────────────────────────────────────────

function AccountCard({ acct, inputs, weekDate, onInputSubmitted, sharedName, sharedRole, onSharedNameChange, onSharedRoleChange }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const acctInputs = inputs[acct.account_name] || [];

  async function handleSubmit() {
    if (!sharedName.trim() || !text.trim()) return;
    setSubmitting(true);
    setSuccess(false);
    setError('');
    try {
      const resp = await fetch('/api/digest-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_date:        weekDate,
          account_name:     acct.account_name,
          contributor_name: sharedName.trim(),
          contributor_role: sharedRole || null,
          response_text:    text.trim(),
        }),
      });
      if (!resp.ok) {
        const d = await resp.json();
        setError(d.error || 'Submission failed.');
      } else {
        setSuccess(true);
        setText('');
        onInputSubmitted();
      }
    } catch (e) {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const riskStyle = {
    ...s.badge,
    background: riskColor(acct.at_risk_type) === C.red ? '#FEE2E2'
      : riskColor(acct.at_risk_type) === C.amber ? '#FEF3C7' : C.surf,
    color: riskColor(acct.at_risk_type),
  };

  const engStyle = { ...s.badge, ...engBadgeStyle(acct.engagement_status) };

  return (
    <div style={s.accountCard}>
      <div style={s.accountHeader}>
        <div style={{ flex: 1 }}>
          <h3 style={s.accountName}>{acct.account_name || 'Unknown Account'}</h3>
          <div style={s.accountMeta}>
            <span style={s.metaItem}><b>ATR:</b>&nbsp;{fmtM(acct.atr_proxy_usd)}</span>
            <span style={s.metaItem}><b>Close:</b>&nbsp;{fmtDate(acct.close_date)}</span>
            <span style={s.metaItem}><b>Product:</b>&nbsp;{acct.product_l2 || '—'}</span>
            {acct.csm_name && <span style={s.metaItem}><b>CSM:</b>&nbsp;{acct.csm_name}</span>}
            {acct.exec_sponsor && <span style={s.metaItem}><b>Sponsor:</b>&nbsp;{acct.exec_sponsor}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {acct.at_risk_type && <span style={riskStyle}>{acct.at_risk_type}</span>}
            {acct.engagement_status && <span style={engStyle}>{acct.engagement_status}</span>}
            {acct.csm_health_score != null && (
              <span style={{ ...s.badge, background: acct.csm_health_score < 50 ? '#FEE2E2' : C.surf, color: acct.csm_health_score < 50 ? C.red : C.muted }}>
                Health {acct.csm_health_score}/100
              </span>
            )}
            {acct.days_since_contact != null && (
              <span style={{ ...s.badge, background: acct.days_since_contact > 60 ? '#FEF3C7' : C.surf, color: acct.days_since_contact > 60 ? C.amber : C.muted }}>
                {acct.days_since_contact}d no contact
              </span>
            )}
            {acct.sfdc_url && (
              <a href={acct.sfdc_url} target="_blank" rel="noreferrer"
                style={{ ...s.badge, background: '#E0F2FE', color: '#0369A1', textDecoration: 'none' }}>
                SFDC ↗
              </a>
            )}
          </div>
        </div>
        {acct.suggested_action && (
          <div style={s.actionPill}>{acct.suggested_action}</div>
        )}
      </div>

      <div style={s.accountBody}>
        {/* Questions */}
        {acct.questions?.length > 0 && (
          <div style={s.questionsBlock}>
            <div style={s.sectionLabel}>Questions for this account</div>
            <ol style={s.questionsList}>
              {acct.questions.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>
        )}

        <hr style={s.divider} />

        {/* Existing inputs */}
        <div style={s.inputsFeed}>
          <div style={s.inputFeedLabel}>
            Contributor reads ({acctInputs.length})
          </div>
          {acctInputs.length === 0
            ? <div style={s.noInputs}>No reads submitted yet. Be the first.</div>
            : acctInputs.map(inp => (
              <div key={inp.id} style={s.inputBubble}>
                <div style={s.inputBubbleMeta}>
                  <b>{inp.contributor_name}</b>
                  {inp.contributor_role && (
                    <span style={s.inputBubbleRolePill}>{inp.contributor_role}</span>
                  )}
                  <span style={{ color: C.muted }}>
                    {new Date(inp.updated_at || inp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>{inp.response_text}</div>
              </div>
            ))
          }
        </div>

        {/* Submit form */}
        <div style={s.formBlock}>
          <div style={s.formLabel}>Add your read</div>
          <div style={s.formRow}>
            <input
              style={s.input}
              placeholder="Your name"
              value={sharedName}
              onChange={e => onSharedNameChange(e.target.value)}
            />
            <select
              style={s.select}
              value={sharedRole}
              onChange={e => onSharedRoleChange(e.target.value)}
            >
              <option value="">Role (optional)</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <textarea
            style={s.textarea}
            placeholder="Your perspective on this account. What is the real situation, what is the blocker, and what should happen in the next 7 days?"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              style={{ ...s.submitBtn, ...(submitting || !sharedName.trim() || !text.trim() ? s.submitBtnDisabled : {}) }}
              onClick={handleSubmit}
              disabled={submitting || !sharedName.trim() || !text.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit read'}
            </button>
            {success && <span style={s.successNote}>Saved. Visible to everyone now.</span>}
            {error && <span style={s.errorNote}>{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OverallReadSection ───────────────────────────────────────────────────────

function OverallReadSection({ weekDate, inputs, onInputSubmitted, sharedName, sharedRole, onSharedNameChange, onSharedRoleChange }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Overall reads are stored with account_name = null; keyed as '__general__'
  const overallInputs = inputs['__general__'] || [];

  async function handleSubmit() {
    if (!sharedName.trim() || !text.trim()) return;
    setSubmitting(true);
    setSuccess(false);
    setError('');
    try {
      const resp = await fetch('/api/digest-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_date:        weekDate,
          account_name:     null,
          contributor_name: sharedName.trim(),
          contributor_role: sharedRole || null,
          response_text:    text.trim(),
        }),
      });
      if (!resp.ok) {
        const d = await resp.json();
        setError(d.error || 'Submission failed.');
      } else {
        setSuccess(true);
        setText('');
        onInputSubmitted();
      }
    } catch (e) {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overallCard}>
      <div style={s.sectionLabel}>Overall read</div>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
        In 3 to 5 sentences: what is the most important thing the C-suite should understand
        about Q4 retention that the data alone does not capture?
      </p>

      {overallInputs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {overallInputs.map(inp => (
            <div key={inp.id} style={s.inputBubble}>
              <div style={s.inputBubbleMeta}>
                <b>{inp.contributor_name}</b>
                {inp.contributor_role && (
                  <span style={s.inputBubbleRolePill}>{inp.contributor_role}</span>
                )}
                <span style={{ color: C.muted }}>
                  {new Date(inp.updated_at || inp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>{inp.response_text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.formBlock}>
        <div style={s.formLabel}>Add your overall read</div>
        <div style={s.formRow}>
          <input
            style={s.input}
            placeholder="Your name"
            value={sharedName}
            onChange={e => onSharedNameChange(e.target.value)}
          />
          <select
            style={s.select}
            value={sharedRole}
            onChange={e => onSharedRoleChange(e.target.value)}
          >
            <option value="">Role (optional)</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea
          style={s.textarea}
          placeholder="Your overall read on Q4 retention..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...s.submitBtn, ...(submitting || !sharedName.trim() || !text.trim() ? s.submitBtnDisabled : {}) }}
            onClick={handleSubmit}
            disabled={submitting || !sharedName.trim() || !text.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit read'}
          </button>
          {success && <span style={s.successNote}>Saved.</span>}
          {error && <span style={s.errorNote}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

// ── DecisionAskSection ───────────────────────────────────────────────────────

function DecisionAskSection({ draftAsk, weekDate, inputs, onInputSubmitted, sharedName, sharedRole, onSharedNameChange, onSharedRoleChange }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Decision ask overrides stored with account_name = '__decision_ask__'
  const decisionInputs = inputs['__decision_ask__'] || [];

  async function handleSubmit() {
    if (!sharedName.trim() || !text.trim()) return;
    setSubmitting(true);
    setSuccess(false);
    setError('');
    try {
      const resp = await fetch('/api/digest-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_date:        weekDate,
          account_name:     '__decision_ask__',
          contributor_name: sharedName.trim(),
          contributor_role: sharedRole || null,
          response_text:    text.trim(),
        }),
      });
      if (!resp.ok) {
        const d = await resp.json();
        setError(d.error || 'Submission failed.');
      } else {
        setSuccess(true);
        setText('');
        onInputSubmitted();
      }
    } catch (e) {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.decisionCard}>
      <div style={s.sectionLabel}>Decision ask — Slide 6</div>
      <div style={s.decisionDraft}>"{draftAsk}"</div>
      <p style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
        Claude's draft. Does this reflect the most important decision this week?
        Add your override or context below.
      </p>

      {decisionInputs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {decisionInputs.map(inp => (
            <div key={inp.id} style={s.inputBubble}>
              <div style={s.inputBubbleMeta}>
                <b>{inp.contributor_name}</b>
                {inp.contributor_role && (
                  <span style={s.inputBubbleRolePill}>{inp.contributor_role}</span>
                )}
              </div>
              <div>{inp.response_text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.formBlock}>
        <div style={s.formLabel}>Your override or context</div>
        <div style={s.formRow}>
          <input
            style={s.input}
            placeholder="Your name"
            value={sharedName}
            onChange={e => onSharedNameChange(e.target.value)}
          />
          <select
            style={s.select}
            value={sharedRole}
            onChange={e => onSharedRoleChange(e.target.value)}
          >
            <option value="">Role (optional)</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <textarea
          style={s.textarea}
          placeholder="Does this framing land? What context or reframe would make Slide 6 more useful for the C-suite?"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...s.submitBtn, ...(submitting || !sharedName.trim() || !text.trim() ? s.submitBtnDisabled : {}) }}
            onClick={handleSubmit}
            disabled={submitting || !sharedName.trim() || !text.trim()}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          {success && <span style={s.successNote}>Saved.</span>}
          {error && <span style={s.errorNote}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DigestTab() {
  const [digest, setDigest]   = useState(null);
  const [inputs, setInputs]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Name/role are shared across all forms on the page so the user only types once
  const [sharedName, setSharedName] = useState('');
  const [sharedRole, setSharedRole] = useState('');

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/digest');
      if (!resp.ok) {
        const d = await resp.json();
        setError(d.error || `Failed to load digest (${resp.status}).`);
        setLoading(false);
        return;
      }
      const data = await resp.json();
      setDigest(data);
      await fetchInputs(data.week_date);
    } catch (e) {
      setError('Network error loading digest.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function fetchInputs(weekDate) {
    try {
      const resp = await fetch(`/api/digest-input?week_date=${weekDate}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setInputs(data.grouped || {});
    } catch { /* non-fatal */ }
  }

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  function handleInputSubmitted() {
    if (digest?.week_date) fetchInputs(digest.week_date);
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.stateBox}>
        <div>Loading digest...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.stateBox}>
        <div style={{ color: C.red, marginBottom: 8 }}>{error}</div>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          {error.includes('No digest') && 'Run wednesday_digest.py to generate this week\'s digest.'}
        </p>
        <button style={s.refreshBtn} onClick={fetchDigest}>Try again</button>
      </div>
    );
  }

  if (!digest) return null;

  const fc        = digest.forecast_context || {};
  const narrative = digest.narrative || {};
  const accounts  = digest.accounts || [];
  const weekDate  = digest.week_date;

  const sharedFormProps = {
    sharedName,
    sharedRole,
    onSharedNameChange: setSharedName,
    onSharedRoleChange: setSharedRole,
  };

  // ── Full render ────────────────────────────────────────────────────────────

  return (
    <div style={s.wrap}>

      {/* Header */}
      <div style={s.headerBar}>
        <div>
          <h2 style={s.headerTitle}>Q4 FY26 Retention Digest</h2>
          <div style={s.headerSub}>
            Week of {weekDate} &nbsp;·&nbsp; Pre-read: CFO, CRO, CMO, CLO
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={s.headerBadge}>
            {fmtPct(fc.attainment_pct)} attainment
          </span>
          <button style={{ ...s.refreshBtn, borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)' }}
            onClick={fetchDigest}>
            Refresh
          </button>
        </div>
      </div>

      {/* Forecast snapshot */}
      <div style={s.forecastCard}>
        <div style={s.sectionLabel}>Forecast snapshot</div>
        <div style={s.forecastGrid}>
          {[
            { l: 'Total Q4 ATR',   v: fmtM(fc.total_q4_atr) },
            { l: 'Booked to date', v: fmtM(fc.booked_atr),     sub: fmtPct(fc.attainment_pct) },
            { l: 'Commit floor',   v: fmtM(fc.floor_atr),      sub: fmtPct(fc.floor_pct) + ' of ATR' },
            { l: 'Most Likely',    v: fmtM(fc.base_atr),       sub: fmtPct(fc.base_pct) + ' of ATR' },
            { l: 'Best Case',      v: fmtM(fc.ceiling_atr),    sub: fmtPct(fc.ceiling_pct) + ' of ATR' },
            { l: 'Weeks remaining', v: fc.weeks_remaining != null ? `~${fc.weeks_remaining}` : '—' },
          ].map(k => (
            <div key={k.l} style={s.kpi}>
              <div style={s.kpiLabel}>{k.l}</div>
              <div style={s.kpiValue}>{k.v}</div>
              {k.sub && <div style={s.kpiSub}>{k.sub}</div>}
            </div>
          ))}
        </div>
        {narrative.where_we_stand && (
          <div style={s.narrativeBox}>{narrative.where_we_stand}</div>
        )}
      </div>

      {/* Decision ask */}
      {digest.decision_ask_draft && (
        <DecisionAskSection
          draftAsk={digest.decision_ask_draft}
          weekDate={weekDate}
          inputs={inputs}
          onInputSubmitted={handleInputSubmitted}
          {...sharedFormProps}
        />
      )}

      {/* Account cards */}
      {accounts.length > 0 && (
        <div>
          <div style={{ ...s.sectionLabel, marginBottom: 14 }}>
            Accounts requiring input ({accounts.length})
          </div>
          {accounts.map((acct, i) => (
            <AccountCard
              key={acct.accountid || acct.account_name || i}
              acct={acct}
              inputs={inputs}
              weekDate={weekDate}
              onInputSubmitted={handleInputSubmitted}
              {...sharedFormProps}
            />
          ))}
        </div>
      )}

      {/* Overall read */}
      <OverallReadSection
        weekDate={weekDate}
        inputs={inputs}
        onInputSubmitted={handleInputSubmitted}
        {...sharedFormProps}
      />

    </div>
  );
}
