// TIRAS CRM V2 — MyFollowUps | Anuradha | Obsidian Gold
// src/pages/MyFollowUps.jsx
import React,{useState,useEffect,useMemo,useRef}from"react";
import{useNavigate}from"react-router-dom";
import{collection,query,where,onSnapshot,orderBy,updateDoc,doc,serverTimestamp,Timestamp}from"firebase/firestore";
import{db,COLLECTIONS}from"../firebase";
import{useAuth}from"../contexts/AuthContext";
const T={bg:"#121212",surface:"#1A1A1B",gold:"#D4AF37",accent:"#E63946",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#22C55E",warning:"#F59E0B",info:"#3B82F6",goldBg:"rgba(212,175,55,.10)",goldBorder:"rgba(212,175,55,.30)",dangerBg:"rgba(230,57,70,.10)",dangerBorder:"rgba(230,57,70,.30)",successBg:"rgba(34,197,94,.10)",warningBg:"rgba(245,158,11,.10)"};
const STYLE_ID="tiras-v2-fu";
const injectStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const t=document.createElement("style");t.id=STYLE_ID;
  t.textContent=`
    @keyframes v2fu  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2spin{to{transform:rotate(360deg)}}
    @keyframes v2shim{0%{background-position:-500px 0}100%{background-position:500px 0}}
    @keyframes v2row {from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
    @keyframes v2dout{from{opacity:1;max-height:120px}to{opacity:0;max-height:0;padding:0;margin:0;border:none}}
    @keyframes v2pls {0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes v2mbin{from{opacity:0}to{opacity:1}}
    @keyframes v2mpop{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes v2tin {from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
    .v2pbtn:hover{background:#e4c350!important;box-shadow:0 6px 20px rgba(212,175,55,.4)!important;transform:translateY(-1px)}
    .v2sbtn:hover{border-color:rgba(212,175,55,.5)!important;color:#D4AF37!important}
    .v2card:hover{border-color:rgba(212,175,55,.35)!important;transform:translateY(-1px);transition:all .2s ease!important}
    .v2abtn:hover{border-color:rgba(212,175,55,.45)!important;color:#D4AF37!important}
    .v2shim{background:linear-gradient(90deg,#1A1A1B 25%,rgba(255,255,255,.05) 50%,#1A1A1B 75%);background-size:500px 100%;animation:v2shim 1.4s ease infinite;border-radius:8px}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:640px){.v2pad{padding:16px!important}.v2stats{grid-template-columns:repeat(2,1fr)!important}.v2fu-actions{gap:6px!important}.v2fu-actions span{display:none!important}}
  `;
  document.head.appendChild(t);
};
const todayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d;};
const todayEnd=()=>{const d=new Date();d.setHours(23,59,59,999);return d;};
const fmtTime=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});};
const fmtDate=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});};
const fmtFull=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
const isoDate=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts);return d.toISOString().slice(0,10);};
const isoTime=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts);return d.toTimeString().slice(0,5);};
const bucket=fu=>{
  const d=fu.scheduledAt?.toDate?.();
  if(!d)return"upcoming";
  if(fu.status==="done")return"done";
  if(d<todayStart())return"overdue";
  if(d<=todayEnd())return"today";
  return"upcoming";
};
const dateLabel=isoKey=>{
  if(isoKey==="unknown")return"Unscheduled";
  const d=new Date(isoKey+"T00:00:00");
  const td=new Date();td.setHours(0,0,0,0);
  const tm=new Date();tm.setDate(tm.getDate()+1);tm.setHours(0,0,0,0);
  if(d.getTime()===td.getTime())return"Today";
  if(d.getTime()===tm.getTime())return"Tomorrow";
  if(d<td)return`Overdue — ${d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}`;
  return d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
};
const Shim=({h,w="100%"})=><div className="v2shim" style={{height:h,width:w}}/>;
const CheckIco=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const ClkIco=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const PhIco=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const EyIco=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

const ABtn=({ico,label,color,onClick})=>{
  const[h,setH]=useState(false);
  return(
    <button className="v2abtn" onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"7px",color:h?color:T.sub,cursor:"pointer",padding:"6px 10px",display:"flex",alignItems:"center",gap:"5px",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",fontWeight:600,transition:"all .15s",minHeight:"36px",whiteSpace:"nowrap"}}>
      {ico}<span>{label}</span>
    </button>
  );
};

