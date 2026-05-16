// TIRAS CRM V2 — MyTeamLeads.jsx
// Manager sees all leads across his agents — filter, search, reassign
// Real-time onSnapshot | Mobile cards + Desktop table | Obsidian Gold

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const C = {
  bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",
  gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",
  red:"#E63946",redMuted:"rgba(230,57,70,0.12)",
  green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",
  blue:"#3B82F6",blueMuted:"rgba(59,130,246,0.12)",
  text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555",
};
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };

const STAGE_META = {
  New:{color:"#6B7280",bg:"rgba(107,114,128,0.12)"},Contacted:{color:C.blue,bg:C.blueMuted},
  Interested:{color:"#F59E0B",bg:"rgba(245,158,11,0.12)"},"Follow-up":{color:"#F97316",bg:"rgba(249,115,22,0.12)"},
  Negotiation:{color:"#8B5CF6",bg:"rgba(139,92,246,0.12)"},"Closed Won":{color:C.green,bg:C.greenMuted},"Closed Lost":{color:C.red,bg:C.redMuted},
};
const TEMP_META = { Hot:{color:C.red,icon:"🔥"}, Warm:{color:"#F59E0B",icon:"☀️"}, Cold:{color:C.blue,icon:"❄️"}, Dead:{color:"#6B7280",icon:"💀"} };
const STAGES = ["All","New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const TEMPS  = ["All","Hot","Warm","Cold","Dead"];

const fmtDate = ts => { if(!ts) return "—"; const d=ts.toDate?ts.toDate():new Date(ts); const diff=Math.floor((Date.now()-d.getTime())/86400000); if(diff===0) return "Today"; if(diff===1) return "Yesterday"; if(diff<7) return `${diff}d ago`; return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}); };
const fmtPhone = p => { if(!p) return "—"; const n=String(p).replace(/\D/g,""); return n.length===10?`+91 ${n.slice(0,5)} ${n.slice(5)}`:p; };

const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
const Toast = ({msg,type,onDone}) => { useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]); return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>; };
const StageBadge = ({stage}) => { const m=STAGE_META[stage]||{color:C.textSub,bg:C.surface}; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,border:`1px solid ${m.color}33`}}>{stage||"New"}</span>; };
const TempBadge = ({temp}) => { const m=TEMP_META[temp]; if(!m) return <span style={{color:C.textMuted,fontSize:11}}>—</span>; return <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.color+"22",color:m.color}}>{m.icon} {temp}</span>; };
const Chip = ({label,active,onClick}) => <button onClick={onClick} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:20,border:`1px solid ${active?C.gold:C.border}`,backgroundColor:active?C.goldMuted:"transparent",color:active?C.gold:C.textSub,cursor:"pointer",whiteSpace:"nowrap",minHeight:32}}>{label}</button>;

