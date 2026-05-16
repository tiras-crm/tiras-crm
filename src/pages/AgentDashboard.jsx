// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM V2 — AgentDashboard
// File: src/pages/AgentDashboard.jsx
// Account: Anuradha | Theme: Obsidian Gold
//
// Drop-in: In src/pages/index.js replace:
//   export const AgentDashboard = () => <Placeholder name="Agent Dashboard" />;
//
// FEATURES:
//  - Priority call list (overdue + today's follow-ups) at top
//  - 4 stat cards: Calls Today, My Leads, Follow-ups Due, Conversion Rate
//  - My Pipeline — stage bar chart (real-time)
//  - Recent Call Activity — last 5 calls with outcome badges + AI summary hint
//  - Wallet gate: calling disabled banner if balance < ₹5
//  - Full mobile responsiveness: auto-fit grid, 44px tap targets
//  - Shimmer loading skeletons — never blank screen
//  - All data via onSnapshot (real-time)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  doc,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ─── V2 Design tokens — Obsidian Gold ────────────────────────────────────────
const T = {
  bg:"#121212", surface:"#1A1A1B", gold:"#D4AF37", accent:"#E63946",
  text:"#F5F5F5", sub:"#9A9A9A", border:"#2A2A2B",
  success:"#22C55E", warning:"#F59E0B", info:"#3B82F6",
  goldBg:"rgba(212,175,55,0.10)", goldBorder:"rgba(212,175,55,0.30)",
  dangerBg:"rgba(230,57,70,0.10)", dangerBorder:"rgba(230,57,70,0.30)",
  successBg:"rgba(34,197,94,0.10)", warningBg:"rgba(245,158,11,0.10)",
  infoBg:"rgba(59,130,246,0.10)",
};

