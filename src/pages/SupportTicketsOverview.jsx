// TIRAS CRM V2 — SupportTicketsOverview.jsx  (UPPARA account)
// Real-time tickets via onSnapshot · 24h escalation red glow animation
// Desktop table · mobile cards · quick assign modal · toast on every write
//
// src/pages/SupportTicketsOverview.jsx
// export { SupportTicketsOverview } from "./SupportTicketsOverview";

import React, { useState, useEffect, useCallback } from "react";
import {
  collection, query, where, doc, onSnapshot,
  updateDoc, serverTimestamp, orderBy, getDocs,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  RiSearchLine, RiLoader4Line, RiAlertLine,
  RiCustomerServiceLine, RiUserAddLine, RiCheckLine,
  RiPhoneLine, RiTimeLine, RiArrowUpLine, RiArrowDownLine,
  RiCloseLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};const TR="all 0.15s ease";

const STATUS_TABS=[{v:"all",l:"All"},{v:"open",l:"Open"},{v:"assigned",l:"Assigned"},{v:"in_progress",l:"In Progress"},{v:"resolved",l:"Resolved"},{v:"closed",l:"Closed"}];
const STATUS_CFG={open:{l:"Open",c:C.red,bg:C.redMuted},assigned:{l:"Assigned",c:C.warning,bg:C.warningMuted},in_progress:{l:"In Progress",c:C.info,bg:C.infoMuted},resolved:{l:"Resolved",c:C.success,bg:C.successMuted},closed:{l:"Closed",c:C.sub,bg:C.surfaceAct}};
const ADVANCE={open:"assigned",assigned:"in_progress",in_progress:"resolved",resolved:"closed"};
const ESCALATION_HOURS=24;
const ESCALATED_STATUSES=new Set(["open","assigned","in_progress"]);

const shortId=(id)=>id?.slice(-5).toUpperCase()||"—";
const relTime=(ts)=>{if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d)/1000);if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;};
const isEscalated=(t)=>{if(!ESCALATED_STATUSES.has(t.status))return false;const d=t.createdAt?.toDate?.()||new Date(t.createdAt);return(Date.now()-d.getTime())/3600000>ESCALATION_HOURS;};

const SK=({w="100%",h="14px",r=R.md})=>(<div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#232325 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"v2Shimmer 1.6s ease-in-out infinite",flexShrink:0}}/>);
const Toast=({msg,type="success"})=>{const col=type==="error"?C.red:C.success;return(<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:C.surfaceAct,border:`1px solid ${col}50`,borderLeft:`3px solid ${col}`,borderRadius:R.md,padding:"10px 18px",display:"flex",alignItems:"center",gap:"8px",boxShadow:SH.md,zIndex:3000,fontFamily:FB,fontSize:"13px",color:C.text,animation:"v2SlideIn 0.25s ease"}}>{type==="error"?<RiAlertLine size={14} color={col}/>:<RiCheckLine size={14} color={col}/>}{msg}</div>);};
const StatusBadge=({status})=>{const cfg=STATUS_CFG[status]||STATUS_CFG.open;return(<span style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:cfg.c,backgroundColor:cfg.bg,border:`1px solid ${cfg.c}30`,borderRadius:R.full,padding:"3px 10px",whiteSpace:"nowrap"}}>{cfg.l}</span>);};