const ReassignModal = ({lead,agents,onClose,onDone}) => {
  const [sel,setSel] = useState(lead.agentId||"");
  const [saving,setSaving] = useState(false);
  const save = async () => {
    if(!sel||sel===lead.agentId){onClose();return;}
    setSaving(true);
    try { await updateDoc(doc(db,COLLECTIONS.LEADS,lead.id),{agentId:sel,updatedAt:serverTimestamp()}); onDone("Lead reassigned","success"); }
    catch(e){ onDone("Failed: "+e.message,"error"); }
    finally{setSaving(false);onClose();}
  };
  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:200}} />
    <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:"min(400px,90vw)",zIndex:201}}>
      <div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>Reassign Lead</div>
      <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginBottom:18}}>{lead.name||"Lead"}</div>
      <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {agents.map(a=>(
          <div key={a.id} onClick={()=>setSel(a.id)} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${sel===a.id?C.gold:C.border}`,backgroundColor:sel===a.id?C.goldMuted:"transparent",cursor:"pointer",fontFamily:F.body,fontSize:14,color:C.text,display:"flex",justifyContent:"space-between"}}>
            {a.displayName||a.email||"Agent"}{sel===a.id&&<span style={{color:C.gold}}>✓</span>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:600,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{flex:1,padding:"10px 0",fontFamily:F.body,fontSize:13,fontWeight:700,border:"none",borderRadius:8,backgroundColor:C.gold,color:"#000",cursor:"pointer",opacity:saving?0.7:1}}>{saving?"…":"Reassign"}</button>
      </div>
    </div>
  </>);
};

export const MyTeamLeads = () => {
  const { currentUser, companyId } = useAuth();
  const [leads,setLeads]=useState([]); const [agents,setAgents]=useState([]); const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null); const [reassign,setReassign]=useState(null);
  const [search,setSearch]=useState(""); const [agentF,setAgentF]=useState("all");
  const [stageF,setStageF]=useState("All"); const [tempF,setTempF]=useState("All");
  const [sortCol,setSortCol]=useState("createdAt"); const [sortDir,setSortDir]=useState("desc");
  const [page,setPage]=useState(1); const PAGE=20;
  useEffect(()=>{setPage(1);},[search,agentF,stageF,tempF]);

  useEffect(()=>{
    if(!currentUser?.uid||!companyId) return;
    const uid=currentUser.uid; let r=0; const ck=()=>{r++;if(r>=2)setLoading(false);};
    const u1=onSnapshot(query(collection(db,COLLECTIONS.USERS),where("managerId","==",uid),where("companyId","==",companyId)),s=>{setAgents(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.LEADS),where("managerId","==",uid),where("companyId","==",companyId)),s=>{setLeads(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    return()=>{u1();u2();};
  },[currentUser?.uid,companyId]);

  const agentMap=useMemo(()=>{const m={};agents.forEach(a=>{m[a.id]=a.displayName||a.email||"Agent";});return m;},[agents]);

  const filtered=useMemo(()=>{
    let r=[...leads];
    if(search.trim()){const q=search.toLowerCase();r=r.filter(l=>(l.name||"").toLowerCase().includes(q)||(l.phone||"").includes(q));}
    if(agentF!=="all") r=r.filter(l=>l.agentId===agentF);
    if(stageF!=="All") r=r.filter(l=>(l.stage||"New")===stageF);
    if(tempF!=="All")  r=r.filter(l=>l.temperature===tempF);
    r.sort((a,b)=>{
      if(sortCol==="name"){const av=(a.name||"").toLowerCase(),bv=(b.name||"").toLowerCase();return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);}
      const av=a.createdAt?.seconds||0,bv=b.createdAt?.seconds||0;
      return sortDir==="asc"?av-bv:bv-av;
    });
    return r;
  },[leads,search,agentF,stageF,tempF,sortCol,sortDir]);

  const totalPages=Math.ceil(filtered.length/PAGE);
  const paginated=filtered.slice((page-1)*PAGE,page*PAGE);
  const hs=c=>{if(sortCol===c)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(c);setSortDir("desc");}};
  const SA=({col})=>sortCol!==col?<span style={{color:C.textMuted,fontSize:10,marginLeft:3}}>↕</span>:<span style={{color:C.gold,fontSize:10,marginLeft:3}}>{sortDir==="asc"?"↑":"↓"}</span>;

  const TH = ({label,col,pl=16})=>(
    <div onClick={col?()=>hs(col):undefined} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:`12px ${pl}px`,cursor:col?"pointer":"default"}}>
      {label}{col&&<SA col={col} />}
    </div>
  );

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}.lr:hover{background-color:${C.surfaceHov}!important}.lc:hover{border-color:${C.gold}55!important;transform:translateY(-1px)}@media(max-width:640px){.tv{display:none!important}.cv{display:block!important}}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px"}}>
      {/* Header */}
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Manager</div>
        <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Team Leads</h1>
        <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>{loading?"Loading…":`${filtered.length} leads · ${agents.length} agents · `}<span style={{color:C.green}}>● Live</span></div>
      </div>

      {/* Filters */}
      <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",marginBottom:14}}>
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.textMuted}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone…" style={{width:"100%",backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px 10px 36px",color:C.text,fontFamily:F.body,fontSize:13,outline:"none"}} />
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Chip label="All Agents" active={agentF==="all"} onClick={()=>setAgentF("all")} />
          {agents.map(a=><Chip key={a.id} label={(a.displayName||a.email||"Agent").split(" ")[0]} active={agentF===a.id} onClick={()=>setAgentF(a.id)} />)}
          <div style={{width:1,height:20,backgroundColor:C.border,alignSelf:"center"}} />
          {STAGES.map(s=><Chip key={s} label={s} active={stageF===s} onClick={()=>setStageF(s)} />)}
          <div style={{width:1,height:20,backgroundColor:C.border,alignSelf:"center"}} />
          {TEMPS.map(t=><Chip key={t} label={t==="All"?"All Temps":`${TEMP_META[t]?.icon||""} ${t}`} active={tempF===t} onClick={()=>setTempF(t)} />)}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="tv" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.2fr 1fr 1fr 80px 130px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
          <TH label="Lead" col="name" pl={20} /><TH label="Phone" /><TH label="Agent" />
          <TH label="Stage" col="stage" /><TH label="Temp" /><TH label="Calls" /><TH label="Added" col="createdAt" />
        </div>
        {loading?Array.from({length:6}).map((_,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.2fr 1fr 1fr 80px 130px",padding:"12px 16px",borderBottom:`1px solid ${C.border}`,gap:12,alignItems:"center"}}>
            <div><Shimmer h={13} w="60%" /><div style={{marginTop:4}}><Shimmer h={"11"} w="40%" /></div></div>
            <Shimmer h={11} w="80%" /><Shimmer h={11} w="65%" /><Shimmer h={20} w="80px" r={20} /><Shimmer h={20} w="60px" r={20} /><Shimmer h={11} w="25px" /><Shimmer h={11} w="55px" />
          </div>
        )):filtered.length===0?(
          <div style={{textAlign:"center",padding:"52px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>📋</div><div>No leads match your filters.</div></div>
        ):paginated.map((lead,idx)=>(
          <div key={lead.id} className="lr" style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.2fr 1fr 1fr 80px 130px",borderBottom:`1px solid ${C.border}`,backgroundColor:idx%2===0?"transparent":C.surface+"66",transition:"background 0.12s",alignItems:"center"}}>
            <div style={{padding:"12px 20px"}}><div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.text}}>{lead.name||"—"}</div><div style={{fontFamily:F.body,fontSize:11,color:C.textMuted,marginTop:2}}>{lead.source||"—"}</div></div>
            <div style={{padding:"12px 16px",fontFamily:"monospace",fontSize:12,color:C.textSub}}>{fmtPhone(lead.phone)}</div>
            <div style={{padding:"12px 16px",fontFamily:F.body,fontSize:13,color:C.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agentMap[lead.agentId]||"Unassigned"}</div>
            <div style={{padding:"12px 16px"}}><StageBadge stage={lead.stage||"New"} /></div>
            <div style={{padding:"12px 16px"}}><TempBadge temp={lead.temperature} /></div>
            <div style={{padding:"12px 16px",textAlign:"center",fontFamily:F.body,fontSize:13,fontWeight:600,color:C.text}}>{lead.callCount||0}</div>
            <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:F.body,fontSize:11,color:C.textMuted}}>{fmtDate(lead.createdAt)}</span>
              <button onClick={()=>setReassign(lead)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 7px",color:C.textSub,cursor:"pointer",fontSize:11,fontFamily:F.body,minHeight:28}}>↔</button>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="cv" style={{display:"none"}}>
        {loading?Array.from({length:4}).map((_,i)=>(
          <div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10}}>
            <Shimmer h={15} w="55%" /><div style={{marginTop:8}}><Shimmer h={12} w="70%" /></div><div style={{marginTop:8,display:"flex",gap:8}}><Shimmer h={22} w="70px" r={20} /><Shimmer h={22} w="60px" r={20} /></div>
          </div>
        )):filtered.length===0?(
          <div style={{textAlign:"center",padding:"52px 0",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:36,marginBottom:12}}>📋</div><div>No leads match.</div></div>
        ):paginated.map(lead=>(
          <div key={lead.id} className="lc" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:10,transition:"border-color 0.15s,transform 0.15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div><div style={{fontFamily:F.body,fontSize:15,fontWeight:700,color:C.text}}>{lead.name||"—"}</div><div style={{fontFamily:"monospace",fontSize:12,color:C.textSub,marginTop:3}}>{fmtPhone(lead.phone)}</div></div>
              <TempBadge temp={lead.temperature} />
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}><StageBadge stage={lead.stage||"New"} /><span style={{fontFamily:F.body,fontSize:11,padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`,color:C.textSub}}>{agentMap[lead.agentId]||"Unassigned"}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontFamily:F.body,fontSize:11,color:C.textMuted}}>{fmtDate(lead.createdAt)}</span>
              <button onClick={()=>setReassign(lead)} style={{fontFamily:F.body,fontSize:12,fontWeight:600,padding:"8px 16px",minHeight:36,border:`1px solid ${C.gold}44`,borderRadius:8,backgroundColor:C.goldMuted,color:C.gold,cursor:"pointer"}}>Reassign ↔</button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading&&filtered.length>PAGE&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,flexWrap:"wrap",gap:10}}>
          <div style={{fontFamily:F.body,fontSize:12,color:C.textSub}}>Showing {(page-1)*PAGE+1}–{Math.min(page*PAGE,filtered.length)} of {filtered.length}</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:page===1?"not-allowed":"pointer",opacity:page===1?0.4:1}}>← Prev</button>
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:page===totalPages?"not-allowed":"pointer",opacity:page===totalPages?0.4:1}}>Next →</button>
          </div>
        </div>
      )}
    </div>
    {reassign&&<ReassignModal lead={reassign} agents={agents} onClose={()=>setReassign(null)} onDone={(msg,type)=>setToast({msg,type})} />}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default MyTeamLeads;
