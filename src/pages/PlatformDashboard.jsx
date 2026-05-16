// TIRAS CRM V2 — PlatformDashboard.jsx
// Role: platform_owner — sees ALL companies, revenue, leads, calls
// Real-time onSnapshot | AreaChart signups | Companies table | Suspend modal

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, orderBy } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const C = { bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",blue:"#3B82F6",blueMuted:"rgba(59,130,246,0.12)",warn:"#F59E0B",warnMuted:"rgba(245,158,11,0.12)",text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555" };
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PLAN_META = { Basic:{color:C.blue,bg:C.blueMuted}, Growth:{color:C.gold,bg:C.goldMuted}, Enterprise:{color:"#8B5CF6",bg:"rgba(139,92,246,0.12)"} };
const STATUS_META = { active:{color:C.green,bg:C.greenMuted,label:"Active"}, suspended:{color:C.red,bg:C.redMuted,label:"Suspended"}, trial:{color:C.warn,bg:C.warnMuted,label:"Trial"}, inactive:{color:C.textMuted,bg:C.surfaceHov,label:"Inactive"} };

const fmtRupee = n => { if(!n)return"₹0"; if(n>=100000)return`₹${(n/100000).toFixed(1)}L`; if(n>=1000)return`₹${(n/1000).toFixed(1)}K`; return`₹${n}`; };
const fmtDate  = ts => { if(!ts)return"—"; const d=ts.toDate?ts.toDate():new Date(ts); const diff=Math.floor((Date.now()-d.getTime())/86400000); if(diff===0)return"Today"; if(diff===1)return"Yesterday"; if(diff<7)return`${diff}d ago`; return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}); };
const startOfMonth=()=>{const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return Timestamp.fromDate(d);};
const startOfToday=()=>{const d=new Date();d.setHours(0,0,0,0);return Timestamp.fromDate(d);};

const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
const Toast   = ({msg,type,onDone}) => { useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>; };

const StatCard = ({icon,label,value,sub,color,loading}) => (
  <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,flex:"1 1 160px",position:"relative",overflow:"hidden"}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,backgroundColor:color||C.gold,borderRadius:"12px 12px 0 0"}} />
    {loading?(<><Shimmer h={12} w="40%" /><div style={{marginTop:12}}><Shimmer h={32} w="55%" /></div><div style={{marginTop:8}}><Shimmer h={11} w="65%" /></div></>):(
      <><div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontFamily:F.heading,fontSize:30,fontWeight:700,color:color||C.gold,lineHeight:1}}>{value}</div>
      <div style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,marginTop:6}}>{label}</div>
      {sub&&<div style={{fontFamily:F.body,fontSize:12,color:C.textSub,marginTop:2}}>{sub}</div>}</>
    )}
  </div>
);

const PlanBadge  = ({plan})  => { const m=PLAN_META[plan]||{color:C.textSub,bg:C.surfaceHov}; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,border:`1px solid ${m.color}33`}}>{plan||"—"}</span>; };
const StatusBadge= ({status})=> { const m=STATUS_META[status]||STATUS_META.inactive; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:5,height:5,borderRadius:"50%",backgroundColor:m.color,display:"inline-block"}} />{m.label}</span>; };

const ChartTip=({active,payload,label})=>{if(!active||!payload?.length)return null;return <div style={{backgroundColor:"#1E1E1E",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px"}}><div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginBottom:4}}>{label}</div><div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:C.gold}}>{payload[0].value} {payload[0].value===1?"company":"companies"}</div></div>;};

const SuspendModal = ({company,onConfirm,onCancel,saving}) => (<>
  <div onClick={onCancel} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:200}} />
  <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:"min(400px,90vw)",zIndex:201,fontFamily:F.body,textAlign:"center"}}>
    <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
    <div style={{fontFamily:F.heading,fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Suspend Company?</div>
    <div style={{fontSize:14,color:C.textSub,marginBottom:24}}><strong style={{color:C.text}}>{company.name}</strong> will lose access immediately. All data is preserved.</div>
    <div style={{display:"flex",gap:10}}>
      <button onClick={onCancel} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>Cancel</button>
      <button onClick={onConfirm} disabled={saving} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:700,border:"none",borderRadius:8,backgroundColor:C.red,color:"#fff",cursor:"pointer",opacity:saving?0.7:1}}>{saving?"Working…":"Suspend"}</button>
    </div>
  </div>
</>);

