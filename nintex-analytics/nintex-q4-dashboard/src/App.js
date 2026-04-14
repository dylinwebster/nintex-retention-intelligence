import { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, CartesianGrid,
} from 'recharts'

const DATA_URL = '/api/data'

function PasswordGate({onUnlock}){
  const [input,setInput]=useState('')
  const [err,setErr]=useState(false)
  const submit=()=>{
    if(input===import.meta.env.VITE_APP_PASSWORD){
      sessionStorage.setItem('nx_auth','1'); onUnlock()
    } else { setErr(true); setInput(''); setTimeout(()=>setErr(false),2000) }
  }
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F2F4F9',flexDirection:'column',gap:24}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontWeight:800,fontSize:20,background:'linear-gradient(135deg,#F26522,#F02D8A)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:6}}>nintex</div>
        <div style={{fontWeight:700,fontSize:15,color:'#060D3F'}}>Q4 FY26 · Renewal Intelligence</div>
        <div style={{fontSize:12,color:'#64748B',marginTop:4}}>Enter password to continue</div>
      </div>
      <div style={{background:'#fff',border:`1px solid ${err?'#DC2626':'#E2E8F0'}`,borderRadius:12,padding:'28px 32px',width:320,boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <input type="password" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Password" autoFocus style={{width:'100%',padding:'10px 14px',borderRadius:8,border:`1.5px solid ${err?'#DC2626':'#E2E8F0'}`,fontSize:13,color:'#060D3F',outline:'none',marginBottom:12,fontFamily:'Plus Jakarta Sans,sans-serif',boxSizing:'border-box'}}/>
        {err&&<div style={{fontSize:11,color:'#DC2626',marginBottom:10,textAlign:'center'}}>Incorrect password</div>}
        <button onClick={submit} style={{width:'100%',padding:'10px',borderRadius:8,background:'linear-gradient(135deg,#F26522,#F02D8A)',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>Sign In</button>
      </div>
    </div>
  )
}

// ─── Brand (Light Theme) ──────────────────────────────────────────────────────
const B = {
  navy:    '#060D3F',
  orange:  '#F26522',
  pink:    '#F02D8A',
  purple:  '#7B3A9E',
  green:   '#16A34A',
  amber:   '#D97706',
  red:     '#DC2626',
  bg:      '#F2F4F9',
  card:    '#FFFFFF',
  border:  '#E2E8F0',
  borderMd:'#CBD5E1',
  text:    '#060D3F',
  textMd:  '#334155',
  muted:   '#64748B',
  faint:   '#F8FAFC',
}

const fM   = v => v == null ? '—' : `$${(Math.abs(v)/1e6).toFixed(1)}M`
const fK   = v => v == null ? '—' : Math.abs(v)>=1e6 ? `$${(Math.abs(v)/1e6).toFixed(1)}M` : `$${(Math.abs(v)/1e3).toFixed(0)}K`
const fD   = v => v ? new Date(v+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'
const fQtr = (fy,q) => `FY${String(fy).slice(-2)} Q${q}`
const mono = {fontFamily:"'JetBrains Mono',monospace"}

const riskCol  = r => ({Churn:B.pink,Downsell:B.orange,Late:B.amber}[r]||B.muted)
const crnCol   = c => ({Red:B.red,Yellow:B.amber,Green:B.green}[c]||B.muted)
const stageCol = s => {
  if(!s) return B.muted
  if(s==='At Risk') return B.pink
  if(s.includes('Closing')||s.includes('Booking')) return B.orange
  if(s.includes('Negotiation')) return B.amber
  if(s.includes('Won')) return B.green
  if(s.includes('Lost')) return '#94A3B8'
  return B.purple
}

const closeMonth = d => d ? d.slice(0,7) : null
const MONTHS = [{key:'all',label:'All Months'},{key:'2026-04',label:'April'},{key:'2026-05',label:'May'},{key:'2026-06',label:'June'}]

// ─── Shared ATR diff cell renderer ───────────────────────────────────────────
// atr: what we expect the deal to close at
// arr: current ARR from account_dimensions
// green if atr > arr by >$500, red if atr < arr by >$500, muted otherwise
function AtrDiffCells({atr, arr}) {
  const diff = arr != null ? (atr || 0) - arr : null
  const col = diff == null ? B.muted : diff > 500 ? B.green : diff < -500 ? B.red : B.muted
  return (
    <>
      <TD right isMono>{arr != null ? fK(arr) : '—'}</TD>
      <TD right isMono color={col}>{diff != null ? (diff > 500 ? '+' : '') + fK(diff) : '—'}</TD>
    </>
  )
}

function exportCSV(rows, filename) {
  if(!rows.length) return
  const cols = Object.keys(rows[0])
  const csv = [cols.join(','),...rows.map(r=>cols.map(c=>{const v=r[c]??'';return typeof v==='string'&&v.includes(',') ? `"${v}"`:v}).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
  a.download = filename; a.click()
}

function buildSystemPrompt(data) {
  const openATR   = data.pipeline_summary.filter(r=>r.stage_group==='Open').reduce((s,r)=>s+(r.total_atr||0),0)
  const atRiskATR = data.pipeline_summary.filter(r=>r.stage==='At Risk').reduce((s,r)=>s+(r.total_atr||0),0)
  const commitATR = data.pipeline_summary.filter(r=>r.forecast_category==='Commit'&&r.stage_group==='Open').reduce((s,r)=>s+(r.total_atr||0),0)
  const wonATR    = data.pipeline_summary.filter(r=>r.stage_group==='Won').reduce((s,r)=>s+(r.total_atr||0),0)
  const topAtRisk = [...data.at_risk].filter(r=>r.at_risk_type).sort((a,b)=>(b.atr_proxy_usd||0)-(a.atr_proxy_usd||0)).slice(0,40)
  return `You are a retention analytics assistant for Dylin Webster, VP of Customer Success at Nintex.
Nintex is under TPG private equity ownership. TPG GRR target: 91% annualized. FY ends June 30. Q4 FY26 = April 1 to June 30 2026.
Data refreshed: ${data.generated_at}

KEY CONTEXT:
- SFDC CPQ migration causes ARR divergence artifacts; >10% divergence is expected not always real
- GRR = compounded trailing 4Q, not averaged
- $100K+ accounts only tier generating net-positive quarterly economics
- pipeline_create_close_history has 209 snapshots back to Sep 2023

PIPELINE SNAPSHOT:
Open ATR: $${(openATR/1e6).toFixed(1)}M | At Risk Stage: $${(atRiskATR/1e6).toFixed(1)}M | Commit: $${(commitATR/1e6).toFixed(1)}M | Won: $${(wonATR/1e6).toFixed(1)}M

PIPELINE BY STAGE:
${JSON.stringify(data.pipeline_summary,null,2)}

WATERFALL (8Q):
${JSON.stringify(data.waterfall,null,2)}

TOP AT-RISK (Churn/Downsell flagged, top 40 by ATR):
${JSON.stringify(topAtRisk,null,2)}

WoW MOVEMENTS (${data.wow_movement.length} accounts):
${JSON.stringify(data.wow_movement,null,2)}

TOP 50 ACCOUNTS BY ARR:
${JSON.stringify(data.top_accounts,null,2)}

PRODUCT ARR FY26 Q3:
${JSON.stringify((data.product_arr||[]).filter(r=>r.FiscalYear===2026&&r.QuarterOfYear===3),null,2)}

Be direct, use specific data points. No em dashes. Flag data quality issues explicitly.`
}

// ─── Shared components ────────────────────────────────────────────────────────
const cardStyle = {background:B.card,border:`1px solid ${B.border}`,borderRadius:10,padding:'18px 20px'}

const Badge = ({label,color}) => (
  <span style={{display:'inline-block',padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:600,background:color+'18',color,border:`1px solid ${color}40`}}>{label}</span>
)
const Dot = ({color,size=7}) => (
  <span style={{display:'inline-block',width:size,height:size,borderRadius:'50%',background:color,marginRight:5,flexShrink:0,verticalAlign:'middle'}}/>
)
const KPI = ({label,value,sub,accent=B.purple}) => (
  <div style={{...cardStyle,borderTop:`3px solid ${accent}`,minWidth:140}}>
    <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:B.muted,marginBottom:4}}>{label}</div>
    <div style={{...mono,fontSize:22,fontWeight:700,color:B.navy,lineHeight:1.1}}>{value}</div>
    {sub && <div style={{fontSize:11,color:B.muted,marginTop:3}}>{sub}</div>}
  </div>
)
const ExportBtn = ({onClick}) => (
  <button onClick={onClick} style={{padding:'6px 14px',borderRadius:6,border:`1px solid ${B.border}`,background:B.card,color:B.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>↓ Export CSV</button>
)

function useSortState(defaultCol,defaultDir='desc'){
  const [col,setCol]=useState(defaultCol)
  const [dir,setDir]=useState(defaultDir)
  const toggle=c=>{if(col===c)setDir(d=>d==='desc'?'asc':'desc');else{setCol(c);setDir('desc')}}
  return {col,dir,toggle}
}

const SortTH = ({children,col,ss,right,width}) => (
  <th onClick={()=>ss.toggle(col)} style={{padding:'9px 12px',textAlign:right?'right':'left',fontSize:11,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',color:ss.col===col?B.orange:B.muted,borderBottom:`2px solid ${B.border}`,cursor:'pointer',whiteSpace:'nowrap',userSelect:'none',background:B.faint,width:width||'auto'}}>
    {children} {ss.col===col?(ss.dir==='desc'?'↓':'↑'):<span style={{opacity:0.25}}>↕</span>}
  </th>
)
const TH = ({children,right,width}) => (
  <th style={{padding:'9px 12px',textAlign:right?'right':'left',fontSize:11,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',color:B.muted,borderBottom:`2px solid ${B.border}`,whiteSpace:'nowrap',background:B.faint,width:width||'auto'}}>{children}</th>
)
const TD = ({children,right,isMono,small,color,bold,title,maxW}) => (
  <td title={title} style={{padding:'8px 12px',textAlign:right?'right':'left',fontSize:small?11:12,color:color||B.textMd,borderBottom:`1px solid ${B.border}`,fontFamily:isMono?'JetBrains Mono,monospace':'inherit',fontWeight:bold?600:400,...(maxW?{maxWidth:maxW,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}:{})}}>{children}</td>
)

const ChartTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null
  return (
    <div style={{background:B.card,border:`1px solid ${B.borderMd}`,borderRadius:8,padding:'10px 14px',fontSize:12,boxShadow:'0 4px 16px rgba(0,0,0,0.1)'}}>
      <div style={{color:B.muted,marginBottom:6,fontSize:11,fontWeight:600}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
          <Dot color={p.color||p.fill} size={6}/>
          <span style={{color:B.muted,marginRight:4}}>{p.name}:</span>
          <span style={{...mono,color:B.navy,fontWeight:600}}>{fM(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const Pager = ({page,setPage,total,per}) => {
  const pages=Math.ceil(total/per)
  const btn=(label,disabled,onClick)=>(
    <button onClick={onClick} disabled={disabled} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${B.border}`,background:disabled?B.faint:B.card,color:disabled?B.muted:B.text,fontSize:11,cursor:disabled?'default':'pointer'}}>{label}</button>
  )
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:`1px solid ${B.border}`}}>
      <span style={{fontSize:11,color:B.muted}}>{total} records · page {page+1} of {pages}</span>
      <div style={{display:'flex',gap:6}}>
        {btn('← Prev',page===0,()=>setPage(p=>Math.max(0,p-1)))}
        {btn('Next →',page>=pages-1,()=>setPage(p=>Math.min(pages-1,p+1)))}
      </div>
    </div>
  )
}

const FilterPills = ({value,onChange,options}) => (
  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
    {options.map(o=>(
      <button key={o.key} onClick={()=>onChange(o.key)} style={{padding:'4px 12px',borderRadius:100,border:`1.5px solid ${value===o.key?B.orange:B.border}`,background:value===o.key?B.orange+'18':B.card,color:value===o.key?B.orange:B.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>{o.label}</button>
    ))}
  </div>
)

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────
function PipelineTab({data}){
  const s=data.pipeline_summary
  const ss=useSortState('total_atr')
  const openATR  =s.filter(r=>r.stage_group==='Open').reduce((a,r)=>a+r.total_atr,0)
  const wonATR   =s.filter(r=>r.stage_group==='Won').reduce((a,r)=>a+r.total_atr,0)
  const lostATR  =s.filter(r=>r.stage==='Closed Lost').reduce((a,r)=>a+r.total_atr,0)
  const atRisk   =s.filter(r=>r.stage==='At Risk').reduce((a,r)=>a+r.total_atr,0)
  const commit   =s.filter(r=>r.forecast_category==='Commit'&&r.stage_group==='Open').reduce((a,r)=>a+r.total_atr,0)

  const chartData = Object.values(
    s.filter(r=>r.stage_group==='Open').reduce((acc,r)=>{
      if(!acc[r.stage]) acc[r.stage]={stage:r.stage,atr:0}
      acc[r.stage].atr+=r.total_atr; return acc
    },{})
  ).filter(r=>r.atr>50000).sort((a,b)=>b.atr-a.atr)

  const sorted=[...s].sort((a,b)=>{const av=a[ss.col]??0,bv=b[ss.col]??0;return ss.dir==='desc'?bv-av:av-bv})

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Open Pipeline ATR" value={fM(openATR)} accent={B.purple}/>
        <KPI label="Commit Forecast" value={fM(commit)} accent={B.orange}/>
        <KPI label="At Risk Stage" value={fM(atRisk)} accent={B.pink}/>
        <KPI label="Already Won" value={fM(wonATR)} accent={B.green}/>
        <KPI label="Closed Lost" value={fM(lostATR)} accent={B.muted}/>
      </div>
      <div style={cardStyle}>
        <div style={{marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:B.navy}}>Open ATR by Stage</div>
          <div style={{fontSize:11,color:B.muted,marginTop:2}}>Aggregated by stage name · stages &gt; $50K ATR</div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(180,chartData.length*38)}>
          <BarChart data={chartData} layout="vertical" margin={{left:0,right:80,top:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={B.border} horizontal={false}/>
            <XAxis type="number" tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fontSize:11,fill:B.muted,fontFamily:'JetBrains Mono'}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="stage" width={190} tick={{fontSize:11,fill:B.textMd}} axisLine={false} tickLine={false}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="atr" radius={[0,4,4,0]} maxBarSize={22} label={{position:'right',formatter:v=>fM(v),fontSize:11,fill:B.muted,fontFamily:'JetBrains Mono'}}>
              {chartData.map((e,i)=><Cell key={i} fill={stageCol(e.stage)}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:B.navy}}>Full Pipeline Breakdown</div>
          <ExportBtn onClick={()=>exportCSV(s,'q4_pipeline.csv')}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <SortTH col="stage" ss={ss}>Stage</SortTH>
              <TH>Group</TH><TH>Forecast</TH>
              <SortTH col="account_count" ss={ss} right>Accounts</SortTH>
              <SortTH col="opp_count" ss={ss} right>Opps</SortTH>
              <SortTH col="total_atr" ss={ss} right>Total ATR</SortTH>
            </tr></thead>
            <tbody>{sorted.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?B.card:B.faint}}>
                <TD><Dot color={stageCol(r.stage)}/>{r.stage}</TD>
                <TD small>{r.stage_group}</TD>
                <TD small>{r.forecast_category}</TD>
                <TD right isMono>{r.account_count}</TD>
                <TD right isMono>{r.opp_count}</TD>
                <TD right isMono bold color={B.navy}>{fM(r.total_atr)}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Waterfall Tab ────────────────────────────────────────────────────────────
function WaterfallTab({data}){
  const wf=data.waterfall.map((r,i,arr)=>{
    const begin=i===0
      ? r.ending_arr-(r.churn||0)-(r.downsell||0)-(r.expansion||0)-(r.new_logo||0)
      : arr[i-1].ending_arr
    return {label:fQtr(r.FiscalYear,r.QuarterOfYear),beginning:begin,ending:r.ending_arr,churn:r.churn||0,downsell:r.downsell||0,expansion:r.expansion||0,new_logo:r.new_logo||0,net:(r.churn||0)+(r.downsell||0)+(r.expansion||0)+(r.new_logo||0),partial:i===arr.length-1}
  })
  const chart=wf.map(r=>({label:r.label,Churn:Math.abs(r.churn),Downsell:Math.abs(r.downsell),Expansion:r.expansion,'New Logo':r.new_logo,'Ending ARR':r.ending}))
  const last=wf[wf.length-1]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Q4 Ending ARR (partial)" value={fM(last.ending)} accent={B.purple} sub="As of data refresh"/>
        <KPI label="Q4 Churn" value={last.churn!==0?fM(last.churn):'—'} accent={B.pink}/>
        <KPI label="Q4 Downsell" value={fM(last.downsell)} accent={B.orange}/>
        <KPI label="Q4 Expansion" value={fM(last.expansion)} accent={B.green}/>
        <KPI label="Q4 New Logo" value={last.new_logo!==0?fM(last.new_logo):'—'} accent={B.amber}/>
      </div>
      <div style={cardStyle}>
        <div style={{marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:B.navy}}>Trailing 8Q ARR Movement</div>
          <div style={{fontSize:11,color:B.muted,marginTop:2}}>Churn and downsell as absolute values · Ending ARR on right axis (navy line)</div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chart} margin={{top:10,right:70,bottom:0,left:10}}>
            <CartesianGrid strokeDasharray="3 3" stroke={B.border} vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:B.muted}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="left" tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fontSize:10,fill:B.muted,...mono}} axisLine={false} tickLine={false} width={52}/>
            <YAxis yAxisId="right" orientation="right" tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fontSize:10,fill:B.muted,...mono}} axisLine={false} tickLine={false} width={60} domain={['dataMin - 10000000','dataMax + 10000000']}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar yAxisId="left" dataKey="Churn"    fill={B.pink}   fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={26}/>
            <Bar yAxisId="left" dataKey="Downsell" fill={B.orange} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={26}/>
            <Bar yAxisId="left" dataKey="Expansion" fill={B.green} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={26}/>
            <Bar yAxisId="left" dataKey="New Logo" fill={B.purple} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={26}/>
            <Line yAxisId="right" type="monotone" dataKey="Ending ARR" stroke={B.navy} strokeWidth={2.5} dot={{r:4,fill:B.navy,strokeWidth:0}}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:B.navy}}>8Q Detail Table</div>
          <ExportBtn onClick={()=>exportCSV(wf,'q4_waterfall.csv')}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <TH>Quarter</TH><TH right>Beginning ARR</TH><TH right>Churn</TH><TH right>Downsell</TH><TH right>Expansion</TH><TH right>New Logo</TH><TH right>Net Change</TH><TH right>Ending ARR</TH>
            </tr></thead>
            <tbody>{wf.map((r,i)=>(
              <tr key={i} style={{background:r.partial?'#FFF7ED':i%2===0?B.card:B.faint}}>
                <TD bold={r.partial} color={r.partial?B.orange:B.navy}>{r.label}{r.partial?' *':''}</TD>
                <TD right isMono>{fM(r.beginning)}</TD>
                <TD right isMono color={r.churn<0?B.pink:B.muted}>{r.churn!==0?fM(r.churn):'—'}</TD>
                <TD right isMono color={r.downsell<0?B.orange:B.muted}>{r.downsell!==0?fM(r.downsell):'—'}</TD>
                <TD right isMono color={r.expansion>0?B.green:B.muted}>{r.expansion!==0?fM(r.expansion):'—'}</TD>
                <TD right isMono color={r.new_logo>0?B.amber:B.muted}>{r.new_logo!==0?fM(r.new_logo):'—'}</TD>
                <TD right isMono bold color={r.net>=0?B.green:B.pink}>{fM(r.net)}</TD>
                <TD right isMono bold color={B.navy}>{fM(r.ending)}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{fontSize:10,color:B.muted,marginTop:8}}>* Q4 partial: churn and new logo not yet complete.</div>
      </div>
    </div>
  )
}

// ─── At-Risk Tab ──────────────────────────────────────────────────────────────
function AtRiskTab({data}){
  const ss=useSortState('atr_proxy_usd')
  const [page,setPage]=useState(0)
  const [month,setMonth]=useState('all')
  const [risk,setRisk]=useState('all')
  const PER=25

  const arrByAccount=useMemo(()=>{
    const m={}
    ;(data.account_dimensions||[]).forEach(r=>{if(r.accountid)m[r.accountid]=r.current_arr})
    return m
  },[data])

  const filtered=useMemo(()=>data.at_risk.filter(r=>{
    const mOk=month==='all'||closeMonth(r.close_date)===month
    const rOk=risk==='all'||r.at_risk_type===risk
    return mOk&&rOk
  }),[data,month,risk])

  const sorted=useMemo(()=>[...filtered].sort((a,b)=>{
    const av=a[ss.col]??'',bv=b[ss.col]??''
    if(typeof av==='number') return ss.dir==='desc'?bv-av:av-bv
    return ss.dir==='desc'?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv))
  }),[filtered,ss.col,ss.dir])

  const churnATR   =filtered.filter(r=>r.at_risk_type==='Churn').reduce((s,r)=>s+(r.atr_proxy_usd||0),0)
  const downsellATR=filtered.filter(r=>r.at_risk_type==='Downsell').reduce((s,r)=>s+(r.atr_proxy_usd||0),0)
  const stageATR   =filtered.filter(r=>r.stage==='At Risk').reduce((s,r)=>s+(r.atr_proxy_usd||0),0)
  const pageData   =sorted.slice(page*PER,(page+1)*PER)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Showing" value={filtered.length} sub={`of ${data.at_risk.length} total`} accent={B.purple}/>
        <KPI label="At Risk Stage ATR" value={fM(stageATR)} accent={B.pink}/>
        <KPI label="Churn Flagged ATR" value={fM(churnATR)} accent={B.pink}/>
        <KPI label="Downsell Flagged ATR" value={fM(downsellATR)} accent={B.orange}/>
      </div>
      <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>Close Month:</span>
          <FilterPills value={month} onChange={v=>{setMonth(v);setPage(0)}} options={MONTHS}/>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>Risk:</span>
          <FilterPills value={risk} onChange={v=>{setRisk(v);setPage(0)}} options={[{key:'all',label:'All'},{key:'Churn',label:'Churn'},{key:'Downsell',label:'Downsell'},{key:'Late',label:'Late'}]}/>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <ExportBtn onClick={()=>exportCSV(sorted,'q4_at_risk.csv')}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <SortTH col="account_name" ss={ss} width={170}>Account</SortTH>
              <SortTH col="atr_proxy_usd" ss={ss} right>ATR</SortTH>
              <TH right>Curr ARR</TH>
              <TH right>Diff</TH>
              <SortTH col="product_l2" ss={ss}>Product</SortTH>
              <SortTH col="stage" ss={ss}>Stage</SortTH>
              <SortTH col="at_risk_type" ss={ss}>Risk</SortTH>
              <SortTH col="churn_risk_renewal" ss={ss}>CRN</SortTH>
              <SortTH col="close_date" ss={ss}>Close</SortTH>
              <SortTH col="arr_divergence_pct" ss={ss} right>Div%</SortTH>
            </tr></thead>
            <tbody>{pageData.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?B.card:B.faint,opacity:r.arr_divergence_pct>200?0.6:1}}>
                <TD maxW={170} bold color={B.navy} title={r.account_name||r.accountid}>{r.account_name||r.accountid?.slice(-8)||'—'}</TD>
                <TD right isMono bold color={B.navy}>{fK(r.atr_proxy_usd)}</TD>
                <AtrDiffCells atr={r.atr_proxy_usd} arr={arrByAccount[r.accountid]}/>
                <TD small>{r.product_l2}</TD>
                <TD><Dot color={stageCol(r.stage)}/><span style={{fontSize:11}}>{r.stage}</span></TD>
                <TD>{r.at_risk_type?<Badge label={r.at_risk_type} color={riskCol(r.at_risk_type)}/>:<span style={{color:B.muted,fontSize:11}}>—</span>}</TD>
                <TD><Dot color={crnCol(r.churn_risk_renewal)}/><span style={{fontSize:11,color:crnCol(r.churn_risk_renewal)}}>{r.churn_risk_renewal||'—'}</span></TD>
                <TD isMono small>{fD(r.close_date)}</TD>
                <TD right isMono><span style={{color:r.arr_divergence_pct>100?B.red:r.arr_divergence_pct>10?B.amber:B.muted}}>{r.arr_divergence_pct!=null?`${r.arr_divergence_pct}%`:'—'}</span></TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <Pager page={page} setPage={setPage} total={sorted.length} per={PER}/>
        <div style={{fontSize:10,color:B.muted,marginTop:8}}>Rows dimmed at &gt;200% divergence: likely CPQ inflation. Account names require extraction update; showing truncated ID.</div>
      </div>
    </div>
  )
}

// ─── Top Accounts Tab ─────────────────────────────────────────────────────────
function TopAccountsTab({data}){
  const ss=useSortState('current_arr_usd')
  const [month,setMonth]=useState('all')

  const filtered=useMemo(()=>data.top_accounts.filter(r=>month==='all'||closeMonth(r.close_date)===month),[data,month])
  const sorted=useMemo(()=>[...filtered].sort((a,b)=>{
    const av=a[ss.col]??'',bv=b[ss.col]??''
    if(typeof av==='number') return ss.dir==='desc'?bv-av:av-bv
    return ss.dir==='desc'?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv))
  }),[filtered,ss.col,ss.dir])

  const dimsByName=useMemo(()=>{
    const m={}
    ;(data.account_dimensions||[]).forEach(r=>{if(r.account_name)m[r.account_name]=r})
    return m
  },[data])

  const dimsById=useMemo(()=>{
    const m={}
    ;(data.account_dimensions||[]).forEach(r=>{if(r.accountid)m[r.accountid]=r})
    return m
  },[data])

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Accounts" value={sorted.length} accent={B.purple}/>
        <KPI label="Total Current ARR" value={fM(sorted.reduce((s,r)=>s+(r.current_arr_usd||0),0))} accent={B.orange}/>
        <KPI label="At Risk in View" value={sorted.filter(r=>r.stage==='At Risk').length} accent={B.pink} sub={fM(sorted.filter(r=>r.stage==='At Risk').reduce((s,r)=>s+(r.atr_proxy_usd||0),0))+' ATR'}/>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <span style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>Close Month:</span>
        <FilterPills value={month} onChange={setMonth} options={MONTHS}/>
      </div>
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <ExportBtn onClick={()=>exportCSV(sorted,'q4_top_accounts.csv')}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <TH width={30}>#</TH>
              <SortTH col="account_name" ss={ss} width={170}>Account</SortTH>
              <SortTH col="current_arr_usd" ss={ss} right>Curr ARR</SortTH>
              <SortTH col="atr_proxy_usd" ss={ss} right>ATR</SortTH>
              <TH right>Diff</TH>
              <SortTH col="product_l2" ss={ss}>Product</SortTH>
              <SortTH col="stage" ss={ss}>Stage</SortTH>
              <SortTH col="at_risk_type" ss={ss}>Risk</SortTH>
              <SortTH col="churn_risk_renewal" ss={ss}>CRN</SortTH>
              <TH>CSM</TH>
              <TH right>Tenure</TH>
              <TH>ARR Trend</TH>
              <SortTH col="close_date" ss={ss}>Close</SortTH>
            </tr></thead>
            <tbody>{sorted.map((r,i)=>{
              const dim=dimsByName[r.account_name]||dimsById[r.accountid]
              return (
                <tr key={i} style={{background:i%2===0?B.card:B.faint}}>
                  <TD isMono small color={B.muted}>{i+1}</TD>
                  <TD maxW={170} bold color={B.navy} title={r.account_name||r.accountid}>{r.account_name||r.accountid?.slice(-8)||'—'}</TD>
                  <TD right isMono bold color={B.navy}>{fK(r.current_arr_usd)}</TD>
                  <TD right isMono>{fK(r.atr_proxy_usd)}</TD>
                  {(()=>{
                    const arr=dim?.current_arr
                    const diff=arr!=null?(r.atr_proxy_usd||0)-arr:null
                    const col=diff==null?B.muted:diff>500?B.green:diff<-500?B.red:B.muted
                    return <TD right isMono color={col}>{diff!=null?(diff>500?'+':'')+fK(diff):'—'}</TD>
                  })()}
                  <TD small>{r.product_l2}</TD>
                  <TD><Dot color={stageCol(r.stage)}/><span style={{fontSize:11}}>{r.stage}</span></TD>
                  <TD>{r.at_risk_type?<Badge label={r.at_risk_type} color={riskCol(r.at_risk_type)}/>:<span style={{color:B.muted,fontSize:11}}>—</span>}</TD>
                  <TD><Dot color={crnCol(r.churn_risk_renewal)}/><span style={{fontSize:11,color:crnCol(r.churn_risk_renewal)}}>{r.churn_risk_renewal||'—'}</span></TD>
                  <TD small>{dim?.csm_name?.split(' ')[0]||'—'}</TD>
                  <TD right isMono small>{dim?.tenure_years?dim.tenure_years+'y':'—'}</TD>
                  <TD small>{(()=>{if(!dim)return '—';const t=dim.arr_trend_direction,p=dim.arr_trend_pct;const col=t==='growing'?B.green:t==='shrinking'?B.red:B.muted;return <span style={{color:col,fontWeight:600}}>{t==='growing'?'▲':t==='shrinking'?'▼':'●'} {p?Math.abs(p)+'%':t||'—'}</span>})()}</TD>
                  <TD isMono small>{fD(r.close_date)}</TD>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── WoW Tab (redesigned) ─────────────────────────────────────────────────────
function WowTab({data}){
  const rows=data.wow_movement||[]

  const arrByAccount=useMemo(()=>{
    const m={}
    ;(data.account_dimensions||[]).forEach(r=>{if(r.accountid)m[r.accountid]=r.current_arr})
    return m
  },[data])

  const classify=r=>{
    const s=r.stage_current, sp=r.stage_prior, fp=r.forecast_prior, fc=r.forecast_current
    if(s==='Closed Lost') return 'Closed Lost'
    if(s==='6 - Closed Won'||s==='Submitted for Booking') return 'Won / Submitted'
    if(s==='At Risk') return 'Moved to At Risk'
    const fOrd=['Pipeline','Best Case','Most Likely','Commit']
    const fi=fOrd.indexOf(fp), fj=fOrd.indexOf(fc)
    const stageOrd=['1 - In Use','1 - Identification','2 - Renewal Campaign Started',
      '2 - Qualification','3 - Contact Initiated','3 - Evaluation','4 - Negotiation','5 - Closing']
    const si=stageOrd.indexOf(sp), sj=stageOrd.indexOf(s)
    if(fi!==-1&&fj!==-1&&fj>fi) return 'Forecast Upgraded'
    if(fi!==-1&&fj!==-1&&fj<fi) return 'Forecast Downgraded'
    if(si!==-1&&sj!==-1&&sj>si) return 'Stage Progressed'
    if(si!==-1&&sj!==-1&&sj<si) return 'Stage Regressed'
    return 'Other Movement'
  }

  const THEME_ORDER=['Won / Submitted','Forecast Upgraded','Stage Progressed',
    'Forecast Downgraded','Stage Regressed','Moved to At Risk','Closed Lost','Other Movement']

  const THEME_COLOR={
    'Won / Submitted':B.green,'Forecast Upgraded':B.green,'Stage Progressed':B.green,
    'Forecast Downgraded':B.amber,'Stage Regressed':B.amber,
    'Moved to At Risk':B.pink,'Closed Lost':B.red,'Other Movement':B.muted,
  }
  const THEME_ICON={
    'Won / Submitted':'✓','Forecast Upgraded':'▲','Stage Progressed':'↑',
    'Forecast Downgraded':'▼','Stage Regressed':'↓',
    'Moved to At Risk':'⚠','Closed Lost':'✕','Other Movement':'→',
  }

  const grouped=useMemo(()=>{
    const g={}
    rows.forEach(r=>{
      const t=classify(r)
      if(!g[t]) g[t]={theme:t,rows:[],totalATR:0}
      g[t].rows.push(r)
      g[t].totalATR+=(r.atr_proxy_usd||0)
    })
    return THEME_ORDER.map(t=>g[t]).filter(Boolean)
  },[rows])

  const [expanded,setExpanded]=useState({})
  const toggle=t=>setExpanded(e=>({...e,[t]:!e[t]}))

  const won=rows.filter(r=>r.stage_current==='6 - Closed Won'||r.stage_current==='Submitted for Booking')
  const lost=rows.filter(r=>r.stage_current==='Closed Lost')
  const atRisk=rows.filter(r=>r.stage_current==='At Risk')

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Total Movements" value={rows.length} accent={B.purple} sub="Since prior snapshot"/>
        <KPI label="Won / Closing" value={won.length} accent={B.green} sub={fM(won.reduce((s,r)=>s+(r.atr_proxy_usd||0),0))}/>
        <KPI label="Closed Lost" value={lost.length} accent={B.red} sub={fM(lost.reduce((s,r)=>s+(r.atr_proxy_usd||0),0))}/>
        <KPI label="Moved to At Risk" value={atRisk.length} accent={B.pink} sub={fM(atRisk.reduce((s,r)=>s+(r.atr_proxy_usd||0),0))}/>
      </div>
      {rows.length===0?(
        <div style={{...cardStyle,textAlign:'center',padding:48,color:B.muted}}>
          <div style={{fontSize:14,marginBottom:8}}>No stage movements detected yet</div>
          <div style={{fontSize:12}}>Expected early in the quarter. Check back next week as snapshots accumulate.</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {grouped.map(g=>(
            <div key={g.theme} style={{...cardStyle,padding:0,overflow:'hidden'}}>
              <div onClick={()=>toggle(g.theme)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',borderBottom:expanded[g.theme]?`1px solid ${B.border}`:'none'}}>
                <span style={{fontSize:18,color:THEME_COLOR[g.theme],fontWeight:700,width:20,textAlign:'center'}}>{THEME_ICON[g.theme]}</span>
                <span style={{fontWeight:700,fontSize:13,color:B.navy,flex:1}}>{g.theme}</span>
                <span style={{...mono,fontSize:12,color:B.muted,marginRight:8}}>{fM(g.totalATR)}</span>
                <span style={{background:THEME_COLOR[g.theme],color:'#fff',borderRadius:12,padding:'2px 9px',fontSize:11,fontWeight:700}}>{g.rows.length}</span>
                <span style={{color:B.muted,fontSize:12,marginLeft:4}}>{expanded[g.theme]?'▲':'▼'}</span>
              </div>
              {expanded[g.theme]&&(
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:B.faint}}>
                    <TH width={200}>Account</TH>
                    <TH right>ATR</TH>
                    <TH right>Curr ARR</TH>
                    <TH right>Diff</TH>
                    <TH>Stage Before</TH>
                    <TH>Stage After</TH>
                    <TH>Forecast Before</TH>
                    <TH>Forecast After</TH>
                    <TH>Risk Before</TH>
                    <TH>Risk After</TH>
                  </tr></thead>
                  <tbody>{g.rows.sort((a,b)=>(b.atr_proxy_usd||0)-(a.atr_proxy_usd||0)).map((r,i)=>(
                    <tr key={i} style={{background:i%2===0?B.card:B.faint}}>
                      <TD bold color={B.navy} maxW={200} title={r.account_name}>{r.account_name||r.accountid?.slice(-8)||'—'}</TD>
                      <TD right isMono>{fK(r.atr_proxy_usd)}</TD>
                      <AtrDiffCells atr={r.atr_proxy_usd} arr={arrByAccount[r.accountid]}/>
                      <TD small>{r.stage_prior||'—'}</TD>
                      <TD small color={THEME_COLOR[g.theme]}>{r.stage_current||'—'}</TD>
                      <TD small>{r.forecast_prior||'—'}</TD>
                      <TD small color={THEME_COLOR[g.theme]}>{r.forecast_current||'—'}</TD>
                      <TD small>{r.risk_type_prior||'—'}</TD>
                      <TD small>{r.risk_type_current||'—'}</TD>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <ExportBtn onClick={()=>exportCSV(rows,'q4_wow.csv')}/>
      </div>
    </div>
  )
}

// ─── Data Dictionary Tab ──────────────────────────────────────────────────────
function DataDictionaryTab(){
  const S={
    section:{fontWeight:800,fontSize:13,color:B.navy,textTransform:'uppercase',letterSpacing:'0.07em',borderBottom:`2px solid ${B.orange}`,paddingBottom:6,marginBottom:12,marginTop:24},
    label:{fontWeight:700,fontSize:12,color:B.navy,marginBottom:2},
    desc:{fontSize:12,color:B.textMd,lineHeight:1.65,marginBottom:10},
    tag:{display:'inline-block',background:B.faint,border:`1px solid ${B.border}`,borderRadius:4,padding:'1px 7px',fontSize:11,color:B.muted,marginRight:4,marginBottom:4},
    caveat:{background:'#FFF8F0',border:`1px solid ${B.amber}`,borderRadius:6,padding:'8px 12px',fontSize:11,color:'#92400E',marginBottom:10},
    example:{background:B.faint,border:`1px solid ${B.border}`,borderRadius:6,padding:'8px 12px',fontSize:11,color:B.textMd,fontStyle:'italic',marginBottom:6},
  }
  const Field=({name,source,desc,caveat})=>(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
        <span style={S.label}>{name}</span>
        <span style={{...S.tag,background:'#EEF2FF',color:'#4338CA',border:'1px solid #C7D2FE'}}>{source}</span>
      </div>
      <div style={S.desc}>{desc}</div>
      {caveat&&<div style={S.caveat}>⚠ {caveat}</div>}
    </div>
  )
  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <div style={cardStyle}>
        <div style={{fontWeight:800,fontSize:16,color:B.navy,marginBottom:4}}>Data Dictionary & Query Guide</div>
        <div style={{fontSize:12,color:B.muted,marginBottom:8}}>Reference for all fields available in the AI agent and dashboard. Use this to understand what questions you can ask and how to interpret the answers.</div>
        <div style={S.caveat}>SFDC data quality note: CPQ migration means renewal revenue may appear under different opportunity IDs than originally forecast. Never treat SFDC ARR as definitive without reconciling against finance.arr_monthly. ARR divergence &gt;10% is flagged automatically.</div>
        <div style={S.section}>Pipeline & Opportunity</div>
        <Field name="ATR (At-Risk Revenue)" source="SFDC" desc="Annual contract value scheduled to renew this quarter. RevOps ATR uses execution date as denominator and includes pull-forwards and multi-year deals. CS/Finance GRR ATR uses scheduled renewal date and annual contracts only. These produce different denominators; the dashboard uses RevOps ATR." caveat="Do not mix RevOps ATR and GRR ATR in the same calculation."/>
        <Field name="Diff (ATR vs Curr ARR)" source="Derived" desc="ATR minus current ARR from finance.retention_arr_fact. Green = ATR exceeds ARR by more than $500 (expansion or price increase). Red = ATR is below ARR by more than $500 (downsell). Muted = within $500 either way (flat renewal)."/>
        <Field name="Stage" source="SFDC" desc="Current pipeline stage: 1-Identification, 2-Renewal Campaign Started, 3-Contact Initiated, 4-Negotiation, 5-Closing, At Risk, Submitted for Booking, 6-Closed Won, Closed Lost."/>
        <Field name="Forecast Category" source="SFDC" desc="Sales forecast classification: Pipeline, Best Case, Most Likely, Commit. Commit is the highest-confidence category."/>
        <Field name="Risk Type / At-Risk Type" source="SFDC" desc="Churn or downsell flag set by the renewal team. Values: Churn, Downsell, or blank (no flag)."/>
        <Field name="Churn Risk Renewal (CRN)" source="SFDC" desc="Green / Yellow / Red risk classification on the opportunity." caveat="CPQ migration means this field may be stale or misaligned with the finance view on some accounts."/>
        <Field name="ARR Divergence %" source="Derived" desc="Difference between SFDC renewal_software_acv and finance.arr_monthly ARR for the same account. Values over 10% are flagged as data quality risk and SFDC ARR should not be used as the authoritative figure for those accounts."/>
        <Field name="Days Since Stage Change" source="SFDC" desc="How many days since the opportunity last moved stage. 30+ days with no change is treated as a staleness risk signal independent of the stage name."/>
        <Field name="WoW Movement" source="SFDC" desc="Stage or forecast category change detected between the two most recent weekly snapshots. Sourced from finance.pipeline_create_close_history (209 weekly snapshots back to Sep 2023)."/>
        <div style={S.section}>Account Profile</div>
        <Field name="CSM Name" source="salesforce.account" desc="Customer Success Manager assigned to the account. Derived from Customer_Success_Manager_Email__c. Null indicates unassigned."/>
        <Field name="Industry" source="salesforce.account" desc="Account industry classification. Sourced from Industry__c (custom field, 96% populated) with fallback to standard Industry field (33% populated)."/>
        <Field name="Region" source="salesforce.account" desc="Account region: Americas, EMEA, APAC, MENA. Sourced from Account_Region__c (97% populated)."/>
        <Field name="Customer Segment" source="salesforce.account" desc="Account tier classification from Customer_Segment_New__c. Values include Top 10, Enterprise, Commercial, SMB."/>
        <Field name="Customer Since / Tenure" source="salesforce.account" desc="Date the account became a customer. Cascades through three fields: Customer_Since_Date__c, EN_Customer_Since__c, Earliest_Closed_Won_date__c. Tenure in years is derived from this date." caveat="Customer_Since_Date__c is only 23% populated across all accounts. Coverage is higher for established enterprise accounts."/>
        <Field name="ARR Trend" source="finance.retention_arr_fact" desc="Direction and percentage change in ARR vs 3 quarters ago. Growing = more than 5% increase. Shrinking = more than 5% decrease. Flat = within 5% either way."/>
        <Field name="Active Products" source="finance.arr_monthly" desc="Current active Product_Hierarchy_L2 values with ARR > 0. More reliable than SFDC product fields due to CPQ migration noise."/>
        <Field name="Exec Sponsor" source="salesforce.account" desc="Named executive sponsor from Nintex_Executive_Sponsor__c. Currently sparse; population improves as exec sponsor program matures."/>
        <div style={S.section}>Engagement & Activity</div>
        <Field name="Last Contact Date" source="Gong + salesforce.task" desc="Most recent of: last Gong call date or last CS-owned task date (Email, Call, Meeting). Combined signal gives the most complete view of when Nintex last touched the account."/>
        <Field name="Engagement Status" source="Derived" desc="Categorized from days since last contact. Active = 0-30 days. Cooling = 31-90 days. At Risk Engagement = 91-180 days. Dark = 180+ days. No Record = no Gong or task history found."/>
        <Field name="Gong Calls Last 90 Days" source="gong.call" desc="Count of Gong-recorded calls linked to this account in the last 90 days. Zero does not necessarily mean no contact; email and task activity may still exist."/>
        <Field name="CS Touches Last 90 Days" source="salesforce.task" desc="Count of CS-owned tasks (Email, Call, Meeting) logged against this account in the last 90 days. Dependent on CSM logging hygiene."/>
        <div style={S.section}>Health & Risk Signals</div>
        <Field name="CSM Health Score" source="salesforce.account" desc="Numeric 0-100 score entered by the CSM via Success_CSM_Acct_Health_Sentiment_Score__c. Higher is healthier. Interim substitute for Tingono health score until database permissions are resolved." caveat="CSM-entered; subject to individual interpretation and logging frequency. Not systematically populated across all accounts."/>
        <Field name="CSM Health Trend" source="salesforce.account" desc="Directional trend of CSM health score: Improving, Stable, Declining."/>
        <Field name="Red Zone" source="salesforce.account" desc="Boolean flag indicating account is in escalation status. Red Zone Reason and Red Zone Category provide additional context when flagged."/>
        <Field name="Tingono Health Score" source="tingono.acc_tingono_table" desc="AI-generated account health score from Tingono. Table exists in Databricks but read permissions are pending IT approval. Will be added to account dimensions after Friday IT meeting."/>
        <div style={S.section}>GRR Methodology</div>
        <Field name="Annualized GRR" source="finance.retention_arr_fact" desc="Trailing 4-quarter compounded rate: Q1 × Q2 × Q3 × Q4 (each as a decimal). Do not average quarters. This is the correct comparison against any annualized target."/>
        <Field name="FY26 GRR Targets" source="TPG Financial Model" desc="82.5% pure GRR. 86.0% GRR + price increase combined (more practical since PI and expansion cannot be separated in SFDC). The original 91% TPG target is no longer the operative benchmark."/>
        <Field name="NRR" source="finance.retention_arr_fact" desc="Net Revenue Retention. Formula: (Start - Churn - Downsell + Expansion) / Start. Includes expansion; NRR above 100% means the cohort is growing."/>
        <div style={S.section}>Example Questions for the AI Agent</div>
        <div style={S.desc}>The agent has access to all fields above for Q4 renewal accounts. Try these:</div>
        {[
          'Who is the CSM for Verizon and when did we last contact them?',
          'Which at-risk accounts have been dark for more than 90 days?',
          'Show me CE RPA accounts in the top 30 with their ARR trend and engagement status',
          'Which accounts have a CSM health score below 50 and renew before May 31?',
          'Which accounts moved from Best Case to Commit this week?',
          'What is the ARR divergence situation across the top 20 accounts?',
          'Which shrinking ARR accounts have an open renewal this quarter?',
          'Show me accounts in the red zone with their risk reason',
          'Which accounts have no CSM assigned and more than $100K ATR?',
          'Compare CE RPA GRR trend over the last 9 quarters',
        ].map((q,i)=>(
          <div key={i} style={S.example}>"{q}"</div>
        ))}
        <div style={S.section}>Known Limitations</div>
        {[
          ['SFDC CPQ Migration','Renewal revenue may appear under different opportunity IDs than originally forecast. ARR divergence >10% flags this automatically. Do not anchor GRR calculations to SFDC ATR alone.'],
          ['Tingono Permissions','tingono.acc_tingono_table exists in Databricks but read access is pending IT approval. CSM health score is the interim substitute.'],
          ['Customer Since Date','Only 23% of all accounts have Customer_Since_Date__c populated. Tenure figures may be missing for some accounts.'],
          ['CSM Health Score','Manually entered by CSMs. Subject to inconsistent logging. Null does not mean healthy; it means not entered.'],
          ['Gong Coverage','Gong captures calls only. Email and meeting activity comes from salesforce.task. Combined last contact date is the most complete signal but still dependent on CSM logging hygiene.'],
          ['Product Data','finance.arr_monthly begins FY24 Q1. Customer retention data begins FY21 Q1. These have different time horizons and different product classification systems.'],
          ['PowerBI','PowerBI has been unavailable for an extended period. This dashboard is the primary analytical tool for CS leadership.'],
        ].map(([title,desc],i)=>(
          <div key={i} style={{marginBottom:10}}>
            <div style={S.label}>{title}</div>
            <div style={S.desc}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Chat Drawer ──────────────────────────────────────────────────────────────
function ChatDrawer({open,onClose,systemPrompt}){
  const [messages,setMessages]=useState([])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const bottomRef=useRef(null)
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages,loading])

  const send=async()=>{
    const text=input.trim(); if(!text||loading) return
    setInput('')
    const next=[...messages,{role:'user',content:text}]
    setMessages(next); setLoading(true)
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next.map(({role,content})=>({role,content})),system:systemPrompt})})
      const d=await res.json()
      let text=d.content?.[0]?.text||d.error||'No response.'
      if(d.stop_reason==='max_tokens') text+='\n\n⚠ Response was cut off. Try asking for fewer items, or follow up with "continue from where you left off".'
      setMessages(m=>[...m,{role:'assistant',content:text,showExport:text.length>200}])
    }catch{setMessages(m=>[...m,{role:'assistant',content:'Error: could not reach the API.'}])}
    setLoading(false)
  }

  const downloadDocx=async(msgs,label)=>{
    if(exporting) return
    setExporting(true)
    try{
      const res=await fetch('/api/generate-doc',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:msgs,title:'Q4 FY26 Renewal Intelligence — '+label,context:'Live Q4 pipeline data'})
      })
      const d=await res.json()
      if(d.error){alert('Export failed: '+d.error);return}
      const bytes=atob(d.base64)
      const arr=new Uint8Array(bytes.length)
      for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i)
      const blob=new Blob([arr],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=d.filename||'nintex_export.docx';a.click()
    }catch(e){alert('Export error: '+e.message)}
    finally{setExporting(false)}
  }

  const exportFullChat=()=>downloadDocx(messages,'Chat Export')
  const exportSingleResponse=(content,i)=>downloadDocx(
    [{role:'user',content:messages[i-1]?.content||'Query'},{role:'assistant',content}],
    'Response Export'
  )

  const STARTERS=['What is the Q4 forecast vs the 91% TPG GRR target?','Which accounts closing in April have churn risk?','How does Q4 at-risk ATR compare to Q3?','Which products have the largest Q4 ATR exposure?']
  const btnStyle=(active)=>({padding:'5px 12px',borderRadius:6,border:`1px solid ${B.border}`,background:'transparent',color:active?B.orange:B.muted,fontSize:11,fontWeight:600,cursor:active?'pointer':'default',opacity:active?1:0.5})

  return (
    <>
      {open&&<div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(6,13,63,0.25)',zIndex:99}}/>}
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:500,background:B.card,borderLeft:`1px solid ${B.border}`,boxShadow:'-8px 0 32px rgba(0,0,0,0.1)',display:'flex',flexDirection:'column',transform:open?'translateX(0)':'translateX(100%)',transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',zIndex:100}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${B.border}`}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:B.navy}}>Ask the Data</div>
            <div style={{fontSize:11,color:B.muted,marginTop:2}}>Grounded in live Q4 pipeline data</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {messages.length>0&&(
              <button onClick={exportFullChat} disabled={exporting} style={btnStyle(!exporting)}>
                {exporting?'Exporting…':'⬇ Export chat'}
              </button>
            )}
            <button onClick={onClose} style={{background:'none',border:'none',color:B.muted,fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {messages.length===0&&(
            <div>
              <div style={{fontSize:12,color:B.muted,marginBottom:10}}>Suggested questions:</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {STARTERS.map((q,i)=>(
                  <button key={i} onClick={()=>setInput(q)} style={{background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:'10px 14px',color:B.textMd,fontSize:12,textAlign:'left',cursor:'pointer',lineHeight:1.4}}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} style={{maxWidth:'90%',alignSelf:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{padding:'10px 14px',borderRadius:10,fontSize:12,lineHeight:1.65,background:m.role==='user'?B.navy:B.faint,color:m.role==='user'?'#fff':B.textMd,border:`1px solid ${m.role==='user'?'transparent':B.border}`,whiteSpace:'pre-wrap'}}>{m.content}</div>
              {m.showExport&&<button onClick={()=>exportSingleResponse(m.content,i)} disabled={exporting} style={{marginTop:6,padding:'4px 10px',borderRadius:6,border:`1px solid ${B.border}`,background:'transparent',color:B.muted,fontSize:10,cursor:'pointer'}}>⬇ Export as Word doc</button>}
            </div>
          ))}
          {loading&&<div style={{alignSelf:'flex-start',padding:'10px 14px',borderRadius:10,background:B.faint,border:`1px solid ${B.border}`,fontSize:12,color:B.muted}}>Thinking...</div>}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:'12px 16px',borderTop:`1px solid ${B.border}`}}>
          <div style={{display:'flex',gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Ask about the Q4 pipeline..." style={{flex:1,background:B.faint,border:`1px solid ${B.border}`,borderRadius:8,padding:'10px 14px',color:B.navy,fontSize:12,outline:'none',fontFamily:'Plus Jakarta Sans,sans-serif'}}/>
            <button onClick={send} disabled={!input.trim()||loading} style={{padding:'10px 18px',borderRadius:8,background:input.trim()&&!loading?`linear-gradient(135deg,${B.orange},${B.pink})`:B.faint,border:`1px solid ${input.trim()&&!loading?'transparent':B.border}`,color:input.trim()&&!loading?'#fff':B.muted,fontSize:12,fontWeight:700,cursor:input.trim()&&!loading?'pointer':'default'}}>Send</button>
          </div>
          <div style={{fontSize:10,color:B.muted,marginTop:6,textAlign:'center'}}>Context: live pipeline, waterfall, top at-risk accounts, WoW movements</div>
        </div>
      </div>
    </>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const TABS=['Pipeline','Waterfall','At-Risk','Top Accounts','WoW','Data Dictionary']

export default function App(){
  const hasPassword=!!import.meta.env.VITE_APP_PASSWORD
  const [unlocked,setUnlocked]=useState(!hasPassword||sessionStorage.getItem('nx_auth')==='1')
  if(!unlocked) return <PasswordGate onUnlock={()=>setUnlocked(true)}/>
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(null)
  const [tab,setTab]=useState('Pipeline')
  const [chatOpen,setChatOpen]=useState(false)

  useEffect(()=>{
    fetch(DATA_URL).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(d=>{setData(d);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})
  },[])

  const sp=useMemo(()=>data?buildSystemPrompt(data):'',[data])

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12,background:B.bg}}>
      <div style={{width:36,height:36,borderRadius:'50%',border:`3px solid ${B.border}`,borderTopColor:B.orange,animation:'spin 0.8s linear infinite'}}/>
      <div style={{fontSize:13,color:B.muted}}>Loading Q4 data...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if(error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:10,background:B.bg}}>
      <div style={{fontSize:13,color:B.red}}>Failed to load: {error}</div>
      <div style={{fontSize:11,color:B.muted}}>Ensure q4_data.json is in /public or VITE_DATA_URL is set.</div>
    </div>
  )

  const refreshed=data.generated_at?new Date(data.generated_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'

  return (
    <div style={{minHeight:'100vh',background:B.bg}}>
      <div style={{background:B.card,borderBottom:`1px solid ${B.border}`,position:'sticky',top:0,zIndex:50,boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div style={{maxWidth:1320,margin:'0 auto',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <span style={{fontWeight:800,fontSize:15,letterSpacing:'-0.02em',background:`linear-gradient(135deg,${B.orange},${B.pink})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>nintex</span>
            <div style={{width:1,height:18,background:B.border}}/>
            <span style={{fontWeight:700,fontSize:13,color:B.navy}}>Q4 FY26 · Renewal Intelligence</span>
            <span style={{...mono,fontSize:11,color:B.muted}}>Apr 1 – Jun 30, 2026</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontSize:11,color:B.muted}}>Refreshed: <span style={{...mono,color:B.textMd}}>{refreshed}</span></span>
            <button onClick={()=>setChatOpen(true)} style={{padding:'7px 18px',borderRadius:8,background:`linear-gradient(135deg,${B.orange},${B.pink})`,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(242,101,34,0.25)'}}>Ask AI</button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:1320,margin:'0 auto',padding:'20px 24px 60px'}}>
        <div style={{display:'flex',gap:2,marginBottom:20,background:B.card,border:`1px solid ${B.border}`,borderRadius:10,padding:3,width:'fit-content',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'7px 20px',borderRadius:7,border:'none',background:tab===t?B.navy:'transparent',color:tab===t?'#fff':B.muted,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',borderBottom:tab===t?`2px solid ${B.orange}`:'2px solid transparent'}}>{t}</button>
          ))}
        </div>
        {tab==='Pipeline'        && <PipelineTab data={data}/>}
        {tab==='Waterfall'       && <WaterfallTab data={data}/>}
        {tab==='At-Risk'         && <AtRiskTab data={data}/>}
        {tab==='Top Accounts'    && <TopAccountsTab data={data}/>}
        {tab==='WoW'             && <WowTab data={data}/>}
        {tab==='Data Dictionary' && <DataDictionaryTab/>}
      </div>
      <ChatDrawer open={chatOpen} onClose={()=>setChatOpen(false)} systemPrompt={sp}/>
    </div>
  )
}
