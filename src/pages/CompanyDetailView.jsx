// TIRAS CRM V2 — CompanyDetailView.jsx
// Platform Owner: full drill-down into one company — users, leads, stats, plan edit
// Real-time onSnapshot for company doc | Route: /platform/companies/:companyId

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, collection, query, where, onSnapshot, updateDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const C = { bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",blue:"#3B82F6",blueMuted:"rgba(59,130,246,0.12)",warn:"#F59E0B",text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555" };
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };
const PLAN_META   = { Basic:{color:C.blue,bg:C.blueMuted}, Growth:{color:C.gold,bg:C.goldMuted}, Enterprise:{color:"#8B5CF6",bg:"rgba(139,92,246,0.12)"} };
const STATUS_META = { active:{color:C.green,bg:C.greenMuted,label:"Active"}, suspended:{color:C.red,bg:C.redMuted,label:"Suspended"}, trial:{color:C.warn,bg:"rgba(245,158,11,0.12)",label:"Trial"}, inactive:{color:C.textMuted,bg:C.surfaceHov,label:"Inactive"} };
const STAGE_COLORS= { New:"#6B7280",Contacted:C.blue,Interested:"#F59E0B","Follow-up":"#F97316",Negotiation:"#8B5CF6","Closed Won":C.green,"Closed Lost":C.red };
const ROLE_LABELS = { platform_owner:"Platform Owner",company_admin:"Admin",manager:"Manager",agent:"Agent",support_agent:"Support" };

const fmtDate  = ts => { if(!ts)return"—"; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); };
const fmtShort = ts => { if(!ts)return"Never"; const d=ts.toDate?ts.toDate():new Date(ts); const diff=Math.floor((Date.now()-d.getTime())/86400000); if(diff===0)return"Today"; if(diff===1)return"Yesterday"; if(diff<7)return`${diff}d ago`; return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}); };

const Shimmer  = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
const Toast    = ({msg,type,onDone}) => { useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>; };

const StatBox  = ({icon,label,value,color}) => (
  <div style={{backgroundColor:C.surfaceHov,borderRadius:10,padding:16,textAlign:"center",flex:"1 1 110px"}}>
    <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
    <div style={{fontFamily:F.heading,fontSize:24,fontWeight:700,color:color||C.gold,lineHeight:1}}>{value}</div>
    <div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:4}}>{label}</div>
  </div>
);

const InfoRow = ({label,value,valueColor}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
    <span style={{fontFamily:F.body,fontSize:13,color:C.textSub,flexShrink:0}}>{label}</span>
    <span style={{fontFamily:F.body,fontSize:13,color:valueColor||C.text,fontWeight:600,textAlign:"right",maxWidth:"60%",wordBreak:"break-word"}}>{value}</span>
  </div>
);

// Plan + Status edit modal
const PlanModal = ({company,onClose,onSaved}) => {
  const [plan,setPlan]=useState(company.plan||"Basic");
  const [status,setStatus]=useState(company.status||"active");
  const [saving,setSaving]=useState(false);
  const save = async () => {
    setSaving(true);
    try{ await updateDoc(doc(db,COLLECTIONS.COMPANIES,company.id),{plan,status,updatedAt:serverTimestamp()}); onSaved({plan,status}); onClose(); }
    catch(e){ console.error(e); } finally{setSaving(false);}
  };
  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:200}} />
    <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:"min(380px,90vw)",zIndex:201}}>
      <div style={{fontFamily:F.heading,fontSize:20,fontWeight:700,color:C.text,marginBottom:20}}>Edit Plan — {company.name}</div>
      {[["Plan","plan",["Basic","Growth","Enterprise"]],["Status","status",["active","trial","suspended","inactive"]]].map(([label,key,opts])=>(
        <div key={key} style={{marginBottom:16}}>
          <label style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textSub,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>
          <select value={key==="plan"?plan:status} onChange={e=>key==="plan"?setPlan(e.target.value):setStatus(e.target.value)} style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}}>
            {opts.map(o=><option key={o} value={o}>{o[0].toUpperCase()+o.slice(1)}</option>)}
          </select>
        </div>
      ))}
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <button onClick={onClose} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:700,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer",opacity:saving?0.7:1}}>{saving?"Saving…":"Save"}</button>
      </div>
    </div>
  </>);
};

