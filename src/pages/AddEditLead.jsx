// TIRAS CRM V2 — AddEditLead | Anuradha | Obsidian Gold
// src/pages/AddEditLead.jsx
import React,{useState,useEffect}from"react";
import{useNavigate,useParams}from"react-router-dom";
import{collection,query,where,getDocs,addDoc,updateDoc,doc,getDoc,serverTimestamp}from"firebase/firestore";
import{db,COLLECTIONS}from"../firebase";
import{useAuth}from"../contexts/AuthContext";
const T={bg:"#121212",surface:"#1A1A1B",gold:"#D4AF37",accent:"#E63946",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#22C55E",warning:"#F59E0B",info:"#3B82F6",goldBg:"rgba(212,175,55,.10)",goldBorder:"rgba(212,175,55,.30)",dangerBg:"rgba(230,57,70,.10)",dangerBorder:"rgba(230,57,70,.30)",successBg:"rgba(34,197,94,.10)",warningBg:"rgba(245,158,11,.10)",infoBg:"rgba(59,130,246,.10)"};
const STYLE_ID="tiras-v2-addlead";
const injectStyles=()=>{
  if(document.getElementById(STYLE_ID))return;
  const t=document.createElement("style");t.id=STYLE_ID;
  t.textContent=`
    @keyframes v2fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes v2spin{to{transform:rotate(360deg)}}
    @keyframes v2shim{0%{background-position:-500px 0}100%{background-position:500px 0}}
    @keyframes v2shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
    .v2pbtn:hover{background:#e4c350!important;box-shadow:0 6px 20px rgba(212,175,55,.4)!important;transform:translateY(-1px)}
    .v2sbtn:hover{border-color:rgba(212,175,55,.5)!important;color:#D4AF37!important}
    .v2shim{background:linear-gradient(90deg,#1A1A1B 25%,rgba(255,255,255,.05) 50%,#1A1A1B 75%);background-size:500px 100%;animation:v2shim 1.4s ease infinite;border-radius:8px}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#2A2A2B;border-radius:4px}
    @media(max-width:768px){.v2form-layout{grid-template-columns:1fr!important}.v2preview-col{position:static!important}.v2field-row{grid-template-columns:1fr!important}.v2pad{padding:16px!important}}
  `;
  document.head.appendChild(t);
};
const SOURCES=["IndiaMART","Website","Cold Call","Referral","Walk-in","Social Media","WhatsApp","Trade Show"];
const STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const STAGE_CFG={"New":{text:T.sub,bg:"rgba(154,154,154,.12)"},"Contacted":{text:T.info,bg:T.infoBg},"Interested":{text:T.gold,bg:T.goldBg},"Follow-up":{text:T.warning,bg:T.warningBg},"Negotiation":{text:T.gold,bg:T.goldBg},"Closed Won":{text:T.success,bg:T.successBg},"Closed Lost":{text:T.accent,bg:T.dangerBg}};
const EMPTY={name:"",phone:"",email:"",company:"",source:"",stage:"New",dealValue:"",notes:""};
const BackIco=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const WarnIco=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

const inp={backgroundColor:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontFamily:"'DM Sans',sans-serif",fontSize:"14px",padding:"10px 14px",outline:"none",width:"100%",boxSizing:"border-box",transition:"border .15s"};
const sel={...inp,cursor:"pointer"};
const Lbl=({text,req})=><div style={{color:T.sub,fontSize:"12px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{text}{req&&<span style={{color:T.accent,marginLeft:"3px"}}>*</span>}</div>;

export const AddEditLead=()=>{
  const navigate=useNavigate();
  const{leadId}=useParams();
  const isEdit=Boolean(leadId);
  const{currentUser,companyId}=useAuth();
  const[form,setForm]=useState(EMPTY);
  const[errors,setErrors]=useState({});
  const[focused,setFocused]=useState(null);
  const[loading,setLoading]=useState(isEdit);
  const[saving,setSaving]=useState(false);
  const[dupWarn,setDupWarn]=useState(null);
  const[checkingDup,setCheckingDup]=useState(false);
  const[toast,setToast]=useState(null);
  const toastRef=React.useRef();

  const showToast=(msg,color=T.success)=>{clearTimeout(toastRef.current);setToast({msg,color});toastRef.current=setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    injectStyles();
    if(!isEdit)return;
    const load=async()=>{
      try{
        const snap=await getDoc(doc(db,COLLECTIONS.LEADS,leadId));
        if(snap.exists()){const d=snap.data();setForm({name:d.name??"",phone:d.phone??"",email:d.email??"",company:d.company??"",source:d.source??"",stage:d.stage??"New",dealValue:d.dealValue!=null?String(d.dealValue):"",notes:d.notes??""});}
      }catch(e){console.error(e);}
      finally{setLoading(false);}
    };
    load();
  },[leadId,isEdit]);

  const handleChange=(field,value)=>{
    setForm(p=>({...p,[field]:value}));
    if(errors[field])setErrors(p=>({...p,[field]:null}));
    if(field==="phone")setDupWarn(null);
  };

  const checkDup=async(phone)=>{
    if(!phone||phone.length<10)return;
    setCheckingDup(true);
    try{
      const snap=await getDocs(query(collection(db,COLLECTIONS.LEADS),where("phone","==",phone),where("companyId","==",companyId)));
      const ex=snap.docs.find(d=>d.id!==leadId);
      setDupWarn(ex?{name:ex.data().name,id:ex.id}:null);
    }finally{setCheckingDup(false);}
  };

  const validate=()=>{
    const e={};
    if(!form.name.trim())e.name="Name is required";
    if(!form.phone.trim())e.phone="Phone number is required";
    else if(!/^\d{10}$/.test(form.phone.replace(/\s/g,"")))e.phone="Enter a valid 10-digit number";
    if(form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email="Enter a valid email address";
    if(form.dealValue&&isNaN(Number(form.dealValue)))e.dealValue="Enter a valid number";
    return e;
  };

  const handleSave=async()=>{
    const errs=validate();
    if(Object.keys(errs).length>0){setErrors(errs);return;}
    setSaving(true);
    try{
      const payload={name:form.name.trim(),phone:form.phone.replace(/\s/g,""),email:form.email.trim()||null,company:form.company.trim()||null,source:form.source||null,stage:form.stage,dealValue:form.dealValue?Number(form.dealValue):null,notes:form.notes.trim()||null,companyId,updatedAt:serverTimestamp(),updatedBy:currentUser.uid};
      if(isEdit){
        await updateDoc(doc(db,COLLECTIONS.LEADS,leadId),payload);
        navigate(`/agent/lead/${leadId}`);
      }else{
        payload.assignedTo=currentUser.uid;payload.createdAt=serverTimestamp();payload.createdBy=currentUser.uid;payload.leadScore=null;payload.lastCallAt=null;
        const ref=await addDoc(collection(db,COLLECTIONS.LEADS),payload);
        navigate(`/agent/lead/${ref.id}`);
      }
    }catch(e){console.error(e);showToast("Could not save lead. Try again.",T.accent);}
    finally{setSaving(false);}
  };

  const stC=STAGE_CFG[form.stage]??STAGE_CFG["New"];
  const iStyle=(f)=>({...inp,...(focused===f?{border:`1px solid ${T.gold}`,boxShadow:`0 0 0 3px rgba(212,175,55,.15)`}:{}),...(errors[f]?{border:`1px solid ${T.accent}`,boxShadow:`0 0 0 3px rgba(230,57,70,.12)`}:{})});
  const sStyle=(f)=>({...sel,...(focused===f?{border:`1px solid ${T.gold}`}:{})});

  if(loading)return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",flexDirection:"column",gap:"12px",color:T.sub}}>
      <div style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.gold,animation:"v2spin .7s linear infinite"}}/>Loading lead…
    </div>
  );

  return(
    <div style={{minHeight:"100%",backgroundColor:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text,padding:"28px"}} className="v2pad">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"28px",animation:"v2fu .25s ease both"}}>
        <button className="v2sbtn" style={{background:"none",border:"none",color:T.sub,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:"13px",display:"flex",alignItems:"center",gap:"5px",padding:0,minHeight:"44px",transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color=T.gold} onMouseLeave={e=>e.currentTarget.style.color=T.sub} onClick={()=>navigate(isEdit?`/agent/lead/${leadId}`:"/agent/leads")}><BackIco/>{isEdit?"Back to Lead":"My Leads"}</button>
        <span style={{color:T.border}}>›</span>
        <div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"24px",fontWeight:700,color:T.text,letterSpacing:"-0.01em",margin:0}}>{isEdit?"Edit Lead":"Add New Lead"}</h1>
          <p style={{color:T.sub,fontSize:"13px",margin:0}}>{isEdit?`Editing ${form.name||"lead"}`:"Fill in the details to add a new lead"}</p>
        </div>
      </div>

      {/* Form + preview grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:"20px",alignItems:"flex-start"}} className="v2form-layout">

        {/* ── LEFT: FIELDS ──────────────────────────────────────────────────── */}
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>

          {/* Form error */}
          {errors._form&&<div style={{backgroundColor:T.dangerBg,border:`1px solid ${T.dangerBorder}`,borderRadius:"8px",padding:"10px 14px",color:T.accent,fontSize:"13px"}}>{errors._form}</div>}

          {/* Duplicate warning */}
          {dupWarn&&(
            <div style={{display:"flex",alignItems:"flex-start",gap:"10px",backgroundColor:T.warningBg,border:`1px solid rgba(245,158,11,.35)`,borderRadius:"8px",padding:"10px 14px",animation:"v2shake .4s ease"}}>
              <span style={{color:T.warning,flexShrink:0,marginTop:"1px"}}><WarnIco/></span>
              <div style={{color:T.warning,fontSize:"13px",lineHeight:"1.5"}}>
                This number already exists as{" "}<strong style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>navigate(`/agent/lead/${dupWarn.id}`)}>{dupWarn.name}</strong>.{" "}
                <strong style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>navigate(`/agent/lead/${dupWarn.id}`)}>View existing lead</strong> or save anyway.
              </div>
            </div>
          )}

          {/* Contact card */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden",animation:"v2fu .3s ease 40ms both"}}>
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{color:T.gold}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Contact Details</span>
            </div>
            <div style={{padding:"20px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}} className="v2field-row">
                <div>
                  <Lbl text="Full Name" req/>
                  <input type="text" placeholder="e.g. Ravi Kumar" value={form.name} onChange={e=>handleChange("name",e.target.value)} onFocus={()=>setFocused("name")} onBlur={()=>setFocused(null)} style={iStyle("name")}/>
                  {errors.name&&<div style={{color:T.accent,fontSize:"11px",marginTop:"4px",display:"flex",alignItems:"center",gap:"4px"}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.name}</div>}
                </div>
                <div>
                  <Lbl text="Phone Number" req/>
                  <input type="tel" placeholder="98XXXXXXXX" value={form.phone} onChange={e=>handleChange("phone",e.target.value.replace(/\D/g,"").slice(0,10))} onFocus={()=>setFocused("phone")} onBlur={()=>{setFocused(null);checkDup(form.phone);}} style={iStyle("phone")} maxLength={10}/>
                  {errors.phone?<div style={{color:T.accent,fontSize:"11px",marginTop:"4px"}}>{errors.phone}</div>:checkingDup&&<div style={{color:T.sub,fontSize:"11px",marginTop:"4px"}}>Checking for duplicates…</div>}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}} className="v2field-row">
                <div>
                  <Lbl text="Email Address"/>
                  <input type="email" placeholder="ravi@company.com" value={form.email} onChange={e=>handleChange("email",e.target.value)} onFocus={()=>setFocused("email")} onBlur={()=>setFocused(null)} style={iStyle("email")}/>
                  {errors.email&&<div style={{color:T.accent,fontSize:"11px",marginTop:"4px"}}>{errors.email}</div>}
                </div>
                <div>
                  <Lbl text="Company"/>
                  <input type="text" placeholder="ABC Textiles Pvt Ltd" value={form.company} onChange={e=>handleChange("company",e.target.value)} onFocus={()=>setFocused("company")} onBlur={()=>setFocused(null)} style={iStyle("company")}/>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline card */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden",animation:"v2fu .3s ease 80ms both"}}>
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{color:T.gold}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
              <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Pipeline Details</span>
            </div>
            <div style={{padding:"20px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}} className="v2field-row">
                <div>
                  <Lbl text="Lead Source"/>
                  <select value={form.source} onChange={e=>handleChange("source",e.target.value)} onFocus={()=>setFocused("source")} onBlur={()=>setFocused(null)} style={sStyle("source")}>
                    <option value="">— Select source —</option>
                    {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl text="Pipeline Stage"/>
                  <select value={form.stage} onChange={e=>handleChange("stage",e.target.value)} onFocus={()=>setFocused("stage")} onBlur={()=>setFocused(null)}
                    style={{...sStyle("stage"),color:stC.text,fontWeight:700}}>
                    {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Lbl text="Deal Value (₹)"/>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",color:T.sub,fontSize:"14px",fontWeight:600,pointerEvents:"none"}}>₹</span>
                  <input type="number" placeholder="0" value={form.dealValue} onChange={e=>handleChange("dealValue",e.target.value)} onFocus={()=>setFocused("dealValue")} onBlur={()=>setFocused(null)} style={{...iStyle("dealValue"),paddingLeft:"28px"}} min="0"/>
                </div>
                {errors.dealValue&&<div style={{color:T.accent,fontSize:"11px",marginTop:"4px"}}>{errors.dealValue}</div>}
              </div>
            </div>
          </div>

          {/* Notes card */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden",animation:"v2fu .3s ease 120ms both"}}>
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{color:T.gold}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
              <span style={{fontSize:"14px",fontWeight:700,color:T.text}}>Notes</span>
            </div>
            <div style={{padding:"20px"}}>
              <Lbl text="Initial Notes"/>
              <textarea placeholder="Background context, what they're looking for, how the intro happened…" value={form.notes} onChange={e=>handleChange("notes",e.target.value)} onFocus={()=>setFocused("notes")} onBlur={()=>setFocused(null)} rows={4}
                style={{...inp,...(focused==="notes"?{border:`1px solid ${T.gold}`}:{}),resize:"vertical",minHeight:"80px"}}/>
            </div>
          </div>
        </div>

        {/* ── RIGHT: PREVIEW + SAVE ─────────────────────────────────────────── */}
        <div style={{display:"flex",flexDirection:"column",gap:"14px",position:"sticky",top:"24px"}} className="v2preview-col">

          {/* Live preview */}
          <div style={{backgroundColor:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px",overflow:"hidden",animation:"v2fu .3s ease 60ms both"}}>
            <div style={{height:"3px",background:`linear-gradient(90deg,${T.gold},${T.accent})`}}/>
            <div style={{padding:"20px"}}>
              <div style={{color:T.sub,fontSize:"11px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"14px"}}>Lead Preview</div>
              <div style={{width:"44px",height:"44px",borderRadius:"50%",backgroundColor:T.goldBg,border:`1.5px solid ${T.gold}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"12px"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",fontWeight:700,color:T.gold,lineHeight:1}}>{(form.name??"?")[0]?.toUpperCase()||"?"}</span>
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",fontWeight:700,color:form.name?T.text:T.sub,marginBottom:"4px",minHeight:"26px"}}>{form.name||"—"}</div>
              <div style={{fontSize:"14px",color:T.sub,fontFamily:"monospace",letterSpacing:"0.06em",marginBottom:"14px",minHeight:"20px"}}>{form.phone||"—"}</div>
              {/* Summary rows */}
              {[["Company",form.company],["Email",form.email],["Source",form.source]].filter(([,v])=>v).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{color:T.sub,fontSize:"12px"}}>{k}</span>
                  <span style={{color:T.sub,fontSize:"12px",fontWeight:500,maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:form.dealValue&&Number(form.dealValue)>0?"0":"0"}}>
                <span style={{color:T.sub,fontSize:"12px"}}>Stage</span>
                <span style={{fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",color:stC.text,backgroundColor:stC.bg}}>{form.stage}</span>
              </div>
              {form.dealValue&&Number(form.dealValue)>0&&(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${T.border}`}}>
                  <span style={{color:T.sub,fontSize:"12px"}}>Deal Value</span>
                  <span style={{color:T.gold,fontSize:"18px",fontWeight:700}}>₹{Number(form.dealValue).toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <button className="v2pbtn" onClick={handleSave} disabled={saving}
            style={{backgroundColor:T.gold,color:"#000",border:"none",borderRadius:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:"15px",fontWeight:700,padding:"14px 20px",cursor:saving?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",width:"100%",minHeight:"48px",transition:"all .15s",boxShadow:`0 4px 16px rgba(212,175,55,.3)`,opacity:saving?.7:1}}>
            {saving?<><div style={{width:"14px",height:"14px",borderRadius:"50%",border:"2px solid rgba(0,0,0,.2)",borderTopColor:"#000",animation:"v2spin .7s linear infinite"}}/>{isEdit?"Saving…":"Creating…"}</>:isEdit?"Save Changes":"Create Lead"}
          </button>

          <button className="v2sbtn" onClick={()=>navigate(isEdit?`/agent/lead/${leadId}`:"/agent/leads")}
            style={{backgroundColor:"transparent",color:T.sub,border:`1px solid ${T.border}`,borderRadius:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",fontWeight:500,padding:"11px 20px",cursor:"pointer",width:"100%",transition:"all .15s",minHeight:"44px"}}>
            Cancel
          </button>

          <div style={{textAlign:"center",color:T.sub,fontSize:"11px"}}><span style={{color:T.accent}}>*</span> Required fields</div>
        </div>
      </div>

      {toast&&<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${toast.color}`,borderRadius:"10px",padding:"12px 18px",color:T.text,fontSize:"13px",fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",gap:"8px",animation:"v2fu .3s ease both"}}>
        <span style={{color:toast.color}}>{toast.color===T.accent?"✕":"✓"}</span>{toast.msg}
      </div>}
    </div>
  );
};
export default AddEditLead;
