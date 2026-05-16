// TIRAS CRM V2 — MyLeadsList
// Account: Anuradha | Obsidian Gold | src/pages/MyLeadsList.jsx
// Desktop: full table | Mobile (<640px): card-per-lead
// Real-time onSnapshot | All filters client-side | Wallet gate on Call button

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const T = {
  bg:"#121212",surface:"#1A1A1B",gold:"#D4AF37",accent:"#E63946",
  text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",
  success:"#22C55E",warning:"#F59E0B",info:"#3B82F6",
  goldBg:"rgba(212,175,55,.10)",goldBorder:"rgba(212,175,55,.30)",
  dangerBg:"rgba(230,57,70,.10)",dangerBorder:"rgba(230,57,70,.30)",
  successBg:"rgba(34,197,94,.10)",warningBg:"rgba(245,158,11,.10)",infoBg:"rgba(59,130,246,.10)",
};

const STYLE_ID="tiras-v2-leads";
const injectStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const t=document.createElement("style"); t.id=STYLE_ID;
  t.textContent=`
    @keyframes v2fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2spin{to{transform:rotate(360deg)}}
    @keyframes v2shim{0%{background-position:-500px 0}100%{background-position:500px 0}}
    @keyframes v2row{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
    .v2card:hover{border-color:rgba(212,175,55,.35)!important;transform:translateY(-2px);transition:all .2s ease!important}
    .v2row:hover{background:rgba(212,175,55,.04)!important;cursor:pointer}
    .v2pbtn:hover{background:#e4c350!important;transform:translateY(-1px)}
    .v2sbtn:hover{border-color:rgba(212,175,55,.5)!important;color:#D4AF37!important}
    .v2shim{background:linear-gradient(90deg,#1A1A1B 25%,rgba(255,255,255,.05) 50%,#1A1A1B 75%);background-size:500px 100%;animation:v2shim 1.4s ease infinite;border-radius:8px}
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:640px){
      .v2table-view{display:none!important}
      .v2card-view{display:block!important}
      .v2pad{padding:16px!important}
      .v2toolbar{flex-direction:column!important}
      .v2toolbar>*{width:100%!important}
    }
    @media(min-width:641px){.v2card-view{display:none!important}}
  `;
  document.head.appendChild(t);
};

const STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const SOURCES=["IndiaMART","Website","Cold Call","Referral","Walk-in","Social Media","WhatsApp","Trade Show"];
const SCORES=["Hot","Warm","Cold","Dead"];
const SORT_OPTS=[
  {v:"newest",l:"Newest first"},{v:"oldest",l:"Oldest first"},
  {v:"name_az",l:"Name A→Z"},{v:"name_za",l:"Name Z→A"},
  {v:"last_call",l:"Last call"},{v:"score",l:"Lead score"},
];
const SCORE_ORD={Hot:0,Warm:1,Cold:2,Dead:3};

const STAGE_CFG={
  "New":         {text:T.sub,        bg:"rgba(154,154,154,.12)"},
  "Contacted":   {text:T.info,       bg:T.infoBg},
  "Interested":  {text:T.gold,       bg:T.goldBg},
  "Follow-up":   {text:T.warning,    bg:T.warningBg},
  "Negotiation": {text:T.gold,       bg:T.goldBg},
  "Closed Won":  {text:T.success,    bg:T.successBg},
  "Closed Lost": {text:T.accent,     bg:T.dangerBg},
};
const SCORE_CFG={
  Hot: {text:"#FF4D4D",bg:"rgba(255,77,77,.10)",dot:"#FF4D4D"},
  Warm:{text:T.gold,  bg:T.goldBg,             dot:T.gold},
  Cold:{text:T.info,  bg:T.infoBg,             dot:T.info},
  Dead:{text:T.sub,   bg:"rgba(154,154,154,.10)",dot:T.sub},
};

