// TIRAS CRM V2 — SubscriptionBillingManager.jsx
// Platform Owner: manage all company plans, log payments, track renewals
// Real-time onSnapshot | Three tabs | Log payment modal | Obsidian Gold

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  collection, query, onSnapshot, doc, updateDoc,
  addDoc, orderBy, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#121212", surface:"#1A1A1B", surfaceHov:"#222223", border:"#2A2A2B",
  gold:"#D4AF37", goldMuted:"rgba(212,175,55,0.12)",
  red:"#E63946",  redMuted:"rgba(230,57,70,0.12)",
  green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",
  blue:"#3B82F6", blueMuted:"rgba(59,130,246,0.12)",
  warn:"#F59E0B", warnMuted:"rgba(245,158,11,0.12)",
  text:"#F5F5F5", textSub:"#9A9A9A", textMuted:"#555555",
};
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };

const PLAN_PRICES = { Basic:1800, Growth:3000, Enterprise:null };
const PLAN_META   = {
  Basic:      { color:C.blue,    bg:C.blueMuted  },
  Growth:     { color:C.gold,    bg:C.goldMuted  },
  Enterprise: { color:"#8B5CF6", bg:"rgba(139,92,246,0.12)" },
};
const PAY_META = {
  paid:    { color:C.green,   bg:C.greenMuted,  label:"Paid"     },
  pending: { color:C.warn,    bg:C.warnMuted,   label:"Pending"  },
  failed:  { color:C.red,     bg:C.redMuted,    label:"Failed"   },
  refunded:{ color:C.textSub, bg:C.surfaceHov,  label:"Refunded" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtRupee = n => { if(!n&&n!==0)return"—"; if(n>=100000)return`₹${(n/100000).toFixed(1)}L`; if(n>=1000)return`₹${(n/1000).toFixed(1)}K`; return`₹${n.toLocaleString("en-IN")}`; };
const fmtDate  = ts => { if(!ts)return"—"; const d=ts.toDate?ts.toDate():(ts.seconds?new Date(ts.seconds*1000):new Date(ts)); return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); };
const daysUntil= ts => { if(!ts)return null; const d=ts.toDate?ts.toDate():new Date(ts.seconds*1000); return Math.ceil((d.getTime()-Date.now())/86400000); };
const startOfMonth=()=>{const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return Timestamp.fromDate(d);};

const exportCSV = (payments, cMap) => {
  const h=["Company","Plan","Amount","Status","Date","Razorpay ID"];
  const rows=payments.map(p=>[`"${cMap[p.companyId]||""}"`,p.plan||"",p.amount||0,p.status||"",fmtDate(p.createdAt),p.razorpayId||""].join(","));
  const blob=new Blob([[h.join(","),...rows].join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tiras-payments-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;

const Toast = ({msg,type,onDone}) => {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>;
};

const StatCard = ({icon,label,value,sub,color}) => (
  <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,flex:"1 1 155px",position:"relative",overflow:"hidden",transition:"border-color 0.15s,transform 0.15s"}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="translateY(0)";}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,backgroundColor:color||C.gold,borderRadius:"12px 12px 0 0"}} />
    <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
    <div style={{fontFamily:F.heading,fontSize:28,fontWeight:700,color:color||C.gold,lineHeight:1}}>{value}</div>
    <div style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,marginTop:6}}>{label}</div>
    {sub&&<div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:2}}>{sub}</div>}
  </div>
);

const PlanBadge = ({plan}) => { const m=PLAN_META[plan]||{color:C.textSub,bg:C.surfaceHov}; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,border:`1px solid ${m.color}33`}}>{plan||"—"}</span>; };
const PayBadge  = ({status}) => { const m=PAY_META[status]||PAY_META.pending; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color}}>{m.label}</span>; };

const TH = ({label,pl=16,center}) => <div style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:`10px ${pl}px`,textAlign:center?"center":"left"}}>{label}</div>;

