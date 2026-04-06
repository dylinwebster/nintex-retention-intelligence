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

  // Aggregate by stage to remove forecast_category duplicates in chart
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
  // Keep Ending ARR in raw dollars; right axis formatter handles display
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
              <SortTH col="current_arr_usd" ss={ss} right>Curr ARR</SortTH>
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
                <TD right isMono>{fK(r.current_arr_usd)}</TD>
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
              <SortTH col="product_l2" ss={ss}>Product</SortTH>
              <SortTH col="stage" ss={ss}>Stage</SortTH>
              <SortTH col="at_risk_type" ss={ss}>Risk</SortTH>
              <SortTH col="churn_risk_renewal" ss={ss}>CRN</SortTH>
              <SortTH col="close_date" ss={ss}>Close</SortTH>
            </tr></thead>
            <tbody>{sorted.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?B.card:B.faint}}>
                <TD isMono small color={B.muted}>{i+1}</TD>
                <TD maxW={170} bold color={B.navy} title={r.account_name||r.accountid}>{r.account_name||r.accountid?.slice(-8)||'—'}</TD>
                <TD right isMono bold color={B.navy}>{fK(r.current_arr_usd)}</TD>
                <TD right isMono>{fK(r.atr_proxy_usd)}</TD>
                <TD small>{r.product_l2}</TD>
                <TD><Dot color={stageCol(r.stage)}/><span style={{fontSize:11}}>{r.stage}</span></TD>
                <TD>{r.at_risk_type?<Badge label={r.at_risk_type} color={riskCol(r.at_risk_type)}/>:<span style={{color:B.muted,fontSize:11}}>—</span>}</TD>
                <TD><Dot color={crnCol(r.churn_risk_renewal)}/><span style={{fontSize:11,color:crnCol(r.churn_risk_renewal)}}>{r.churn_risk_renewal||'—'}</span></TD>
                <TD isMono small>{fD(r.close_date)}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── WoW Tab ──────────────────────────────────────────────────────────────────