const norm=s=>(s??"").toLowerCase().trim();
const timeAgo=ts=>{
  if(!ts)return null;
  const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d.getTime())/1000);
  if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;
  const dy=Math.floor(s/86400);if(dy===1)return"Yesterday";if(dy<7)return`${dy}d ago`;
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
};

const Shim=({h,w="100%",style={}})=>(
  <div className="v2shim" style={{height:h,width:w,...style}}/>
);
const SkeletonRows=({n=5})=>(
  <div>
    {Array.from({length:n}).map((_,i)=>(
      <div key={i} style={{display:"flex",gap:"16px",padding:"14px 20px",borderBottom:`1px solid ${T.border}`,alignItems:"center"}}>
        <div style={{flex:"2"}}><Shim h="13px" w="60%"/><div style={{height:"4px"}}/><Shim h="11px" w="35%"/></div>
        <div style={{flex:"1"}}><Shim h="22px" w="70%"/></div>
        <div style={{flex:"1"}}><Shim h="22px" w="60%"/></div>
        <div style={{flex:"1"}}><Shim h="13px" w="55%"/></div>
        <div style={{flex:"1"}}><Shim h="13px" w="40%"/></div>
        <div style={{flex:"0 0 90px",display:"flex",gap:"6px"}}><Shim h="30px" w="30px"/><Shim h="30px" w="30px"/></div>
      </div>
    ))}
  </div>
);

