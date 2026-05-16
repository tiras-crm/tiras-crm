// TIRAS CRM V2 — TeamManagement.jsx  (UPPARA account)
// Real-time team roster via onSnapshot · mobile cards · desktop table
// Add member via Cloud Function · edit/deactivate with toast
//
// src/pages/TeamManagement.jsx
// export { TeamManagement } from "./TeamManagement";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, COLLECTIONS, ROLES } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  RiAddLine, RiSearchLine, RiEditLine, RiUserLine,
  RiShieldUserLine, RiTeamLine, RiCheckboxCircleLine,
  RiIndeterminateCircleLine, RiLoader4Line, RiCloseLine,
  RiMailLine, RiAlertLine, RiCheckLine, RiUserSettingsLine,
  RiRefreshLine,
} from "react-icons/ri";

// ─── V2 Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",
  gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",
  red:"#E63946",redMuted:"rgba(230,57,70,0.12)",
  text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",
  success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",
  warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",
  info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)",
};
const FH="'Playfair Display',Georgia,serif";
const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};
const TR="all 0.15s ease";

const ROLE_OPTIONS=[
  {value:ROLES.MANAGER,label:"Manager",desc:"Sees his agents, leads, recordings. Can assign tickets.",color:C.gold},
  {value:ROLES.AGENT,label:"Agent",desc:"Sees only his own assigned leads and calls.",color:C.info},
  {value:ROLES.SUPPORT_AGENT,label:"Support Agent",desc:"Sees only tickets assigned to them.",color:C.success},
];
const ROLE_COLOR={[ROLES.MANAGER]:{c:C.gold,bg:C.goldMuted},[ROLES.AGENT]:{c:C.info,bg:C.infoMuted},[ROLES.SUPPORT_AGENT]:{c:C.success,bg:C.successMuted}};
const FILTER_TABS=[{v:"all",l:"All"},{v:ROLES.MANAGER,l:"Managers"},{v:ROLES.AGENT,l:"Agents"},{v:ROLES.SUPPORT_AGENT,l:"Support"}];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nameColor=(name="")=>{const h=[C.gold,C.info,C.success,"#9B59B6","#1ABC9C",C.warning];let s=0;for(let i=0;i<name.length;i++)s+=name.charCodeAt(i);return h[s%h.length];};
const lastActive=(ts)=>{if(!ts)return"Never";const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d)/1000);if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;};

