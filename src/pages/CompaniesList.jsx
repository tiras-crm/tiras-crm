// TIRAS CRM V2 — CompaniesList.jsx
// Platform Owner: full company management — filter, bulk suspend, add, CSV export
// Real-time onSnapshot | Mobile cards + Desktop table | Obsidian Gold

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, getDocs, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const C = { bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",blue:"#3B82F6",blueMuted:"rgba(59,130,246,0.12)",warn:"#F59E0B",warnMuted:"rgba(245,158,11,0.12)",text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555" };
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };
const PLAN_META   = { Basic:{color:C.blue,bg:C.blueMuted}, Growth:{color:C.gold,bg:C.goldMuted}, Enterprise:{color:"#8B5CF6",bg:"rgba(139,92,246,0.12)"} };
const STATUS_META = { active:{color:C.green,bg:C.greenMuted,label:"Active"}, suspended:{color:C.red,bg:C.redMuted,label:"Suspended"}, trial:{color:C.warn,bg:C.warnMuted,label:"Trial"}, inactive:{color:C.textMuted,bg:C.surfaceHov,label:"Inactive"} };
const INDUSTRIES  = ["All Industries","Staffing","Real Estate","Manufacturing","EdTech","Healthcare","Retail","Finance","IT Services","Logistics","Other"];

