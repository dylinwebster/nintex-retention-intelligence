// ForecastCallScorecard.jsx  (v2 — dual ATR)
// Drop-in component for the Nintex Retention Intelligence Dashboard.
//
// USAGE:
//   import ForecastCallScorecard from './ForecastCallScorecard';
//   <ForecastCallScorecard data={forecastSummary} />
//
// PROPS:
//   data {object} — forecast_summary row from Vercel Blob.
//                   Matches column names from forecast_summary_query.sql v2.
//                   Pass null/undefined to show loading skeleton.
//
// WHAT'S NEW IN V2:
//   - Dual ATR toggle: RevOps (execution) vs Scheduled (GRR/contractual)
//   - ATR Gap explainer panel: shows pull-forward and push-out decomposition
//   - GRR scenario rows: shows implied GRR% at Commit / Most Likely / Best Case
//     on the Scheduled basis (what TPG actually evaluates)
//   - Both bases shown in collapsed summary bar for quick scanning
//
// Nintex brand tokens:
//   Navy #060D3F  Orange #F26522  Pink #F02D8A  Purple #7B3A9E

import { useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtM = n => n == null ? "—" : "$" + (n / 1_000_000).toFixed(1) + "M";
const fmtPct = n => n == null ? "—" : n.toFixed(1) + "%";
const fmtK = n => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return fmtM(n);
  return "$" + Math.round(n / 1_000).toLocaleString() + "K";
};
const fmtDate = d => {
  if (!d) return "—";
  const p = new Date(d);
  return isNaN(p) ? d : p.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function attainmentColor(pct) {
  if (pct == null) return "#888";
  if (pct >= 86) return "#1D9E75";
  if (pct >= 60) return "#D97706";
  return "#A32D2D";
}

function grrColor(pct) {
  if (pct == null) return "#888";
  if (pct >= 86) return "#1D9E75";
  if (pct >= 82.5) return "#D97706";
  return "#A32D2D";
}

function achievabilityStyle(code) {
  switch (code) {
    case "achievable":          return { bg: "#ECFDF5", text: "#166534", label: "Achievable at Best Case" };
    case "requires_most_likely":return { bg: "#FFFBEB", text: "#92400E", label: "Requires Most Likely" };
    default:                    return { bg: "#FEF2F2", text: "#991B1B", label: "Gap exceeds Best Case" };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "#888", marginBottom: 8,
      paddingBottom: 4, borderBottom: "1px solid #E5E7EB",
    }}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, valueColor, accent, wide }) {
  return (
    <div style={{
      background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 10,
      padding: "13px 15px",
      borderTop: accent ? `3px solid ${accent}` : "1px solid #E5E7EB",
      flex: wide ? "1 1 180px" : "1 1 130px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.07em", color: "#888", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700,
                    fontFamily: "'DM Mono','Courier New',monospace",
                    color: valueColor || "#060D3F", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, value, total, pct, color, targetPct, targetLabel }) {
  const ratio = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#374151" }}>
          {fmtM(value)} <span style={{ color: "#888" }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 6, background: "#F3F4F6", borderRadius: 4, overflow: "visible" }}>
        <div style={{ height: "100%", width: `${ratio * 100}%`, background: color,
                      borderRadius: 4, transition: "width 0.4s ease" }} />
        {targetPct != null && (
          <div style={{ position: "absolute", left: `${targetPct}%`, top: -3,
                        width: 2, height: 12, background: "#F02D8A", borderRadius: 1 }} />
        )}
      </div>
      {targetPct != null && (
        <div style={{ textAlign: "right", fontSize: 9, color: "#F02D8A",
                      fontWeight: 700, marginTop: 2 }}>
          {targetLabel}
        </div>
      )}
    </div>
  );
}

