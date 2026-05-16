// TIRAS CRM V2 — PipelineKanban.jsx  (UPPARA account)
// Real-time drag-drop pipeline · onSnapshot · custom stages · Obsidian Gold theme
// Mobile: horizontal scroll · optimistic Firestore writes · toast feedback
//
// src/pages/PipelineKanban.jsx
// export { PipelineKanban } from "./PipelineKanban";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  collection, query, where, doc, onSnapshot,
  updateDoc, orderBy, serverTimestamp, getDocs,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  RiLoader4Line, RiRefreshLine, RiAddLine,
  RiDragMove2Line, RiPhoneLine, RiUserLine,
  RiMoneyDollarCircleLine, RiTimeLine, RiCheckLine, RiAlertLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};

const DEFAULT_STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];

const STAGE_CFG={
  "New":        {c:C.info,      bg:C.infoMuted},
  "Contacted":  {c:C.gold,      bg:C.goldMuted},
  "Interested": {c:"#E67E22",   bg:"rgba(230,126,34,0.12)"},
  "Follow-up":  {c:C.warning,   bg:C.warningMuted},
  "Negotiation":{c:"#9B59B6",   bg:"rgba(155,89,182,0.12)"},
  "Closed Won": {c:C.success,   bg:C.successMuted},
  "Closed Lost":{c:C.red,       bg:C.redMuted},
};

const SCORE_DOT={hot:"#FF6B35",warm:C.warning,cold:C.info,dead:C.sub};

