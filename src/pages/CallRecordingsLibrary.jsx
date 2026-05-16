// TIRAS CRM V2 — CallRecordingsLibrary.jsx  (UPPARA account)
// Real-time call recordings via onSnapshot · inline HTML5 audio player
// AI summary expand/collapse · mobile cards · filter by agent / date / outcome
//
// src/pages/CallRecordingsLibrary.jsx
// export { CallRecordingsLibrary } from "./CallRecordingsLibrary";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  RiSearchLine, RiLoader4Line, RiPlayCircleLine, RiPauseCircleLine,
  RiTimeLine, RiCalendarLine, RiUserLine, RiPhoneLine,
  RiRobot2Line, RiArrowDownSLine, RiArrowUpSLine,
  RiDownloadLine, RiMicLine, RiCheckLine, RiAlertLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};

const OUTCOMES=["Interested","Not Interested","Call Back","No Answer","Wrong Number","Busy","Voicemail"];
const OUTCOME_C={"Interested":C.success,"Not Interested":C.red,"Call Back":C.warning,"No Answer":C.sub,"Wrong Number":C.red,"Busy":C.warning,"Voicemail":C.info};

const fmtDur=(s)=>{if(!s&&s!==0)return"—";return`${Math.floor(s/60)}:${String(s%60).padStart(2,"0");}`;};
const fmtDate=(ts)=>{if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts);const diff=Math.floor((Date.now()-d)/1000);if(diff<60)return"Just now";if(diff<3600)return`${Math.floor(diff/60)}m ago`;if(diff<86400)return`${Math.floor(diff/3600)}h ago`;if(diff<604800)return`${Math.floor(diff/86400)}d ago`;return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});};

