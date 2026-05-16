// TIRAS CRM V2 — PlatformAnalytics.jsx
// Platform Owner: MRR, growth, plan distribution, call volume, industry split
// Real-time onSnapshot | Period selector | Obsidian Gold theme

import React, { useEffect, useState, useMemo } from "react";
import {
  collection, query, onSnapshot, where, Timestamp, orderBy,
} from "firebase/firestore";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#121212", surface:"#1A1A1B", surfaceHov:"#222223", border:"#2A2A2B",
  gold:"#D4AF37", goldMuted:"rgba(212,175,55,0.12)",
  red:"#E63946",  redMuted:"rgba(230,57,70,0.12)",
  green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",
  blue:"#3B82F6", blueMuted:"rgba(59,130,246,0.12)",
  warn:"#F59E0B", purple:"#8B5CF6",
  text:"#F5F5F5", textSub:"#9A9A9A", textMuted:"#555555",
};
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PIE_COLORS = [C.gold, C.green, C.blue, C.purple, C.warn, C.red];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtRupee = n => { if(!n)return"₹0"; if(n>=100000)return`₹${(n/100000).toFixed(1)}L`; if(n>=1000)return`₹${(n/1000).toFixed(1)}K`; return`₹${n.toLocaleString("en-IN")}`; };
const nMonthsAgo = n => { const d=new Date(); d.setMonth(d.getMonth()-n); d.setDate(1); d.setHours(0,0,0,0); return Timestamp.fromDate(d); };
const buildSkeleton = n => Array.from({length:n},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-(n-1-i)); return {label:MONTHS_S[d.getMonth()],month:d.getMonth(),year:d.getFullYear(),companies:0,revenue:0,calls:0}; });

// ─── Sub-components ───────────────────────────────────────────────────────────
const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;

const StatCard = ({icon,label,value,sub,color,loading}) => (
  <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,flex:"1 1 155px",position:"relative",overflow:"hidden",transition:"border-color 0.15s,transform 0.15s"}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=color||C.gold;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,backgroundColor:color||C.gold,borderRadius:"12px 12px 0 0"}} />
    {loading?(
      <><Shimmer h={12} w="40%" /><div style={{marginTop:12}}><Shimmer h={30} w="55%" /></div><div style={{marginTop:8}}><Shimmer h={11} w="65%" /></div></>
    ):(
      <><div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontFamily:F.heading,fontSize:28,fontWeight:700,color:color||C.gold,lineHeight:1}}>{value}</div>
      <div style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,marginTop:6}}>{label}</div>
      {sub&&<div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:2}}>{sub}</div>}</>
    )}
  </div>
);

const SectionTitle = ({title,sub}) => (
  <div style={{marginBottom:16}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:3,height:18,backgroundColor:C.gold,borderRadius:99}} />
      <span style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>{title}</span>
    </div>
    {sub&&<div style={{fontFamily:F.body,fontSize:12,color:C.textSub,marginTop:3,paddingLeft:13}}>{sub}</div>}
  </div>
);

const ChartTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{backgroundColor:"#1E1E1E",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px"}}>
      <div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontFamily:F.body,fontSize:13,marginBottom:3}}>
          <div style={{width:8,height:8,borderRadius:2,backgroundColor:p.color||p.fill}} />
          <span style={{color:C.textSub}}>{p.name}:</span>
          <span style={{color:C.text,fontWeight:600}}>{typeof p.value==="number"&&p.name?.includes("₹")?fmtRupee(p.value):p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const PlatformAnalytics = () => {
  const { isPlatformOwner } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [calls,     setCalls]     = useState([]);
  const [totalLeads,setLeads]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState("6m");

  useEffect(()=>{
    let r=0; const ck=()=>{r++;if(r>=4)setLoading(false);};
    const win=nMonthsAgo(6);
    const u1=onSnapshot(query(collection(db,COLLECTIONS.COMPANIES),orderBy("createdAt","desc")),s=>{setCompanies(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.PAYMENTS),where("createdAt",">=",win),orderBy("createdAt","desc")),s=>{setPayments(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u3=onSnapshot(query(collection(db,COLLECTIONS.CALLS),where("createdAt",">=",win)),s=>{setCalls(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u4=onSnapshot(collection(db,COLLECTIONS.LEADS),s=>{setLeads(s.size);ck();},e=>{console.error(e);ck();});
    return()=>{u1();u2();u3();u4();};
  },[]);

  const monthCount = period==="1m"?1:period==="3m"?3:6;

  // Growth trend chart data
  const growthData = useMemo(()=>{
    const sk=buildSkeleton(monthCount);
    companies.forEach(c=>{const d=c.createdAt?.toDate?c.createdAt.toDate():null;if(!d)return;const sl=sk.find(s=>s.month===d.getMonth()&&s.year===d.getFullYear());if(sl)sl.companies++;});
    payments.filter(p=>p.status==="paid").forEach(p=>{const d=p.createdAt?.toDate?p.createdAt.toDate():null;if(!d)return;const sl=sk.find(s=>s.month===d.getMonth()&&s.year===d.getFullYear());if(sl)sl.revenue+=p.amount||0;});
    calls.forEach(c=>{const d=c.createdAt?.toDate?c.createdAt.toDate():null;if(!d)return;const sl=sk.find(s=>s.month===d.getMonth()&&s.year===d.getFullYear());if(sl)sl.calls++;});
    return sk;
  },[monthCount,companies,payments,calls]);

  // Plan distribution
  const planDist = useMemo(()=>{
    const m={};companies.forEach(c=>{const k=c.plan||"Unknown";m[k]=(m[k]||0)+1;});
    return Object.entries(m).map(([name,value])=>({name,value}));
  },[companies]);

  // Revenue by plan
  const revByPlan = useMemo(()=>{
    const m={};payments.filter(p=>p.status==="paid").forEach(p=>{const k=p.plan||"Unknown";m[k]=(m[k]||0)+(p.amount||0);});
    return Object.entries(m).map(([name,value])=>({name,value}));
  },[payments]);

  // Industry breakdown
  const industryDist = useMemo(()=>{
    const m={};companies.forEach(c=>{const k=c.industry||"Other";m[k]=(m[k]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,value])=>({name,value}));
  },[companies]);

  // Key metrics
  const totalRevenue    = payments.filter(p=>p.status==="paid").reduce((s,p)=>s+(p.amount||0),0);
  const activeCompanies = companies.filter(c=>c.status==="active").length;
  const MRR_MAP         = {Basic:1800,Growth:3000,Enterprise:5000};
  const mrr             = companies.filter(c=>c.status==="active").reduce((s,c)=>s+(MRR_MAP[c.plan]||0),0);
  const convRate        = companies.length>0?Math.round((activeCompanies/companies.length)*100):0;
  const avgRev          = activeCompanies>0?Math.round(totalRevenue/activeCompanies):0;

  const healthRows = [
    {label:"Active",    count:companies.filter(c=>c.status==="active").length,    color:C.green,  icon:"✓"},
    {label:"Trial",     count:companies.filter(c=>c.status==="trial").length,     color:C.warn,   icon:"◑"},
    {label:"Suspended", count:companies.filter(c=>c.status==="suspended").length, color:C.red,    icon:"⊘"},
    {label:"Inactive",  count:companies.filter(c=>c.status==="inactive").length,  color:C.textSub,icon:"○"},
    {label:"Total",     count:companies.length,                                   color:C.gold,   icon:"■"},
  ];

  if(!isPlatformOwner) return <div style={{minHeight:"100vh",backgroundColor:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,color:C.textSub}}><div style={{textAlign:"center"}}><div style={{fontSize:40}}>🔒</div><div style={{marginTop:12}}>Platform Owner only.</div></div></div>;

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}@media(max-width:640px){.two-col{grid-template-columns:1fr!important}.three-col{grid-template-columns:1fr!important}}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px",fontFamily:F.body,color:C.text}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Platform Owner</div>
          <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Platform Analytics</h1>
          <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>Real-time metrics across all companies · <span style={{color:C.green}}>● Live</span></div>
        </div>
        {/* Period selector */}
        <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {[["1m","1M"],["3m","3M"],["6m","6M"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"9px 16px",minHeight:40,border:"none",backgroundColor:period===v?C.goldMuted:"transparent",color:period===v?C.gold:C.textSub,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <StatCard icon="📈" label="Est. MRR"         value={loading?"…":fmtRupee(mrr)}                     sub="monthly recurring"    color={C.green}  loading={loading} />
        <StatCard icon="💰" label="Total Revenue"    value={loading?"…":fmtRupee(totalRevenue)}            sub="all paid"             color={C.gold}   loading={loading} />
        <StatCard icon="🏢" label="Active Companies" value={loading?"…":activeCompanies}                   sub={`${convRate}% rate`}  color={C.blue}   loading={loading} />
        <StatCard icon="📋" label="Platform Leads"   value={loading?"…":totalLeads.toLocaleString("en-IN")} sub="all companies"       color={C.purple} loading={loading} />
        <StatCard icon="📞" label="Calls (6M)"       value={loading?"…":calls.length.toLocaleString("en-IN")} sub="all agents"        color={C.warn}   loading={loading} />
        <StatCard icon="💵" label="Avg Rev / Co"     value={loading?"…":fmtRupee(avgRev)}                  sub="active only"         color:"#EC4899"  color={"#EC4899"} loading={loading} />
      </div>

      {/* Row 1: Growth area chart + Plan pie */}
      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:14,marginBottom:14}}>

        {/* Growth chart */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Platform Growth" sub={`Companies · Revenue · Calls — last ${monthCount} month${monthCount!==1?"s":""}`} />
          {loading?<Shimmer h={240} />:(
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={growthData} margin={{top:8,right:8,left:-16,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{fill:C.textSub,fontSize:11,fontFamily:F.body}} axisLine={false} tickLine={false} />
                <YAxis yAxisId="co"  tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="rev" orientation="right" tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>fmtRupee(v)} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{fontFamily:F.body,fontSize:12,color:C.textSub,paddingTop:10}} iconType="circle" iconSize={8} />
                <Line yAxisId="co"  type="monotone" dataKey="companies" name="Companies" stroke={C.gold}  strokeWidth={2.5} dot={{r:4,fill:C.gold}}  activeDot={{r:6}} />
                <Line yAxisId="rev" type="monotone" dataKey="revenue"   name="Revenue ₹" stroke={C.green} strokeWidth={2.5} dot={{r:4,fill:C.green}} activeDot={{r:6}} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plan distribution pie */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Plan Split" />
          {loading?<Shimmer h={160} />:planDist.length===0?(
            <div style={{textAlign:"center",padding:"32px 0",color:C.textSub,fontFamily:F.body,fontSize:13}}>No data.</div>
          ):(
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {planDist.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                {planDist.map((entry,i)=>(
                  <div key={entry.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:2,backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}} />
                      <span style={{fontFamily:F.body,fontSize:13,color:C.textSub}}>{entry.name}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.text}}>{entry.value}</span>
                      <span style={{fontFamily:F.body,fontSize:11,color:C.textMuted}}>{companies.length>0?`${Math.round((entry.value/companies.length)*100)}%`:"0%"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Revenue by plan bar + Industry horizontal bars */}
      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>

        {/* Revenue by plan */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Revenue by Plan" sub="Total paid — per tier" />
          {loading?<Shimmer h={200} />:revByPlan.length===0?(
            <div style={{textAlign:"center",padding:"32px 0",color:C.textSub,fontFamily:F.body,fontSize:13}}>No paid revenue yet.</div>
          ):(
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revByPlan} margin={{top:8,right:8,left:-16,bottom:0}} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{fill:C.textSub,fontSize:12,fontFamily:F.body}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>fmtRupee(v)} />
                <Tooltip content={<ChartTip />} cursor={{fill:"rgba(255,255,255,0.04)"}} />
                <Bar dataKey="value" name="Revenue" radius={[4,4,0,0]}>
                  {revByPlan.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Industry breakdown */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Top Industries" sub="Companies by sector" />
          {loading?Array.from({length:6}).map((_,i)=><div key={i} style={{marginBottom:12}}><Shimmer h={28} /></div>):industryDist.length===0?(
            <div style={{textAlign:"center",padding:"32px 0",color:C.textSub,fontFamily:F.body,fontSize:13}}>No data.</div>
          ):industryDist.map((entry,i)=>{
            const max=Math.max(...industryDist.map(e=>e.value),1);
            const col=PIE_COLORS[i%PIE_COLORS.length];
            return (
              <div key={entry.name} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:F.body,fontSize:13,color:C.textSub}}>{entry.name}</span>
                  <span style={{fontFamily:F.heading,fontSize:14,fontWeight:700,color:C.text}}>{entry.value}</span>
                </div>
                <div style={{height:6,borderRadius:99,backgroundColor:C.border,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(entry.value/max)*100}%`,backgroundColor:col,borderRadius:99,transition:"width 0.5s ease"}} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 3: Call volume bar + Company health */}
      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:14}}>

        {/* Call volume */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Call Volume by Month" sub={`All companies — last ${monthCount} month${monthCount!==1?"s":""}`} />
          {loading?<Shimmer h={180} />:(
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={growthData} margin={{top:8,right:8,left:-22,bottom:0}} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{fill:C.textSub,fontSize:11,fontFamily:F.body}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{fill:"rgba(255,255,255,0.04)"}} />
                <Bar dataKey="calls" name="Calls" fill={C.gold} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Company health */}
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <SectionTitle title="Company Health" />
          {loading?Array.from({length:5}).map((_,i)=><div key={i} style={{marginBottom:10}}><Shimmer h={44} /></div>):(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {healthRows.map(({label,count,color,icon})=>(
                  <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",backgroundColor:C.surfaceHov,borderRadius:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{color,fontSize:13}}>{icon}</span>
                      <span style={{fontFamily:F.body,fontSize:13,color:C.textSub}}>{label}</span>
                    </div>
                    <span style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color}}>{count}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:F.body,fontSize:12,color:C.textSub}}>Activation Rate</span>
                  <span style={{fontFamily:F.heading,fontSize:13,fontWeight:700,color:convRate>=70?C.green:C.warn}}>{convRate}%</span>
                </div>
                <div style={{height:6,borderRadius:99,backgroundColor:C.border,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${convRate}%`,backgroundColor:convRate>=70?C.green:C.warn,borderRadius:99,transition:"width 0.5s ease"}} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </>);
};
export default PlatformAnalytics;