const formatINR=(n)=>{if(!n)return null;if(n>=100000)return`₹${(n/100000).toFixed(1)}L`;if(n>=1000)return`₹${(n/1000).toFixed(1)}K`;return`₹${n}`;};
const relTime=(ts)=>{if(!ts)return null;const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d)/1000);if(s<3600)return`${Math.floor(s/60)}m`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`;};

const Toast=({msg,type="success"})=>{const col=type==="error"?C.red:C.success;return(<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:C.surfaceAct,border:`1px solid ${col}50`,borderLeft:`3px solid ${col}`,borderRadius:R.md,padding:"10px 18px",display:"flex",alignItems:"center",gap:"8px",boxShadow:SH.md,zIndex:3000,fontFamily:FB,fontSize:"13px",color:C.text,animation:"v2SlideIn 0.25s ease"}}>{type==="error"?<RiAlertLine size={14} color={col}/>:<RiCheckLine size={14} color={col}/>}{msg}</div>);};

// ─── Lead Card ────────────────────────────────────────────────────────────────
const LeadCard=({lead,onDragStart,onDragEnd,isDragging})=>{
  const [hov,setHov]=useState(false);
  const scoreColor=SCORE_DOT[lead.leadScore];
  const val=formatINR(lead.dealValue);
  const ago=relTime(lead.updatedAt||lead.createdAt);

  return(
    <div
      draggable
      onDragStart={e=>onDragStart(e,lead)}
      onDragEnd={onDragEnd}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        backgroundColor:hov?C.surfaceAct:C.surface,
        border:`1px solid ${hov?C.goldBorder:C.border}`,
        borderRadius:R.md,padding:"12px",cursor:"grab",userSelect:"none",
        opacity:isDragging?0.35:1,
        transition:"transform 0.12s ease,box-shadow 0.12s ease,border-color 0.12s ease,background-color 0.12s ease",
        transform:hov&&!isDragging?"translateY(-1px)":"none",
        boxShadow:hov?SH.md:SH.sm,
        position:"relative",
      }}
    >
      {scoreColor&&(<div style={{position:"absolute",top:"12px",right:"12px",width:"7px",height:"7px",borderRadius:"50%",backgroundColor:scoreColor,boxShadow:`0 0 5px ${scoreColor}`}}/>)}

      <div style={{display:"flex",alignItems:"flex-start",gap:"6px",marginBottom:"8px"}}>
        <RiDragMove2Line size={12} color={C.sub} style={{marginTop:"2px",flexShrink:0,opacity:hov?1:0.5,transition:"opacity 0.15s ease"}}/>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:"14px"}}>{lead.name||"Unnamed"}</div>
          {lead.phone&&<div style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",marginTop:"2px"}}><RiPhoneLine size={9}/>{lead.phone}</div>}
        </div>
      </div>

      <div style={{display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center"}}>
        {val&&(<span style={{fontFamily:FB,fontSize:"11px",fontWeight:700,color:C.gold,display:"flex",alignItems:"center",gap:"2px"}}><RiMoneyDollarCircleLine size={10}/>{val}</span>)}
        {lead.agentName&&(<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"2px"}}><RiUserLine size={9}/>{lead.agentName.split(" ")[0]}</span>)}
        {lead.source&&(<span style={{fontFamily:FB,fontSize:"10px",color:C.sub,backgroundColor:C.surfaceAct,borderRadius:R.full,padding:"1px 7px"}}>{lead.source}</span>)}
      </div>

      {ago&&(<div style={{fontFamily:FB,fontSize:"10px",color:C.sub,marginTop:"6px",display:"flex",alignItems:"center",gap:"2px",opacity:0.7}}><RiTimeLine size={9}/>{ago} ago</div>)}
    </div>
  );
};

// ─── Stage Column ─────────────────────────────────────────────────────────────
const StageColumn=({stage,leads,isDragOver,onDragOver,onDragEnter,onDragLeave,onDrop,onDragStart,onDragEnd,draggingId})=>{
  const cfg=STAGE_CFG[stage]||{c:C.sub,bg:C.surfaceAct};
  const total=leads.reduce((s,l)=>s+(l.dealValue||0),0);
  const fmtTotal=formatINR(total);

  return(
    <div
      onDragOver={e=>{e.preventDefault();onDragOver(e);}}
      onDragEnter={e=>{e.preventDefault();onDragEnter(e);}}
      onDragLeave={onDragLeave}
      onDrop={e=>{e.preventDefault();onDrop(e);}}
      style={{
        width:"220px",minWidth:"220px",display:"flex",flexDirection:"column",
        backgroundColor:isDragOver?cfg.bg:"transparent",
        border:`1px solid ${isDragOver?cfg.c:C.border}`,
        borderRadius:R.lg,
        transition:"background-color 0.15s ease,border-color 0.15s ease,box-shadow 0.15s ease",
        boxShadow:isDragOver?`0 0 0 2px ${cfg.c}30`:SH.sm,
        maxHeight:"calc(100vh - 260px)",flexShrink:0,
      }}
    >
      {/* Column header */}
      <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
            <div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:cfg.c,flexShrink:0,boxShadow:isDragOver?`0 0 6px ${cfg.c}`:"none",transition:"box-shadow 0.15s ease"}}/>
            <span style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:C.text,whiteSpace:"nowrap"}}>{stage}</span>
          </div>
          <span style={{fontFamily:FB,fontSize:"11px",fontWeight:700,color:cfg.c,backgroundColor:cfg.bg,borderRadius:R.full,padding:"2px 8px",minWidth:"20px",textAlign:"center"}}>{leads.length}</span>
        </div>
        {fmtTotal&&(<div style={{fontFamily:FB,fontSize:"11px",color:C.sub}}>{fmtTotal} pipeline</div>)}
      </div>

      {/* Cards */}
      <div style={{padding:"8px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px",flexGrow:1,scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`}}>
        {leads.length===0&&(
          <div style={{padding:"20px 12px",textAlign:"center",color:isDragOver?cfg.c:C.sub,fontFamily:FB,fontSize:"12px",border:`2px dashed ${isDragOver?cfg.c:C.border}`,borderRadius:R.md,transition:"all 0.15s ease"}}>
            {isDragOver?"Drop here":"No leads"}
          </div>
        )}
        {leads.map(l=>(
          <LeadCard key={l.id} lead={l} onDragStart={onDragStart} onDragEnd={onDragEnd} isDragging={draggingId===l.id}/>
        ))}
        {leads.length>0&&isDragOver&&(<div style={{height:"36px",border:`2px dashed ${cfg.c}`,borderRadius:R.md,flexShrink:0,transition:"all 0.15s ease"}}/>)}
      </div>
    </div>
  );
};

