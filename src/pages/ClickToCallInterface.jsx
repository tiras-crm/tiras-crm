// TIRAS CRM V2 — ClickToCallInterface | Anuradha | Obsidian Gold
// src/pages/ClickToCallInterface.jsx
import React,{useState,useEffect,useRef,useCallback}from"react";
import{useNavigate,useLocation}from"react-router-dom";
import{collection,query,where,getDocs,addDoc,updateDoc,doc,serverTimestamp,Timestamp,limit}from"firebase/firestore";
import{db,COLLECTIONS}from"../firebase";
import{useAuth}from"../contexts/AuthContext";
const T={bg:"#121212",surface:"#1A1A1B",gold:"#D4AF37",accent:"#E63946",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#22C55E",warning:"#F59E0B",info:"#3B82F6",goldBg:"rgba(212,175,55,.10)",goldBorder:"rgba(212,175,55,.30)",dangerBg:"rgba(230,57,70,.10)",dangerBorder:"rgba(230,57,70,.30)",successBg:"rgba(34,197,94,.10)"};
const STYLE_ID="tiras-v2-call";
const injectStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const t=document.createElement("style");t.id=STYLE_ID;
  t.textContent=`
    @keyframes v2fu  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2spin{to{transform:rotate(360deg)}}
    @keyframes v2ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.2);opacity:0}}
    @keyframes v2dpls{0%,80%,100%{opacity:.25;transform:scale(.7)}40%{opacity:1;transform:scale(1)}}
    @keyframes v2rdot{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes v2dpng{0%,100%{box-shadow:0 0 0 0 rgba(230,57,70,0)}50%{box-shadow:0 0 0 12px rgba(230,57,70,.25)}}
    @keyframes v2sup {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2chkc{from{stroke-dashoffset:126}to{stroke-dashoffset:0}}
    @keyframes v2chkd{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}
    .v2pbtn:hover{background:#e4c350!important;box-shadow:0 6px 20px rgba(212,175,55,.4)!important;transform:translateY(-1px)}
    .v2sbtn:hover{border-color:rgba(212,175,55,.5)!important;color:#D4AF37!important}
    .v2ctlbtn:hover{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.25)!important}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:640px){.v2pad{padding:16px!important}}
  `;
  document.head.appendChild(t);
};
const STATE={IDLE:"idle",CONNECTING:"connecting",IN_CALL:"in_call",POST_CALL:"post_call",BLOCKED:"blocked"};
const OUTCOMES=[{v:"Interested",c:T.success,e:"🔥"},{v:"Not Interested",c:T.accent,e:"❌"},{v:"Call Back",c:T.gold,e:"🔄"},{v:"No Answer",c:T.sub,e:"🔕"},{v:"Wrong Number",c:T.sub,e:"❓"},{v:"Busy",c:T.warning,e:"⏳"},{v:"Voicemail",c:T.info,e:"📬"}];
const OBJ_TAGS=["None","Price","Timing","Not Interested","Need More Info","Wrong Person"];
const scoreFromDur=s=>{if(!s||s===0)return"Dead";if(s<30)return"Cold";if(s<180)return"Warm";return"Hot";};
const pad2=n=>String(n).padStart(2,"0");
const fmtTimer=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;return h>0?`${pad2(h)}:${pad2(m)}:${pad2(sc)}`:`${pad2(m)}:${pad2(sc)}`;};

const BackIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const PhOff=({sz=28})=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const PhOn=({sz=28,color="#000"})=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const MicIco=({muted})=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={muted?T.accent:"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{muted&&<line x1="1" y1="1" x2="23" y2="23" stroke={T.accent}/>}<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const PauseIco=()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const SpkIco=()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>;

const CheckAnim=()=>(
  <svg width="72" height="72" viewBox="0 0 52 52" fill="none">
    <circle cx="26" cy="26" r="24" fill={T.successBg} stroke={T.success} strokeWidth="2" strokeDasharray="151" strokeDashoffset="151" style={{animation:"v2chkc .5s ease .1s forwards"}}/>
    <polyline points="15 26 22 33 37 18" stroke={T.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="40" style={{animation:"v2chkd .35s ease .5s forwards"}}/>
  </svg>
);

export const ClickToCallInterface=()=>{
  const navigate=useNavigate();
  const location=useLocation();
  const{currentUser,companyId,userProfile}=useAuth();
  const[lead,setLead]=useState(location.state?.lead??null);
  const[manualPhone,setManualPhone]=useState("");
  const[callState,setCallState]=useState(STATE.IDLE);
  const[callSaved,setCallSaved]=useState(false);
  const[elapsed,setElapsed]=useState(0);
  const timerRef=useRef();
  const[isMuted,setIsMuted]=useState(false);
  const[isOnHold,setIsOnHold]=useState(false);
  const[liveNote,setLiveNote]=useState("");
  const[selOutcome,setSelOutcome]=useState(null);
  const[postNote,setPostNote]=useState("");
  const[selTag,setSelTag]=useState("None");
  const[saving,setSaving]=useState(false);
  const[blockedBy,setBlockedBy]=useState(null);
  const plivoRef=useRef();
  const callDocRef=useRef();
  const callStartRef=useRef();

  useEffect(()=>{injectStyles();},[]);
  useEffect(()=>{
    if(!window.Plivo||!userProfile?.plivoUsername||!userProfile?.plivoPassword)return;
    const c=new window.Plivo.BrowserSdk({debug:"ERROR",permOnClick:false});
    c.client.on("onCallConnected",()=>{callStartRef.current=new Date();setCallState(STATE.IN_CALL);startTimer();});
    c.client.on("onCallTerminated",()=>{stopTimer();setCallState(prev=>prev!==STATE.POST_CALL?STATE.POST_CALL:prev);});
    c.client.login(userProfile.plivoUsername,userProfile.plivoPassword);
    plivoRef.current=c;
    return()=>{try{plivoRef.current?.client?.logout();}catch{}};
  },[userProfile]);
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const startTimer=useCallback(()=>{setElapsed(0);timerRef.current=setInterval(()=>setElapsed(s=>s+1),1000);},[]);
  const stopTimer=useCallback(()=>clearInterval(timerRef.current),[]);

  const checkOverlap=async(leadId)=>{
    if(!leadId)return false;
    const snap=await getDocs(query(collection(db,COLLECTIONS.CALLS),where("leadId","==",leadId),where("companyId","==",companyId),where("status","==","in_progress"),limit(1)));
    if(snap.empty)return false;
    const d=snap.docs[0].data();
    if(d.agentId===currentUser.uid)return false;
    setBlockedBy(d.agentDisplayName??"Another agent");setCallState(STATE.BLOCKED);return true;
  };

  const handleCall=async()=>{
    const phone=(lead?.phone??manualPhone).replace(/\D/g,"");
    if(!phone)return;
    if(lead?.id){const blocked=await checkOverlap(lead.id);if(blocked)return;}
    setCallState(STATE.CONNECTING);
    try{
      const ref=await addDoc(collection(db,COLLECTIONS.CALLS),{leadId:lead?.id??null,leadName:lead?.name??manualPhone,companyId,agentId:currentUser.uid,agentDisplayName:userProfile?.displayName??currentUser.email,phone,status:"in_progress",createdAt:serverTimestamp(),type:"call"});
      callDocRef.current=ref.id;
      if(plivoRef.current){
        plivoRef.current.client.call(`91${phone.startsWith("91")?phone.slice(2):phone}`,{"X-PH-LeadId":lead?.id??"","X-PH-CompanyId":companyId,"X-PH-AgentId":currentUser.uid});
      }else{
        console.warn("Plivo SDK not loaded — simulating (dev mode)");
        setTimeout(()=>{callStartRef.current=new Date();setCallState(STATE.IN_CALL);startTimer();},2000);
      }
    }catch(e){console.error(e);setCallState(STATE.IDLE);}
  };

  const handleEndCall=()=>{
    try{plivoRef.current?.client?.hangup();}catch{}
    stopTimer();setCallState(STATE.POST_CALL);setPostNote(liveNote);setLiveNote("");
  };

  const toggleMute=()=>{try{isMuted?plivoRef.current?.client?.unmute():plivoRef.current?.client?.mute();}catch{}setIsMuted(v=>!v);};
  const toggleHold=()=>setIsOnHold(v=>!v);

  const handleSaveCall=async()=>{
    if(!selOutcome)return;setSaving(true);
    try{
      const dur=elapsed;
      const score=scoreFromDur(["No Answer","Wrong Number","Busy"].includes(selOutcome)?0:dur);
      if(callDocRef.current)await updateDoc(doc(db,COLLECTIONS.CALLS,callDocRef.current),{status:"completed",outcome:selOutcome,duration:dur,note:postNote.trim(),objectionTag:selTag,leadScore:score,endedAt:serverTimestamp()});
      if(lead?.id)await updateDoc(doc(db,COLLECTIONS.LEADS,lead.id),{lastCallAt:serverTimestamp(),lastCallOutcome:selOutcome,leadScore:score,objectionTag:selTag!=="None"?selTag:null,updatedAt:serverTimestamp(),updatedBy:currentUser.uid});
      setCallSaved(true);
    }catch(e){console.error(e);}
    finally{setSaving(false);}
  };

  const handleDiscard=async()=>{
    if(callDocRef.current){try{await updateDoc(doc(db,COLLECTIONS.CALLS,callDocRef.current),{status:"abandoned",endedAt:serverTimestamp()});}catch{}}
    navigate(lead?.id?`/agent/lead/${lead.id}`:"/agent/leads");
  };

  const phone=lead?.phone??manualPhone??"—";
  const name=lead?.name??(manualPhone?`+91 ${manualPhone}`:"Unknown");
  const avatar=(lead?.name??"?")[0].toUpperCase();
  const canDial=lead?.phone||(manualPhone.length===10);

  const card={backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"16px",overflow:"hidden",animation:"v2fu .3s ease 40ms both",width:"100%",maxWidth:"480px",boxShadow:"0 20px 60px rgba(0,0,0,.5)"};
  const btnP={backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,padding:"11px 20px",cursor:"pointer",transition:"all .15s"};
  const btnS={backgroundColor:"transparent",color:T.sub,border:`1px solid ${T.border}`,borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:500,padding:"11px 20px",cursor:"pointer",transition:"all .15s"};

  if(callSaved)return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 24px",fontFamily:"'DM Sans',sans-serif",color:T.text}}>
      <div style={{backgroundColor:T.surface,border:`1px solid ${T.goldBorder}`,borderRadius:"16px",padding:"40px 32px",textAlign:"center",maxWidth:"440px",width:"100%",animation:"v2fu .35s ease both",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{marginBottom:"16px"}}><CheckAnim/></div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",fontWeight:700,color:T.success,marginBottom:"8px"}}>Call logged</div>
        <div style={{color:T.sub,fontSize:"14px",lineHeight:"1.6",marginBottom:"28px"}}>
          <strong style={{color:T.gold}}>{selOutcome}</strong> — {fmtTimer(elapsed)} with {name}.
          <br/>Score updated to <strong style={{color:{Hot:"#FF4D4D",Warm:T.gold,Cold:T.info,Dead:T.sub}[scoreFromDur(["No Answer","Wrong Number","Busy"].includes(selOutcome)?0:elapsed)]}}>{scoreFromDur(["No Answer","Wrong Number","Busy"].includes(selOutcome)?0:elapsed)}</strong>.
          {postNote&&" Note saved."}{selTag!=="None"&&<> Objection: <strong>{selTag}</strong>.</>}
        </div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center",flexWrap:"wrap"}}>
          {lead?.id&&<button className="v2pbtn" style={btnP} onClick={()=>navigate(`/agent/lead/${lead.id}`)}>View Lead</button>}
          <button className="v2pbtn" style={{...btnP,backgroundColor:T.success}} onClick={()=>{setCallState(STATE.IDLE);setElapsed(0);setSelOutcome(null);setPostNote("");setSelTag("None");setLiveNote("");callDocRef.current=null;setCallSaved(false);}}>Call Again</button>
          <button className="v2sbtn" style={btnS} onClick={()=>navigate("/agent/leads")}>My Leads</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 24px",fontFamily:"'DM Sans',sans-serif",color:T.text}} className="v2pad">
      {/* Top row */}
      <div style={{width:"100%",maxWidth:"480px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"24px",animation:"v2fu .25s ease both"}}>
        <button className="v2sbtn" style={{background:"none",border:"none",color:T.sub,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",display:"flex",alignItems:"center",gap:"5px",padding:0,minHeight:"44px",transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.sub} onClick={()=>lead?.id?navigate(`/agent/lead/${lead.id}`):navigate("/agent/leads")} disabled={callState===STATE.IN_CALL}><BackIco/>{lead?.id?lead.name:"My Leads"}</button>
        {callState===STATE.IN_CALL&&<span style={{display:"flex",alignItems:"center",gap:"6px",color:T.success,fontSize:"13px",fontWeight:600}}><span style={{width:"6px",height:"6px",borderRadius:"50%",backgroundColor:T.success,animation:"v2rdot 1.2s ease infinite"}}/>Live</span>}
      </div>

      <div style={card}>
        {/* Gradient top bar */}
        <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},${T.accent})`}}/>

        {/* Lead header */}
        <div style={{padding:"24px 24px 16px",textAlign:"center",borderBottom:`1px solid ${T.border}`}}>
          <div style={{width:"64px",height:"64px",borderRadius:"50%",backgroundColor:T.goldBg,border:`1.5px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:"26px",fontWeight:700,color:T.gold,lineHeight:1}}>{avatar}</span>
          </div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",fontWeight:700,color:T.text,marginBottom:"4px"}}>{name}</div>
          <div style={{fontSize:"16px",color:T.sub,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:"6px"}}>{phone}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",flexWrap:"wrap"}}>
            {lead?.source&&<span style={{fontSize:"11px",fontWeight:600,padding:"2px 10px",borderRadius:"20px",color:T.sub,backgroundColor:"rgba(154,154,154,.08)"}}>{lead.source}</span>}
            {lead?.leadScore&&<span style={{fontSize:"11px",fontWeight:700,padding:"2px 10px",borderRadius:"20px",color:{Hot:"#FF4D4D",Warm:T.gold,Cold:T.info,Dead:T.sub}[lead.leadScore]||T.sub,backgroundColor:{Hot:"rgba(255,77,77,.10)",Warm:T.goldBg,Cold:T.infoBg,Dead:"rgba(154,154,154,.10)"}[lead.leadScore]||"rgba(154,154,154,.10)"}}>{lead.leadScore}</span>}
          </div>
        </div>

        {/* ── IDLE ─────────────────────────────────────────────────────────── */}
        {callState===STATE.IDLE&&(
          <div style={{padding:"32px 24px 36px",display:"flex",flexDirection:"column",alignItems:"center"}}>
            {!lead&&(
              <div style={{width:"100%",marginBottom:"24px"}}>
                <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"6px"}}>Phone number</div>
                <input type="tel" placeholder="98XXXXXXXX" value={manualPhone} onChange={e=>setManualPhone(e.target.value.replace(/\D/g,"").slice(0,10))} maxLength={10}
                  style={{backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"monospace",fontSize:"22px",letterSpacing:"0.1em",padding:"12px 20px",outline:"none",width:"100%",textAlign:"center",boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
                />
              </div>
            )}
            {/* Ring + call button */}
            <div style={{position:"relative",width:"110px",height:"110px",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"24px"}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{position:"absolute",width:"110px",height:"110px",borderRadius:"50%",border:`2px solid ${T.success}`,animation:`v2ring 2.4s ease ${i*.8}s infinite`}}/>
              ))}
              <button className="v2pbtn"
                style={{width:"80px",height:"80px",borderRadius:"50%",backgroundColor:canDial?T.success:"rgba(34,197,94,.3)",border:"none",cursor:canDial?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1,boxShadow:canDial?`0 6px 24px rgba(34,197,94,.4)`:"none",transition:"all .15s"}}
                onClick={handleCall} disabled={!canDial}
              ><PhOn sz={30} color="#fff"/></button>
            </div>
            <span style={{color:T.sub,fontSize:"13px",fontWeight:500,letterSpacing:"0.04em"}}>Tap to call</span>
            {lead?.lastCallAt&&(
              <div style={{display:"flex",alignItems:"center",gap:"6px",backgroundColor:"rgba(154,154,154,.08)",borderRadius:"20px",padding:"4px 14px",marginTop:"14px"}}>
                <span style={{fontSize:"10px",color:T.sub}}>●</span>
                <span style={{color:T.sub,fontSize:"12px"}}>Last: <strong style={{color:T.text}}>{lead.lastCallOutcome??"Unknown"}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* ── CONNECTING ────────────────────────────────────────────────────── */}
        {callState===STATE.CONNECTING&&(
          <div style={{padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",color:T.sub,fontSize:"16px",fontWeight:500}}>
              Connecting
              {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",backgroundColor:T.gold,animation:`v2dpls 1.2s ease ${i*.2}s infinite`}}/>)}
            </div>
            <div style={{color:T.sub,fontSize:"14px"}}>Dialling {phone}…</div>
            <button className="v2sbtn" style={{...btnS,borderRadius:"20px",padding:"8px 24px",borderColor:`rgba(230,57,70,.4)`,color:T.accent}} onMouseEnter={e=>{e.currentTarget.style.backgroundColor=T.dangerBg;}} onMouseLeave={e=>{e.currentTarget.style.backgroundColor="transparent";}} onClick={handleEndCall}>Cancel</button>
          </div>
        )}

        {/* ── IN CALL ───────────────────────────────────────────────────────── */}
        {callState===STATE.IN_CALL&&(
          <div style={{padding:"28px 24px 36px",display:"flex",flexDirection:"column",alignItems:"center"}}>
            {/* Timer */}
            <div style={{textAlign:"center",marginBottom:"24px"}}>
              <div style={{fontFamily:"monospace",fontSize:"48px",fontWeight:700,color:T.text,letterSpacing:"0.08em",lineHeight:1}}>{fmtTimer(elapsed)}</div>
              <div style={{color:T.sub,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:"6px"}}>Duration</div>
            </div>
            {/* Recording badge */}
            <div style={{display:"flex",alignItems:"center",gap:"7px",backgroundColor:T.dangerBg,border:`1px solid ${T.dangerBorder}`,borderRadius:"20px",padding:"5px 14px",marginBottom:"28px"}}>
              <div style={{width:"6px",height:"6px",borderRadius:"50%",backgroundColor:T.accent,animation:"v2rdot 1.4s ease infinite"}}/>
              <span style={{color:T.accent,fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>Recording</span>
            </div>
            {/* Controls */}
            <div style={{display:"flex",alignItems:"center",gap:"24px",marginBottom:"28px"}}>
              {/* Mute */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                <button className="v2ctlbtn" onClick={toggleMute}
                  style={{width:"56px",height:"56px",borderRadius:"50%",border:`1px solid ${isMuted?T.accent:T.border}`,backgroundColor:isMuted?T.dangerBg:"rgba(255,255,255,.04)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",color:isMuted?T.accent:T.text}}>
                  <MicIco muted={isMuted}/>
                </button>
                <span style={{fontSize:"11px",color:T.sub}}>{isMuted?"Unmute":"Mute"}</span>
              </div>
              {/* End call */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                <button onClick={handleEndCall}
                  style={{width:"72px",height:"72px",borderRadius:"50%",backgroundColor:T.accent,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:"v2dpng 2s ease infinite",boxShadow:`0 6px 24px rgba(230,57,70,.45)`,transition:"transform .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  <PhOff sz={28}/>
                </button>
                <span style={{fontSize:"12px",color:T.sub,fontWeight:500}}>End Call</span>
              </div>
              {/* Hold */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"}}>
                <button className="v2ctlbtn" onClick={toggleHold}
                  style={{width:"56px",height:"56px",borderRadius:"50%",border:`1px solid ${isOnHold?T.gold:T.border}`,backgroundColor:isOnHold?T.goldBg:"rgba(255,255,255,.04)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",color:isOnHold?T.gold:T.text}}>
                  <PauseIco/>
                </button>
                <span style={{fontSize:"11px",color:T.sub}}>{isOnHold?"Resume":"Hold"}</span>
              </div>
            </div>
            {/* Live note */}
            <textarea placeholder="Quick note while on call…" value={liveNote} onChange={e=>setLiveNote(e.target.value)}
              style={{width:"100%",backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"13px",padding:"10px 14px",outline:"none",resize:"none",height:"56px",boxSizing:"border-box"}}
              onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
            />
          </div>
        )}

        {/* ── POST CALL ─────────────────────────────────────────────────────── */}
        {callState===STATE.POST_CALL&&(
          <div style={{padding:"24px",animation:"v2sup .3s ease both"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",fontWeight:700,color:T.text}}>Log this call</span>
              <span style={{fontSize:"12px",fontWeight:700,fontFamily:"monospace",backgroundColor:"rgba(154,154,154,.10)",color:T.sub,padding:"2px 10px",borderRadius:"20px"}}>{fmtTimer(elapsed)}</span>
            </div>
            {/* Outcome */}
            <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"10px"}}>Call Outcome *</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"20px"}}>
              {OUTCOMES.map(({v,c,e})=>(
                <button key={v} onClick={()=>setSelOutcome(v)}
                  style={{border:`1px solid ${selOutcome===v?c:T.border}`,borderRadius:"8px",backgroundColor:selOutcome===v?`${c}10`:"transparent",cursor:"pointer",padding:"10px 14px",display:"flex",alignItems:"center",gap:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",color:selOutcome===v?c:T.sub,fontWeight:selOutcome===v?700:400,transition:"all .15s",minHeight:"44px",textAlign:"left"}}>
                  <span style={{fontSize:"16px"}}>{e}</span>{v}
                </button>
              ))}
            </div>
            {/* Note */}
            <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Note</div>
            <textarea placeholder="What was discussed? Key points, objections, next steps…" value={postNote} onChange={e=>setPostNote(e.target.value)}
              style={{width:"100%",backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",padding:"10px 14px",outline:"none",resize:"vertical",minHeight:"72px",boxSizing:"border-box",marginBottom:"20px"}}
              onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
            />
            {/* Objection tags */}
            <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Objection Raised</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"7px",marginBottom:"20px"}}>
              {OBJ_TAGS.map(tag=>(
                <button key={tag} onClick={()=>setSelTag(tag)}
                  style={{border:`1px solid ${selTag===tag?T.warning:T.border}`,borderRadius:"20px",backgroundColor:selTag===tag?T.warningBg:"transparent",cursor:"pointer",padding:"4px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",fontWeight:selTag===tag?700:400,color:selTag===tag?T.warning:T.sub,transition:"all .15s",minHeight:"36px"}}>
                  {tag}
                </button>
              ))}
            </div>
            {/* AI hint */}
            <div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:T.goldBg,border:`1px solid ${T.goldBorder}`,borderRadius:"8px",padding:"10px 14px",marginBottom:"20px"}}>
              <SpkIco/><span style={{color:T.sub,fontSize:"12px",lineHeight:"1.5"}}>AI summary will be generated automatically within ~60 seconds of saving.</span>
            </div>
            <div style={{height:"1px",backgroundColor:T.border,marginBottom:"16px"}}/>
            <div style={{display:"flex",gap:"8px"}}>
              <button className="v2sbtn" style={btnS} onClick={handleDiscard} disabled={saving}>Discard</button>
              <button className="v2pbtn" style={{...btnP,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",opacity:!selOutcome||saving?.5:1,cursor:!selOutcome?"not-allowed":"pointer"}} onClick={handleSaveCall} disabled={!selOutcome||saving}>
                {saving?<><div style={{width:"14px",height:"14px",borderRadius:"50%",border:"2px solid rgba(0,0,0,.2)",borderTopColor:"#000",animation:"v2spin .7s linear infinite"}}/>Saving…</>:"Save Call Log"}
              </button>
            </div>
          </div>
        )}

        {/* ── BLOCKED ───────────────────────────────────────────────────────── */}
        {callState===STATE.BLOCKED&&(
          <div style={{padding:"48px 24px",textAlign:"center",animation:"v2fu .3s ease both"}}>
            <div style={{fontSize:"40px",marginBottom:"16px"}}>🔒</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",fontWeight:700,color:T.accent,marginBottom:"10px"}}>Lead Already Being Called</div>
            <div style={{color:T.sub,fontSize:"14px",lineHeight:"1.7",marginBottom:"28px"}}>
              <strong style={{color:T.text}}>{blockedBy}</strong> is currently on a call with <strong style={{color:T.gold}}>{name}</strong>.<br/>Wait for their call to end or contact your manager.
            </div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button className="v2sbtn" style={btnS} onClick={()=>setCallState(STATE.IDLE)}>Go Back</button>
              {lead?.id&&<button className="v2pbtn" style={btnP} onClick={()=>navigate(`/agent/lead/${lead.id}`)}>View Lead</button>}
            </div>
          </div>
        )}
      </div>

      {callState===STATE.IDLE&&<div style={{marginTop:"20px",color:T.sub,fontSize:"12px",textAlign:"center",maxWidth:"340px",lineHeight:"1.6"}}>All calls are recorded automatically and linked to the lead's timeline.</div>}
    </div>
  );
};
export default ClickToCallInterface;