// ─── SK shimmer ───────────────────────────────────────────────────────────────
const SK=({w="100%",h="16px",r=R.md})=>(<div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#232325 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"v2Shimmer 1.6s ease-in-out infinite"}}/>);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast=({msg,type="success"})=>{const col=type==="error"?C.red:C.success;return(<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:C.surfaceAct,border:`1px solid ${col}50`,borderLeft:`3px solid ${col}`,borderRadius:R.md,padding:"10px 18px",display:"flex",alignItems:"center",gap:"8px",boxShadow:SH.md,zIndex:3000,fontFamily:FB,fontSize:"13px",color:C.text,animation:"v2SlideIn 0.25s ease"}}>{type==="error"?<RiAlertLine size={15} color={col}/>:<RiCheckLine size={15} color={col}/> }{msg}</div>);};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar=({name,size=38})=>{const col=nameColor(name);return(<div style={{width:size,height:size,borderRadius:"50%",backgroundColor:col+"22",border:`2px solid ${col}50`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FH,fontSize:size*0.38,fontWeight:700,color:col,flexShrink:0,userSelect:"none"}}>{(name||"?").charAt(0).toUpperCase()}</div>);};

// ─── Role Badge ───────────────────────────────────────────────────────────────
const RoleBadge=({role})=>{const cfg=ROLE_COLOR[role]||{c:C.sub,bg:C.surfaceAct};return(<span style={{fontSize:"11px",fontWeight:600,fontFamily:FB,color:cfg.c,backgroundColor:cfg.bg,border:`1px solid ${cfg.c}30`,borderRadius:R.full,padding:"3px 10px",whiteSpace:"nowrap"}}>{ROLE_OPTIONS.find(r=>r.value===role)?.label||role}</span>);};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge=({active})=>(<span style={{fontSize:"11px",fontWeight:600,fontFamily:FB,display:"inline-flex",alignItems:"center",gap:"4px",color:active!==false?C.success:C.sub,backgroundColor:active!==false?C.successMuted:C.surfaceAct,border:`1px solid ${active!==false?C.success+"30":C.border}`,borderRadius:R.full,padding:"3px 10px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",backgroundColor:active!==false?C.success:C.sub,flexShrink:0}}/>{active!==false?"Active":"Inactive"}</span>);

// ─── Mini Stat ────────────────────────────────────────────────────────────────
const MiniStat=({icon:Icon,ic,label,value,loading})=>(<div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"14px 16px",display:"flex",alignItems:"center",gap:"12px"}}><div style={{width:"36px",height:"36px",borderRadius:R.md,backgroundColor:ic+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon size={17} color={ic}/></div><div><div style={{fontFamily:FB,fontSize:loading?"14px":"22px",fontWeight:700,color:loading?C.sub:C.text,lineHeight:1.1}}>{loading?"—":value}</div><div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px"}}>{label}</div></div></div>);

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
const AddEditModal=({mode,formData,setFormData,formErrors,submitError,submitting,managers,onClose,onSubmit})=>{
  const overlayRef=useRef(null);
  useEffect(()=>{const h=(e)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[onClose]);
  const isAdd=mode==="add";
  const inp={width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none",transition:TR};
  return(
    <div ref={overlayRef} onClick={e=>{if(e.target===overlayRef.current)onClose();}} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px"}}>
      <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.xl,width:"100%",maxWidth:"460px",boxShadow:SH.md,overflow:"hidden",animation:"v2FadeUp 0.2s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontFamily:FH,fontSize:"18px",fontWeight:700,color:C.text}}>{isAdd?"Add Team Member":"Edit Member"}</div>
            <div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px"}}>{isAdd?"Member receives a password setup email":"Email cannot be changed here"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,padding:"4px",display:"flex"}}><RiCloseLine size={20}/></button>
        </div>
        <div style={{padding:"20px"}}>
          {/* Name */}
          <div style={{marginBottom:"14px"}}>
            <label style={{display:"block",fontFamily:FB,fontSize:"12px",fontWeight:600,color:C.sub,marginBottom:"6px"}}>Full Name <span style={{color:C.red}}>*</span></label>
            <input value={formData.displayName} onChange={e=>setFormData(p=>({...p,displayName:e.target.value}))} placeholder="e.g. Priya Sharma" style={{...inp,borderColor:formErrors.displayName?C.red:C.border}}/>
            {formErrors.displayName&&<div style={{fontFamily:FB,fontSize:"11px",color:C.red,marginTop:"4px",display:"flex",alignItems:"center",gap:"3px"}}><RiAlertLine size={10}/>{formErrors.displayName}</div>}
          </div>
          {/* Email — add only */}
          {isAdd&&(
            <div style={{marginBottom:"14px"}}>
              <label style={{display:"block",fontFamily:FB,fontSize:"12px",fontWeight:600,color:C.sub,marginBottom:"6px"}}>Email Address <span style={{color:C.red}}>*</span></label>
              <input type="email" value={formData.email} onChange={e=>setFormData(p=>({...p,email:e.target.value}))} placeholder="priya@company.com" style={{...inp,borderColor:formErrors.email?C.red:C.border}}/>
              {formErrors.email&&<div style={{fontFamily:FB,fontSize:"11px",color:C.red,marginTop:"4px",display:"flex",alignItems:"center",gap:"3px"}}><RiAlertLine size={10}/>{formErrors.email}</div>}
            </div>
          )}
          {/* Role */}
          <div style={{marginBottom:"14px"}}>
            <label style={{display:"block",fontFamily:FB,fontSize:"12px",fontWeight:600,color:C.sub,marginBottom:"8px"}}>Role <span style={{color:C.red}}>*</span></label>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {ROLE_OPTIONS.map(opt=>{const sel=formData.role===opt.value;return(
                <div key={opt.value} onClick={()=>setFormData(p=>({...p,role:opt.value}))} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",borderRadius:R.md,border:`1px solid ${sel?opt.color+"60":C.border}`,backgroundColor:sel?opt.color+"12":"transparent",cursor:"pointer",transition:TR}}>
                  <div style={{width:"16px",height:"16px",borderRadius:"50%",border:`2px solid ${sel?opt.color:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:TR}}>
                    {sel&&<div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:opt.color}}/>}
                  </div>
                  <div><div style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:sel?opt.color:C.text}}>{opt.label}</div><div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"2px"}}>{opt.desc}</div></div>
                </div>
              );})}
            </div>
          </div>
          {/* Assign to manager */}
          {formData.role===ROLES.AGENT&&managers.length>0&&(
            <div style={{marginBottom:"14px"}}>
              <label style={{display:"block",fontFamily:FB,fontSize:"12px",fontWeight:600,color:C.sub,marginBottom:"6px"}}>Assign to Manager</label>
              <select value={formData.managerId} onChange={e=>setFormData(p=>({...p,managerId:e.target.value}))} style={{...inp,appearance:"none",cursor:"pointer"}}>
                <option value="">— Unassigned —</option>
                {managers.map(m=><option key={m.id} value={m.id}>{m.displayName||m.email}</option>)}
              </select>
            </div>
          )}
          {submitError&&(<div style={{display:"flex",alignItems:"flex-start",gap:"8px",padding:"10px 14px",borderRadius:R.md,backgroundColor:C.redMuted,border:`1px solid ${C.red}40`,marginBottom:"14px"}}><RiAlertLine size={15} color={C.red} style={{flexShrink:0,marginTop:"1px"}}/><div style={{fontFamily:FB,fontSize:"13px",color:C.red,lineHeight:1.5}}>{submitError}</div></div>)}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"10px",padding:"14px 20px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={onClose} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"14px",fontWeight:500,padding:"8px 16px",cursor:"pointer"}}>Cancel</button>
          <button onClick={onSubmit} disabled={submitting} style={{backgroundColor:C.gold,color:"#000",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"8px 18px",cursor:submitting?"not-allowed":"pointer",opacity:submitting?0.6:1,display:"flex",alignItems:"center",gap:"5px"}}>
            {submitting?<><RiLoader4Line size={14} style={{animation:"v2Spin 0.8s linear infinite"}}/>{isAdd?"Creating…":"Saving…"}</>:<><RiCheckLine size={14}/>{isAdd?"Create Member":"Save Changes"}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Deactivate Dialog ────────────────────────────────────────────────────────
const DeactivateDialog=({member,onCancel,onConfirm,processing})=>(
  <div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"16px"}}>
    <div style={{backgroundColor:C.surface,border:`1px solid ${C.red}40`,borderRadius:R.xl,width:"100%",maxWidth:"360px",padding:"24px",boxShadow:SH.md,animation:"v2FadeUp 0.2s ease"}}>
      <div style={{width:"44px",height:"44px",borderRadius:R.lg,backgroundColor:C.redMuted,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"14px"}}><RiIndeterminateCircleLine size={22} color={C.red}/></div>
      <div style={{fontFamily:FH,fontSize:"18px",fontWeight:700,color:C.text,marginBottom:"8px"}}>{member.isActive!==false?"Deactivate":"Reactivate"} {member.displayName?.split(" ")[0]||"Member"}?</div>
      <div style={{fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.6,marginBottom:"20px"}}>{member.isActive!==false?`${member.displayName||"This member"} will lose access immediately. Data stays untouched.`:`${member.displayName||"This member"} will regain full access.`}</div>
      <div style={{display:"flex",gap:"10px"}}>
        <button onClick={onCancel} style={{flex:1,backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"14px",fontWeight:500,padding:"10px 0",cursor:"pointer"}}>Cancel</button>
        <button onClick={onConfirm} disabled={processing} style={{flex:1,backgroundColor:member.isActive!==false?C.red:C.success,color:"#fff",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"10px 0",cursor:processing?"not-allowed":"pointer",opacity:processing?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px"}}>{processing?<RiLoader4Line size={14} style={{animation:"v2Spin 0.8s linear infinite"}}/>:null}{member.isActive!==false?"Deactivate":"Reactivate"}</button>
      </div>
    </div>
  </div>
);

// ─── TeamManagement ───────────────────────────────────────────────────────────
export const TeamManagement=()=>{
  const {companyId,currentUser}=useAuth();
  const [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [roleFilter,setRoleFilter]=useState("all");
  const [modalMode,setModalMode]=useState(null);
  const [selectedMember,setSelectedMember]=useState(null);
  const [deactivateTarget,setDeactivateTarget]=useState(null);
  const [deactivateProcessing,setDeactivateProcessing]=useState(false);
  const [formData,setFormData]=useState({displayName:"",email:"",role:ROLES.AGENT,managerId:""});
  const [formErrors,setFormErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const [toast,setToast]=useState(null);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // onSnapshot
  useEffect(()=>{
    if(!companyId)return;
    const unsub=onSnapshot(
      query(collection(db,COLLECTIONS.USERS),where("companyId","==",companyId)),
      (snap)=>{setMembers(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.displayName||"").localeCompare(b.displayName||"")));setLoading(false);},
      (err)=>{console.error("TeamManagement snap:",err);setLoading(false);}
    );
    return()=>unsub();
  },[companyId]);

  const managers=members.filter(m=>m.role===ROLES.MANAGER&&m.isActive!==false);
  const filtered=members.filter(m=>{const q=search.toLowerCase();const ms=!q||m.displayName?.toLowerCase().includes(q)||m.email?.toLowerCase().includes(q);const mr=roleFilter==="all"||m.role===roleFilter;return ms&&mr;});
  const miniStats={total:members.length,active:members.filter(m=>m.isActive!==false).length,managers:members.filter(m=>m.role===ROLES.MANAGER).length,agents:members.filter(m=>m.role===ROLES.AGENT).length};

  const openAdd=()=>{setFormData({displayName:"",email:"",role:ROLES.AGENT,managerId:""});setFormErrors({});setSubmitError("");setSelectedMember(null);setModalMode("add");};
  const openEdit=(m)=>{setSelectedMember(m);setFormData({displayName:m.displayName||"",email:m.email||"",role:m.role||ROLES.AGENT,managerId:m.managerId||""});setFormErrors({});setSubmitError("");setModalMode("edit");};
  const closeModal=()=>{if(submitting)return;setModalMode(null);setSelectedMember(null);};

  const validate=()=>{const e={};if(!formData.displayName.trim())e.displayName="Name is required";if(modalMode==="add"){if(!formData.email.trim())e.email="Email is required";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))e.email="Invalid email";}if(!formData.role)e.role="Select a role";return e;};

  const handleAdd=async()=>{const e=validate();if(Object.keys(e).length){setFormErrors(e);return;}setSubmitting(true);setSubmitError("");try{const fn=httpsCallable(functions,"createTeamMember");await fn({displayName:formData.displayName.trim(),email:formData.email.trim().toLowerCase(),role:formData.role,companyId,managerId:formData.managerId||null});setModalMode(null);showToast("Member created — password setup email sent");}catch(err){setSubmitError(err?.message||"Failed. Is the Cloud Function deployed?");}finally{setSubmitting(false);}};

  const handleEdit=async()=>{const e=validate();if(Object.keys(e).length){setFormErrors(e);return;}setSubmitting(true);setSubmitError("");try{await updateDoc(doc(db,COLLECTIONS.USERS,selectedMember.id),{displayName:formData.displayName.trim(),role:formData.role,managerId:formData.managerId||null,updatedAt:serverTimestamp()});setModalMode(null);showToast("Member updated");}catch(err){setSubmitError(err?.message||"Failed to save.");}finally{setSubmitting(false);}};

  const handleToggleActive=async()=>{if(!deactivateTarget)return;setDeactivateProcessing(true);try{await updateDoc(doc(db,COLLECTIONS.USERS,deactivateTarget.id),{isActive:deactivateTarget.isActive===false,updatedAt:serverTimestamp()});showToast(deactivateTarget.isActive===false?"Member reactivated":"Member deactivated");}catch(err){showToast("Failed to update status","error");}finally{setDeactivateProcessing(false);setDeactivateTarget(null);}};

  const COLS="40px 1fr 130px 110px 120px 80px";

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2SlideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .tm-row:hover{background-color:${C.surfaceHov} !important;}
        .tm-act{opacity:0;transition:opacity 0.15s ease;}
        .tm-row:hover .tm-act{opacity:1;}
        select option{background:${C.surface};color:${C.text};}
        @media(max-width:640px){.tm-table{display:none !important;}.tm-cards{display:flex !important;}}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px",marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <div>
          <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Team Management</h1>
          <p style={{margin:"6px 0 0",fontSize:"14px",color:C.sub}}>Add members, assign roles, manage access.</p>
        </div>
        <button onClick={openAdd} style={{backgroundColor:C.gold,color:"#000",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"10px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",minHeight:"44px"}}>
          <RiAddLine size={16}/>Add Member
        </button>
      </div>

      {/* Mini stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"12px",marginBottom:"20px",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        <MiniStat icon={RiTeamLine} ic={C.info} label="Total Members" value={miniStats.total} loading={loading}/>
        <MiniStat icon={RiCheckboxCircleLine} ic={C.success} label="Active" value={miniStats.active} loading={loading}/>
        <MiniStat icon={RiShieldUserLine} ic={C.gold} label="Managers" value={miniStats.managers} loading={loading}/>
        <MiniStat icon={RiUserLine} ic={C.info} label="Agents" value={miniStats.agents} loading={loading}/>
      </div>

      {/* Search + Filter */}
      <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center",animation:"v2FadeUp 0.3s ease 0.1s both"}}>
        <div style={{position:"relative",flex:"1 1 200px",minWidth:"180px"}}>
          <RiSearchLine size={14} color={C.sub} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
          <input type="text" placeholder="Search name or email…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px 10px 34px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none"}}/>
        </div>
        <div style={{display:"flex",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"3px",gap:"2px"}}>
          {FILTER_TABS.map(tab=>{const active=roleFilter===tab.v;return(<button key={tab.v} onClick={()=>setRoleFilter(tab.v)} style={{background:active?C.gold:"transparent",border:"none",borderRadius:R.sm,color:active?"#000":C.sub,fontFamily:FB,fontSize:"13px",fontWeight:active?700:400,padding:"5px 14px",cursor:"pointer",transition:TR,whiteSpace:"nowrap",minHeight:"34px"}}>{tab.l}</button>);})}
        </div>
        {!loading&&<span style={{fontSize:"13px",color:C.sub,marginLeft:"auto"}}>{filtered.length} member{filtered.length!==1?"s":""}</span>}
      </div>

      {/* Desktop table */}
      <div className="tm-table" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        <div style={{display:"grid",gridTemplateColumns:COLS,padding:"10px 20px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`,gap:"12px",alignItems:"center"}}>
          {["","Member","Role","Status","Last Active",""].map((h,i)=>(<div key={i} style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:i===5?"right":"left"}}>{h}</div>))}
        </div>

        {loading&&(<div style={{padding:"48px",textAlign:"center"}}><RiLoader4Line size={24} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/><div style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginTop:"10px"}}>Loading team…</div></div>)}
        {!loading&&filtered.length===0&&(<div style={{padding:"48px",textAlign:"center"}}><RiUserSettingsLine size={32} color={C.sub} style={{marginBottom:"12px"}}/><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text,marginBottom:"6px"}}>{search||roleFilter!=="all"?"No members match":"No team members yet"}</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>{search||roleFilter!=="all"?"Try clearing filters":"Click Add Member to get started."}</div></div>)}

        {!loading&&filtered.map((m,idx)=>{const isSelf=m.id===currentUser?.uid;const isInactive=m.isActive===false;return(
          <div key={m.id} className="tm-row" style={{display:"grid",gridTemplateColumns:COLS,padding:"12px 20px",borderBottom:idx<filtered.length-1?`1px solid ${C.border}`:"none",gap:"12px",alignItems:"center",backgroundColor:C.surface,transition:TR,opacity:isInactive?0.5:1}}>
            <div style={{display:"flex",alignItems:"center"}}><Avatar name={m.displayName||m.email} size={34}/></div>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"6px"}}>{m.displayName||"—"}{isSelf&&<span style={{fontSize:"11px",color:C.gold}}>(You)</span>}</div>
              <div style={{fontFamily:FB,fontSize:"12px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><RiMailLine size={10}/>{m.email}</div>
            </div>
            <div><RoleBadge role={m.role}/></div>
            <div><StatusBadge active={m.isActive}/></div>
            <div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>{lastActive(m.lastLoginAt)}</div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:"5px"}}>
              <button className="tm-act" onClick={()=>openEdit(m)} title="Edit" style={{background:"none",border:`1px solid ${C.border}`,borderRadius:R.sm,color:C.sub,cursor:"pointer",padding:"6px",display:"flex",alignItems:"center",minWidth:"32px",justifyContent:"center"}}><RiEditLine size={13}/></button>
              {!isSelf&&(<button className="tm-act" onClick={()=>setDeactivateTarget(m)} title={isInactive?"Reactivate":"Deactivate"} style={{background:"none",border:`1px solid ${isInactive?C.success+"50":C.red+"50"}`,borderRadius:R.sm,color:isInactive?C.success:C.red,cursor:"pointer",padding:"6px",display:"flex",alignItems:"center",minWidth:"32px",justifyContent:"center"}}>{isInactive?<RiCheckboxCircleLine size={13}/>:<RiIndeterminateCircleLine size={13}/>}</button>)}
            </div>
          </div>
        );})}
      </div>

      {/* Mobile cards */}
      <div className="tm-cards" style={{display:"none",flexDirection:"column",gap:"10px",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        {loading&&[1,2,3].map(i=>(<div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"16px",display:"flex",flexDirection:"column",gap:"10px"}}><SK w="60%" h="18px"/><SK w="80%" h="14px"/><SK w="40%" h="14px"/></div>))}
        {!loading&&filtered.map(m=>{const isSelf=m.id===currentUser?.uid;const isInactive=m.isActive===false;return(
          <div key={m.id} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"16px",opacity:isInactive?0.55:1}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
              <Avatar name={m.displayName||m.email} size={42}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:FB,fontSize:"15px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.displayName||"—"}{isSelf&&<span style={{fontSize:"11px",color:C.gold,marginLeft:"6px"}}>(You)</span>}</div>
                <div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}><RoleBadge role={m.role}/><StatusBadge active={m.isActive}/></div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>openEdit(m)} style={{flex:1,backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"10px 0",cursor:"pointer",minHeight:"44px"}}>Edit</button>
              {!isSelf&&(<button onClick={()=>setDeactivateTarget(m)} style={{flex:1,backgroundColor:isInactive?C.successMuted:C.redMuted,border:`1px solid ${isInactive?C.success+"50":C.red+"50"}`,borderRadius:R.md,color:isInactive?C.success:C.red,fontFamily:FB,fontSize:"13px",fontWeight:600,padding:"10px 0",cursor:"pointer",minHeight:"44px"}}>{isInactive?"Reactivate":"Deactivate"}</button>)}
            </div>
          </div>
        );})}
      </div>

      {modalMode&&<AddEditModal mode={modalMode} formData={formData} setFormData={setFormData} formErrors={formErrors} submitError={submitError} submitting={submitting} managers={managers} onClose={closeModal} onSubmit={modalMode==="add"?handleAdd:handleEdit}/>}
      {deactivateTarget&&<DeactivateDialog member={deactivateTarget} onCancel={()=>setDeactivateTarget(null)} onConfirm={handleToggleActive} processing={deactivateProcessing}/>}
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
};