function ATRToggle({ value, onChange }) {
  return (
    <div style={{
      display: "inline-flex", background: "#F3F4F6", borderRadius: 8,
      padding: 3, gap: 3,
    }}>
      {[
        { key: "revops", label: "RevOps ATR", tip: "Execution basis: SFDC close date" },
        { key: "sched",  label: "Scheduled ATR", tip: "GRR basis: contractual renewal date" },
      ].map(opt => (
        <button
          key={opt.key}
          title={opt.tip}
          onClick={() => onChange(opt.key)}
          style={{
            padding: "4px 12px", border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: 11, fontWeight: 700, transition: "all .15s",
            background: value === opt.key ? "#060D3F" : "transparent",
            color: value === opt.key ? "#FFF" : "#6B7280",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ATR gap explainer panel — shown when user wants to understand the difference
function GapExplainer({ d }) {
  return (
    <div style={{
      background: "#F0EBF8", border: "1px solid #C4B5D8",
      borderRadius: 10, padding: "14px 16px", marginBottom: 18,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: "#7B3A9E", marginBottom: 10 }}>
        Why RevOps ATR ({fmtM(d.revops_total_atr)}) differs from Scheduled ATR ({fmtM(d.sched_total_atr)})
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          {
            label: "Pull-forwards into Q4",
            value: fmtM(d.pull_forward_atr),
            count: `${d.pull_forward_opp_count} opps`,
            sub: "Close date in Q4 but renewal date before Q4. These inflate RevOps ATR; they should not count toward Q4 GRR.",
            color: "#7B3A9E",
          },
          {
            label: "Pushed out of Q4",
            value: fmtM(d.pushed_out_atr),
            count: `${d.pushed_out_opp_count} opps`,
            sub: "Renewal date in Q4 but close date pushed beyond Q4. These reduce Scheduled ATR from a revops perspective.",
            color: "#D97706",
          },
          {
            label: "Missing renewal date",
            value: fmtM(d.missing_renew_date_atr),
            count: `${d.missing_renew_date_count} opps`,
            sub: "supposed_to_renew_date not populated. These land in RevOps ATR only and cannot be classified.",
            color: "#A32D2D",
          },
          {
            label: "Net ATR basis gap",
            value: fmtM(d.atr_basis_gap),
            count: "RevOps minus Scheduled",
            sub: "Should approximately equal pull-forwards minus push-outs. Residual is unexplained or date-classification variance.",
            color: "#060D3F",
          },
        ].map(item => (
          <div key={item.label} style={{
            flex: "1 1 160px", background: "#FFF",
            border: `1px solid ${item.color}22`,
            borderLeft: `3px solid ${item.color}`,
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                          color: item.color, letterSpacing: ".06em", marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700,
                          fontFamily: "'DM Mono',monospace", color: "#060D3F" }}>
              {item.value}
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 1, marginBottom: 5 }}>
              {item.count}
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4 }}>
              {item.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// GRR scenario table — scheduled basis only (what TPG evaluates)
function GRRScenarioTable({ d }) {
  const rows = [
    {
      label: "Commit floor",
      total: d.sched_commit_total,
      pct: d.sched_commit_pct,
      grr: d.sched_grr_at_commit,
      sub: "Highest confidence; Submitted + Stage 5",
    },
    {
      label: "Most Likely",
      total: d.sched_most_likely_total,
      pct: d.sched_most_likely_pct,
      grr: d.sched_grr_at_most_likely,
      sub: "Commit + Stage 4 – Negotiation",
    },
    {
      label: "Best Case",
      total: d.sched_best_case_total,
      pct: d.sched_best_case_pct,
      grr: d.sched_grr_at_best_case,
      sub: "Most Likely + Stage 3 – Contact Initiated",
    },
  ];
  return (
    <div style={{
      background: "#FFF", border: "1px solid #E5E7EB",
      borderRadius: 10, padding: "14px 16px", flex: "1 1 280px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: ".07em", color: "#888", marginBottom: 10 }}>
        Implied GRR · Scheduled ATR basis · TPG evaluation view
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <div style={{ flex: 2, fontSize: 9, color: "#888", fontWeight: 700 }}>SCENARIO</div>
        <div style={{ flex: 1, fontSize: 9, color: "#888", fontWeight: 700, textAlign: "right" }}>TOTAL</div>
        <div style={{ flex: 1, fontSize: 9, color: "#888", fontWeight: 700, textAlign: "right" }}>% ATR</div>
        <div style={{ flex: 1, fontSize: 9, color: "#888", fontWeight: 700, textAlign: "right" }}>GRR</div>
      </div>
      {/* Target row */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6, padding: "5px 0",
                    borderBottom: "1px dashed #E5E7EB" }}>
        <div style={{ flex: 2, fontSize: 11, color: "#F02D8A", fontWeight: 700 }}>86% GRR target</div>
        <div style={{ flex: 1, fontSize: 11, fontFamily: "'DM Mono',monospace",
                      color: "#F02D8A", textAlign: "right" }}>
          {fmtM(d.sched_arr_needed)}
        </div>
        <div style={{ flex: 1, fontSize: 11, fontFamily: "'DM Mono',monospace",
                      color: "#F02D8A", textAlign: "right" }}>86.0%</div>
        <div style={{ flex: 1, fontSize: 11, fontFamily: "'DM Mono',monospace",
                      color: "#F02D8A", textAlign: "right" }}>86.0%</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} style={{
          display: "flex", gap: 4, padding: "6px 0",
          borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none",
        }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#060D3F" }}>{r.label}</div>
            <div style={{ fontSize: 9, color: "#888" }}>{r.sub}</div>
          </div>
          <div style={{ flex: 1, fontSize: 12, fontFamily: "'DM Mono',monospace",
                        color: "#060D3F", textAlign: "right", fontWeight: 600 }}>
            {fmtM(r.total)}
          </div>
          <div style={{ flex: 1, fontSize: 12, fontFamily: "'DM Mono',monospace",
                        color: "#060D3F", textAlign: "right" }}>
            {fmtPct(r.pct)}
          </div>
          <div style={{ flex: 1, fontSize: 13, fontFamily: "'DM Mono',monospace",
                        fontWeight: 700, color: grrColor(r.grr), textAlign: "right" }}>
            {fmtPct(r.grr)}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 9, color: "#888" }}>
        Current Closed Won GRR: <strong style={{ color: grrColor(d.sched_won_pct) }}>{fmtPct(d.sched_won_pct)}</strong>
        {" "}· Pure GRR target: 82.5%
      </div>
    </div>
  );
}

function Skeleton() {
  const pulse = {
    background: "linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)",
    backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", borderRadius: 6,
  };
  return (
    <div style={{ padding: "20px 0" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ ...pulse, flex: 1, height: 80 }} />)}
      </div>
      <div style={{ ...pulse, height: 120, marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 10 }}>
        {[1,2,3].map(i => <div key={i} style={{ ...pulse, flex: 1, height: 70 }} />)}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ForecastCallScorecard({ data: d }) {
  const [expanded, setExpanded]       = useState(true);
  const [atrBasis, setAtrBasis]       = useState("revops"); // "revops" | "sched"
  const [showGapExplainer, setShowGap]= useState(false);

  if (!d) return <Skeleton />;

  // Select the right set of fields based on toggle
  const isRevOps = atrBasis === "revops";
  const totalAtr        = isRevOps ? d.revops_total_atr        : d.sched_total_atr;
  const closedWon       = isRevOps ? d.revops_closed_won       : d.sched_closed_won;
  const closedLost      = isRevOps ? d.revops_closed_lost      : d.sched_closed_lost;
  const submitted       = isRevOps ? d.revops_submitted        : d.sched_submitted;
  const openAtr         = isRevOps ? d.revops_open             : d.sched_open;
  const bookedTotal     = isRevOps ? d.revops_booked_total     : d.sched_booked_total;
  const commitTotal     = isRevOps ? d.revops_commit_total     : d.sched_commit_total;
  const mlTotal         = isRevOps ? d.revops_most_likely_total: d.sched_most_likely_total;
  const bcTotal         = isRevOps ? d.revops_best_case_total  : d.sched_best_case_total;
  const wonPct          = isRevOps ? d.revops_won_pct          : d.sched_won_pct;
  const bookedPct       = isRevOps ? d.revops_booked_pct       : d.sched_booked_pct;
  const commitPct       = isRevOps ? d.revops_commit_pct       : d.sched_commit_pct;
  const mlPct           = isRevOps ? d.revops_most_likely_pct  : d.sched_most_likely_pct;
  const bcPct           = isRevOps ? d.revops_best_case_pct    : d.sched_best_case_pct;
  const arrNeeded       = isRevOps ? d.revops_arr_needed       : d.sched_arr_needed;
  const gapToTarget     = isRevOps ? d.revops_gap_to_target    : d.sched_gap_to_target;
  const weeklyRate      = isRevOps ? d.revops_weekly_rate_needed : d.sched_weekly_rate_needed;
  const achievability   = isRevOps ? d.revops_grr_achievability  : d.sched_grr_achievability;
  const atRiskOpen      = isRevOps ? d.revops_at_risk_open     : null;

  const ach = achievabilityStyle(achievability);
  const weeklyBestCase = d.weeks_remaining_in_q4 > 0
    ? (bcTotal - closedWon) / d.weeks_remaining_in_q4
    : null;

  return (
    <div style={{
      background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12,
      padding: "16px 20px", marginBottom: 20,
      fontFamily: "Aptos, Calibri, Arial, sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: expanded ? 16 : 0, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#060D3F" }}>
            Q4 FY26 Forecast Call
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                         borderRadius: 20, background: ach.bg, color: ach.text }}>
            {ach.label}
          </span>
          {d.divergence_count > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                           borderRadius: 20, background: "#FEF9C3", color: "#854D0E" }}>
              {d.divergence_count} SFDC/Finance divergences
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "#888" }}>
            {fmtDate(d.pipeline_snapshot_date)} · {d.weeks_remaining_in_q4} wks remaining
          </span>
          <span style={{ fontSize: 11, color: "#6B7280", cursor: "pointer" }}
                onClick={() => setExpanded(e => !e)}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── Collapsed one-liner ── */}
      {!expanded && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingTop: 4 }}>
          {[
            { label: "RevOps ATR", v: fmtM(d.revops_total_atr) },
            { label: "Scheduled ATR", v: fmtM(d.sched_total_atr), note: "GRR basis" },
            { label: "Closed Won", v: fmtM(d.revops_closed_won), color: "#1D9E75" },
            { label: "Most Likely", v: fmtM(d.revops_most_likely_total) + " (" + fmtPct(d.revops_most_likely_pct) + " RevOps)" },
            { label: "Sched GRR @ ML", v: fmtPct(d.sched_grr_at_most_likely), color: grrColor(d.sched_grr_at_most_likely) },
            { label: "Gap (Sched)", v: fmtM(d.sched_gap_to_target), color: "#A32D2D" },
          ].map(item => (
            <div key={item.label} style={{ fontSize: 11 }}>
              <span style={{ color: "#888", marginRight: 4 }}>{item.label}:</span>
              <span style={{ fontWeight: 700, color: item.color || "#060D3F",
                             fontFamily: "'DM Mono',monospace" }}>{item.v}</span>
              {item.note && <span style={{ fontSize: 9, color: "#888", marginLeft: 4 }}>({item.note})</span>}
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <>
          {/* ── ATR basis toggle + gap explainer trigger ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <ATRToggle value={atrBasis} onChange={setAtrBasis} />
            <button
              onClick={() => setShowGap(g => !g)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "4px 12px",
                border: "1px solid #C4B5D8", borderRadius: 6, cursor: "pointer",
                background: showGapExplainer ? "#7B3A9E" : "#FFF",
                color: showGapExplainer ? "#FFF" : "#7B3A9E", transition: "all .15s",
              }}
            >
              {showGapExplainer ? "Hide" : "Explain"} ATR gap ({fmtM(d.atr_basis_gap)})
            </button>
            <span style={{ fontSize: 10, color: "#888" }}>
              {isRevOps
                ? "RevOps: execution basis · SFDC close date · includes pull-forwards · quota denominator"
                : "Scheduled: contractual basis · renewal date · excludes pull-forwards · GRR denominator"}
            </span>
          </div>

          {/* ── Gap explainer (conditional) ── */}
          {showGapExplainer && <GapExplainer d={d} />}

          {/* ── Row 1: ATR KPIs ── */}
          <SectionHeader>
            {isRevOps ? "RevOps ATR denominator · execution close date basis" : "Scheduled ATR denominator · contractual renewal date basis (GRR)"}
          </SectionHeader>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <KpiCard
              label={isRevOps ? "Total RevOps ATR" : "Total Scheduled ATR"}
              value={fmtM(totalAtr)}
              sub={`${d.total_accounts?.toLocaleString() ?? "—"} accounts`}
              accent="#060D3F" wide
            />
            <KpiCard label="Closed Won" value={fmtM(closedWon)}
              sub={`${fmtPct(wonPct)} of ATR`}
              valueColor={attainmentColor(wonPct)} accent="#1D9E75" />
            <KpiCard label="Submitted for Booking" value={fmtM(submitted)}
              sub="Near-certain; pending processing" accent="#7B3A9E" />
            <KpiCard label="Booked Total" value={fmtM(bookedTotal)}
              sub={`${fmtPct(bookedPct)} of ATR (Won + Submitted)`}
              valueColor={attainmentColor(bookedPct)} accent="#F26522" />
            <KpiCard label="Confirmed Churn" value={fmtM(closedLost)}
              sub="Closed Lost" valueColor="#A32D2D" accent="#A32D2D" />
            <KpiCard label="Still Open" value={fmtM(openAtr)}
              sub={atRiskOpen != null ? `${fmtM(atRiskOpen)} flagged at-risk` : ""}
              accent="#D97706" />
          </div>

          {/* ── Row 2: Forecast scenarios + progress bars ── */}
          <SectionHeader>Forecast scenarios · cumulative · {isRevOps ? "RevOps" : "Scheduled"} ATR basis</SectionHeader>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>

            {/* Scenario cards */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Commit Floor", value: fmtM(commitTotal), pct: fmtPct(commitPct),
                  sub: "Won + Stage 5 + Submitted", accent: "#7B3A9E" },
                { label: "Most Likely",  value: fmtM(mlTotal),     pct: fmtPct(mlPct),
                  sub: "Commit + Stage 4", accent: "#F26522" },
                { label: "Best Case",    value: fmtM(bcTotal),     pct: fmtPct(bcPct),
                  sub: "Most Likely + Stage 3", accent: "#1D9E75" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#FFF", border: "1px solid #E5E7EB",
                  borderTop: `3px solid ${s.accent}`,
                  borderRadius: 10, padding: "13px 15px", minWidth: 140, flex: "1 1 140px",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                                letterSpacing: ".07em", color: "#888", marginBottom: 3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 700,
                                fontFamily: "'DM Mono',monospace", color: "#060D3F", lineHeight: 1.1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.accent, marginTop: 2 }}>
                    {s.pct} of ATR
                  </div>
                  <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Progress bars */}
            <div style={{ flex: "1 1 250px", background: "#FFF", border: "1px solid #E5E7EB",
                          borderRadius: 10, padding: "13px 15px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: ".07em", color: "#888", marginBottom: 10 }}>
                Attainment vs {fmtM(totalAtr)} {isRevOps ? "RevOps" : "Scheduled"} ATR
              </div>
              <ProgressBar label="Closed Won"    value={closedWon}  total={totalAtr} pct={fmtPct(wonPct)}    color="#1D9E75" />
              <ProgressBar label="Commit Floor"  value={commitTotal} total={totalAtr} pct={fmtPct(commitPct)} color="#7B3A9E" />
              <ProgressBar label="Most Likely"   value={mlTotal}    total={totalAtr} pct={fmtPct(mlPct)}    color="#F26522" />
              <ProgressBar label="Best Case"     value={bcTotal}    total={totalAtr} pct={fmtPct(bcPct)}    color="#1D9E75"
                targetPct={d.grr_target_pct} targetLabel={`${d.grr_target_pct}% GRR target = ${fmtM(arrNeeded)}`} />
            </div>
          </div>

          {/* ── Row 3: GRR scenario table (Scheduled) + GRR gap cards ── */}
          <SectionHeader>
            GRR gap to {d.grr_target_pct}% target · {isRevOps ? "RevOps" : "Scheduled"} basis ·
            {" "}GRR scenario table always on Scheduled (TPG evaluation view)
          </SectionHeader>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 0 }}>

            {/* GRR scenario table — always Scheduled */}
            <GRRScenarioTable d={d} />

            {/* GRR gap cards */}
            <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 10 }}>
              <KpiCard
                label={`ARR Needed (${d.grr_target_pct}% GRR · ${isRevOps ? "RevOps" : "Scheduled"})`}
                value={fmtM(arrNeeded)}
                sub={`${d.grr_target_pct}% × ${fmtM(totalAtr)}`}
                accent="#060D3F"
              />
              <KpiCard label="Gap to Close" value={fmtM(gapToTarget)}
                sub={`From ${fmtM(openAtr)} open ATR · ${d.weeks_remaining_in_q4} wks remaining`}
                valueColor="#A32D2D" accent="#A32D2D" />
              <KpiCard label="Wkly Run Rate Needed" value={fmtK(weeklyRate)}
                sub={`To close gap on ${isRevOps ? "RevOps" : "Scheduled"} basis`}
                valueColor={weeklyRate > 3_000_000 ? "#A32D2D" : "#D97706"} accent="#7B3A9E" />
              <KpiCard label="Best Case Wkly Capacity" value={fmtK(weeklyBestCase)}
                sub="(Best Case remaining) ÷ weeks left" accent="#1D9E75" />
            </div>
          </div>

          {/* ── Data quality footnote ── */}
          <div style={{
            marginTop: 14, padding: "8px 12px",
            background: d.divergence_count > 0 ? "#FFFBEB" : "#F9FAFB",
            border: `1px solid ${d.divergence_count > 0 ? "#FCD34D" : "#E5E7EB"}`,
            borderRadius: 8, fontSize: 10, color: "#6B7280",
          }}>
            <strong>Data quality:</strong> ATR uses <code>revenue_renewal_usd</code> from{" "}
            <code>finance.salesforce_data</code>.
            RevOps ATR = close_date in Q4. Scheduled ATR = supposed_to_renew_date in Q4.
            {d.missing_renew_date_count > 0 &&
              ` ${d.missing_renew_date_count} opps (${fmtM(d.missing_renew_date_atr)}) are missing supposed_to_renew_date and appear in RevOps ATR only.`}
            {d.divergence_count > 0 &&
              ` ${d.divergence_count} accounts show >10% SFDC/Finance ARR divergence.`}
            {" "}Post-CPQ migration caveat: renewal revenue may appear under different opp IDs.
            GRR target: {d.grr_target_pct}% (GRR + price increase). Pure GRR target: {d.grr_pure_target_pct}%.
          </div>
        </>
      )}
    </div>
  );
}