const FUCard=({fu,onDone,onReschedule,onCall,onView,delay})=>{
  const[exiting,setExiting]=useState(false);
  const bkt=bucket(fu);
  const isOD=bkt==="overdue";
  const isDone=fu.status==="done";
  const isToday=bkt==="today";
  const barC=isDone?T.success:isOD?T.accent:isToday?T.gold:T.info;
  const doDone=()=>{setExiting(true);setTimeout(()=>onDone(fu.id),300);};
  return(
    <div className={exiting?"":"v2card"}
      style={{backgroundColor:T.surface,border:`1px solid ${isOD&&!isDone?`rgba(230,57,70,.35)`:T.border}`,borderRadius:"12px",overflow:"hidden",marginBottom:"10px",transition:"all .2s ease",animation:`v2row .2s ease ${delay}ms both`,opacity:isDone?.5:1,...(exiting?{animation:"v2dout .3s ease forwards",overflow:"hidden"}:{})}}>
      <div style={{display:"flex",alignItems:"stretch"}}>
        {/* Left colour bar */}
        <div style={{width:"3px",backgroundColor:barC,flexShrink:0,borderRadius:"12px 0 0 12px"}}/>
        <div style={{flex:1,padding:"14px 16px",display:"flex",alignItems:"center",gap:"14px"}}>
          {/* Time col */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"1px",minWidth:"52px",flexShrink:0}}>
            <div style={{fontSize:"14px",fontWeight:700,color:barC,fontFamily:"monospace",lineHeight:1.2}}>{fmtTime(fu.scheduledAt)}</div>
            <div style={{fontSize:"11px",color:T.sub,lineHeight:1.2,whiteSpace:"nowrap"}}>{fmtDate(fu.scheduledAt)}</div>
          </div>
          {/* Content */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"14px",fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:"2px"}}>{fu.leadName??"—"}</div>
            {fu.note&&<div style={{fontSize:"12px",color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:"4px"}}>{fu.note}</div>}
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {isOD&&!isDone&&<span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:T.accent,backgroundColor:T.dangerBg}}>Overdue</span>}
              {isDone&&<span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:T.success,backgroundColor:T.successBg}}>✓ Done</span>}
              {isToday&&!isDone&&<span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:T.gold,backgroundColor:T.goldBg,display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",backgroundColor:T.gold,animation:"v2pls 1.5s ease infinite",display:"inline-block"}}/>Today</span>}
            </div>
          </div>
          {/* Actions */}
          {!isDone&&(
            <div style={{display:"flex",gap:"6px",flexShrink:0,flexWrap:"wrap"}} className="v2fu-actions">
              {fu.leadId&&<ABtn ico={<EyIco/>} label="View" color={T.info} onClick={()=>onView(fu.leadId)}/>}
              {fu.leadId&&<ABtn ico={<PhIco/>} label="Call" color={T.success} onClick={()=>onCall(fu)}/>}
              <ABtn ico={<ClkIco/>} label="Reschedule" color={T.warning} onClick={()=>onReschedule(fu)}/>
              <ABtn ico={<CheckIco/>} label="Done" color={T.success} onClick={doDone}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MyFollowUps=()=>{
  const navigate=useNavigate();
  const{currentUser,companyId}=useAuth();
  const[followups,setFollowups]=useState(null);
  const[filter,setFilter]=useState("pending");
  const[reTarget,setReTarget]=useState(null);
  const[reDate,setReDate]=useState("");
  const[reTime,setReTime]=useState("");
  const[reNote,setReNote]=useState("");
  const[saving,setSaving]=useState(false);
  const[toast,setToast]=useState(null);
  const toastRef=useRef();

  const showToast=(msg,color=T.success)=>{clearTimeout(toastRef.current);setToast({msg,color});toastRef.current=setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    injectStyles();
    if(!currentUser||!companyId)return;
    const q=query(collection(db,COLLECTIONS.FOLLOW_UPS),where("agentId","==",currentUser.uid),where("companyId","==",companyId),orderBy("scheduledAt","asc"));
    const u=onSnapshot(q,snap=>setFollowups(snap.docs.map(d=>({id:d.id,...d.data()}))),err=>console.error(err));
    return()=>u();
  },[currentUser,companyId]);

  const counts=useMemo(()=>{
    if(!followups)return{};
    return{
      pending:followups.filter(f=>f.status==="pending").length,
      overdue:followups.filter(f=>bucket(f)==="overdue").length,
      today:  followups.filter(f=>bucket(f)==="today").length,
      done:   followups.filter(f=>f.status==="done").length,
      all:    followups.length,
    };
  },[followups]);

  const filtered=useMemo(()=>{
    if(!followups)return[];
    switch(filter){
      case"overdue":return followups.filter(f=>bucket(f)==="overdue");
      case"today":  return followups.filter(f=>bucket(f)==="today");
      case"done":   return followups.filter(f=>f.status==="done");
      case"all":    return followups;
      default:      return followups.filter(f=>f.status==="pending");
    }
  },[followups,filter]);

  // Grouped by date for pending/overdue/today
  const grouped=useMemo(()=>{
    if(filter==="done"||filter==="all")return null;
    const g={};
    filtered.forEach(fu=>{const k=isoDate(fu.scheduledAt)||"unknown";if(!g[k])g[k]=[];g[k].push(fu);});
    return g;
  },[filtered,filter]);

  const handleDone=async(id)=>{
    try{await updateDoc(doc(db,COLLECTIONS.FOLLOW_UPS,id),{status:"done",completedAt:serverTimestamp(),updatedAt:serverTimestamp()});showToast("Follow-up marked as done ✓");}
    catch{showToast("Could not update",T.accent);}
  };

  const openReschedule=fu=>{setReTarget(fu);setReDate(isoDate(fu.scheduledAt)||"");setReTime(isoTime(fu.scheduledAt)||"");setReNote(fu.note||"");};

  const handleReschedule=async()=>{
    if(!reDate||!reTime||!reTarget)return;setSaving(true);
    try{
      const nd=new Date(`${reDate}T${reTime}`);
      await updateDoc(doc(db,COLLECTIONS.FOLLOW_UPS,reTarget.id),{scheduledAt:Timestamp.fromDate(nd),note:reNote.trim(),status:"pending",updatedAt:serverTimestamp()});
      if(reTarget.leadId)await updateDoc(doc(db,COLLECTIONS.LEADS,reTarget.leadId),{nextFollowupAt:Timestamp.fromDate(nd),updatedAt:serverTimestamp()});
      setReTarget(null);showToast("Follow-up rescheduled");
    }catch{showToast("Could not reschedule",T.accent);}
    finally{setSaving(false);}
  };

  const FILTERS=[{k:"pending",l:"Pending",c:T.gold},{k:"overdue",l:"Overdue",c:T.accent},{k:"today",l:"Today",c:T.gold},{k:"done",l:"Done",c:T.success},{k:"all",l:"All",c:T.sub}];
  const inp={backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",padding:"10px 14px",outline:"none",width:"100%",boxSizing:"border-box",marginBottom:"14px"};
  const btnP={backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,padding:"9px 18px",cursor:"pointer",transition:"all .15s"};
  const btnS={backgroundColor:"transparent",color:T.sub,border:`1px solid ${T.border}`,borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:500,padding:"9px 18px",cursor:"pointer",transition:"all .15s"};

  return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text,padding:"28px"}} className="v2pad">
      {/* Header */}
      <div style={{marginBottom:"24px",animation:"v2fu .3s ease both"}}>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"26px",fontWeight:700,color:T.text,letterSpacing:"-0.01em",marginBottom:"4px"}}>My Follow-ups</h1>
        <p style={{color:T.sub,fontSize:"14px"}}>{followups!==null?`${counts.pending??0} pending · ${counts.overdue??0} overdue`:"Loading…"}</p>
      </div>

      {/* Stats */}
      {followups!==null&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"24px",animation:"v2fu .3s ease 50ms both"}} className="v2stats">
          {[{l:"Pending",v:counts.pending,c:T.gold},{l:"Overdue",v:counts.overdue,c:T.accent},{l:"Due Today",v:counts.today,c:T.gold},{l:"Done",v:counts.done,c:T.success}].map(({l,v,c})=>(
            <div key={l} style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"16px 18px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",backgroundColor:c}}/>
              <div style={{color:T.sub,fontSize:"10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>{l}</div>
              <div style={{fontSize:"30px",fontWeight:700,color:c,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{v??0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:"6px",marginBottom:"24px",flexWrap:"wrap",animation:"v2fu .3s ease 80ms both"}}>
        {FILTERS.map(({k,l,c})=>{
          const active=filter===k;const cnt=counts[k]??0;
          return(
            <button key={k} onClick={()=>setFilter(k)}
              style={{border:`1px solid ${active?c:T.border}`,borderRadius:"20px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:active?700:500,padding:"7px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",transition:"all .15s",backgroundColor:active?`${c}18`:"transparent",color:active?c:T.sub,minHeight:"36px"}}>
              {l}
              {cnt>0&&<span style={{fontSize:"10px",fontWeight:700,padding:"0 5px",borderRadius:"20px",lineHeight:"1.6",backgroundColor:active?"rgba(0,0,0,.2)":T.border,color:active?c:T.sub}}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {followups===null?(
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"16px",display:"flex",gap:"14px",alignItems:"center"}}>
              <Shim h="8px" w="8px"/><div style={{flex:1}}><Shim h="13px" w="45%"/><div style={{height:"5px"}}/><Shim h="11px" w="30%"/></div><Shim h="30px" w="180px"/>
            </div>
          ))}
        </div>
      ):filtered.length===0?(
        <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"48px 24px",textAlign:"center"}}>
          <div style={{fontSize:"32px",marginBottom:"12px",opacity:.4}}>{filter==="done"?"✅":filter==="overdue"?"⏰":"📅"}</div>
          <div style={{color:T.text,fontSize:"15px",fontWeight:600,marginBottom:"6px"}}>{filter==="done"?"No completed follow-ups":filter==="overdue"?"No overdue follow-ups — great!":"No follow-ups here"}</div>
          {filter==="pending"&&<div style={{color:T.sub,fontSize:"13px"}}>Open a lead and schedule a follow-up from the lead detail page.</div>}
        </div>
      ):grouped?(
        Object.entries(grouped).sort(([a],[b])=>new Date(a)-new Date(b)).map(([dateKey,items])=>{
          const lbl=dateLabel(dateKey);const isOD=lbl.startsWith("Overdue");
          return(
            <div key={dateKey}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",marginTop:"20px"}}>
                <div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:isOD?T.accent:T.gold,flexShrink:0}}/>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:"15px",fontWeight:700,color:isOD?T.accent:T.text}}>{lbl}</span>
                <span style={{fontSize:"11px",fontWeight:600,padding:"1px 8px",borderRadius:"20px",backgroundColor:"rgba(154,154,154,.08)",color:T.sub}}>{items.length}</span>
              </div>
              {items.map((fu,idx)=><FUCard key={fu.id} fu={fu} onDone={handleDone} onReschedule={openReschedule} onCall={fu=>navigate("/agent/call",{state:{lead:{id:fu.leadId,name:fu.leadName,phone:fu.leadPhone??null}}})} onView={id=>navigate(`/agent/lead/${id}`)} delay={idx*25}/>)}
            </div>
          );
        })
      ):(
        filtered.map((fu,idx)=><FUCard key={fu.id} fu={fu} onDone={handleDone} onReschedule={openReschedule} onCall={fu=>navigate("/agent/call",{state:{lead:{id:fu.leadId,name:fu.leadName,phone:fu.leadPhone??null}}})} onView={id=>navigate(`/agent/lead/${id}`)} delay={idx*25}/>)
      )}

      {/* Reschedule modal */}
      {reTarget&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px",animation:"v2mbin .2s ease both"}} onClick={()=>setReTarget(null)}>
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"16px",boxShadow:"0 20px 60px rgba(0,0,0,.7)",width:"100%",maxWidth:"420px",animation:"v2mpop .25s ease both",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},${T.accent})`}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px 12px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",fontWeight:700,color:T.text}}>Reschedule Follow-up</span>
              <button style={{background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:"20px",lineHeight:1}} onClick={()=>setReTarget(null)}>×</button>
            </div>
            <div style={{padding:"20px 24px"}}>
              <div style={{backgroundColor:T.bg,borderRadius:"8px",padding:"10px 14px",marginBottom:"16px",color:T.sub,fontSize:"13px"}}>
                <strong style={{color:T.text}}>{reTarget.leadName}</strong>{reTarget.scheduledAt&&<span> · was {fmtFull(reTarget.scheduledAt)}</span>}
              </div>
              <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>New Date</div>
              <input type="date" value={reDate} onChange={e=>setReDate(e.target.value)} min={new Date().toISOString().slice(0,10)} style={inp} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
              <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>New Time</div>
              <input type="time" value={reTime} onChange={e=>setReTime(e.target.value)} style={inp} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
              <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Note (optional)</div>
              <input type="text" placeholder="What to discuss…" value={reNote} onChange={e=>setReNote(e.target.value)} style={{...inp,marginBottom:0}} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
            </div>
            <div style={{padding:"12px 24px 20px",display:"flex",gap:"8px",justifyContent:"flex-end"}}>
              <button className="v2sbtn" style={btnS} onClick={()=>setReTarget(null)}>Cancel</button>
              <button className="v2pbtn" style={{...btnP,opacity:saving||!reDate||!reTime?.6:1}} onClick={handleReschedule} disabled={saving||!reDate||!reTime}>{saving?"Saving…":"Reschedule"}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${toast.color}`,borderRadius:"10px",padding:"12px 18px",color:T.text,fontSize:"13px",fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",gap:"8px",animation:"v2tin .3s ease both"}}>
        <span style={{color:toast.color}}>{toast.color===T.accent?"✕":"✓"}</span>{toast.msg}
      </div>}
    </div>
  );
};
export default MyFollowUps;