export const PlatformDashboard = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [callCount, setCallCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [suspendTarget, setSuspend] = useState(null);
  const [suspending,    setSuspending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(()=>{
    let r=0; const ck=()=>{r++;if(r>=4)setLoading(false);};
    const u1=onSnapshot(query(collection(db,COLLECTIONS.COMPANIES),orderBy("createdAt","desc")),s=>{setCompanies(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.PAYMENTS),where("status","==","paid"),where("createdAt",">=",startOfMonth())),s=>{setPayments(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u3=onSnapshot(query(collection(db,COLLECTIONS.CALLS),where("createdAt",">=",startOfToday())),s=>{setCallCount(s.size);ck();},e=>{console.error(e);ck();});
    const u4=onSnapshot(collection(db,COLLECTIONS.LEADS),s=>{setLeadCount(s.size);ck();},e=>{console.error(e);ck();});
    return()=>{u1();u2();u3();u4();};
  },[]);

  const handleSuspend = async () => {
    if(!suspendTarget)return;
    setSuspending(true);
    try {
      const next = suspendTarget.status==="suspended"?"active":"suspended";
      await updateDoc(doc(db,COLLECTIONS.COMPANIES,suspendTarget.id),{status:next});
      setToast({msg:`${suspendTarget.name} ${next==="suspended"?"suspended":"restored"}`,type:"success"});
    } catch(e){ setToast({msg:"Failed: "+e.message,type:"error"}); }
    finally{ setSuspending(false); setSuspend(null); }
  };

  const revenue = payments.reduce((s,p)=>s+(p.amount||0),0);
  const activeCount = companies.filter(c=>c.status==="active").length;
  const newThisMonth = companies.filter(c=>{const s=c.createdAt?.seconds;return s&&s*1000>=startOfMonth().toMillis();}).length;

  const chartData = useMemo(()=>{
    const sk=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return{label:MONTHS_S[d.getMonth()],month:d.getMonth(),year:d.getFullYear(),companies:0};});
    companies.forEach(c=>{const d=c.createdAt?.toDate?c.createdAt.toDate():null;if(!d)return;const sl=sk.find(s=>s.month===d.getMonth()&&s.year===d.getFullYear());if(sl)sl.companies++;});
    return sk;
  },[companies]);

  const tableData = useMemo(()=>{
    if(!search.trim())return companies;
    const q=search.toLowerCase();
    return companies.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.adminEmail||"").toLowerCase().includes(q));
  },[companies,search]);

  if(!isPlatformOwner) return <div style={{minHeight:"100vh",backgroundColor:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,color:C.textSub}}><div style={{textAlign:"center"}}><div style={{fontSize:40}}>🔒</div><div style={{marginTop:12}}>Platform Owner access required.</div></div></div>;

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}.co-row:hover{background-color:${C.surfaceHov}!important}@media(max-width:640px){.table-view{display:none!important}}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px",fontFamily:F.body,color:C.text}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>TIRAS Platform · Owner</div>
          <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Platform Dashboard</h1>
          <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})} · <span style={{color:C.green}}>● Live</span></div>
        </div>
        <button onClick={()=>navigate("/platform/companies")} style={{fontFamily:F.body,fontSize:13,fontWeight:700,backgroundColor:C.gold,color:"#000",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",minHeight:44}}>All Companies →</button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:20}}>
        <StatCard icon="🏢" label="Total Companies"  value={loading?"…":companies.length}     sub={`${activeCount} active`}      color={C.gold}  loading={loading} />
        <StatCard icon="💰" label="Revenue (Month)"  value={loading?"…":fmtRupee(revenue)}    sub="paid subscriptions"           color={C.green} loading={loading} />
        <StatCard icon="📋" label="Total Leads"      value={loading?"…":leadCount.toLocaleString("en-IN")} sub="platform-wide" color={C.blue}  loading={loading} />
        <StatCard icon="📞" label="Calls Today"      value={loading?"…":callCount}             sub="all companies"                color={C.warn}  loading={loading} />
        <StatCard icon="🆕" label="New This Month"   value={loading?"…":newThisMonth}          sub="companies joined"            color="#8B5CF6" loading={loading} />
      </div>

      {/* Chart + plan breakdown */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:14,marginBottom:14}}>
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>Company Signups — Last 6 Months</div>
          <div style={{fontFamily:F.body,fontSize:12,color:C.textSub,marginBottom:16}}>Monthly new companies joining TIRAS</div>
          {loading?<Shimmer h={200} />:(
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{top:6,right:6,left:-22,bottom:0}}>
                <defs><linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.gold} stopOpacity={0.4}/><stop offset="95%" stopColor={C.gold} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{fill:C.textSub,fontSize:11,fontFamily:F.body}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:C.textSub,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{stroke:C.gold+"44",strokeWidth:1}} />
                <Area type="monotone" dataKey="companies" stroke={C.gold} strokeWidth={2.5} fill="url(#goldGrad)" dot={{fill:C.gold,r:4,strokeWidth:0}} activeDot={{r:6,fill:C.warn}} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
          <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Plan Split</div>
          {loading?Array.from({length:3}).map((_,i)=><div key={i} style={{marginBottom:14}}><Shimmer h={36} /></div>):
          ["Basic","Growth","Enterprise"].map(plan=>{
            const cnt=companies.filter(c=>c.plan===plan).length;
            const pct=companies.length>0?(cnt/companies.length)*100:0;
            const m=PLAN_META[plan];
            return (
              <div key={plan} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontFamily:F.body,fontSize:13,color:C.textSub}}>{plan}</span>
                  <span style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:m.color}}>{cnt}</span>
                </div>
                <div style={{height:6,borderRadius:99,backgroundColor:C.border,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,backgroundColor:m.color,borderRadius:99,transition:"width 0.5s ease"}} />
                </div>
              </div>
            );
          })}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,marginTop:4}}>
            {["active","suspended","trial"].map(s=>{const cnt=companies.filter(c=>c.status===s).length;const m=STATUS_META[s];return(
              <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",backgroundColor:m.color}} /><span style={{fontFamily:F.body,fontSize:13,color:C.textSub}}>{m.label}</span></div>
                <span style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.text}}>{cnt}</span>
              </div>
            );})}
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,flex:1}}>All Companies</div>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.textMuted}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px 7px 30px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none",width:200}} />
          </div>
          <button onClick={()=>navigate("/platform/companies")} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${C.gold}44`,borderRadius:8,backgroundColor:C.goldMuted,color:C.gold,cursor:"pointer"}}>+ Add</button>
        </div>
        {/* Table header */}
        <div className="table-view" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 100px 110px 170px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
          {["Company","Plan","Admin","Agents","Last Active","Status","Actions"].map((h,i)=>(
            <div key={h} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px",paddingLeft:i===0?20:10,textAlign:i===6?"center":"left"}}>{h}</div>
          ))}
        </div>
        {loading?Array.from({length:6}).map((_,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 100px 110px 170px",padding:"12px 10px",borderBottom:`1px solid ${C.border}`,gap:10,alignItems:"center"}}>
            <div style={{paddingLeft:10}}><Shimmer h={13} w="60%" /><div style={{marginTop:4}}><Shimmer h={11} w="40%" /></div></div>
            <Shimmer h={20} w={60} r={20} /><Shimmer h={11} w="70%" /><Shimmer h={11} w={25} /><Shimmer h={11} w={50} /><Shimmer h={20} w={65} r={20} />
            <div style={{display:"flex",gap:6,justifyContent:"center"}}><Shimmer h={26} w={50} r={6} /><Shimmer h={26} w={50} r={6} /></div>
          </div>
        )):tableData.length===0?(
          <div style={{textAlign:"center",padding:"48px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>🏢</div><div>No companies found.</div></div>
        ):tableData.map((company,idx)=>(
          <div key={company.id} className="co-row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 90px 100px 110px 170px",borderBottom:`1px solid ${C.border}`,backgroundColor:idx%2===0?"transparent":C.surface+"66",transition:"background 0.12s",alignItems:"center"}}>
            <div style={{padding:"12px 20px",cursor:"pointer"}} onClick={()=>navigate(`/platform/companies/${company.id}`)}>
              <div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{company.name||"—"}</div>
              <div style={{fontFamily:F.body,fontSize:11,color:C.textMuted,marginTop:2}}>{company.industry||"General"} · {company.city||"India"}</div>
            </div>
            <div style={{padding:"12px 10px"}}><PlanBadge plan={company.plan} /></div>
            <div style={{padding:"12px 10px",fontFamily:F.body,fontSize:12,color:C.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company.adminEmail||"—"}</div>
            <div style={{padding:"12px 10px",textAlign:"center",fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>{company.agentCount||0}</div>
            <div style={{padding:"12px 10px",fontFamily:F.body,fontSize:12,color:C.textMuted}}>{fmtDate(company.lastActiveAt||company.createdAt)}</div>
            <div style={{padding:"12px 10px"}}><StatusBadge status={company.status||"active"} /></div>
            <div style={{padding:"12px 10px",display:"flex",gap:6,justifyContent:"center"}}>
              <button onClick={()=>navigate(`/platform/companies/${company.id}`)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 10px",minHeight:30,border:`1px solid ${C.border}`,borderRadius:6,backgroundColor:"transparent",color:C.textSub,cursor:"pointer"}}>View</button>
              <button onClick={()=>navigate(`/platform/billing?company=${company.id}`)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 10px",minHeight:30,border:`1px solid ${C.border}`,borderRadius:6,backgroundColor:"transparent",color:C.textSub,cursor:"pointer"}}>Plan</button>
              <button onClick={()=>setSuspend(company)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 10px",minHeight:30,border:`1px solid ${company.status==="suspended"?C.green+"66":C.red+"55"}`,borderRadius:6,backgroundColor:"transparent",color:company.status==="suspended"?C.green:C.red,cursor:"pointer"}}>
                {company.status==="suspended"?"↑ On":"⊘ Off"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {suspendTarget&&<SuspendModal company={suspendTarget} onConfirm={handleSuspend} onCancel={()=>setSuspend(null)} saving={suspending} />}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default PlatformDashboard;