const fmtDate = ts => { if(!ts)return"—"; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); };
const exportCSV = (rows) => {
  const h=["Name","Industry","Plan","Status","Admin Email","Agents","Joined"];
  const lines=rows.map(c=>[`"${c.name||""}"`,`"${c.industry||""}"`,c.plan||"",c.status||"",`"${c.adminEmail||""}"`,c.agentCount||0,fmtDate(c.createdAt)].join(","));
  const blob=new Blob([[h.join(","),...lines].join("\n")],{type:"text/csv"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`tiras-companies-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
};

const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
const Toast   = ({msg,type,onDone}) => { useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>; };
const PlanBadge  = ({plan})   => { const m=PLAN_META[plan]||{color:C.textSub,bg:C.surfaceHov}; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,border:`1px solid ${m.color}33`}}>{plan||"—"}</span>; };
const StatusBadge= ({status}) => { const m=STATUS_META[status]||STATUS_META.inactive; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:5,height:5,borderRadius:"50%",backgroundColor:m.color,display:"inline-block"}} />{m.label}</span>; };
const Chip = ({label,active,onClick}) => <button onClick={onClick} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:20,border:`1px solid ${active?C.gold:C.border}`,backgroundColor:active?C.goldMuted:"transparent",color:active?C.gold:C.textSub,cursor:"pointer",whiteSpace:"nowrap",minHeight:32}}>{label}</button>;

// Add Company Modal
const AddModal = ({onClose,onAdded}) => {
  const [form,setForm]=useState({name:"",adminEmail:"",industry:"Staffing",plan:"Basic",city:"",phone:""});
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const save = async () => {
    if(!form.name.trim()||!form.adminEmail.trim()){setErr("Name and email required.");return;}
    setSaving(true);
    try {
      const ref=await addDoc(collection(db,COLLECTIONS.COMPANIES),{...form,name:form.name.trim(),adminEmail:form.adminEmail.trim(),status:"trial",agentCount:0,leadCount:0,createdAt:serverTimestamp(),lastActiveAt:serverTimestamp()});
      onAdded({id:ref.id,...form,status:"trial",agentCount:0,leadCount:0});
      onClose();
    } catch(e){setErr(e.message);} finally{setSaving(false);}
  };
  const inp = (label,key,type="text",opts) => (
    <div style={{marginBottom:14}}>
      <label style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.textSub,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>
      {opts?(
        <select value={form[key]} onChange={set(key)} style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}}>
          {opts.map(o=><option key={o}>{o}</option>)}
        </select>
      ):(
        <input type={type} value={form[key]} onChange={set(key)} style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}} />
      )}
    </div>
  );
  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:200}} />
    <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:"min(460px,90vw)",zIndex:201,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:F.heading,fontSize:20,fontWeight:700,color:C.text}}>Add Company</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.textSub,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
      </div>
      {inp("Company Name *","name")} {inp("Admin Email *","adminEmail","email")}
      {inp("Industry","industry","text",INDUSTRIES.slice(1))} {inp("Plan","plan","text",["Basic","Growth","Enterprise"])}
      {inp("City","city")} {inp("Phone","phone","tel")}
      {err&&<div style={{marginBottom:14,padding:10,backgroundColor:C.redMuted,border:`1px solid ${C.red}44`,borderRadius:8,fontFamily:F.body,fontSize:12,color:C.red}}>{err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:700,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer",opacity:saving?0.7:1}}>{saving?"Adding…":"Add Company"}</button>
      </div>
    </div>
  </>);
};

export const CompaniesList = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [companies,setCompanies]=useState([]); const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null); const [showAdd,setShowAdd]=useState(false);
  const [selected,setSelected]=useState(new Set()); const [bulkSaving,setBulkSaving]=useState(false);
  const [search,setSearch]=useState(""); const [planF,setPlanF]=useState("All"); const [statusF,setStatusF]=useState("All"); const [indF,setIndF]=useState("All Industries");
  const [view,setView]=useState("table"); // table | cards

  useEffect(()=>{
    const u=onSnapshot(query(collection(db,COLLECTIONS.COMPANIES),orderBy("createdAt","desc")),s=>{setCompanies(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},e=>{console.error(e);setLoading(false);});
    return()=>u();
  },[]);

  const filtered=useMemo(()=>{
    let r=[...companies];
    if(search.trim()){const q=search.toLowerCase();r=r.filter(c=>(c.name||"").toLowerCase().includes(q)||(c.adminEmail||"").toLowerCase().includes(q)||(c.city||"").toLowerCase().includes(q));}
    if(planF!=="All")   r=r.filter(c=>c.plan===planF);
    if(statusF!=="All") r=r.filter(c=>(c.status||"active")===statusF);
    if(indF!=="All Industries") r=r.filter(c=>c.industry===indF);
    return r;
  },[companies,search,planF,statusF,indF]);

  const toggleOne = id => setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll = () => selected.size===filtered.length?setSelected(new Set()):setSelected(new Set(filtered.map(c=>c.id)));

  const toggleStatus = async company => {
    const next=company.status==="suspended"?"active":"suspended";
    try{ await updateDoc(doc(db,COLLECTIONS.COMPANIES,company.id),{status:next}); setToast({msg:`${company.name} ${next==="suspended"?"suspended":"restored"}`,type:"success"}); }
    catch(e){ setToast({msg:"Failed: "+e.message,type:"error"}); }
  };

  const bulkSuspend = async () => {
    setBulkSaving(true);
    try{ await Promise.all([...selected].map(id=>updateDoc(doc(db,COLLECTIONS.COMPANIES,id),{status:"suspended"}))); setSelected(new Set()); setToast({msg:`${selected.size} companies suspended`,type:"success"}); }
    catch(e){ setToast({msg:"Failed: "+e.message,type:"error"}); } finally{setBulkSaving(false);}
  };

  if(!isPlatformOwner) return <div style={{minHeight:"100vh",backgroundColor:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,color:C.textSub}}><div style={{textAlign:"center"}}><div style={{fontSize:40}}>🔒</div><div style={{marginTop:12}}>Platform Owner only.</div></div></div>;

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}.co-row:hover{background-color:${C.surfaceHov}!important}.co-card:hover{border-color:${C.gold}55!important;transform:translateY(-1px)}@media(max-width:640px){.tv{display:none!important}.cv{display:block!important}}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px",fontFamily:F.body,color:C.text}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Platform Owner</div>
          <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Companies</h1>
          <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>{loading?"Loading…":`${filtered.length} of ${companies.length} · `}<span style={{color:C.green}}>● Live</span></div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>exportCSV(filtered)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"9px 16px",minHeight:40,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>↓ CSV</button>
          {["table","cards"].map(v=><button key={v} onClick={()=>setView(v)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"9px 14px",minHeight:40,border:`1px solid ${view===v?C.gold:C.border}`,borderRadius:8,backgroundColor:view===v?C.goldMuted:"transparent",color:view===v?C.gold:C.textSub,cursor:"pointer"}}>{v==="table"?"⊟":"⊞"}</button>)}
          <button onClick={()=>setShowAdd(true)} style={{fontFamily:F.body,fontSize:13,fontWeight:700,padding:"9px 18px",minHeight:40,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer"}}>+ Add</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.textMuted}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, city…" style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px 10px 36px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}} />
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {["All","Basic","Growth","Enterprise"].map(p=><Chip key={p} label={p==="All"?"All Plans":p} active={planF===p} onClick={()=>setPlanF(p)} />)}
          <div style={{width:1,height:20,backgroundColor:C.border,alignSelf:"center"}} />
          {["All","active","trial","suspended"].map(s=><Chip key={s} label={s==="All"?"All Status":(STATUS_META[s]?.label||s)} active={statusF===s} onClick={()=>setStatusF(s)} />)}
          <div style={{width:1,height:20,backgroundColor:C.border,alignSelf:"center"}} />
          <select value={indF} onChange={e=>setIndF(e.target.value)} style={{backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",color:C.text,fontFamily:F.body,fontSize:12,cursor:"pointer",outline:"none"}}>
            {INDUSTRIES.map(i=><option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="tv" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"40px 2.2fr 1fr 1.2fr 80px 110px 100px 150px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
            <input type="checkbox" checked={filtered.length>0&&selected.size===filtered.length} onChange={toggleAll} style={{cursor:"pointer",accentColor:C.gold}} />
          </div>
          {["Company","Plan","Admin","Agents","Status","Joined","Actions"].map((h,i)=>(
            <div key={h} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px",paddingLeft:i===0?20:10,textAlign:i===6?"center":"left"}}>{h}</div>
          ))}
        </div>
        {loading?Array.from({length:7}).map((_,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"40px 2.2fr 1fr 1.2fr 80px 110px 100px 150px",padding:"12px 10px",borderBottom:`1px solid ${C.border}`,gap:10,alignItems:"center"}}>
            <Shimmer w={16} h={16} r={3} />
            <div style={{paddingLeft:10}}><Shimmer h={13} w="60%" /><div style={{marginTop:4}}><Shimmer h={11} w="40%" /></div></div>
            <Shimmer h={20} w={60} r={20} /><Shimmer h={11} w="65%" /><Shimmer h={11} w={25} /><Shimmer h={20} w={65} r={20} /><Shimmer h={11} w={55} />
            <div style={{display:"flex",gap:6,justifyContent:"center"}}><Shimmer h={26} w={46} r={6} /><Shimmer h={26} w={46} r={6} /></div>
          </div>
        )):filtered.length===0?(
          <div style={{textAlign:"center",padding:"52px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>🏢</div><div>No companies match.</div></div>
        ):filtered.map((company,idx)=>(
          <div key={company.id} className="co-row" style={{display:"grid",gridTemplateColumns:"40px 2.2fr 1fr 1.2fr 80px 110px 100px 150px",borderBottom:`1px solid ${C.border}`,backgroundColor:selected.has(company.id)?C.goldMuted:idx%2===0?"transparent":C.surface+"55",transition:"background 0.12s",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
              <input type="checkbox" checked={selected.has(company.id)} onChange={()=>toggleOne(company.id)} style={{cursor:"pointer",accentColor:C.gold}} />
            </div>
            <div style={{padding:"12px 20px",cursor:"pointer"}} onClick={()=>navigate(`/platform/companies/${company.id}`)}>
              <div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{company.name||"—"}</div>
              <div style={{fontFamily:F.body,fontSize:11,color:C.textMuted,marginTop:2}}>{company.industry||"—"} · {company.city||"India"}</div>
            </div>
            <div style={{padding:"10px"}}><PlanBadge plan={company.plan} /></div>
            <div style={{padding:"10px",fontFamily:F.body,fontSize:12,color:C.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company.adminEmail||"—"}</div>
            <div style={{padding:"10px",textAlign:"center",fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>{company.agentCount||0}</div>
            <div style={{padding:"10px"}}><StatusBadge status={company.status||"active"} /></div>
            <div style={{padding:"10px",fontFamily:F.body,fontSize:12,color:C.textMuted}}>{fmtDate(company.createdAt)}</div>
            <div style={{padding:"10px",display:"flex",gap:6,justifyContent:"center"}}>
              <button onClick={()=>navigate(`/platform/companies/${company.id}`)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 10px",minHeight:30,border:`1px solid ${C.border}`,borderRadius:6,backgroundColor:"transparent",color:C.textSub,cursor:"pointer"}}>View</button>
              <button onClick={()=>toggleStatus(company)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 10px",minHeight:30,border:`1px solid ${company.status==="suspended"?C.green+"66":C.red+"55"}`,borderRadius:6,backgroundColor:"transparent",color:company.status==="suspended"?C.green:C.red,cursor:"pointer"}}>
                {company.status==="suspended"?"↑":"⊘"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="cv" style={{display:"none"}}>
        {loading?Array.from({length:4}).map((_,i)=>(
          <div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
            <Shimmer h={15} w="55%" /><div style={{marginTop:8}}><Shimmer h={12} w="70%" /></div><div style={{marginTop:10,display:"flex",gap:8}}><Shimmer h={22} w="60px" r={20} /><Shimmer h={22} w="60px" r={20} /></div>
          </div>
        )):filtered.map(company=>(
          <div key={company.id} className="co-card" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10,transition:"border-color 0.15s,transform 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={()=>navigate(`/platform/companies/${company.id}`)}>{company.name||"—"}</div>
                <div style={{fontFamily:F.body,fontSize:12,color:C.textMuted,marginTop:2}}>{company.industry||"—"} · {company.city||"India"}</div>
              </div>
              <StatusBadge status={company.status||"active"} />
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              <PlanBadge plan={company.plan} />
              <span style={{fontFamily:F.body,fontSize:11,padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`,color:C.textSub}}>{company.agentCount||0} agents</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>navigate(`/platform/companies/${company.id}`)} style={{flex:1,padding:"8px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer",minHeight:40}}>View</button>
              <button onClick={()=>toggleStatus(company)} style={{flex:1,padding:"8px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${company.status==="suspended"?C.green+"66":C.red+"55"}`,borderRadius:8,backgroundColor:"transparent",color:company.status==="suspended"?C.green:C.red,cursor:"pointer",minHeight:40}}>
                {company.status==="suspended"?"Restore":"Suspend"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Bulk bar */}
    {selected.size>0&&(
      <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",backgroundColor:C.surface,border:`1px solid ${C.gold}55`,borderRadius:20,padding:"10px 20px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",zIndex:50,fontFamily:F.body}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text}}>{selected.size} selected</div>
        <div style={{width:1,height:20,backgroundColor:C.border}} />
        <button onClick={bulkSuspend} disabled={bulkSaving} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",border:`1px solid ${C.red}44`,borderRadius:8,backgroundColor:C.redMuted,color:C.red,cursor:"pointer",minHeight:36}}>{bulkSaving?"Working…":"Suspend All"}</button>
        <button onClick={()=>setSelected(new Set())} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:20,padding:0,lineHeight:1}}>×</button>
      </div>
    )}

    {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdded={()=>setToast({msg:"Company added","type":"success"})} />}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default CompaniesList;