const SK=({w="100%",h="14px",r=R.md})=>(<div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#232325 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"v2Shimmer 1.6s ease-in-out infinite",flexShrink:0}}/>);

// ─── Inline Audio Player ──────────────────────────────────────────────────────
const AudioPlayer=({url,id,activeId,setActiveId})=>{
  const audioRef=useRef(null);
  const rafRef=useRef(null);
  const [playing,setPlaying]=useState(false);
  const [current,setCurrent]=useState(0);
  const [duration,setDuration]=useState(0);

  const isActive=activeId===id;

  useEffect(()=>{if(!isActive&&playing){audioRef.current?.pause();setPlaying(false);cancelAnimationFrame(rafRef.current);}},[isActive,playing]);

  const tick=()=>{if(audioRef.current)setCurrent(Math.floor(audioRef.current.currentTime));rafRef.current=requestAnimationFrame(tick);};

  const play=()=>{if(!audioRef.current)return;setActiveId(id);audioRef.current.play();setPlaying(true);rafRef.current=requestAnimationFrame(tick);};
  const pause=()=>{audioRef.current?.pause();setPlaying(false);cancelAnimationFrame(rafRef.current);};
  const onEnded=()=>{setPlaying(false);setCurrent(0);cancelAnimationFrame(rafRef.current);};
  const onMeta=()=>setDuration(Math.floor(audioRef.current?.duration||0));

  const seek=(e)=>{const rect=e.currentTarget.getBoundingClientRect();const pct=(e.clientX-rect.left)/rect.width;const t=pct*(audioRef.current?.duration||0);if(audioRef.current){audioRef.current.currentTime=t;setCurrent(Math.floor(t));}};

  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[]);
  const pct=duration>0?Math.min(100,(current/duration)*100):0;

  return(
    <div style={{display:"flex",alignItems:"center",gap:"10px",flex:1}}>
      <audio ref={audioRef} src={url} onLoadedMetadata={onMeta} onEnded={onEnded} preload="metadata"/>
      <button onClick={playing?pause:play} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",padding:0,display:"flex",alignItems:"center",flexShrink:0}}>
        {playing?<RiPauseCircleLine size={28}/>:<RiPlayCircleLine size={28}/>}
      </button>
      <div style={{flex:1,minWidth:0}}>
        <div onClick={seek} style={{width:"100%",height:"4px",backgroundColor:C.surfaceAct,borderRadius:R.full,cursor:"pointer",marginBottom:"4px",position:"relative"}}>
          <div style={{width:`${pct}%`,height:"100%",backgroundColor:C.gold,borderRadius:R.full,transition:playing?"none":"width 0.1s ease"}}/>
          {duration>0&&(<div style={{position:"absolute",left:`${pct}%`,top:"50%",transform:"translate(-50%,-50%)",width:"10px",height:"10px",borderRadius:"50%",backgroundColor:C.gold,boxShadow:`0 0 4px ${C.gold}`,opacity:playing?1:0,transition:"opacity 0.15s ease"}}/>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontFamily:FB,fontSize:"10px",color:C.sub}}>{fmtDur(current)}</span>
          <span style={{fontFamily:FB,fontSize:"10px",color:C.sub}}>{fmtDur(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Recording Row (desktop) ──────────────────────────────────────────────────
const RecordingRow=({call,isLast,activeId,setActiveId})=>{
  const [expanded,setExpanded]=useState(false);
  const outColor=OUTCOME_C[call.outcome]||C.sub;

  return(
    <div style={{borderBottom:isLast?"none":`1px solid ${C.border}`}}>
      <div style={{padding:"14px 20px"}}>
        {/* Top: lead info */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",flexWrap:"wrap",gap:"6px"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap",marginBottom:"4px"}}>
              <span style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{call.leadName||"Unknown Lead"}</span>
              {call.outcome&&(<span style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:outColor,backgroundColor:outColor+"20",borderRadius:R.full,padding:"2px 8px",whiteSpace:"nowrap"}}>{call.outcome}</span>)}
            </div>
            <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
              {call.leadPhone&&<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px"}}><RiPhoneLine size={10}/>{call.leadPhone}</span>}
              {call.agentName&&<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px"}}><RiUserLine size={10}/>{call.agentName}</span>}
              <span style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px"}}><RiCalendarLine size={10}/>{fmtDate(call.createdAt)}</span>
              {call.durationSeconds!=null&&(<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",backgroundColor:C.surfaceAct,borderRadius:R.full,padding:"1px 8px"}}><RiTimeLine size={9}/>{fmtDur(call.durationSeconds)}</span>)}
            </div>
          </div>
          {call.recordingUrl&&(
            <a href={call.recordingUrl} download target="_blank" rel="noreferrer" style={{color:C.sub,display:"flex",alignItems:"center",gap:"3px",fontSize:"11px",textDecoration:"none",flexShrink:0}}>
              <RiDownloadLine size={13}/>
            </a>
          )}
        </div>

        {/* Player */}
        {call.recordingUrl?(
          <AudioPlayer url={call.recordingUrl} id={call.id} activeId={activeId} setActiveId={setActiveId}/>
        ):(
          <span style={{fontFamily:FB,fontSize:"12px",color:C.sub,fontStyle:"italic"}}>Recording expired or unavailable</span>
        )}

        {/* AI summary toggle */}
        {call.aiSummary&&(
          <button onClick={()=>setExpanded(e=>!e)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",color:C.gold,fontFamily:FB,fontSize:"12px",fontWeight:600,padding:"8px 0 0",marginTop:"4px"}}>
            <RiRobot2Line size={13}/>AI Summary{expanded?<RiArrowUpSLine size={13}/>:<RiArrowDownSLine size={13}/>}
          </button>
        )}
      </div>

      {/* AI Summary expanded */}
      {expanded&&call.aiSummary&&(
        <div style={{margin:"0 20px 14px",padding:"12px 14px",backgroundColor:C.goldMuted,border:`1px solid ${C.goldBorder}`,borderRadius:R.md}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px"}}>
            <RiRobot2Line size={13} color={C.gold}/>
            <span style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.08em"}}>AI Call Summary</span>
          </div>
          <p style={{margin:0,fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.7}}>{call.aiSummary}</p>
          {call.aiObjectionTag&&(
            <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{fontFamily:FB,fontSize:"11px",color:C.sub}}>Objection:</span>
              <span style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:C.warning,backgroundColor:C.warningMuted,borderRadius:R.full,padding:"2px 10px"}}>{call.aiObjectionTag}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Mobile card ──────────────────────────────────────────────────────────────
const RecordingCard=({call,activeId,setActiveId})=>{
  const [expanded,setExpanded]=useState(false);
  const outColor=OUTCOME_C[call.outcome]||C.sub;
  return(
    <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"14px",marginBottom:"10px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{call.leadName||"Unknown"}</div>
          <div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"2px"}}>{call.agentName||"—"} · {fmtDate(call.createdAt)}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px",flexShrink:0,marginLeft:"8px"}}>
          {call.outcome&&<span style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:outColor,backgroundColor:outColor+"20",borderRadius:R.full,padding:"2px 8px"}}>{call.outcome}</span>}
          {call.durationSeconds!=null&&<span style={{fontFamily:FB,fontSize:"10px",color:C.sub}}>{fmtDur(call.durationSeconds)}</span>}
        </div>
      </div>
      {call.recordingUrl&&<div style={{marginBottom:"8px"}}><AudioPlayer url={call.recordingUrl} id={call.id} activeId={activeId} setActiveId={setActiveId}/></div>}
      {call.aiSummary&&(<>
        <button onClick={()=>setExpanded(e=>!e)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",color:C.gold,fontFamily:FB,fontSize:"12px",fontWeight:600,padding:"4px 0",width:"100%"}}>
          <RiRobot2Line size={13}/>AI Summary{expanded?<RiArrowUpSLine size={13}/>:<RiArrowDownSLine size={13}/>}
        </button>
        {expanded&&<div style={{marginTop:"8px",padding:"10px",backgroundColor:C.goldMuted,border:`1px solid ${C.goldBorder}`,borderRadius:R.md}}><p style={{margin:0,fontFamily:FB,fontSize:"12px",color:C.sub,lineHeight:1.6}}>{call.aiSummary}</p></div>}
      </>)}
    </div>
  );
};

// ─── CallRecordingsLibrary ────────────────────────────────────────────────────
export const CallRecordingsLibrary=()=>{
  const {companyId}=useAuth();
  const [calls,setCalls]=useState([]);
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterAgent,setFilterAgent]=useState("all");
  const [filterOutcome,setFilterOutcome]=useState("all");
  const [filterFrom,setFilterFrom]=useState("");
  const [filterTo,setFilterTo]=useState("");
  const [activePlayId,setActivePlayId]=useState(null);

  useEffect(()=>{
    if(!companyId)return;
    const unsub=onSnapshot(
      query(collection(db,COLLECTIONS.CALLS),where("companyId","==",companyId),orderBy("createdAt","desc")),
      snap=>{
        const data=snap.docs.map(d=>({id:d.id,...d.data()}));
        setCalls(data);
        // Collect unique agents from calls for the filter
        const agentMap={};data.forEach(c=>{if(c.agentId&&!agentMap[c.agentId])agentMap[c.agentId]={id:c.agentId,displayName:c.agentName||"Agent"};});
        setAgents(Object.values(agentMap));
        setLoading(false);
      },
      err=>{console.error("CallRecordingsLibrary snap:",err);setLoading(false);}
    );
    return()=>unsub();
  },[companyId]);

  const filtered=calls.filter(c=>{
    const q=search.toLowerCase();
    const ms=!q||c.leadName?.toLowerCase().includes(q)||c.agentName?.toLowerCase().includes(q)||c.leadPhone?.includes(q);
    const ma=filterAgent==="all"||c.agentId===filterAgent;
    const mo=filterOutcome==="all"||c.outcome===filterOutcome;
    let md=true;
    if(filterFrom||filterTo){const d=c.createdAt?.toDate?.()||new Date(c.createdAt);if(filterFrom)md=md&&d>=new Date(filterFrom);if(filterTo){const to=new Date(filterTo);to.setHours(23,59,59);md=md&&d<=to;}}
    return ms&&ma&&mo&&md;
  });

  const withRec=calls.filter(c=>c.recordingUrl).length;
  const withAI=calls.filter(c=>c.aiSummary).length;
  const avgDur=calls.length>0?Math.round(calls.reduce((s,c)=>s+(c.durationSeconds||0),0)/calls.length):0;

  const inp={backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"9px 14px",color:C.text,fontFamily:FB,fontSize:"13px",outline:"none",appearance:"none",cursor:"pointer"};

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        select option{background:${C.surface};color:${C.text};}
        @media(max-width:640px){.rl-table{display:none !important;}.rl-cards{display:block !important;}.rl-header{flex-direction:column;align-items:flex-start;}}
      `}</style>

      {/* Header */}
      <div className="rl-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px",marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <div>
          <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Call Recordings</h1>
          <p style={{margin:"6px 0 0",fontFamily:FB,fontSize:"14px",color:C.sub}}>Every recorded call — play inline, read AI summaries.</p>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{display:"flex",gap:"10px",marginBottom:"18px",flexWrap:"wrap",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        {[{l:"Total Calls",v:calls.length,c:C.info},{l:"With Recording",v:withRec,c:C.gold},{l:"AI Summaries",v:withAI,c:"#9B59B6"},{l:"Avg Duration",v:fmtDur(avgDur),c:C.success}].map(s=>(<div key={s.l} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>{s.l}:</span><span style={{fontFamily:FB,fontSize:"15px",fontWeight:700,color:s.c}}>{loading?"—":s.v}</span></div>))}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center",animation:"v2FadeUp 0.3s ease 0.1s both"}}>
        <div style={{position:"relative",flex:"1 1 180px",minWidth:"160px"}}>
          <RiSearchLine size={14} color={C.sub} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
          <input type="text" placeholder="Lead, agent, phone…" value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,paddingLeft:"34px",width:"100%",boxSizing:"border-box"}}/>
        </div>
        <select value={filterAgent} onChange={e=>setFilterAgent(e.target.value)} style={{...inp,minWidth:"140px"}}><option value="all">All Agents</option>{agents.map(a=><option key={a.id} value={a.id}>{a.displayName}</option>)}</select>
        <select value={filterOutcome} onChange={e=>setFilterOutcome(e.target.value)} style={{...inp,minWidth:"160px"}}><option value="all">All Outcomes</option>{OUTCOMES.map(o=><option key={o} value={o}>{o}</option>)}</select>
        <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
          <span style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>From</span>
          <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} style={{...inp,width:"140px"}}/>
          <span style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>To</span>
          <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} style={{...inp,width:"140px"}}/>
          {(filterFrom||filterTo)&&<button onClick={()=>{setFilterFrom("");setFilterTo("");}} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontFamily:FB,fontSize:"12px"}}>Clear</button>}
        </div>
        {!loading&&<span style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginLeft:"auto"}}>{filtered.length} recordings</span>}
      </div>

      {/* Desktop table */}
      <div className="rl-table" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        <div style={{padding:"10px 20px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:"8px"}}>
          <RiMicLine size={14} color={C.sub}/>
          <span style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em"}}>Recording</span>
          <span style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginLeft:"auto"}}>One recording plays at a time</span>
        </div>
        {loading&&(<div style={{padding:"48px",textAlign:"center"}}><RiLoader4Line size={24} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/><div style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginTop:"10px"}}>Loading recordings…</div></div>)}
        {!loading&&filtered.length===0&&(<div style={{padding:"48px",textAlign:"center"}}><RiMicLine size={32} color={C.sub} style={{marginBottom:"12px"}}/><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text,marginBottom:"6px"}}>{search||filterAgent!=="all"?"No recordings match":"No call recordings yet"}</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Recordings appear after agents complete calls via Plivo.</div></div>)}
        {!loading&&filtered.map((call,idx)=>(<RecordingRow key={call.id} call={call} isLast={idx===filtered.length-1} activeId={activePlayId} setActiveId={setActivePlayId}/>))}
      </div>

      {/* Mobile cards */}
      <div className="rl-cards" style={{display:"none",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        {loading&&[1,2,3].map(i=>(<div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"14px",marginBottom:"10px",display:"flex",flexDirection:"column",gap:"10px"}}><SK w="60%" h="16px"/><SK w="80%" h="12px"/><SK w="100%" h="4px" r={R.full}/></div>))}
        {!loading&&filtered.map(call=>(<RecordingCard key={call.id} call={call} activeId={activePlayId} setActiveId={setActivePlayId}/>))}
      </div>
    </div>
  );
};