function WowTab({data}){
  const ss=useSortState('atr_proxy_usd')
  const sorted=useMemo(()=>[...data.wow_movement].sort((a,b)=>{
    const av=a[ss.col]??'',bv=b[ss.col]??''
    if(typeof av==='number') return ss.dir==='desc'?bv-av:av-bv
    return ss.dir==='desc'?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv))
  }),[data,ss.col,ss.dir])

  const dir=(prior,current)=>{
    if(current==='Closed Lost') return {icon:'✕',color:B.red}
    if(current==='6 - Closed Won'||current==='Submitted for Booking') return {icon:'✓',color:B.green}
    if(current==='At Risk') return {icon:'↓',color:B.pink}
    const ord=['1 - In Use','1 - Identification','2 - Renewal Campaign Started','2 - Qualification','3 - Contact Initiated','3 - Evaluation','4 - Negotiation','5 - Closing']
    const pi=ord.indexOf(prior),ci=ord.indexOf(current)
    if(pi!==-1&&ci!==-1&&ci>pi) return {icon:'↑',color:B.green}
    if(pi!==-1&&ci!==-1&&ci<pi) return {icon:'↓',color:B.pink}
    return {icon:'→',color:B.amber}
  }

  const won =sorted.filter(r=>r.stage_current==='6 - Closed Won'||r.stage_current==='Submitted for Booking')
  const lost=sorted.filter(r=>r.stage_current==='Closed Lost')

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <KPI label="Accounts Moved" value={sorted.length} accent={B.purple} sub="Since prior snapshot"/>
        <KPI label="Won / Closing" value={won.length} accent={B.green} sub={fM(won.reduce((s,r)=>s+(r.atr_proxy_usd||0),0))}/>
        <KPI label="Closed Lost" value={lost.length} accent={B.red} sub={fM(lost.reduce((s,r)=>s+(r.atr_proxy_usd||0),0))}/>
        <KPI label="Moved to At Risk" value={sorted.filter(r=>r.stage_current==='At Risk').length} accent={B.pink}/>
      </div>
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
          <ExportBtn onClick={()=>exportCSV(sorted,'q4_wow.csv')}/>
        </div>
        {sorted.length===0?(
          <div style={{textAlign:'center',padding:48,color:B.muted}}>
            <div style={{fontSize:14,marginBottom:8}}>No stage movements detected yet</div>
            <div style={{fontSize:12}}>Expected early in the quarter. Check back next week as snapshots accumulate.</div>
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                <TH width={36}>Dir</TH>
                <SortTH col="atr_proxy_usd" ss={ss} right>ATR</SortTH>
                <SortTH col="stage_prior" ss={ss}>Stage Before</SortTH>
                <SortTH col="stage_current" ss={ss}>Stage After</SortTH>
                <SortTH col="forecast_prior" ss={ss}>Forecast Before</SortTH>
                <SortTH col="forecast_current" ss={ss}>Forecast After</SortTH>
                <SortTH col="risk_type_prior" ss={ss}>Risk Before</SortTH>
                <SortTH col="risk_type_current" ss={ss}>Risk After</SortTH>
              </tr></thead>
              <tbody>{sorted.map((r,i)=>{
                const {icon,color}=dir(r.stage_prior,r.stage_current)
                return (
                  <tr key={i} style={{background:i%2===0?B.card:B.faint}}>
                    <TD><span style={{...mono,fontSize:16,color,fontWeight:700}}>{icon}</span></TD>
                    <TD right isMono bold color={B.navy}>{fK(r.atr_proxy_usd)}</TD>
                    <TD small><Dot color={stageCol(r.stage_prior)}/>{r.stage_prior}</TD>
                    <TD small><Dot color={stageCol(r.stage_current)}/>{r.stage_current}</TD>
                    <TD small>{r.forecast_prior}</TD>
                    <TD small color={r.forecast_current==='Commit'?B.orange:B.textMd} bold={r.forecast_current==='Commit'}>{r.forecast_current}</TD>
                    <TD small>{r.risk_type_prior?<Badge label={r.risk_type_prior} color={riskCol(r.risk_type_prior)}/>:<span style={{color:B.muted}}>—</span>}</TD>
                    <TD small>{r.risk_type_current?<Badge label={r.risk_type_current} color={riskCol(r.risk_type_current)}/>:<span style={{color:B.muted}}>—</span>}</TD>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat Drawer ──────────────────────────────────────────────────────────────
function ChatDrawer({open,onClose,systemPrompt}){
  const [messages,setMessages]=useState([])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)
  const bottomRef=useRef(null)
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages,loading])

  const send=async()=>{
    const text=input.trim(); if(!text||loading) return
    setInput('')
    const next=[...messages,{role:'user',content:text}]
    setMessages(next); setLoading(true)
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next,system:systemPrompt})})
      const d=await res.json()
      let text=d.content?.[0]?.text||d.error||'No response.'
      if(d.stop_reason==='max_tokens') text+='\n\n⚠ Response was cut off. Try asking for fewer items, or follow up with "continue from where you left off".'
      setMessages(m=>[...m,{role:'assistant',content:text,showExport:text.split('\n').length>8}])
    }catch{setMessages(m=>[...m,{role:'assistant',content:'Error: could not reach the API.'}])}
    setLoading(false)
  }

  const exportChatCSV=()=>{
    const lines=['Nintex Q4 FY26 — Chat Export','Generated: '+new Date().toLocaleString(),'']
    messages.forEach(m=>{lines.push((m.role==='user'?'You: ':'Assistant: ')+m.content);lines.push('')})
    const csv=lines.map(r=>r.includes(',')?'"'+r.replace(/"/g,'""')+'"':r).join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='nintex_chat_'+new Date().toISOString().slice(0,10)+'.csv';a.click()
  }
  const exportResponseCSV=(text)=>{
    const rows=text.split('\n').filter(l=>l.trim()).map(l=>l.replace(/^\s*\d+[\.\)]\s*/,'').replace(/\*\*/g,'').trim())
    const csv=rows.map(r=>r.includes(',')?'"'+r.replace(/"/g,'""')+'"':r).join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='nintex_export.csv';a.click()
  }

  const STARTERS=['What is the Q4 forecast vs the 91% TPG GRR target?','Which accounts closing in April have churn risk?','How does Q4 at-risk ATR compare to Q3?','Which products have the largest Q4 ATR exposure?']

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
            {messages.length>0&&<button onClick={exportChatCSV} style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${B.border}`,background:'transparent',color:B.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>⬇ Export chat</button>}
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
              {m.showExport&&<button onClick={()=>exportResponseCSV(m.content)} style={{marginTop:6,padding:'4px 10px',borderRadius:6,border:`1px solid ${B.border}`,background:'transparent',color:B.muted,fontSize:10,cursor:'pointer'}}>⬇ Export as CSV</button>}
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
const TABS=['Pipeline','Waterfall','At-Risk','Top Accounts','WoW']

export default function App(){
const hasPassword = !!import.meta.env.VITE_APP_PASSWORD
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
        {tab==='Pipeline'     && <PipelineTab data={data}/>}
        {tab==='Waterfall'    && <WaterfallTab data={data}/>}
        {tab==='At-Risk'      && <AtRiskTab data={data}/>}
        {tab==='Top Accounts' && <TopAccountsTab data={data}/>}
        {tab==='WoW'          && <WowTab data={data}/>}
      </div>
      <ChatDrawer open={chatOpen} onClose={()=>setChatOpen(false)} systemPrompt={sp}/>
    </div>
  )
}