// ─── Keyframe + responsive CSS injection ─────────────────────────────────────
const STYLE_ID = "tiras-v2-dash";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes v2fu  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes v2spin{ to{transform:rotate(360deg)} }
    @keyframes v2shim{
      0%  {background-position:-500px 0}
      100%{background-position: 500px 0}
    }
    @keyframes v2cnt { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes v2pls { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes v2slr { from{opacity:0;transform:translateX(10px)} to{opacity:1;transform:translateX(0)} }
    .v2card:hover { border-color:rgba(212,175,55,.35)!important; box-shadow:0 4px 24px rgba(212,175,55,.07)!important; transform:translateY(-2px); transition:all .22s ease!important; }
    .v2pbtn:hover { background:#e4c350!important; box-shadow:0 6px 20px rgba(212,175,55,.40)!important; transform:translateY(-1px); }
    .v2row:hover  { background:rgba(212,175,55,.04)!important; }
    .v2shim { background:linear-gradient(90deg,#1A1A1B 25%,rgba(255,255,255,.05) 50%,#1A1A1B 75%); background-size:500px 100%; animation:v2shim 1.4s ease infinite; border-radius:8px; }
    ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:#121212} ::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:640px){
      .v2grid4{grid-template-columns:repeat(2,1fr)!important}
      .v2grid2{grid-template-columns:1fr!important}
      .v2donly{display:none!important}
      .v2pad  {padding:16px!important}
    }
    @media(min-width:641px){.v2monly{display:none!important}}
  `;
  document.head.appendChild(tag);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStart = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const todayEnd   = () => { const d=new Date(); d.setHours(23,59,59,999); return d; };
const monthStart = () => { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; };
const timeAgo = (ts) => {
  if (!ts) return "—";
  const d=ts.toDate?ts.toDate():new Date(ts), s=Math.floor((Date.now()-d.getTime())/1000);
  if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
};
const fmtTime = (ts) => {
  if(!ts) return "";
  const d=ts.toDate?ts.toDate():new Date(ts);
  return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
};
const fmtDur  = (s) => s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` : "0:00";
const greeting = () => { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };

const OUTCOME_CFG = {
  "Interested":    {color:T.success, bg:T.successBg},
  "Not Interested":{color:T.accent,  bg:T.dangerBg },
  "Call Back":     {color:T.gold,    bg:T.goldBg   },
  "No Answer":     {color:T.sub,     bg:"rgba(154,154,154,.08)"},
  "Wrong Number":  {color:T.sub,     bg:"rgba(154,154,154,.08)"},
  "Busy":          {color:T.warning, bg:T.warningBg},
  "Voicemail":     {color:T.info,    bg:T.infoBg   },
};
const STAGE_CLR = {
  "New":T.sub,"Contacted":T.info,"Interested":T.gold,"Follow-up":T.warning,
  "Negotiation":T.gold,"Closed Won":T.success,"Closed Lost":T.accent
};
const STAGE_ORDER = ["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
const Shim = ({h,w="100%",style={}}) => (
  <div className="v2shim" style={{height:h,width:w,borderRadius:"8px",...style}}/>
);
const StatSkeleton = () => (
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px",marginBottom:"24px"}} className="v2grid4">
    {[0,1,2,3].map(i=>(
      <div key={i} style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"20px",animationDelay:`${i*50}ms`}}>
        <Shim h="11px" w="60%"/><div style={{height:"8px"}}/><Shim h="36px" w="50%"/><div style={{height:"6px"}}/><Shim h="11px" w="80%"/>
      </div>
    ))}
  </div>
);
const RowSkeleton = ({rows=3}) => (
  <div>
    {Array.from({length:rows}).map((_,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 20px",borderBottom:`1px solid ${T.border}`}}>
        <Shim h="8px" w="8px" style={{borderRadius:"50%"}}/>
        <div style={{flex:1}}><Shim h="13px" w="55%"/><div style={{height:"5px"}}/><Shim h="10px" w="35%"/></div>
        <Shim h="22px" w="60px"/>
      </div>
    ))}
  </div>
);

// ─── Icon SVGs ────────────────────────────────────────────────────────────────
const PhoneIco = ({sz=14}) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const PipeIco = ({sz=14}) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const ClkIco = ({sz=14}) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// AgentDashboard
// ─────────────────────────────────────────────────────────────────────────────
export const AgentDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, companyId, userProfile } = useAuth();
  const unsubRefs = useRef([]);

  const [callsToday,     setCallsToday]     = useState(null);
  const [talkTime,       setTalkTime]       = useState(0);
  const [leadsByStage,   setLeadsByStage]   = useState(null);
  const [totalLeads,     setTotalLeads]     = useState(0);
  const [followupsDue,   setFollowupsDue]   = useState(null);
  const [recentCalls,    setRecentCalls]    = useState(null);
  const [convRate,       setConvRate]       = useState(null);
  const [callingEnabled, setCallingEnabled] = useState(true);

  useEffect(() => {
    injectStyles();
    if (!currentUser || !companyId) return;
    const unsubs = setupListeners();
    return () => unsubs.forEach(u => u?.());
  }, [currentUser, companyId]); // eslint-disable-line

  const setupListeners = () => {
    // 1. Company wallet gate (agent sees disabled state only, never balance)
    const u1 = onSnapshot(doc(db, COLLECTIONS.COMPANIES, companyId), snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      const bal    = d?.wallet?.balance ?? 0;
      const status = d?.subscriptionStatus ?? "trial";
      setCallingEnabled((status === "active" || status === "trial") && bal >= 5);
    });

    // 2. All my leads (real-time)
    const u2 = onSnapshot(
      query(collection(db,COLLECTIONS.LEADS),
        where("assignedTo","==",currentUser.uid),
        where("companyId","==",companyId)
      ),
      snap => {
        const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
        const stages = {};
        let won=0, monthTotal=0;
        docs.forEach(l => {
          const st = l.stage||"New";
          stages[st] = (stages[st]||0)+1;
          const ca = l.createdAt?.toDate?.();
          if (ca && ca >= monthStart()) { monthTotal++; if(st==="Closed Won") won++; }
        });
        setLeadsByStage(stages);
        setTotalLeads(docs.length);
        setConvRate(monthTotal>0 ? Math.round((won/monthTotal)*100) : 0);
      }
    );

    // 3. Calls today (real-time)
    const u3 = onSnapshot(
      query(collection(db,COLLECTIONS.CALLS),
        where("agentId","==",currentUser.uid),
        where("companyId","==",companyId),
        where("createdAt",">=",Timestamp.fromDate(todayStart())),
        where("createdAt","<=",Timestamp.fromDate(todayEnd()))
      ),
      snap => {
        let secs=0; snap.docs.forEach(d=>{ secs+=d.data().duration||0; });
        setCallsToday(snap.size); setTalkTime(secs);
      }
    );

    // 4. Follow-ups due today (real-time)
    const u4 = onSnapshot(
      query(collection(db,COLLECTIONS.FOLLOW_UPS),
        where("agentId","==",currentUser.uid),
        where("companyId","==",companyId),
        where("status","==","pending"),
        where("scheduledAt","<=",Timestamp.fromDate(todayEnd())),
        orderBy("scheduledAt","asc")
      ),
      snap => setFollowupsDue(snap.docs.map(d=>({id:d.id,...d.data()})))
    );

    // 5. Recent calls (last 5, real-time)
    const u5 = onSnapshot(
      query(collection(db,COLLECTIONS.CALLS),
        where("agentId","==",currentUser.uid),
        where("companyId","==",companyId),
        orderBy("createdAt","desc"), limit(5)
      ),
      snap => setRecentCalls(snap.docs.map(d=>({id:d.id,...d.data()})))
    );

    return [u1,u2,u3,u4,u5];
  };

  // Derived
  const displayName  = userProfile?.displayName ?? currentUser?.email?.split("@")[0] ?? "Agent";
  const talkTimeStr  = talkTime>=60 ? `${Math.floor(talkTime/60)}m talk time` : `${talkTime}s talk time`;
  const maxStage     = leadsByStage ? Math.max(...Object.values(leadsByStage),1) : 1;
  const overdueItems = followupsDue?.filter(f=>f.scheduledAt?.toDate?.()<new Date()) ?? [];
  const priorityList = [...overdueItems, ...(followupsDue?.filter(f=>f.scheduledAt?.toDate?.()>=new Date())??[])];

  const STATS = [
    {label:"Calls Today",   value:callsToday??0,         meta:talkTimeStr,                                     color:T.gold,    delay:0  },
    {label:"My Leads",      value:totalLeads,             meta:`${Object.keys(leadsByStage??{}).length} stages`, color:T.info,    delay:60 },
    {label:"Follow-ups Due",value:followupsDue?.length??0,meta:overdueItems.length>0?`${overdueItems.length} overdue`:"All on time", color:overdueItems.length>0?T.accent:T.success, delay:120},
    {label:"Conversion",    value:`${convRate??0}%`,      meta:"Closed Won this month",                          color:T.success, delay:180},
  ];

  return (
    <div style={{minHeight:"100%",backgroundColor:T.bg,padding:"28px",fontFamily:"'DM Sans',sans-serif",color:T.text}} className="v2pad">

      {/* Header */}
      <div style={{marginBottom:"28px",animation:"v2fu 0.3s ease both"}}>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"28px",fontWeight:700,color:T.text,letterSpacing:"-0.01em",marginBottom:"4px"}}>
          {greeting()}, <span style={{color:T.gold}}>{displayName}</span>
        </h1>
        <p style={{color:T.sub,fontSize:"14px"}}>
          {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </p>
      </div>

      {/* Calling disabled banner */}
      {!callingEnabled && (
        <div style={{display:"flex",alignItems:"center",gap:"12px",backgroundColor:T.dangerBg,border:`1px solid ${T.dangerBorder}`,borderRadius:"10px",padding:"12px 16px",marginBottom:"24px",animation:"v2fu 0.3s ease both"}}>
          <span style={{fontSize:"18px"}}>⚠</span>
          <span style={{color:T.accent,fontSize:"13px",fontWeight:600}}>
            Calling is currently disabled. Contact your admin to recharge the wallet.
          </span>
        </div>
      )}

      {/* Stat cards */}
      {callsToday===null ? <StatSkeleton/> : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px",marginBottom:"24px"}} className="v2grid4">
          {STATS.map(({label,value,meta,color,delay})=>(
            <div key={label} className="v2card" style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"20px",position:"relative",overflow:"hidden",transition:"all .22s ease",animation:`v2fu .35s ease ${delay}ms both`}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",backgroundColor:color,borderRadius:"12px 12px 0 0"}}/>
              <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"10px"}}>{label}</div>
              <div style={{fontSize:"36px",fontWeight:700,lineHeight:1,color,marginBottom:"4px",animation:"v2cnt .4s ease both",fontVariantNumeric:"tabular-nums"}}>{value}</div>
              <div style={{color:T.sub,fontSize:"12px"}}>{meta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-col grid: Priority calls + Pipeline */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"16px"}} className="v2grid2">

        {/* Priority Call List */}
        <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",overflow:"hidden",animation:"v2fu .35s ease 80ms both"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:"8px"}}>
              <PhoneIco/> Priority Calls
            </span>
            {overdueItems.length>0 && (
              <span style={{fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",backgroundColor:T.dangerBg,color:T.accent,border:`1px solid ${T.dangerBorder}`}}>
                {overdueItems.length} overdue
              </span>
            )}
            {overdueItems.length===0 && priorityList.length>0 && (
              <span style={{fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",backgroundColor:T.goldBg,color:T.gold,border:`1px solid ${T.goldBorder}`}}>
                {priorityList.length} due
              </span>
            )}
          </div>

          {followupsDue===null ? <RowSkeleton/> :
           priorityList.length===0 ? (
            <div style={{textAlign:"center",padding:"36px 20px",color:T.sub,fontSize:"13px"}}>
              <div style={{fontSize:"28px",marginBottom:"10px",opacity:.5}}>✅</div>
              <div style={{color:T.text,fontSize:"14px",fontWeight:600,marginBottom:"4px"}}>All clear</div>
              <div>No follow-ups due today</div>
            </div>
          ) : (
            <>
              {priorityList.slice(0,6).map((fu,idx)=>{
                const isOD  = fu.scheduledAt?.toDate?.()<new Date();
                const dotC  = isOD?T.accent:T.gold;
                return (
                  <div key={fu.id} className="v2row"
                    style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 20px",borderBottom:idx===Math.min(priorityList.length,6)-1?"none":`1px solid ${T.border}`,cursor:"pointer",minHeight:"44px",transition:"background .15s"}}
                    onClick={()=>fu.leadId&&navigate(`/agent/lead/${fu.leadId}`)}
                  >
                    <div style={{width:"8px",height:"8px",borderRadius:"50%",backgroundColor:dotC,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"14px",fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fu.leadName??"—"}</div>
                      {fu.note&&<div style={{fontSize:"12px",color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fu.note}</div>}
                    </div>
                    <span style={{fontSize:"12px",fontWeight:700,color:isOD?T.accent:T.gold,flexShrink:0}}>{isOD?"Overdue":fmtTime(fu.scheduledAt)}</span>
                    <button
                      disabled={!callingEnabled}
                      className={callingEnabled?"v2pbtn":""}
                      style={{
                        backgroundColor:callingEnabled?T.gold:"rgba(212,175,55,.2)",
                        color:callingEnabled?"#000":T.sub,
                        border:"none",borderRadius:"7px",fontFamily:"'DM Sans',sans-serif",
                        fontSize:"12px",fontWeight:700,padding:"6px 12px",
                        cursor:callingEnabled?"pointer":"not-allowed",
                        flexShrink:0,minHeight:"44px",display:"flex",alignItems:"center",gap:"5px",
                        transition:"all .15s",
                      }}
                      onClick={e=>{
                        e.stopPropagation();
                        if(!callingEnabled) return;
                        navigate("/agent/call",{state:{lead:{id:fu.leadId,name:fu.leadName,phone:fu.leadPhone}}});
                      }}
                    >
                      <PhoneIco sz={12}/>Call
                    </button>
                  </div>
                );
              })}
              {priorityList.length>6&&(
                <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`}}>
                  <button style={{background:"none",border:"none",color:T.gold,fontFamily:"'DM Sans',sans-serif",fontSize:"12px",fontWeight:600,cursor:"pointer",padding:0}} onClick={()=>navigate("/agent/followups")}>
                    View all {priorityList.length} →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pipeline stage bars */}
        <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",overflow:"hidden",animation:"v2fu .35s ease 120ms both"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:"8px"}}>
              <PipeIco/> My Pipeline
            </span>
            {leadsByStage!==null&&(
              <span style={{fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",backgroundColor:T.goldBg,color:T.gold,border:`1px solid ${T.goldBorder}`}}>
                {totalLeads} total
              </span>
            )}
          </div>

          {leadsByStage===null ? <RowSkeleton rows={5}/> :
           totalLeads===0 ? (
            <div style={{textAlign:"center",padding:"36px 20px",color:T.sub,fontSize:"13px"}}>
              <div style={{fontSize:"28px",marginBottom:"10px",opacity:.5}}>📋</div>
              <div style={{color:T.text,fontSize:"14px",fontWeight:600,marginBottom:"4px"}}>No leads assigned</div>
              <button className="v2pbtn" style={{marginTop:"12px",backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,padding:"8px 16px",cursor:"pointer",minHeight:"44px",transition:"all .15s"}} onClick={()=>navigate("/agent/add-lead")}>
                Add Your First Lead
              </button>
            </div>
          ) : (
            <div style={{padding:"10px 0"}}>
              {STAGE_ORDER.filter(s=>(leadsByStage[s]||0)>0).map(stage=>{
                const count  = leadsByStage[stage]||0;
                const color  = STAGE_CLR[stage]||T.sub;
                const pct    = Math.round((count/maxStage)*100);
                return (
                  <div key={stage} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 20px"}}>
                    <div style={{fontSize:"13px",color,width:"100px",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stage}</div>
                    <div style={{flex:1,height:"5px",backgroundColor:"rgba(255,255,255,.05)",borderRadius:"10px",overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,backgroundColor:color,borderRadius:"10px",transition:"width .7s cubic-bezier(.4,0,.2,1)",minWidth:count>0?"5px":0}}/>
                    </div>
                    <div style={{fontSize:"13px",fontWeight:700,color,width:"24px",textAlign:"right",flexShrink:0}}>{count}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Recent Activity */}
      <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",overflow:"hidden",animation:"v2fu .35s ease 160ms both"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:"8px"}}>
            <ClkIco/> Recent Call Activity
          </span>
          <button style={{background:"none",border:"none",color:T.gold,fontFamily:"'DM Sans',sans-serif",fontSize:"12px",fontWeight:600,cursor:"pointer",padding:0}} onClick={()=>navigate("/agent/leads")}>
            View all leads →
          </button>
        </div>

        {recentCalls===null ? <RowSkeleton rows={5}/> :
         recentCalls.length===0 ? (
          <div style={{textAlign:"center",padding:"36px 20px",color:T.sub,fontSize:"13px"}}>
            <div style={{fontSize:"28px",marginBottom:"10px",opacity:.5}}>📞</div>
            <div style={{color:T.text,fontSize:"14px",fontWeight:600,marginBottom:"4px"}}>No calls yet</div>
            <div>Make your first call to see activity here</div>
          </div>
        ) : (
          recentCalls.map((call,idx)=>{
            const oc=OUTCOME_CFG[call.outcome]??{color:T.sub,bg:"rgba(154,154,154,.08)"};
            return (
              <div key={call.id} className="v2row"
                style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 20px",borderBottom:idx===recentCalls.length-1?"none":`1px solid ${T.border}`,cursor:"pointer",minHeight:"44px",transition:"background .15s",animation:`v2slr .2s ease ${idx*40}ms both`}}
                onClick={()=>call.leadId&&navigate(`/agent/lead/${call.leadId}`)}
              >
                <div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:oc.color,boxShadow:`0 0 6px ${oc.color}50`,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"14px",fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{call.leadName??"—"}</div>
                  <div style={{fontSize:"12px",color:T.sub,marginTop:"1px"}}>
                    {fmtDur(call.duration)}
                    {call.aiSummary&&<span style={{color:T.gold,marginLeft:"8px"}}>· AI summary ready</span>}
                  </div>
                </div>
                {call.outcome&&(
                  <span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color:oc.color,backgroundColor:oc.bg,whiteSpace:"nowrap",flexShrink:0}}>
                    {call.outcome}
                  </span>
                )}
                <span style={{fontSize:"11px",color:T.sub,flexShrink:0}}>{timeAgo(call.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default AgentDashboard;