export const CompanyDetailView = () => {
  const { companyId } = useParams();
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();

  const [company,  setCompany]  = useState(null);
  const [users,    setUsers]    = useState([]);
  const [leads,    setLeads]    = useState([]);
  const [recentL,  setRecentL]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [tab,      setTab]      = useState("overview");
  const [planModal,setPlanModal]= useState(false);

  useEffect(()=>{
    if(!companyId)return;
    let r=0; const ck=()=>{r++;if(r>=4)setLoading(false);};

    // 1. Company doc — real-time
    const u1=onSnapshot(doc(db,COLLECTIONS.COMPANIES,companyId),s=>{
      if(s.exists())setCompany({id:s.id,...s.data()});
      ck();
    },e=>{console.error(e);ck();});

    // 2. Users in company
    const u2=onSnapshot(query(collection(db,COLLECTIONS.USERS),where("companyId","==",companyId)),s=>{setUsers(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});

    // 3. All leads (for stage breakdown)
    const u3=onSnapshot(query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId)),s=>{setLeads(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});

    // 4. Recent leads (last 5)
    const u4=onSnapshot(query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId),orderBy("createdAt","desc"),limit(5)),s=>{setRecentL(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});

    return()=>{u1();u2();u3();u4();};
  },[companyId]);

  const stageBreakdown = useMemo(()=>{
    const m={};leads.forEach(l=>{const s=l.stage||"New";m[s]=(m[s]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[leads]);

  const toggleSuspend = async () => {
    if(!company)return;
    const next=company.status==="suspended"?"active":"suspended";
    try{ await updateDoc(doc(db,COLLECTIONS.COMPANIES,company.id),{status:next,updatedAt:serverTimestamp()}); setToast({msg:`Company ${next==="suspended"?"suspended":"restored"}`,type:"success"}); }
    catch(e){ setToast({msg:"Failed: "+e.message,type:"error"}); }
  };

  const agentCount  = users.filter(u=>u.role==="agent").length;
  const mgrCount    = users.filter(u=>u.role==="manager").length;

  if(!isPlatformOwner) return <div style={{minHeight:"100vh",backgroundColor:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,color:C.textSub}}><div style={{textAlign:"center"}}><div style={{fontSize:40}}>🔒</div><div style={{marginTop:12}}>Platform Owner only.</div></div></div>;

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}.tab-btn:hover{color:${C.text}!important}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,fontFamily:F.body,color:C.text}}>

      {/* Sticky top bar */}
      <div style={{backgroundColor:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10,flexWrap:"wrap"}}>
        <button onClick={()=>navigate(-1)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>← Back</button>
        {loading?<Shimmer w={200} h={20} />:(
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company?.name||"Company"}</div>
            <div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:2}}>{company?.industry} · {company?.city||"India"}</div>
          </div>
        )}
        {!loading&&company&&(
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>setPlanModal(true)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>✏ Edit Plan</button>
            <button onClick={toggleSuspend} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${company.status==="suspended"?C.green+"66":C.red+"55"}`,borderRadius:8,backgroundColor:"transparent",color:company.status==="suspended"?C.green:C.red,cursor:"pointer"}}>
              {company.status==="suspended"?"↑ Restore":"⊘ Suspend"}
            </button>
          </div>
        )}
        <span style={{fontFamily:F.body,fontSize:12,color:C.green}}>● Live</span>
      </div>

      <div style={{padding:"20px 20px"}}>
        {/* Stat row */}
        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:20}}>
          {loading?Array.from({length:4}).map((_,i)=><div key={i} style={{flex:"1 1 110px",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,height:90}}><Shimmer h={12} w="60%" /><div style={{marginTop:10}}><Shimmer h={28} w="45%" /></div></div>):(
            <>
              <StatBox icon="📋" label="Total Leads"   value={leads.length.toLocaleString("en-IN")} color={C.gold} />
              <StatBox icon="👥" label="Agents"        value={agentCount}    color={C.green} />
              <StatBox icon="🧑‍💼" label="Managers"     value={mgrCount}      color={C.blue}  />
              <StatBox icon="👤" label="Total Users"   value={users.length}  color="#8B5CF6" />
            </>
          )}
        </div>

        {/* Company info strip */}
        {!loading&&company&&(
          <div style={{backgroundColor:C.surface,border:`1px solid ${company.status==="suspended"?C.red+"44":C.gold+"33"}`,borderRadius:12,padding:"12px 20px",marginBottom:20,display:"flex",flexWrap:"wrap",gap:20,alignItems:"center"}}>
            {[
              ["Plan", company.plan||"—", PLAN_META[company.plan]?.color||C.textSub],
              ["Status",(STATUS_META[company.status]||STATUS_META.active).label,(STATUS_META[company.status]||STATUS_META.active).color],
              ["Admin",company.adminEmail||"—",C.textSub],
              ["Joined",fmtDate(company.createdAt),C.textSub],
              ["Last Active",fmtShort(company.lastActiveAt),C.textSub],
            ].map(([label,value,color])=>(
              <div key={label}>
                <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{label}</div>
                <div style={{fontFamily:F.body,fontSize:13,fontWeight:600,color}}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
          {["overview","users","leads"].map(t=>(
            <button key={t} className="tab-btn" onClick={()=>setTab(t)} style={{fontFamily:F.heading,fontSize:14,fontWeight:700,padding:"10px 20px",border:"none",background:"none",color:tab===t?C.gold:C.textSub,borderBottom:`2px solid ${tab===t?C.gold:"transparent"}`,cursor:"pointer",textTransform:"capitalize",marginBottom:"-1px",transition:"color 0.15s"}}>
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
            <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Company Info</div>
              {loading?Array.from({length:6}).map((_,i)=><div key={i} style={{marginBottom:10}}><Shimmer h={14} /></div>):(
                company&&[
                  ["Name",company.name],["Admin Email",company.adminEmail],["Industry",company.industry],
                  ["City",company.city||"—"],["Phone",company.phone||"—"],["Joined",fmtDate(company.createdAt)],
                ].map(([l,v])=><InfoRow key={l} label={l} value={v||"—"} />)
              )}
            </div>
            <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Pipeline ({leads.length} leads)</div>
              {loading?Array.from({length:5}).map((_,i)=><div key={i} style={{marginBottom:10}}><Shimmer h={28} /></div>):stageBreakdown.length===0?(
                <div style={{textAlign:"center",padding:"28px 0",color:C.textSub,fontFamily:F.body,fontSize:13}}>No leads yet.</div>
              ):stageBreakdown.map(([stage,count])=>{
                const max=Math.max(...stageBreakdown.map(([,c])=>c),1);
                const col=STAGE_COLORS[stage]||C.textSub;
                return (
                  <div key={stage} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",backgroundColor:col,flexShrink:0}} />
                    <div style={{fontFamily:F.body,fontSize:12,color:C.textSub,width:100,flexShrink:0}}>{stage}</div>
                    <div style={{flex:1,height:6,borderRadius:99,backgroundColor:C.border,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${(count/max)*100}%`,backgroundColor:col,borderRadius:99}} />
                    </div>
                    <div style={{fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text,width:24,textAlign:"right",flexShrink:0}}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab==="users"&&(
          <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>Team Members ({users.length})</div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 100px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
              {["Name & Email","Role","Last Login","Status"].map(h=><div key={h} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 16px"}}>{h}</div>)}
            </div>
            {loading?Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 100px",padding:"12px 16px",borderBottom:`1px solid ${C.border}`,gap:12,alignItems:"center"}}>
                <div><Shimmer h={13} w="55%" /><div style={{marginTop:4}}><Shimmer h={11} w="70%" /></div></div>
                <Shimmer h={20} w="75px" r={20} /><Shimmer h={11} w="55px" /><Shimmer h={20} w="60px" r={20} />
              </div>
            )):users.length===0?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.textSub,fontFamily:F.body}}>No users yet.</div>
            ):users.map((user,idx)=>(
              <div key={user.id} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 100px",borderBottom:`1px solid ${C.border}`,backgroundColor:idx%2===0?"transparent":C.surface+"55",alignItems:"center"}}>
                <div style={{padding:"10px 16px"}}><div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{user.displayName||"—"}</div><div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:2}}>{user.email}</div></div>
                <div style={{padding:"10px 16px"}}><span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:C.goldMuted,color:C.gold}}>{ROLE_LABELS[user.role]||user.role||"—"}</span></div>
                <div style={{padding:"10px 16px",fontFamily:F.body,fontSize:12,color:C.textMuted}}>{fmtShort(user.lastLoginAt)}</div>
                <div style={{padding:"10px 16px"}}><span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:user.isActive!==false?C.greenMuted:C.redMuted,color:user.isActive!==false?C.green:C.red}}>{user.isActive!==false?"Active":"Off"}</span></div>
              </div>
            ))}
          </div>
        )}

        {/* LEADS */}
        {tab==="leads"&&(
          <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,flex:1}}>Recent Leads</div>
              <span style={{fontFamily:F.body,fontSize:12,color:C.textSub}}>{leads.length} total · showing last 5</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
              {["Name","Phone","Stage","Added"].map(h=><div key={h} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 16px"}}>{h}</div>)}
            </div>
            {loading?Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr",padding:"12px 16px",borderBottom:`1px solid ${C.border}`,gap:12,alignItems:"center"}}>
                <Shimmer h={13} w="60%" /><Shimmer h={11} w="70%" /><Shimmer h={20} w="70px" r={20} /><Shimmer h={11} w="50px" />
              </div>
            )):recentL.length===0?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.textSub,fontFamily:F.body}}>No leads yet.</div>
            ):recentL.map((lead,idx)=>{
              const col=STAGE_COLORS[lead.stage||"New"]||C.textSub;
              return (
                <div key={lead.id} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr",borderBottom:`1px solid ${C.border}`,backgroundColor:idx%2===0?"transparent":C.surface+"55",alignItems:"center"}}>
                  <div style={{padding:"10px 16px",fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{lead.name||"—"}</div>
                  <div style={{padding:"10px 16px",fontFamily:"monospace",fontSize:12,color:C.textSub}}>{lead.phone||"—"}</div>
                  <div style={{padding:"10px 16px"}}><span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:col+"22",color:col}}>{lead.stage||"New"}</span></div>
                  <div style={{padding:"10px 16px",fontFamily:F.body,fontSize:12,color:C.textMuted}}>{fmtShort(lead.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    {planModal&&company&&<PlanModal company={company} onClose={()=>setPlanModal(false)} onSaved={u=>{setCompany(c=>({...c,...u}));setToast({msg:"Plan updated",type:"success"});}} />}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default CompanyDetailView;
