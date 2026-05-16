// TIRAS CRM V2 — LeadDetailPage | Anuradha | Obsidian Gold
// src/pages/LeadDetailPage.jsx
import React,{useState,useEffect,useRef,useCallback}from"react";
import{useParams,useNavigate}from"react-router-dom";
import{doc,onSnapshot,collection,query,where,orderBy,getDocs,addDoc,updateDoc,serverTimestamp,Timestamp}from"firebase/firestore";
import{db,COLLECTIONS}from"../firebase";
import{useAuth}from"../contexts/AuthContext";
const T={bg:"#121212",surface:"#1A1A1B",gold:"#D4AF37",accent:"#E63946",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#22C55E",warning:"#F59E0B",info:"#3B82F6",goldBg:"rgba(212,175,55,.10)",goldBorder:"rgba(212,175,55,.30)",dangerBg:"rgba(230,57,70,.10)",dangerBorder:"rgba(230,57,70,.30)",successBg:"rgba(34,197,94,.10)",warningBg:"rgba(245,158,11,.10)",infoBg:"rgba(59,130,246,.10)"};
const STYLE_ID="tiras-v2-ld";
const injectStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const t=document.createElement("style");t.id=STYLE_ID;
  t.textContent=`
    @keyframes v2fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2spin{to{transform:rotate(360deg)}}
    @keyframes v2shim{0%{background-position:-500px 0}100%{background-position:500px 0}}
    @keyframes v2si{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
    @keyframes v2mbin{from{opacity:0}to{opacity:1}}
    @keyframes v2mpop{from{opacity:0;transform:scale(.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes v2tin{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes v2chk{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}
    .v2shim{background:linear-gradient(90deg,#1A1A1B 25%,rgba(255,255,255,.05) 50%,#1A1A1B 75%);background-size:500px 100%;animation:v2shim 1.4s ease infinite;border-radius:8px}
    .v2pbtn:hover{background:#e4c350!important;box-shadow:0 6px 20px rgba(212,175,55,.4)!important;transform:translateY(-1px)}
    .v2sbtn:hover{border-color:rgba(212,175,55,.5)!important;color:#D4AF37!important}
    .v2abtn:hover{border-color:rgba(212,175,55,.45)!important;color:#D4AF37!important;background:rgba(212,175,55,.06)!important}
    .v2tab-act{background:#D4AF37!important;color:#000!important;font-weight:700!important}
    .v2tab-in:hover{color:#F5F5F5!important}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:768px){.v2layout{grid-template-columns:1fr!important}.v2left-panel{position:static!important}.v2pad{padding:16px!important}}
  `;
  document.head.appendChild(t);
};
const STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const OUTCOMES=["Interested","Not Interested","Call Back","No Answer","Wrong Number","Busy","Voicemail"];
const OBJ_TAGS=["None","Price","Timing","Not Interested","Need More Info","Wrong Person"];
const STAGE_CFG={"New":{text:T.sub,bg:"rgba(154,154,154,.12)"},"Contacted":{text:T.info,bg:T.infoBg},"Interested":{text:T.gold,bg:T.goldBg},"Follow-up":{text:T.warning,bg:T.warningBg},"Negotiation":{text:T.gold,bg:T.goldBg},"Closed Won":{text:T.success,bg:T.successBg},"Closed Lost":{text:T.accent,bg:T.dangerBg}};
const SCORE_CFG={Hot:{text:"#FF4D4D",bg:"rgba(255,77,77,.10)",dot:"#FF4D4D"},Warm:{text:T.gold,bg:T.goldBg,dot:T.gold},Cold:{text:T.info,bg:T.infoBg,dot:T.info},Dead:{text:T.sub,bg:"rgba(154,154,154,.10)",dot:T.sub}};
const OC_CFG={"Interested":{c:T.success,bg:T.successBg},"Not Interested":{c:T.accent,bg:T.dangerBg},"Call Back":{c:T.gold,bg:T.goldBg},"No Answer":{c:T.sub,bg:"rgba(154,154,154,.08)"},"Wrong Number":{c:T.sub,bg:"rgba(154,154,154,.08)"},"Busy":{c:T.warning,bg:T.warningBg},"Voicemail":{c:T.info,bg:T.infoBg}};
const fmtDate=ts=>{if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});};
const fmtDT=ts=>{if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});};
const fmtDur=s=>{if(!s)return"0:00";return`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;};
const timeAgo=ts=>{if(!ts)return"";const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d.getTime())/1000);if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return fmtDate(ts);};
const waUrl=(phone,msg)=>`https://wa.me/91${(phone??"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
const Shim=({h,w="100%"})=><div className="v2shim" style={{height:h,width:w}}/>;
const Spinner=()=><div style={{width:"15px",height:"15px",borderRadius:"50%",border:`2px solid rgba(0,0,0,.2)`,borderTopColor:"#000",animation:"v2spin .7s linear infinite",flexShrink:0}}/>;
// Icons
const BackIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const PhIco=({sz=14})=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const WaIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>;
const CalIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const PayIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const TkIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>;
const EdIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const SpkIco=()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>;
const CpIco=()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;

const Badge=({label,cfg,dot})=>(
  <span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color:cfg.text||cfg.c,backgroundColor:cfg.bg,display:"inline-flex",alignItems:"center",gap:"4px",whiteSpace:"nowrap"}}>
    {dot&&<span style={{width:"5px",height:"5px",borderRadius:"50%",backgroundColor:dot,flexShrink:0}}/>}{label}
  </span>
);
const Modal=({title,onClose,footer,children})=>(
  <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px",animation:"v2mbin .2s ease both"}} onClick={onClose}>
    <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"16px",boxShadow:"0 20px 60px rgba(0,0,0,.7)",width:"100%",maxWidth:"440px",animation:"v2mpop .25s ease both",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px 12px",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",fontWeight:700,color:T.text}}>{title}</span>
        <button style={{background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:"20px",lineHeight:1,padding:"2px"}} onClick={onClose}>×</button>
      </div>
      <div style={{padding:"20px 24px"}}>{children}</div>
      {footer&&<div style={{padding:"12px 24px 20px",display:"flex",gap:"8px",justifyContent:"flex-end"}}>{footer}</div>}
    </div>
  </div>
);
const ActionBtn=({icon,label,color,onClick,disabled})=>{
  const[h,setH]=useState(false);
  return(
    <button disabled={disabled} className="v2abtn" onClick={onClick}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{width:"100%",border:`1px solid ${T.border}`,borderRadius:"8px",backgroundColor:"transparent",cursor:disabled?"not-allowed":"pointer",padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:600,color:h&&!disabled?T.gold:T.sub,transition:"all .15s",minHeight:"44px",opacity:disabled?.5:1}}>
      <span style={{color:h&&!disabled?color:T.sub,transition:"color .15s",flexShrink:0}}>{icon}</span>{label}
    </button>
  );
};
const mdInp={backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",padding:"10px 14px",outline:"none",width:"100%",boxSizing:"border-box",marginBottom:"14px",transition:"border .15s"};
const mdSel={...mdInp,cursor:"pointer"};
const mdTA={...mdInp,resize:"vertical",minHeight:"72px"};

export const LeadDetailPage=()=>{
  const{leadId}=useParams();
  const navigate=useNavigate();
  const{currentUser,companyId}=useAuth();
  const[lead,setLead]=useState(null);
  const[calls,setCalls]=useState(null);
  const[followups,setFollowups]=useState(null);
  const[tickets,setTickets]=useState(null);
  const[payments,setPayments]=useState(null);
  const[waTemplates,setWaTemplates]=useState([]);
  const[callingEnabled,setCallingEnabled]=useState(true);
  const[pageErr,setPageErr]=useState(null);
  const[activeTab,setActiveTab]=useState("timeline");
  const[noteText,setNoteText]=useState("");
  const[savingNote,setSavingNote]=useState(false);
  const[savingStage,setSavingStage]=useState(false);
  const[showFuModal,setShowFuModal]=useState(false);
  const[showTkModal,setShowTkModal]=useState(false);
  const[showPayModal,setShowPayModal]=useState(false);
  const[showWaModal,setShowWaModal]=useState(false);
  const[fuDate,setFuDate]=useState("");
  const[fuTime,setFuTime]=useState("");
  const[fuNote,setFuNote]=useState("");
  const[savingFu,setSavingFu]=useState(false);
  const[tkTitle,setTkTitle]=useState("");
  const[tkDesc,setTkDesc]=useState("");
  const[tkPri,setTkPri]=useState("Medium");
  const[savingTk,setSavingTk]=useState(false);
  const[payAmt,setPayAmt]=useState("");
  const[payDesc,setPayDesc]=useState("");
  const[payLink,setPayLink]=useState(null);
  const[savingPay,setSavingPay]=useState(false);
  const[selWa,setSelWa]=useState(null);
  const[toast,setToast]=useState(null);
  const toastRef=useRef();
  const unsubRefs=useRef([]);

  const showToast=useCallback((msg,color=T.success)=>{
    clearTimeout(toastRef.current);setToast({msg,color});toastRef.current=setTimeout(()=>setToast(null),3000);
  },[]);

  useEffect(()=>{
    injectStyles();
    if(!leadId)return;
    const u1=onSnapshot(doc(db,COLLECTIONS.LEADS,leadId),snap=>{
      if(!snap.exists()){setPageErr("Lead not found.");return;}
      setLead({id:snap.id,...snap.data()});
    },()=>setPageErr("Could not load lead."));
    unsubRefs.current=[u1];
    if(companyId){
      const u2=onSnapshot(doc(db,COLLECTIONS.COMPANIES,companyId),snap=>{
        if(!snap.exists())return;const d=snap.data();
        setCallingEnabled((d?.subscriptionStatus==="active"||d?.subscriptionStatus==="trial")&&(d?.wallet?.balance??0)>=5);
      });
      unsubRefs.current.push(u2);
      fetchSecondary();
    }
    return()=>unsubRefs.current.forEach(u=>u?.());
  },[leadId,companyId]);// eslint-disable-line

  const fetchSecondary=async()=>{
    const base=[where("leadId","==",leadId),where("companyId","==",companyId)];
    const[c,f,tk,p,wa]=await Promise.all([
      getDocs(query(collection(db,COLLECTIONS.CALLS),...base,orderBy("createdAt","desc"))),
      getDocs(query(collection(db,COLLECTIONS.FOLLOW_UPS),...base,orderBy("scheduledAt","desc"))),
      getDocs(query(collection(db,COLLECTIONS.TICKETS),...base,orderBy("createdAt","desc"))),
      getDocs(query(collection(db,COLLECTIONS.PAYMENTS),...base,orderBy("createdAt","desc"))),
      getDocs(query(collection(db,COLLECTIONS.WHATSAPP_TEMPLATES),where("companyId","==",companyId))),
    ]);
    setCalls(c.docs.map(d=>({id:d.id,...d.data()})));
    setFollowups(f.docs.map(d=>({id:d.id,...d.data()})));
    setTickets(tk.docs.map(d=>({id:d.id,...d.data()})));
    setPayments(p.docs.map(d=>({id:d.id,...d.data()})));
    setWaTemplates(wa.docs.map(d=>({id:d.id,...d.data()})));
  };

  const handleStageChange=async(s)=>{
    if(!lead||s===lead.stage)return;setSavingStage(true);
    try{await updateDoc(doc(db,COLLECTIONS.LEADS,leadId),{stage:s,updatedAt:serverTimestamp(),updatedBy:currentUser.uid});showToast(`Stage → ${s}`);}
    catch{showToast("Could not update stage",T.accent);}
    finally{setSavingStage(false);}
  };

  const handleAddNote=async()=>{
    if(!noteText.trim())return;setSavingNote(true);
    try{
      await addDoc(collection(db,COLLECTIONS.CALLS),{leadId,companyId,agentId:currentUser.uid,type:"note",note:noteText.trim(),createdAt:serverTimestamp(),leadName:lead?.name??""});
      await updateDoc(doc(db,COLLECTIONS.LEADS,leadId),{updatedAt:serverTimestamp(),lastNoteAt:serverTimestamp()});
      setNoteText("");showToast("Note saved");fetchSecondary();
    }catch{showToast("Could not save note",T.accent);}
    finally{setSavingNote(false);}
  };

  const handleSaveFu=async()=>{
    if(!fuDate||!fuTime)return;setSavingFu(true);
    try{
      const sd=new Date(`${fuDate}T${fuTime}`);
      await addDoc(collection(db,COLLECTIONS.FOLLOW_UPS),{leadId,leadName:lead?.name??"",companyId,agentId:currentUser.uid,scheduledAt:Timestamp.fromDate(sd),note:fuNote.trim(),status:"pending",createdAt:serverTimestamp()});
      await updateDoc(doc(db,COLLECTIONS.LEADS,leadId),{nextFollowupAt:Timestamp.fromDate(sd),updatedAt:serverTimestamp()});
      setShowFuModal(false);setFuDate("");setFuTime("");setFuNote("");showToast("Follow-up scheduled");fetchSecondary();
    }catch{showToast("Could not schedule",T.accent);}
    finally{setSavingFu(false);}
  };

  const handleSaveTk=async()=>{
    if(!tkTitle.trim())return;setSavingTk(true);
    try{
      await addDoc(collection(db,COLLECTIONS.TICKETS),{leadId,leadName:lead?.name??"",companyId,createdBy:currentUser.uid,title:tkTitle.trim(),description:tkDesc.trim(),priority:tkPri,status:"Open",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      setShowTkModal(false);setTkTitle("");setTkDesc("");setTkPri("Medium");showToast("Ticket raised");fetchSecondary();
    }catch{showToast("Could not raise ticket",T.accent);}
    finally{setSavingTk(false);}
  };

  const handleGenPay=async()=>{
    if(!payAmt||isNaN(Number(payAmt)))return;setSavingPay(true);
    try{
      const ref=await addDoc(collection(db,COLLECTIONS.PAYMENTS),{leadId,leadName:lead?.name??"",companyId,agentId:currentUser.uid,amount:Number(payAmt),currency:"INR",description:payDesc.trim()||`Payment from ${lead?.name}`,status:"link_pending",createdAt:serverTimestamp()});
      const lnk=`https://rzp.io/l/${ref.id.slice(0,8).toUpperCase()}`;
      setPayLink(lnk);showToast("Payment link generated");fetchSecondary();
    }catch{showToast("Could not generate link",T.accent);}
    finally{setSavingPay(false);}
  };

  const handleSendWa=(tmpl)=>{
    if(!lead?.phone)return;
    const msg=(tmpl.message??"").replace("{name}",lead.name??"").replace("{company}",lead.company??"");
    window.open(waUrl(lead.phone,msg),"_blank");
    setShowWaModal(false);showToast("WhatsApp opened");
  };

  if(pageErr)return(<div style={{minHeight:"100%",backgroundColor:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",flexDirection:"column",gap:"16px",color:T.accent,fontSize:"18px"}}><div>⚠ {pageErr}</div><button style={{backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,padding:"10px 20px",cursor:"pointer"}} onClick={()=>navigate(-1)}>Go back</button></div>);
  if(!lead)return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:T.sub}}>
        <div style={{width:"28px",height:"28px",borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.gold,animation:"v2spin .7s linear infinite",margin:"0 auto 12px"}}/>
        Loading lead…
      </div>
    </div>
  );

  const stC=STAGE_CFG[lead.stage]??STAGE_CFG["New"];
  const scC=SCORE_CFG[lead.leadScore];
  const TABS=[{k:"timeline",l:"Timeline",n:calls?.length??0},{k:"followups",l:"Follow-ups",n:followups?.filter(f=>f.status==="pending").length??0},{k:"tickets",l:"Tickets",n:tickets?.length??0},{k:"payments",l:"Payments",n:payments?.length??0}];

  const pill=(label,color,bg)=><span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color,backgroundColor:bg,whiteSpace:"nowrap"}}>{label}</span>;
  const btnP={backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:700,padding:"8px 18px",cursor:"pointer",transition:"all .15s"};
  const btnS={backgroundColor:"transparent",color:T.sub,border:`1px solid ${T.border}`,borderRadius:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:500,padding:"8px 18px",cursor:"pointer",transition:"all .15s"};

  return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text,padding:"28px"}} className="v2pad">
      {/* Back */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"24px",animation:"v2fu .25s ease both"}}>
        <button className="v2sbtn" style={{background:"none",border:"none",color:T.sub,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",display:"flex",alignItems:"center",gap:"5px",padding:0,transition:"color .15s",minHeight:"44px"}} onClick={()=>navigate("/agent/leads")}><BackIco/>My Leads</button>
        <span style={{color:T.border}}>›</span>
        <span style={{color:T.sub,fontSize:"13px"}}>{lead.name}</span>
      </div>

      {/* Two-col layout */}
      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:"20px",alignItems:"flex-start"}} className="v2layout">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div style={{display:"flex",flexDirection:"column",gap:"14px",position:"sticky",top:"24px"}} className="v2left-panel">

          {/* Info card */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden",animation:"v2fu .3s ease 40ms both"}}>
            {/* Accent top bar */}
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},${T.accent})`}}/>
            <div style={{padding:"20px 20px 0"}}>
              {/* Avatar */}
              <div style={{width:"56px",height:"56px",borderRadius:"50%",backgroundColor:T.goldBg,border:`1.5px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"14px"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:"24px",fontWeight:700,color:T.gold,lineHeight:1}}>{(lead.name??"?")[0].toUpperCase()}</span>
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",fontWeight:700,color:T.text,marginBottom:"10px",letterSpacing:"-0.01em"}}>{lead.name}</div>
              {/* Badges */}
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"16px"}}>
                <Badge label={lead.stage??"New"} cfg={stC}/>
                {scC&&<Badge label={lead.leadScore} cfg={scC} dot={scC.dot}/>}
                {lead.objectionTag&&lead.objectionTag!=="None"&&<span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color:T.warning,backgroundColor:T.warningBg}}>⚠ {lead.objectionTag}</span>}
              </div>
              {/* Stage select */}
              <div style={{marginBottom:"16px"}}>
                <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"6px"}}>Pipeline Stage</div>
                <select value={lead.stage??"New"} onChange={e=>handleStageChange(e.target.value)} disabled={savingStage}
                  style={{backgroundColor:T.bg,border:`1px solid ${stC.text}60`,borderRadius:"8px",color:stC.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:700,padding:"9px 12px",outline:"none",width:"100%",cursor:"pointer",opacity:savingStage?.6:1}}>
                  {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Details */}
              {[[PhIco,"Phone",lead.phone],[()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,"Email",lead.email],[()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,"Company",lead.company],[()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,"Source",lead.source]].filter(([,,v])=>v).map(([Ico,lbl,val])=>(
                <div key={lbl} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"12px"}}>
                  <span style={{color:T.sub,flexShrink:0,marginTop:"2px"}}><Ico/></span>
                  <div><div style={{color:T.sub,fontSize:"10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>{lbl}</div><div style={{color:T.text,fontSize:"14px",fontWeight:500,wordBreak:"break-word"}}>{val}</div></div>
                </div>
              ))}
              <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"16px"}}>
                <span style={{color:T.sub,flexShrink:0,marginTop:"2px"}}><CalIco/></span>
                <div><div style={{color:T.sub,fontSize:"10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>Added</div><div style={{color:T.text,fontSize:"14px",fontWeight:500}}>{fmtDate(lead.createdAt)}</div></div>
              </div>
              {lead.nextFollowupAt&&<div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"16px"}}>
                <span style={{color:T.gold,flexShrink:0,marginTop:"2px"}}><CalIco/></span>
                <div><div style={{color:T.gold,fontSize:"10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>Next Follow-up</div><div style={{color:T.gold,fontSize:"14px",fontWeight:600}}>{fmtDT(lead.nextFollowupAt)}</div></div>
              </div>}
            </div>
            {lead.dealValue>0&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",borderTop:`1px solid ${T.border}`,backgroundColor:"rgba(212,175,55,.04)"}}>
              <span style={{color:T.sub,fontSize:"13px"}}>Deal Value</span>
              <span style={{color:T.gold,fontSize:"18px",fontWeight:700}}>₹{Number(lead.dealValue).toLocaleString("en-IN")}</span>
            </div>}
          </div>

          {/* Quick actions */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",padding:"16px",animation:"v2fu .3s ease 80ms both"}}>
            <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"10px"}}>Quick Actions</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              <ActionBtn icon={<PhIco/>} label={callingEnabled?`Call ${lead.phone??""}`:"`Calling disabled — recharge wallet`"} color={T.success} disabled={!callingEnabled} onClick={()=>navigate("/agent/call",{state:{lead}})}/>
              <ActionBtn icon={<WaIco/>} label="Send WhatsApp" color="#25D366" onClick={()=>setShowWaModal(true)}/>
              <ActionBtn icon={<CalIco/>} label="Schedule Follow-up" color={T.gold} onClick={()=>setShowFuModal(true)}/>
              <ActionBtn icon={<PayIco/>} label="Generate Payment Link" color={T.gold} onClick={()=>{setPayLink(null);setShowPayModal(true);}}/>
              <ActionBtn icon={<TkIco/>} label="Raise Support Ticket" color={T.warning} onClick={()=>setShowTkModal(true)}/>
              <ActionBtn icon={<EdIco/>} label="Edit Lead" color={T.sub} onClick={()=>navigate(`/agent/edit-lead/${leadId}`)}/>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
        <div style={{display:"flex",flexDirection:"column",gap:"14px",animation:"v2fu .3s ease 100ms both"}}>

          {/* Tab bar */}
          <div style={{display:"flex",gap:"3px",backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"12px",padding:"4px"}}>
            {TABS.map(({k,l,n})=>(
              <button key={k}
                className={activeTab===k?"v2tab-act":"v2tab-in"}
                style={{flex:1,border:"none",borderRadius:"9px",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",fontWeight:activeTab===k?700:500,padding:"10px 8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",transition:"all .15s",backgroundColor:activeTab===k?T.gold:"transparent",color:activeTab===k?"#000":T.sub,minHeight:"44px"}}
                onClick={()=>setActiveTab(k)}
              >
                {l}{n>0&&<span style={{fontSize:"10px",fontWeight:700,padding:"0 5px",borderRadius:"20px",lineHeight:"1.6",backgroundColor:activeTab===k?"rgba(0,0,0,.2)":T.border,color:activeTab===k?"#000":T.sub}}>{n}</span>}
              </button>
            ))}
          </div>

          {/* ── Timeline ─────────────────────────────────────────────────────── */}
          {activeTab==="timeline"&&(
            <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Activity Timeline</span>
                <span style={{color:T.sub,fontSize:"12px"}}>All calls, notes & updates</span>
              </div>
              {/* Note input */}
              <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,backgroundColor:"rgba(212,175,55,.02)"}}>
                <textarea placeholder="Add a note about this lead…" value={noteText} onChange={e=>setNoteText(e.target.value)}
                  style={{width:"100%",backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"13px",padding:"10px 14px",outline:"none",resize:"vertical",minHeight:"60px",boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}
                />
                {noteText.trim()&&<button className="v2pbtn" style={btnP} onClick={handleAddNote} disabled={savingNote}>{savingNote?"Saving…":"Save Note"}</button>}
              </div>
              {/* Timeline items */}
              {calls===null?<div style={{padding:"32px",textAlign:"center",color:T.sub}}><div style={{width:"18px",height:"18px",borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.gold,animation:"v2spin .7s linear infinite",margin:"0 auto 10px"}}/></div>:
               calls.length===0?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>No activity yet — make the first call or add a note above.</div>:
               calls.map((item,idx)=>{
                const isNote=item.type==="note";
                const oc=OC_CFG[item.outcome]??{c:T.sub,bg:"rgba(154,154,154,.08)"};
                const dotC=isNote?T.info:oc.c;
                return(
                  <div key={item.id} style={{padding:"14px 20px",borderBottom:idx===calls.length-1?"none":`1px solid ${T.border}`,animation:`v2si .2s ease ${idx*30}ms both`,position:"relative"}}>
                    <div style={{position:"absolute",left:"17px",top:"20px",width:"7px",height:"7px",borderRadius:"50%",backgroundColor:dotC,boxShadow:`0 0 6px ${dotC}40`}}/>
                    <div style={{paddingLeft:"22px"}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"6px",gap:"8px"}}>
                        <div>
                          <span style={{fontSize:"14px",fontWeight:600,color:T.text}}>{isNote?"Note":`Call — ${fmtDur(item.duration)}`}</span>
                          {!isNote&&item.outcome&&<span style={{marginLeft:"8px",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:oc.c,backgroundColor:oc.bg}}>{item.outcome}</span>}
                        </div>
                        <span style={{color:T.sub,fontSize:"11px",flexShrink:0}}>{timeAgo(item.createdAt)}</span>
                      </div>
                      {item.note&&<div style={{color:T.sub,fontSize:"13px",lineHeight:"1.5",marginBottom:"8px"}}>{item.note}</div>}
                      {!isNote&&item.recordingUrl&&(
                        <div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:T.bg,borderRadius:"8px",padding:"8px 12px",marginBottom:"8px"}}>
                          <audio src={item.recordingUrl} controls style={{flex:1,height:"28px",outline:"none"}}/>
                        </div>
                      )}
                      {!isNote&&item.aiSummary&&(
                        <div style={{backgroundColor:T.goldBg,border:`1px solid ${T.goldBorder}`,borderRadius:"8px",padding:"10px 14px",marginBottom:"6px"}}>
                          <div style={{color:T.gold,fontSize:"10px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px",display:"flex",alignItems:"center",gap:"5px"}}><SpkIco/>AI Summary</div>
                          <div style={{color:T.sub,fontSize:"13px",lineHeight:"1.5"}}>{item.aiSummary}</div>
                        </div>
                      )}
                      {!isNote&&item.objectionTag&&item.objectionTag!=="None"&&<span style={{fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:T.warning,backgroundColor:T.warningBg}}>Objection: {item.objectionTag}</span>}
                    </div>
                  </div>
                );
               })}
            </div>
          )}

          {/* ── Follow-ups ───────────────────────────────────────────────────── */}
          {activeTab==="followups"&&(
            <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Follow-ups</span>
                <button className="v2pbtn" style={{...btnP,fontSize:"12px",padding:"6px 14px"}} onClick={()=>setShowFuModal(true)}>+ Schedule</button>
              </div>
              {followups===null?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>Loading…</div>:
               followups.length===0?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>No follow-ups scheduled yet.</div>:
               followups.map((fu,idx)=>{
                const isOD=fu.status==="pending"&&fu.scheduledAt?.toDate?.()<new Date();
                const c=isOD?T.accent:fu.status==="done"?T.success:T.gold;
                return(
                  <div key={fu.id} style={{padding:"14px 20px",borderBottom:idx===followups.length-1?"none":`1px solid ${T.border}`,position:"relative"}}>
                    <div style={{position:"absolute",left:"17px",top:"20px",width:"7px",height:"7px",borderRadius:"50%",backgroundColor:c}}/>
                    <div style={{paddingLeft:"22px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:"14px",fontWeight:600,color:T.text}}>{fmtDT(fu.scheduledAt)}</span>
                        {pill(isOD?"Overdue":fu.status,c,`${c}18`)}
                      </div>
                      {fu.note&&<div style={{color:T.sub,fontSize:"13px",marginTop:"4px"}}>{fu.note}</div>}
                    </div>
                  </div>
                );
               })}
            </div>
          )}

          {/* ── Tickets ──────────────────────────────────────────────────────── */}
          {activeTab==="tickets"&&(
            <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Support Tickets</span>
                <button className="v2pbtn" style={{...btnP,fontSize:"12px",padding:"6px 14px"}} onClick={()=>setShowTkModal(true)}>+ Raise Ticket</button>
              </div>
              {tickets===null?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>Loading…</div>:
               tickets.length===0?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>No tickets raised for this lead.</div>:
               tickets.map((tk,idx)=>{
                const c=tk.status==="Open"?T.accent:tk.status==="Resolved"?T.success:T.warning;
                return(
                  <div key={tk.id} style={{padding:"14px 20px",borderBottom:idx===tickets.length-1?"none":`1px solid ${T.border}`,position:"relative"}}>
                    <div style={{position:"absolute",left:"17px",top:"20px",width:"7px",height:"7px",borderRadius:"50%",backgroundColor:c}}/>
                    <div style={{paddingLeft:"22px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"4px"}}>
                        <span style={{fontSize:"14px",fontWeight:600,color:T.text}}>{tk.title}</span>
                        <div style={{display:"flex",gap:"6px",alignItems:"center",flexShrink:0}}>{pill(tk.status,c,`${c}18`)}<span style={{color:T.sub,fontSize:"11px"}}>{timeAgo(tk.createdAt)}</span></div>
                      </div>
                      {tk.description&&<div style={{color:T.sub,fontSize:"13px",lineHeight:"1.5"}}>{tk.description}</div>}
                      <span style={{fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",color:tk.priority==="High"?T.accent:tk.priority==="Low"?T.sub:T.warning,backgroundColor:tk.priority==="High"?T.dangerBg:tk.priority==="Low"?"rgba(154,154,154,.08)":T.warningBg,marginTop:"6px",display:"inline-block"}}>{tk.priority} Priority</span>
                    </div>
                  </div>
                );
               })}
            </div>
          )}

          {/* ── Payments ─────────────────────────────────────────────────────── */}
          {activeTab==="payments"&&(
            <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Payment Links</span>
                <button className="v2pbtn" style={{...btnP,fontSize:"12px",padding:"6px 14px"}} onClick={()=>{setPayLink(null);setShowPayModal(true);}}>+ New Link</button>
              </div>
              {payments===null?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>Loading…</div>:
               payments.length===0?<div style={{padding:"32px",textAlign:"center",color:T.sub,fontSize:"13px"}}>No payment links generated yet.</div>:
               payments.map((p,idx)=>{
                const c=p.status==="paid"?T.success:T.gold;
                return(
                  <div key={p.id} style={{padding:"14px 20px",borderBottom:idx===payments.length-1?"none":`1px solid ${T.border}`,position:"relative"}}>
                    <div style={{position:"absolute",left:"17px",top:"20px",width:"7px",height:"7px",borderRadius:"50%",backgroundColor:c}}/>
                    <div style={{paddingLeft:"22px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",marginBottom:"4px"}}>
                        <span style={{fontSize:"16px",fontWeight:700,color:T.gold}}>₹{Number(p.amount).toLocaleString("en-IN")}</span>
                        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>{pill(p.status==="paid"?"Paid ✓":"Pending",c,`${c}18`)}<span style={{color:T.sub,fontSize:"11px"}}>{timeAgo(p.createdAt)}</span></div>
                      </div>
                      {p.description&&<div style={{color:T.sub,fontSize:"13px"}}>{p.description}</div>}
                      {p.shortUrl&&<div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:T.bg,borderRadius:"8px",padding:"8px 12px",marginTop:"8px"}}>
                        <span style={{flex:1,color:T.gold,fontSize:"12px",fontFamily:"monospace",wordBreak:"break-all"}}>{p.shortUrl}</span>
                        <button className="v2sbtn" style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"6px",color:T.sub,cursor:"pointer",padding:"4px 8px",display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",transition:"all .15s"}} onClick={()=>{navigator.clipboard.writeText(p.shortUrl);showToast("Copied!")}}><CpIco/>Copy</button>
                      </div>}
                    </div>
                  </div>
                );
               })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      {showFuModal&&<Modal title="Schedule Follow-up" onClose={()=>setShowFuModal(false)} footer={<><button style={btnS} onClick={()=>setShowFuModal(false)}>Cancel</button><button className="v2pbtn" style={{...btnP,opacity:savingFu||!fuDate||!fuTime?.6:1}} onClick={handleSaveFu} disabled={savingFu||!fuDate||!fuTime}>{savingFu?"Saving…":"Schedule"}</button></>}>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Date</div>
        <input type="date" value={fuDate} onChange={e=>setFuDate(e.target.value)} min={new Date().toISOString().slice(0,10)} style={mdInp} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Time</div>
        <input type="time" value={fuTime} onChange={e=>setFuTime(e.target.value)} style={mdInp} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Note (optional)</div>
        <textarea placeholder="What to discuss…" value={fuNote} onChange={e=>setFuNote(e.target.value)} style={{...mdTA,marginBottom:0}} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
      </Modal>}

      {showTkModal&&<Modal title="Raise Support Ticket" onClose={()=>setShowTkModal(false)} footer={<><button style={btnS} onClick={()=>setShowTkModal(false)}>Cancel</button><button className="v2pbtn" style={{...btnP,opacity:savingTk||!tkTitle.trim()?.6:1}} onClick={handleSaveTk} disabled={savingTk||!tkTitle.trim()}>{savingTk?"Raising…":"Raise Ticket"}</button></>}>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Title *</div>
        <input type="text" placeholder="Brief description…" value={tkTitle} onChange={e=>setTkTitle(e.target.value)} style={mdInp} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Description</div>
        <textarea placeholder="Full details…" value={tkDesc} onChange={e=>setTkDesc(e.target.value)} style={mdTA} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
        <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Priority</div>
        <select value={tkPri} onChange={e=>setTkPri(e.target.value)} style={{...mdSel,marginBottom:0}} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}>
          {["Low","Medium","High"].map(p=><option key={p}>{p}</option>)}
        </select>
      </Modal>}

      {showPayModal&&<Modal title="Generate Payment Link" onClose={()=>setShowPayModal(false)} footer={!payLink&&<><button style={btnS} onClick={()=>setShowPayModal(false)}>Cancel</button><button className="v2pbtn" style={{...btnP,opacity:savingPay||!payAmt?.6:1}} onClick={handleGenPay} disabled={savingPay||!payAmt}>{savingPay?"Generating…":"Generate Link"}</button></>}>
        {payLink?(
          <div>
            <div style={{color:T.success,fontWeight:700,marginBottom:"10px"}}>✓ Payment link ready</div>
            <div style={{display:"flex",alignItems:"center",gap:"8px",backgroundColor:T.bg,borderRadius:"8px",padding:"10px 14px",marginBottom:"14px"}}>
              <span style={{flex:1,color:T.gold,fontSize:"13px",fontFamily:"monospace",wordBreak:"break-all"}}>{payLink}</span>
              <button className="v2sbtn" style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"6px",color:T.sub,cursor:"pointer",padding:"4px 8px",display:"flex",alignItems:"center",gap:"4px",fontSize:"12px",transition:"all .15s"}} onClick={()=>{navigator.clipboard.writeText(payLink);showToast("Link copied!");}}><CpIco/>Copy</button>
            </div>
            <button className="v2pbtn" style={{...btnP,width:"100%",justifyContent:"center",display:"flex",alignItems:"center",gap:"8px",backgroundColor:"#25D366"}} onClick={()=>window.open(waUrl(lead.phone,`Hi ${lead.name}, please complete your payment: ${payLink}`),"_blank")}><WaIco/>Send via WhatsApp</button>
            <button style={{...btnS,width:"100%",marginTop:"8px"}} onClick={()=>setShowPayModal(false)}>Done</button>
          </div>
        ):(
          <>
            <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Amount (₹) *</div>
            <input type="number" placeholder="e.g. 5000" value={payAmt} onChange={e=>setPayAmt(e.target.value)} style={mdInp} min="1" onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
            <div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Description</div>
            <input type="text" placeholder={`Payment from ${lead.name}`} value={payDesc} onChange={e=>setPayDesc(e.target.value)} style={{...mdInp,marginBottom:"6px"}} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
            <div style={{color:T.sub,fontSize:"12px"}}>Razorpay charges 2% per transaction.</div>
          </>
        )}
      </Modal>}

      {showWaModal&&<Modal title={`WhatsApp — ${lead.name}`} onClose={()=>{setShowWaModal(false);setSelWa(null);}}>
        {waTemplates.length===0?(
          <>
            <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>No saved templates. Type a custom message:</div>
            <textarea placeholder="Type your message…" value={selWa?.message??""} onChange={e=>setSelWa({message:e.target.value})} style={{...mdTA,marginBottom:"14px"}} onFocus={e=>e.target.style.border=`1px solid ${T.gold}`} onBlur={e=>e.target.style.border=`1px solid ${T.border}`}/>
            <button className="v2pbtn" style={{...btnP,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",backgroundColor:"#25D366",opacity:selWa?.message?.trim()?1:.5}} onClick={()=>selWa?.message?.trim()&&handleSendWa(selWa)}><WaIco/>Open WhatsApp</button>
          </>
        ):(
          <>
            <div style={{color:T.sub,fontSize:"13px",marginBottom:"12px"}}>Select a template to send to {lead.name}:</div>
            {waTemplates.map(tmpl=>(
              <div key={tmpl.id} onClick={()=>setSelWa(tmpl)} style={{backgroundColor:T.bg,border:`1px solid ${selWa?.id===tmpl.id?T.gold:T.border}`,borderRadius:"8px",padding:"10px 14px",marginBottom:"8px",cursor:"pointer",transition:"border .15s",backgroundColor:selWa?.id===tmpl.id?T.goldBg:T.bg}}>
                <div style={{fontSize:"13px",fontWeight:600,color:T.text,marginBottom:"2px"}}>{tmpl.name}</div>
                <div style={{fontSize:"12px",color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tmpl.message}</div>
              </div>
            ))}
            <button className="v2pbtn" style={{...btnP,width:"100%",marginTop:"6px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",backgroundColor:"#25D366",opacity:selWa?1:.5}} onClick={()=>selWa&&handleSendWa(selWa)}><WaIco/>Open WhatsApp</button>
          </>
        )}
      </Modal>}

      {toast&&<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${toast.color}`,borderRadius:"10px",padding:"12px 18px",color:T.text,fontSize:"13px",fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",gap:"8px",maxWidth:"320px",animation:"v2tin .3s ease both"}}>
        <span style={{color:toast.color}}>{toast.color===T.accent?"✕":"✓"}</span>{toast.msg}
      </div>}
    </div>
  );
};
export default LeadDetailPage;