// Icons
const SearchIco=()=>(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
const PlusIco=()=>(<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const EyeIco=()=>(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
const PhIco=()=>(<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);

const Badge=({label,cfg})=>(
  <span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color:cfg.text,backgroundColor:cfg.bg,display:"inline-flex",alignItems:"center",gap:"4px",whiteSpace:"nowrap"}}>
    {cfg.dot&&<span style={{width:"5px",height:"5px",borderRadius:"50%",backgroundColor:cfg.dot,flexShrink:0}}/>}
    {label}
  </span>
);

export const MyLeadsList=()=>{
  const navigate=useNavigate();
  const {currentUser,companyId}=useAuth();
  const [leads,setLeads]=useState(null);
  const [callingEnabled,setCallingEnabled]=useState(true);
  const [search,setSearch]=useState("");
  const [stageF,setStageF]=useState("All");
  const [scoreF,setScoreF]=useState("All");
  const [sourceF,setSourceF]=useState("All");
  const [sortBy,setSortBy]=useState("newest");
  const [toast,setToast]=useState(null);
  const toastRef=useRef();

  const showToast=(msg,color=T.success)=>{
    clearTimeout(toastRef.current);
    setToast({msg,color});
    toastRef.current=setTimeout(()=>setToast(null),3000);
  };

  useEffect(()=>{
    injectStyles();
    if(!currentUser||!companyId)return;
    const u1=onSnapshot(doc(db,COLLECTIONS.COMPANIES,companyId),snap=>{
      if(!snap.exists())return;
      const d=snap.data();
      setCallingEnabled((d?.subscriptionStatus==="active"||d?.subscriptionStatus==="trial")&&(d?.wallet?.balance??0)>=5);
    });
    const u2=onSnapshot(
      query(collection(db,COLLECTIONS.LEADS),where("assignedTo","==",currentUser.uid),where("companyId","==",companyId),orderBy("createdAt","desc")),
      snap=>setLeads(snap.docs.map(d=>({id:d.id,...d.data()}))),
      err=>console.error("leads snap",err)
    );
    return()=>{u1();u2();};
  },[currentUser,companyId]);

  const filtered=useMemo(()=>{
    if(!leads)return[];
    const term=norm(search);
    return leads.filter(l=>{
      if(term&&!norm(l.name).includes(term)&&!norm(l.phone).includes(term)&&!norm(l.email).includes(term))return false;
      if(stageF!=="All"&&l.stage!==stageF)return false;
      if(scoreF!=="All"&&l.leadScore!==scoreF)return false;
      if(sourceF!=="All"&&l.source!==sourceF)return false;
      return true;
    }).sort((a,b)=>{
      switch(sortBy){
        case"oldest":return(a.createdAt?.seconds??0)-(b.createdAt?.seconds??0);
        case"name_az":return norm(a.name).localeCompare(norm(b.name));
        case"name_za":return norm(b.name).localeCompare(norm(a.name));
        case"last_call":return(b.lastCallAt?.seconds??0)-(a.lastCallAt?.seconds??0);
        case"score":return(SCORE_ORD[a.leadScore]??9)-(SCORE_ORD[b.leadScore]??9);
        default:return(b.createdAt?.seconds??0)-(a.createdAt?.seconds??0);
      }
    });
  },[leads,search,stageF,scoreF,sourceF,sortBy]);

  const hasFilters=search||stageF!=="All"||scoreF!=="All"||sourceF!=="All";
  const clearAll=()=>{setSearch("");setStageF("All");setScoreF("All");setSourceF("All");};

  const inp={backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",padding:"10px 14px",outline:"none",transition:"border .15s"};
  const sel={...inp,cursor:"pointer"};

  return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,padding:"28px",fontFamily:"'DM Sans',sans-serif",color:T.text}} className="v2pad">

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"24px",flexWrap:"wrap",gap:"12px",animation:"v2fu .3s ease both"}}>
        <div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"26px",fontWeight:700,color:T.text,letterSpacing:"-0.01em",marginBottom:"4px"}}>My Leads</h1>
          <p style={{color:T.sub,fontSize:"14px"}}>{leads!==null?`${leads.length} lead${leads.length!==1?"s":""} assigned to you`:"Loading…"}</p>
        </div>
        <button className="v2pbtn" style={{backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,padding:"10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:"7px",minHeight:"44px",transition:"all .15s",boxShadow:`0 4px 14px rgba(212,175,55,.3)`}} onClick={()=>navigate("/agent/add-lead")}>
          <PlusIco/> Add Lead
        </button>
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap",alignItems:"center",animation:"v2fu .3s ease 50ms both"}} className="v2toolbar">
        <div style={{position:"relative",flex:"1 1 200px",minWidth:"160px"}}>
          <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:T.sub,display:"flex"}}><SearchIco/></span>
          <input type="text" placeholder="Search name, phone, email…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inp,paddingLeft:"36px",width:"100%",boxSizing:"border-box"}}
            onFocus={e=>{e.target.style.border=`1px solid ${T.gold}`;}}
            onBlur={e=>{e.target.style.border=`1px solid ${T.border}`;}}
          />
        </div>
        {[
          {val:stageF,set:setStageF,opts:STAGES,all:"All Stages"},
          {val:scoreF,set:setScoreF,opts:SCORES,all:"All Scores"},
          {val:sourceF,set:setSourceF,opts:SOURCES,all:"All Sources"},
        ].map(({val,set,opts,all},i)=>(
          <select key={i} value={val} onChange={e=>set(e.target.value)} style={{...sel,flex:"0 0 auto"}}
            onFocus={e=>e.target.style.border=`1px solid ${T.gold}`}
            onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
          >
            <option value="All">{all}</option>
            {opts.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...sel,flex:"0 0 auto",color:T.text}}
          onFocus={e=>e.target.style.border=`1px solid ${T.gold}`}
          onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
        >
          {SORT_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>

      {/* Results bar */}
      {leads!==null&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",animation:"v2fu .3s ease 80ms both"}}>
          <span style={{color:T.sub,fontSize:"13px",fontWeight:500}}>
            {filtered.length===leads.length?`${leads.length} lead${leads.length!==1?"s":""}`:`${filtered.length} of ${leads.length} leads`}
          </span>
          {hasFilters&&<button style={{background:"none",border:"none",color:T.gold,fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:600,cursor:"pointer",padding:0}} onClick={clearAll}>Clear filters</button>}
        </div>
      )}

      {/* ── DESKTOP TABLE ─────────────────────────────────────────────────────── */}
      <div className="v2table-view" style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",overflow:"hidden",animation:"v2fu .3s ease 100ms both"}}>
        {/* Table header */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",backgroundColor:"rgba(255,255,255,.02)",padding:"10px 20px",borderBottom:`1px solid ${T.border}`}}>
          {["Lead","Stage","Score","Source","Last Activity",""].map((h,i)=>(
            <div key={i} style={{color:T.sub,fontSize:"10px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:i===5?"right":"left"}}>{h}</div>
          ))}
        </div>

        {leads===null?<SkeletonRows/>:
         leads.length===0?(
          <div style={{textAlign:"center",padding:"48px 20px",color:T.sub}}>
            <div style={{fontSize:"32px",marginBottom:"12px",opacity:.4}}>📋</div>
            <div style={{color:T.text,fontSize:"15px",fontWeight:600,marginBottom:"6px"}}>No leads assigned yet</div>
            <div style={{marginBottom:"20px"}}>Your manager hasn't assigned any leads, or add your first one</div>
            <button className="v2pbtn" style={{backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,padding:"10px 20px",cursor:"pointer",minHeight:"44px",transition:"all .15s"}} onClick={()=>navigate("/agent/add-lead")}>Add Your First Lead</button>
          </div>
         ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"48px 20px",color:T.sub}}>
            <div style={{fontSize:"32px",marginBottom:"12px",opacity:.4}}>🔍</div>
            <div style={{color:T.text,fontSize:"15px",fontWeight:600,marginBottom:"6px"}}>No results</div>
            <button style={{background:"none",border:"none",color:T.gold,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:600,cursor:"pointer",padding:0}} onClick={clearAll}>Clear all filters</button>
          </div>
         ):(
          filtered.map((lead,idx)=>{
            const stC=STAGE_CFG[lead.stage]??STAGE_CFG["New"];
            const scC=SCORE_CFG[lead.leadScore];
            return(
              <div key={lead.id} className="v2row"
                style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",padding:"12px 20px",borderBottom:idx===filtered.length-1?"none":`1px solid ${T.border}`,alignItems:"center",transition:"background .15s",animation:`v2row .2s ease ${Math.min(idx*25,300)}ms both`}}
                onClick={()=>navigate(`/agent/lead/${lead.id}`)}
              >
                <div style={{minWidth:0}}>
                  <div style={{fontSize:"14px",fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.name??"—"}</div>
                  <div style={{fontSize:"12px",color:T.sub,marginTop:"2px"}}>{lead.phone??"—"}</div>
                </div>
                <div><Badge label={lead.stage??"New"} cfg={stC}/></div>
                <div>{scC?<Badge label={lead.leadScore} cfg={scC}/>:<span style={{color:T.sub,fontSize:"13px"}}>—</span>}</div>
                <div style={{fontSize:"13px",color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.source??"—"}</div>
                <div>
                  {lead.lastCallAt
                    ?<><div style={{fontSize:"13px",color:T.sub}}>{timeAgo(lead.lastCallAt)}</div><div style={{fontSize:"11px",color:T.sub,marginTop:"1px"}}>{lead.lastCallOutcome}</div></>
                    :<span style={{fontSize:"13px",color:T.sub}}>Never called</span>
                  }
                </div>
                <div style={{display:"flex",gap:"6px",justifyContent:"flex-end"}} onClick={e=>e.stopPropagation()}>
                  <button className="v2sbtn" style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"7px",color:T.sub,cursor:"pointer",padding:"6px 9px",display:"flex",alignItems:"center",transition:"all .15s",minHeight:"36px"}} title="View" onClick={()=>navigate(`/agent/lead/${lead.id}`)}><EyeIco/></button>
                  <button className="v2sbtn" style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"7px",color:T.sub,cursor:callingEnabled?"pointer":"not-allowed",padding:"6px 9px",display:"flex",alignItems:"center",transition:"all .15s",minHeight:"36px",opacity:callingEnabled?1:.45}} title="Call"
                    onClick={()=>{if(!callingEnabled){showToast("Calling disabled — admin must recharge wallet",T.accent);return;}navigate("/agent/call",{state:{lead}});}}
                  ><PhIco/></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MOBILE CARD VIEW ─────────────────────────────────────────────────── */}
      <div className="v2card-view" style={{display:"none"}}>
        {leads===null?(
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"16px"}}>
                <Shim h="14px" w="60%"/><div style={{height:"6px"}}/><Shim h="11px" w="40%"/><div style={{height:"10px"}}/><div style={{display:"flex",gap:"6px"}}><Shim h="22px" w="70px"/><Shim h="22px" w="55px"/></div>
              </div>
            ))}
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"48px 20px",color:T.sub}}>
            <div style={{fontSize:"32px",marginBottom:"12px",opacity:.4}}>🔍</div>
            <div style={{color:T.text,fontSize:"15px",fontWeight:600,marginBottom:"6px"}}>No results</div>
            <button style={{background:"none",border:"none",color:T.gold,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:600,cursor:"pointer",padding:0}} onClick={clearAll}>Clear filters</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {filtered.map((lead,idx)=>{
              const stC=STAGE_CFG[lead.stage]??STAGE_CFG["New"];
              const scC=SCORE_CFG[lead.leadScore];
              return(
                <div key={lead.id} className="v2card" style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"16px",transition:"all .2s ease",animation:`v2row .2s ease ${Math.min(idx*30,240)}ms both`}}>
                  {/* Top row */}
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:"15px",fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.name??"—"}</div>
                      <div style={{fontSize:"13px",color:T.sub,marginTop:"2px"}}>{lead.phone??"—"}</div>
                    </div>
                    <Badge label={lead.stage??"New"} cfg={stC}/>
                  </div>
                  {/* Meta row */}
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
                    {scC&&<Badge label={lead.leadScore} cfg={scC}/>}
                    {lead.source&&<span style={{fontSize:"11px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",color:T.sub,backgroundColor:"rgba(154,154,154,.08)"}}>{lead.source}</span>}
                  </div>
                  {lead.lastCallAt&&<div style={{fontSize:"12px",color:T.sub,marginBottom:"12px"}}>Last call: {timeAgo(lead.lastCallAt)} · {lead.lastCallOutcome}</div>}
                  {/* Actions */}
                  <div style={{display:"flex",gap:"8px"}}>
                    <button className="v2pbtn" style={{flex:1,backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,padding:"10px",cursor:"pointer",minHeight:"44px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",transition:"all .15s"}} onClick={()=>navigate(`/agent/lead/${lead.id}`)}>
                      <EyeIco/> View
                    </button>
                    <button className="v2sbtn" style={{flex:1,backgroundColor:"transparent",color:callingEnabled?T.success:T.sub,border:`1px solid ${callingEnabled?"rgba(34,197,94,.4)":T.border}`,borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,padding:"10px",cursor:callingEnabled?"pointer":"not-allowed",minHeight:"44px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",transition:"all .15s",opacity:callingEnabled?1:.5}}
                      onClick={()=>{if(!callingEnabled){showToast("Calling disabled",T.accent);return;}navigate("/agent/call",{state:{lead}});}}
                    >
                      <PhIco/> Call
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${toast.color}`,borderRadius:"10px",padding:"12px 18px",color:T.text,fontSize:"13px",fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",gap:"8px",maxWidth:"320px",animation:"v2fu .3s ease both"}}>
          <span style={{color:toast.color}}>{toast.color===T.accent?"✕":"✓"}</span>{toast.msg}
        </div>
      )}
    </div>
  );
};
export default MyLeadsList;