// Log Payment Modal
const LogModal = ({companies,onClose,onLogged}) => {
  const [form,setForm] = useState({companyId:"",plan:"Basic",amount:"",status:"paid",razorpayId:"",note:""});
  const [saving,setSaving] = useState(false);
  const [err,setErr]       = useState("");

  const set = k => e => {
    const val=e.target.value;
    setForm(f=>{
      const next={...f,[k]:val};
      if(k==="plan"&&PLAN_PRICES[val])next.amount=String(PLAN_PRICES[val]);
      return next;
    });
  };

  const save = async () => {
    if(!form.companyId){setErr("Select a company.");return;}
    if(!form.amount||isNaN(Number(form.amount))){setErr("Enter a valid amount.");return;}
    setSaving(true);
    try {
      const payload={companyId:form.companyId,plan:form.plan,amount:Number(form.amount),status:form.status,razorpayId:form.razorpayId.trim()||null,note:form.note.trim()||null,createdAt:serverTimestamp(),loggedBy:"platform_owner"};
      await addDoc(collection(db,COLLECTIONS.PAYMENTS),payload);
      await updateDoc(doc(db,COLLECTIONS.COMPANIES,form.companyId),{plan:form.plan,lastPaymentAt:serverTimestamp()});
      onLogged("Payment logged successfully","success");
      onClose();
    } catch(e){setErr(e.message);} finally{setSaving(false);}
  };

  const sel = (label,key,opts) => (
    <div style={{marginBottom:14}}>
      <label style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textSub,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>
      <select value={form[key]} onChange={set(key)} style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}}>
        <option value="">— Select —</option>
        {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const inp = (label,key,type="text") => (
    <div style={{marginBottom:14}}>
      <label style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textSub,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>
      <input type={type} value={form[key]} onChange={set(key)} style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}} />
    </div>
  );

  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:200}} />
    <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:"min(460px,90vw)",zIndex:201,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:F.heading,fontSize:20,fontWeight:700,color:C.text}}>Log Payment</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.textSub,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
      </div>
      {sel("Company *","companyId",companies.map(c=>[c.id,c.name]))}
      {sel("Plan","plan",[["Basic","Basic — ₹1,800"],["Growth","Growth — ₹3,000"],["Enterprise","Enterprise — Custom"]])}
      {inp("Amount (₹) *","amount","number")}
      {sel("Status","status",[["paid","Paid"],["pending","Pending"],["failed","Failed"],["refunded","Refunded"]])}
      {inp("Razorpay Payment ID","razorpayId")}
      {inp("Note (optional)","note")}
      {err&&<div style={{marginBottom:14,padding:10,backgroundColor:C.redMuted,border:`1px solid ${C.red}44`,borderRadius:8,fontFamily:F.body,fontSize:12,color:C.red}}>{err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:700,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer",opacity:saving?0.7:1}}>{saving?"Saving…":"Log Payment"}</button>
      </div>
    </div>
  </>);
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export const SubscriptionBillingManager = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [companies, setCompanies] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [showLog,   setShowLog]   = useState(false);
  const [tab,       setTab]       = useState("subscriptions");
  const [search,    setSearch]    = useState("");
  const [planF,     setPlanF]     = useState("All");
  const [editingPlan, setEditingPlan] = useState(null);

  // Real-time
  useEffect(()=>{
    let r=0; const ck=()=>{r++;if(r>=2)setLoading(false);};
    const u1=onSnapshot(query(collection(db,COLLECTIONS.COMPANIES),orderBy("createdAt","desc")),s=>{setCompanies(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.PAYMENTS),orderBy("createdAt","desc")),s=>{setPayments(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    return()=>{u1();u2();};
  },[]);

  const changePlan = async (companyId, plan) => {
    try{await updateDoc(doc(db,COLLECTIONS.COMPANIES,companyId),{plan,updatedAt:serverTimestamp()});setToast({msg:"Plan updated",type:"success"});}
    catch(e){setToast({msg:"Failed: "+e.message,type:"error"});}
    setEditingPlan(null);
  };

  const companyMap = useMemo(()=>{const m={};companies.forEach(c=>{m[c.id]=c.name;});return m;},[companies]);

  const monthMs = startOfMonth().toMillis();
  const totalRevenue  = payments.filter(p=>p.status==="paid").reduce((s,p)=>s+(p.amount||0),0);
  const monthRevenue  = payments.filter(p=>p.status==="paid"&&(p.createdAt?.seconds||0)*1000>=monthMs).reduce((s,p)=>s+(p.amount||0),0);
  const pendingCount  = payments.filter(p=>p.status==="pending").length;
  const expiringSoon  = companies.filter(c=>{const d=daysUntil(c.currentPeriodEnd);return d!==null&&d>=0&&d<=7;}).length;

  const MRR_MAP = {Basic:1800,Growth:3000,Enterprise:5000};
  const mrr = companies.filter(c=>c.status==="active").reduce((s,c)=>s+(MRR_MAP[c.plan]||0),0);

  const filteredSubs = useMemo(()=>{
    let r=[...companies];
    if(search.trim()){const q=search.toLowerCase();r=r.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.adminEmail||"").toLowerCase().includes(q));}
    if(planF!=="All") r=r.filter(c=>c.plan===planF);
    return r;
  },[companies,search,planF]);

  const filteredPay = useMemo(()=>{
    if(!search.trim())return payments;
    const q=search.toLowerCase();
    return payments.filter(p=>(companyMap[p.companyId]||"").toLowerCase().includes(q)||(p.razorpayId||"").toLowerCase().includes(q));
  },[payments,search,companyMap]);

  const renewals = useMemo(()=>companies.filter(c=>c.currentPeriodEnd).map(c=>({...c,daysLeft:daysUntil(c.currentPeriodEnd)})).sort((a,b)=>(a.daysLeft??9999)-(b.daysLeft??9999)),[companies]);

  if(!isPlatformOwner) return <div style={{minHeight:"100vh",backgroundColor:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,color:C.textSub}}><div style={{textAlign:"center"}}><div style={{fontSize:40}}>🔒</div><div style={{marginTop:12}}>Platform Owner only.</div></div></div>;

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}.brow:hover{background-color:${C.surfaceHov}!important}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px",fontFamily:F.body,color:C.text}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Platform Owner</div>
          <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Subscription & Billing</h1>
          <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>Manage plans, payments and renewals · <span style={{color:C.green}}>● Live</span></div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>exportCSV(payments,companyMap)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"9px 16px",minHeight:40,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>↓ Export</button>
          <button onClick={()=>setShowLog(true)} style={{fontFamily:F.body,fontSize:13,fontWeight:700,padding:"9px 18px",minHeight:40,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer"}}>+ Log Payment</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginBottom:24}}>
        <StatCard icon="💰" label="Total Revenue"   value={loading?"…":fmtRupee(totalRevenue)}  sub="all paid" color={C.green} />
        <StatCard icon="📅" label="This Month"      value={loading?"…":fmtRupee(monthRevenue)}  sub="subscriptions" color={C.gold} />
        <StatCard icon="📈" label="Est. MRR"        value={loading?"…":fmtRupee(mrr)}           sub="active companies" color:C.blue color={C.blue} />
        <StatCard icon="⏳" label="Pending"         value={loading?"…":pendingCount}             sub="payments" color={C.warn} />
        <StatCard icon="🔔" label="Renewing Soon"   value={loading?"…":expiringSoon}             sub="within 7 days" color={expiringSoon>0?C.red:C.textSub} />
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
        {[["subscriptions","Subscriptions"],["history","Payment History"],["renewals",`Renewals${expiringSoon>0?` (${expiringSoon})`:""}`]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{fontFamily:F.heading,fontSize:14,fontWeight:700,padding:"10px 20px",border:"none",background:"none",color:tab===id?C.gold:C.textSub,borderBottom:`2px solid ${tab===id?C.gold:"transparent"}`,cursor:"pointer",marginBottom:"-1px",transition:"color 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* Search + plan filter */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.textMuted}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies…" style={{width:"100%",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px 9px 34px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}} />
        </div>
        {tab==="subscriptions"&&(
          <div style={{display:"flex",gap:6}}>
            {["All","Basic","Growth","Enterprise"].map(p=>(
              <button key={p} onClick={()=>setPlanF(p)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${planF===p?C.gold:C.border}`,borderRadius:20,backgroundColor:planF===p?C.goldMuted:"transparent",color:planF===p?C.gold:C.textSub,cursor:"pointer"}}>
                {p==="All"?"All Plans":p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SUBSCRIPTIONS TAB */}
      {tab==="subscriptions"&&(
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"2.2fr 1.2fr 1fr 1.2fr 130px 160px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
            <TH label="Company" pl={20} /><TH label="Plan" /><TH label="Status" /><TH label="Period End" /><TH label="Value" /><TH label="Actions" center />
          </div>
          {loading?Array.from({length:6}).map((_,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2.2fr 1.2fr 1fr 1.2fr 130px 160px",padding:"12px 16px",borderBottom:`1px solid ${C.border}`,gap:12,alignItems:"center"}}>
              <div><Shimmer h={13} w="60%" /><div style={{marginTop:4}}><Shimmer h={11} w="40%" /></div></div>
              <Shimmer h={20} w={65} r={20} /><Shimmer h={20} w={60} r={20} /><Shimmer h={11} w={75} /><Shimmer h={13} w={55} />
              <div style={{display:"flex",gap:6,justifyContent:"center"}}><Shimmer h={28} w={65} r={6} /><Shimmer h={28} w={55} r={6} /></div>
            </div>
          )):filteredSubs.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>🏢</div><div>No companies match.</div></div>
          ):filteredSubs.map((company,idx)=>{
            const dLeft=daysUntil(company.currentPeriodEnd);
            const expiring=dLeft!==null&&dLeft<=7&&dLeft>=0;
            const expired =dLeft!==null&&dLeft<0;
            const price=PLAN_PRICES[company.plan];
            const isEditing=editingPlan===company.id;
            const statusColors={active:C.green,suspended:C.red,trial:C.warn,inactive:C.textSub};
            const statusLabels={active:"Active",suspended:"Suspended",trial:"Trial",inactive:"Inactive"};
            return (
              <div key={company.id} className="brow" style={{display:"grid",gridTemplateColumns:"2.2fr 1.2fr 1fr 1.2fr 130px 160px",borderBottom:`1px solid ${C.border}`,backgroundColor:expired?C.redMuted+"33":expiring?C.warnMuted+"33":idx%2===0?"transparent":C.surface+"55",transition:"background 0.12s",alignItems:"center"}}>
                <div style={{padding:"12px 20px",cursor:"pointer"}} onClick={()=>navigate(`/platform/companies/${company.id}`)}>
                  <div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{company.name||"—"}</div>
                  <div style={{fontFamily:F.body,fontSize:11,color:C.textMuted,marginTop:2}}>{company.adminEmail||"—"}</div>
                </div>
                <div style={{padding:"12px 16px"}}>
                  {isEditing?(
                    <select autoFocus defaultValue={company.plan} onBlur={e=>{if(e.target.value!==company.plan)changePlan(company.id,e.target.value);else setEditingPlan(null);}} onChange={e=>changePlan(company.id,e.target.value)} style={{backgroundColor:C.surfaceHov,border:`1px solid ${C.gold}`,borderRadius:6,padding:"4px 8px",color:C.text,fontFamily:F.body,fontSize:12,outline:"none"}}>
                      <option>Basic</option><option>Growth</option><option>Enterprise</option>
                    </select>
                  ):(
                    <span onClick={()=>setEditingPlan(company.id)} style={{cursor:"pointer"}} title="Click to change plan">
                      <PlanBadge plan={company.plan} />
                      <span style={{fontFamily:F.body,fontSize:10,color:C.textMuted,marginLeft:4}}>✏</span>
                    </span>
                  )}
                </div>
                <div style={{padding:"12px 16px"}}>
                  <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:(statusColors[company.status||"active"]||C.textSub)+"22",color:statusColors[company.status||"active"]||C.textSub}}>
                    {statusLabels[company.status||"active"]||"Active"}
                  </span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  {company.currentPeriodEnd?(
                    <div>
                      <div style={{fontFamily:F.body,fontSize:12,color:expired?C.red:expiring?C.warn:C.textSub}}>{fmtDate(company.currentPeriodEnd)}</div>
                      <div style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:expired?C.red:expiring?C.warn:C.textMuted,marginTop:2}}>
                        {expired?`${Math.abs(dLeft)}d overdue`:dLeft===0?"Expires today":`${dLeft}d left`}
                      </div>
                    </div>
                  ):<span style={{fontFamily:F.body,fontSize:12,color:C.textMuted}}>Not set</span>}
                </div>
                <div style={{padding:"12px 16px"}}>
                  <span style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.green}}>{price?fmtRupee(price):"Custom"}</span>
                </div>
                <div style={{padding:"12px 16px",display:"flex",gap:6,justifyContent:"center"}}>
                  <button onClick={()=>setShowLog(true)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"6px 10px",minHeight:32,border:`1px solid ${C.green}55`,borderRadius:6,backgroundColor:C.greenMuted,color:C.green,cursor:"pointer"}}>+ Pay</button>
                  <button onClick={()=>navigate(`/platform/companies/${company.id}`)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"6px 10px",minHeight:32,border:`1px solid ${C.border}`,borderRadius:6,backgroundColor:"transparent",color:C.textSub,cursor:"pointer"}}>View</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAYMENT HISTORY TAB */}
      {tab==="history"&&(
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.5fr 100px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
            <TH label="Company" pl={20} /><TH label="Plan" /><TH label="Amount" /><TH label="Status" /><TH label="Razorpay ID" /><TH label="Date" />
          </div>
          {loading?Array.from({length:8}).map((_,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.5fr 100px",padding:"11px 16px",borderBottom:`1px solid ${C.border}`,gap:12,alignItems:"center"}}>
              <Shimmer h={13} w="60%" /><Shimmer h={20} w={60} r={20} /><Shimmer h={13} w={55} /><Shimmer h={20} w={55} r={20} /><Shimmer h={11} w="80%" /><Shimmer h={11} w={55} />
            </div>
          )):filteredPay.length===0?(
            <div style={{textAlign:"center",padding:"48px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>💳</div><div>No payments yet.</div></div>
          ):filteredPay.map((pay,idx)=>(
            <div key={pay.id} className="brow" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.5fr 100px",borderBottom:`1px solid ${C.border}`,backgroundColor:idx%2===0?"transparent":C.surface+"55",transition:"background 0.12s",alignItems:"center"}}>
              <div style={{padding:"10px 20px",fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{companyMap[pay.companyId]||pay.companyId||"—"}</div>
              <div style={{padding:"10px 16px"}}><PlanBadge plan={pay.plan} /></div>
              <div style={{padding:"10px 16px",fontFamily:F.heading,fontSize:15,fontWeight:700,color:pay.status==="paid"?C.green:C.text}}>{fmtRupee(pay.amount)}</div>
              <div style={{padding:"10px 16px"}}><PayBadge status={pay.status} /></div>
              <div style={{padding:"10px 16px",fontFamily:"monospace",fontSize:11,color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pay.razorpayId||"—"}</div>
              <div style={{padding:"10px 16px",fontFamily:F.body,fontSize:12,color:C.textMuted}}>{fmtDate(pay.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* RENEWALS TAB */}
      {tab==="renewals"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {loading?Array.from({length:5}).map((_,i)=>(
            <div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}><Shimmer w={64} h={64} r={10} /><div style={{flex:1}}><Shimmer h={14} w="50%" /><div style={{marginTop:8}}><Shimmer h={11} w="35%" /></div></div><Shimmer w={80} h={32} r={8} /></div>
          )):renewals.length===0?(
            <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,textAlign:"center",padding:"52px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>📅</div><div>No renewal dates set.</div></div>
          ):renewals.map(company=>{
            const expired=company.daysLeft<0, expiring=!expired&&company.daysLeft<=7;
            const col=expired?C.red:expiring?C.warn:C.green;
            return (
              <div key={company.id} style={{backgroundColor:C.surface,border:`1px solid ${expired?C.red+"44":expiring?C.warn+"44":C.border}`,borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{width:64,height:64,borderRadius:10,backgroundColor:col+"18",border:`2px solid ${col}44`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontFamily:F.heading,fontSize:22,fontWeight:700,color:col,lineHeight:1}}>{expired?Math.abs(company.daysLeft):company.daysLeft}</div>
                  <div style={{fontFamily:F.body,fontSize:9,color:col,textTransform:"uppercase",letterSpacing:"0.05em"}}>{expired?"past":"days"}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>{company.name}</div>
                  <div style={{fontFamily:F.body,fontSize:12,color:C.textSub,marginTop:3}}>{company.plan} · Expires {fmtDate(company.currentPeriodEnd)}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:20,backgroundColor:col+"18",color:col,border:`1px solid ${col}44`}}>{expired?"Expired":expiring?"Soon":"Active"}</span>
                  <button onClick={()=>setShowLog(true)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"8px 16px",minHeight:36,border:`1px solid ${C.green}55`,borderRadius:8,backgroundColor:C.greenMuted,color:C.green,cursor:"pointer"}}>Renew</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {showLog&&<LogModal companies={companies} onClose={()=>setShowLog(false)} onLogged={(msg,type)=>setToast({msg,type})} />}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default SubscriptionBillingManager;