// ─── PipelineKanban ───────────────────────────────────────────────────────────
export const PipelineKanban=()=>{
  const {companyId}=useAuth();
  const [leads,setLeads]=useState([]);
  const [stages,setStages]=useState(DEFAULT_STAGES);
  const [loading,setLoading]=useState(true);
  const [savingId,setSavingId]=useState(null);
  const [toast,setToast]=useState(null);

  const [draggingLead,setDraggingLead]=useState(null);
  const [dragOverStage,setDragOverStage]=useState(null);
  const dragCounterRef=useRef({});

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2500);};

  // onSnapshot for leads + getDocs for custom stages
  useEffect(()=>{
    if(!companyId)return;
    // Load custom stages once
    getDocs(query(collection(db,COLLECTIONS.PIPELINE_STAGES),where("companyId","==",companyId),orderBy("order","asc")))
      .then(snap=>{const cs=snap.docs.map(d=>d.data().name).filter(Boolean);if(cs.length>0)setStages(cs);});

    const unsub=onSnapshot(
      query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId),orderBy("createdAt","desc")),
      snap=>{setLeads(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      err=>{console.error("PipelineKanban snap:",err);setLoading(false);}
    );
    return()=>unsub();
  },[companyId]);

  // Drag handlers
  const handleDragStart=useCallback((e,lead)=>{setDraggingLead(lead);e.dataTransfer.effectAllowed="move";},[]);
  const handleDragEnd=useCallback(()=>{setDraggingLead(null);setDragOverStage(null);dragCounterRef.current={};},[]);
  const handleDragEnter=useCallback((e,stage)=>{dragCounterRef.current[stage]=(dragCounterRef.current[stage]||0)+1;setDragOverStage(stage);},[]);
  const handleDragLeave=useCallback((e,stage)=>{dragCounterRef.current[stage]=(dragCounterRef.current[stage]||0)-1;if((dragCounterRef.current[stage]||0)<=0){dragCounterRef.current[stage]=0;setDragOverStage(s=>s===stage?null:s);}},[]);

  const handleDrop=useCallback(async(e,targetStage)=>{
    e.preventDefault();setDragOverStage(null);dragCounterRef.current={};
    const lead=draggingLead;setDraggingLead(null);
    if(!lead||lead.stage===targetStage)return;

    // Optimistic
    setLeads(prev=>prev.map(l=>l.id===lead.id?{...l,stage:targetStage}:l));
    setSavingId(lead.id);
    try{
      await updateDoc(doc(db,COLLECTIONS.LEADS,lead.id),{stage:targetStage,updatedAt:serverTimestamp()});
      showToast(`Moved to ${targetStage}`);
    }catch(err){
      console.error("PipelineKanban drop:",err);
      setLeads(prev=>prev.map(l=>l.id===lead.id?{...l,stage:lead.stage}:l));
      showToast("Failed to save — reverted","error");
    }finally{setSavingId(null);}
  },[draggingLead]);

  // Group leads
  const leadsByStage=useMemo(()=>stages.reduce((m,s)=>{m[s]=leads.filter(l=>l.stage===s);return m;},{}),[ leads,stages]);

  const totalLeads=leads.length;
  const totalVal=leads.reduce((s,l)=>s+(l.dealValue||0),0);
  const hotCount=leads.filter(l=>l.leadScore==="hot").length;

  return(
    <div style={{backgroundColor:C.bg,height:"100vh",display:"flex",flexDirection:"column",fontFamily:FB,overflow:"hidden",boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2SlideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      `}</style>

      {/* Header */}
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,backgroundColor:C.bg,flexWrap:"wrap",gap:"10px"}}>
        <div>
          <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(22px,2.5vw,30px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Pipeline</h1>
          {!loading&&(
            <p style={{margin:"3px 0 0",fontFamily:FB,fontSize:"13px",color:C.sub}}>
              {totalLeads} leads ·{" "}
              <span style={{color:C.gold}}>{totalVal>=100000?`₹${(totalVal/100000).toFixed(1)}L`:totalVal>=1000?`₹${(totalVal/1000).toFixed(1)}K`:`₹${totalVal}`} pipeline</span>
              {hotCount>0&&<> · <span style={{color:"#FF6B35"}}>🔥 {hotCount} hot</span></>}
            </p>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {savingId&&(<span style={{fontFamily:FB,fontSize:"12px",color:C.sub,display:"flex",alignItems:"center",gap:"5px"}}><RiLoader4Line size={13} style={{animation:"v2Spin 0.8s linear infinite"}}/>Saving…</span>)}
          <button style={{backgroundColor:C.gold,color:"#000",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"13px",fontWeight:700,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",minHeight:"40px"}}><RiAddLine size={14}/>Add Lead</button>
        </div>
      </div>

      {/* Board */}
      {loading?(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"12px"}}>
          <RiLoader4Line size={28} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/>
          <span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Loading pipeline…</span>
        </div>
      ):(
        <div style={{flex:1,overflowX:"auto",overflowY:"hidden",padding:"16px 24px",display:"flex",gap:"12px",alignItems:"flex-start",minHeight:0}}>
          {stages.map(stage=>(
            <StageColumn
              key={stage} stage={stage}
              leads={leadsByStage[stage]||[]}
              isDragOver={dragOverStage===stage}
              draggingId={draggingLead?.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={()=>setDragOverStage(stage)}
              onDragEnter={e=>handleDragEnter(e,stage)}
              onDragLeave={e=>handleDragLeave(e,stage)}
              onDrop={e=>handleDrop(e,stage)}
            />
          ))}
        </div>
      )}

      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
};