// ─── Assign Modal ─────────────────────────────────────────────────────────────
const AssignModal=({ticket,agents,onAssign,onClose,assigning})=>(
  <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px"}}>
    <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.xl,width:"100%",maxWidth:"340px",padding:"20px",boxShadow:SH.md,animation:"v2FadeUp 0.2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
        <div>
          <div style={{fontFamily:FH,fontSize:"17px",fontWeight:700,color:C.text}}>Assign Ticket</div>
          <div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px"}}>#{shortId(ticket.id)}</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,display:"flex"}}><RiCloseLine size={18}/></button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px",maxHeight:"240px",overflowY:"auto",marginBottom:"14px"}}>
        {agents.length===0&&(<div style={{fontFamily:FB,fontSize:"13px",color:C.sub,textAlign:"center",padding:"20px"}}>No agents found. Add team members first.</div>)}
        {agents.map(agent=>(<button key={agent.id} onClick={()=>onAssign(agent)} disabled={assigning} style={{background:"none",border:`1px solid ${ticket.assignedToId===agent.id?C.goldBorder:C.border}`,borderRadius:R.md,padding:"10px 14px",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",transition:TR,fontFamily:FB,backgroundColor:ticket.assignedToId===agent.id?C.goldMuted:"transparent",minHeight:"52px"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=ticket.assignedToId===agent.id?C.goldMuted:C.surfaceHov} onMouseLeave={e=>e.currentTarget.style.backgroundColor=ticket.assignedToId===agent.id?C.goldMuted:"transparent"}>
          <div style={{width:"34px",height:"34px",borderRadius:"50%",backgroundColor:C.infoMuted,border:`1px solid ${C.info}40`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FH,fontSize:"15px",fontWeight:700,color:C.info,flexShrink:0}}>{(agent.displayName||agent.email||"?").charAt(0).toUpperCase()}</div>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:C.text}}>{agent.displayName||agent.email}</div>
            <div style={{fontFamily:FB,fontSize:"11px",color:C.sub}}>{agent.role==="support_agent"?"Support Agent":"Agent"}</div>
          </div>
          {ticket.assignedToId===agent.id&&<RiCheckLine size={15} color={C.gold}/>}
        </button>))}
      </div>
      <button onClick={onClose} style={{width:"100%",backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"10px 0",cursor:"pointer",minHeight:"44px"}}>Cancel</button>
    </div>
  </div>
);

// ─── SupportTicketsOverview ───────────────────────────────────────────────────
export const SupportTicketsOverview=()=>{
  const {companyId}=useAuth();
  const [tickets,setTickets]=useState([]);
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [statusFilter,setStatusFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [sortKey,setSortKey]=useState("createdAt");
  const [sortDir,setSortDir]=useState("desc");
  const [assignTarget,setAssignTarget]=useState(null);
  const [assigning,setAssigning]=useState(false);
  const [toast,setToast]=useState(null);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // onSnapshot for tickets
  useEffect(()=>{
    if(!companyId)return;
    getDocs(query(collection(db,COLLECTIONS.USERS),where("companyId","==",companyId),where("role","in",["support_agent","agent","manager"]))).then(s=>setAgents(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub=onSnapshot(
      query(collection(db,COLLECTIONS.TICKETS),where("companyId","==",companyId),orderBy("createdAt","desc")),
      snap=>{setTickets(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      err=>{console.error("SupportTickets snap:",err);setLoading(false);}
    );
    return()=>unsub();
  },[companyId]);

  const handleAssign=async(agent)=>{if(!assignTarget)return;setAssigning(true);try{await updateDoc(doc(db,COLLECTIONS.TICKETS,assignTarget.id),{assignedToId:agent.id,assignedToName:agent.displayName||agent.email,status:assignTarget.status==="open"?"assigned":assignTarget.status,updatedAt:serverTimestamp()});setAssignTarget(null);showToast(`Assigned to ${agent.displayName||agent.email}`);}catch(err){showToast("Failed to assign","error");}finally{setAssigning(false);};};

  const advanceStatus=async(ticket)=>{const next=ADVANCE[ticket.status];if(!next)return;try{await updateDoc(doc(db,COLLECTIONS.TICKETS,ticket.id),{status:next,updatedAt:serverTimestamp()});showToast(`Status → ${STATUS_CFG[next]?.l||next}`);}catch(err){showToast("Failed to update status","error");}};

  const filtered=tickets.filter(t=>{const q=search.toLowerCase();const ms=!q||t.title?.toLowerCase().includes(q)||t.leadName?.toLowerCase().includes(q)||t.assignedToName?.toLowerCase().includes(q);const mst=statusFilter==="all"||t.status===statusFilter;return ms&&mst;}).sort((a,b)=>{const ea=isEscalated(a),eb=isEscalated(b);if(ea&&!eb)return-1;if(!ea&&eb)return 1;let av=a[sortKey],bv=b[sortKey];if(av?.toDate)av=av.toDate().getTime();if(bv?.toDate)bv=bv.toDate().getTime();if(av<bv)return sortDir==="asc"?-1:1;if(av>bv)return sortDir==="asc"?1:-1;return 0;});

  const tabCounts=STATUS_TABS.reduce((m,t)=>{m[t.v]=t.v==="all"?tickets.length:tickets.filter(tk=>tk.status===t.v).length;return m;},{});
  const escalatedCount=tickets.filter(isEscalated).length;
  const toggleSort=(k)=>{if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("desc");}};

  const ColH=({label,ck})=>(<div onClick={ck?()=>toggleSort(ck):undefined} style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:sortKey===ck?C.gold:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",cursor:ck?"pointer":"default",display:"flex",alignItems:"center",gap:"3px",userSelect:"none"}}>{label}{ck&&sortKey===ck&&(sortDir==="asc"?<RiArrowUpLine size={10}/>:<RiArrowDownLine size={10}/>)}</div>);

  const COLS="64px 1fr 120px 140px 120px 80px";

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2SlideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes v2EscGlow{0%,100%{box-shadow:0 0 0 0 rgba(230,57,70,0)}50%{box-shadow:0 0 12px 2px rgba(230,57,70,0.25)}}
        .st-row:hover{background-color:${C.surfaceHov} !important;}
        .st-act{opacity:0;transition:opacity 0.15s ease;}
        .st-row:hover .st-act{opacity:1;}
        select option{background:${C.surface};color:${C.text};}
        @media(max-width:640px){.st-table{display:none !important;}.st-cards{display:flex !important;}}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px",marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <div>
          <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Support Tickets</h1>
          <p style={{margin:"6px 0 0",fontFamily:FB,fontSize:"14px",color:C.sub}}>
            {loading?"Loading…":<>{tickets.length} total · {escalatedCount>0?<span style={{color:C.red}}>🔴 {escalatedCount} escalated (&gt;{ESCALATION_HOURS}h)</span>:<span style={{color:C.success}}>✓ No escalations</span>}</>}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{display:"flex",gap:"2px",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"3px",marginBottom:"14px",flexWrap:"wrap",width:"fit-content",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        {STATUS_TABS.map(tab=>{const active=statusFilter===tab.v;const count=tabCounts[tab.v];const isAlert=["open","assigned","in_progress"].includes(tab.v)&&count>0;return(<button key={tab.v} onClick={()=>setStatusFilter(tab.v)} style={{background:active?C.gold:"transparent",border:"none",borderRadius:R.sm,color:active?"#000":C.sub,fontFamily:FB,fontSize:"12px",fontWeight:active?700:400,padding:"5px 12px",cursor:"pointer",transition:TR,display:"flex",alignItems:"center",gap:"5px",whiteSpace:"nowrap",minHeight:"34px"}}>
          {tab.l}
          {count>0&&<span style={{backgroundColor:active?"rgba(0,0,0,0.2)":(isAlert?C.redMuted:C.surfaceAct),color:active?"#000":(isAlert?C.red:C.sub),borderRadius:R.full,padding:"0 6px",fontSize:"10px",fontWeight:700}}>{count}</span>}
        </button>);})}
      </div>

      {/* Search */}
      <div style={{position:"relative",marginBottom:"14px",maxWidth:"380px",animation:"v2FadeUp 0.3s ease 0.1s both"}}>
        <RiSearchLine size={14} color={C.sub} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
        <input type="text" placeholder="Title, lead or assignee…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px 10px 34px",color:C.text,fontFamily:FB,fontSize:"13px",outline:"none"}}/>
      </div>

      {/* Desktop table */}
      <div className="st-table" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        <div style={{display:"grid",gridTemplateColumns:COLS,padding:"10px 20px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`,gap:"12px",alignItems:"center"}}>
          <ColH label="Ticket #"/><ColH label="Title / Lead" ck="title"/><ColH label="Status"/><ColH label="Assigned To"/><ColH label="Created" ck="createdAt"/><div style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"right"}}>Actions</div>
        </div>

        {loading&&(<div style={{padding:"48px",textAlign:"center"}}><RiLoader4Line size={24} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/><div style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginTop:"10px"}}>Loading tickets…</div></div>)}
        {!loading&&filtered.length===0&&(<div style={{padding:"48px",textAlign:"center"}}><RiCustomerServiceLine size={32} color={C.sub} style={{marginBottom:"12px"}}/><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text,marginBottom:"6px"}}>{search||statusFilter!=="all"?"No tickets match":"No tickets yet"}</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Tickets are raised from lead detail pages.</div></div>)}

        {!loading&&filtered.map((t,idx)=>{const esc=isEscalated(t);const canAdv=!!ADVANCE[t.status];return(
          <div key={t.id} className="st-row" style={{display:"grid",gridTemplateColumns:COLS,padding:"12px 20px",borderBottom:idx<filtered.length-1?`1px solid ${C.border}`:"none",gap:"12px",alignItems:"center",backgroundColor:esc?`${C.red}08`:C.surface,borderLeft:esc?`3px solid ${C.red}`:"3px solid transparent",transition:TR,animation:esc?"v2EscGlow 2s ease-in-out infinite":"none"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"11px",color:esc?C.red:C.sub,display:"flex",alignItems:"center",gap:"3px"}}>{esc&&<RiAlertLine size={11}/>}#{shortId(t.id)}</div>
            <div style={{minWidth:0}}><div style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title||"Untitled"}</div>{t.leadName&&<div style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",marginTop:"2px"}}><RiPhoneLine size={9}/>{t.leadName}</div>}</div>
            <div><StatusBadge status={t.status}/></div>
            <div style={{fontFamily:FB,fontSize:"13px",color:t.assignedToName?C.sub:C.sub,fontStyle:t.assignedToName?"normal":"italic"}}>{t.assignedToName||"Unassigned"}</div>
            <div style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>{relTime(t.createdAt)}</div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:"5px"}}>
              <button className="st-act" onClick={()=>setAssignTarget(t)} title="Assign" style={{background:"none",border:`1px solid ${C.border}`,borderRadius:R.sm,color:C.sub,cursor:"pointer",padding:"6px",display:"flex",alignItems:"center",minWidth:"32px",justifyContent:"center"}}><RiUserAddLine size={13}/></button>
              {canAdv&&<button className="st-act" onClick={()=>advanceStatus(t)} title="Advance status" style={{background:"none",border:`1px solid ${C.success}50`,borderRadius:R.sm,color:C.success,cursor:"pointer",padding:"6px",display:"flex",alignItems:"center",minWidth:"32px",justifyContent:"center"}}><RiCheckLine size={13}/></button>}
            </div>
          </div>
        );})}
      </div>

      {/* Mobile cards */}
      <div className="st-cards" style={{display:"none",flexDirection:"column",gap:"10px",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        {loading&&[1,2,3].map(i=>(<div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"14px",display:"flex",flexDirection:"column",gap:"10px"}}><SK w="60%" h="16px"/><SK w="80%" h="14px"/><div style={{display:"flex",gap:"8px"}}><SK w="80px" h="22px" r={R.full}/></div></div>))}
        {!loading&&filtered.map(t=>{const esc=isEscalated(t);const canAdv=!!ADVANCE[t.status];return(
          <div key={t.id} style={{backgroundColor:esc?`${C.red}08`:C.surface,border:`1px solid ${esc?C.red+"55":C.border}`,borderRadius:R.lg,padding:"14px",animation:esc?"v2EscGlow 2s ease-in-out infinite":"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:esc?C.text:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{esc&&<RiAlertLine size={12} color={C.red} style={{marginRight:"4px"}}/>}{t.title||"Untitled"}</div>
                {t.leadName&&<div style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",marginTop:"2px"}}><RiPhoneLine size={9}/>{t.leadName}</div>}
              </div>
              <span style={{fontFamily:"monospace",fontSize:"10px",color:esc?C.red:C.sub,marginLeft:"8px",flexShrink:0}}>#{shortId(t.id)}</span>
            </div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}><StatusBadge status={t.status}/>{t.assignedToName&&<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,backgroundColor:C.surfaceAct,borderRadius:R.full,padding:"3px 10px"}}>{t.assignedToName}</span>}</div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>setAssignTarget(t)} style={{flex:1,backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"12px",fontWeight:500,padding:"10px 0",cursor:"pointer",minHeight:"44px",display:"flex",alignItems:"center",justifyContent:"center",gap:"5px"}}><RiUserAddLine size={13}/>Assign</button>
              {canAdv&&<button onClick={()=>advanceStatus(t)} style={{flex:1,backgroundColor:C.successMuted,border:`1px solid ${C.success}50`,borderRadius:R.md,color:C.success,fontFamily:FB,fontSize:"12px",fontWeight:600,padding:"10px 0",cursor:"pointer",minHeight:"44px",display:"flex",alignItems:"center",justifyContent:"center",gap:"5px"}}><RiCheckLine size={13}/>Advance</button>}
            </div>
          </div>
        );})}
      </div>

      {assignTarget&&<AssignModal ticket={assignTarget} agents={agents} onAssign={handleAssign} onClose={()=>setAssignTarget(null)} assigning={assigning}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
};
