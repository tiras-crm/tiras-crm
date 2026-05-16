// TIRAS CRM V2 — CompanySettings.jsx  (UPPARA account)
// Tabbed company settings: Profile (+ GST) · Pipeline Stages · WhatsApp Templates · Billing
// onSnapshot for company doc · toast on every save · mobile-responsive tab nav
//
// src/pages/CompanySettings.jsx
// export { CompanySettings } from "./CompanySettings";

import React, { useState, useEffect, useCallback } from "react";
import {
  doc, collection, query, where, onSnapshot,
  setDoc, updateDoc, addDoc, deleteDoc,
  getDocs, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  RiBuildingLine, RiFlowChart, RiWhatsappLine,
  RiMoneyDollarCircleLine, RiSaveLine, RiLoader4Line,
  RiAddLine, RiDeleteBinLine, RiEditLine, RiCloseLine,
  RiCheckLine, RiAlertLine, RiInformationLine,
  RiArrowUpLine, RiArrowDownLine, RiEyeLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};const TR="all 0.15s ease";

const TABS=[
  {id:"profile",   label:"Company Profile",    icon:RiBuildingLine},
  {id:"pipeline",  label:"Pipeline Stages",    icon:RiFlowChart},
  {id:"whatsapp",  label:"WhatsApp Templates", icon:RiWhatsappLine},
  {id:"billing",   label:"Billing & Plan",     icon:RiMoneyDollarCircleLine},
];

const INDUSTRIES=["Staffing & Recruitment","Real Estate","Manufacturing","EdTech / Education","Healthcare","Financial Services","Retail / E-commerce","IT Services","Construction","Hospitality & Travel","Logistics","Other"];
const TIMEZONES=["Asia/Kolkata","Asia/Dubai","Asia/Singapore","Europe/London","America/New_York","America/Los_Angeles"];
const DEFAULT_STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const PLAN_CFG={basic:{l:"Basic",price:"₹1,800/mo",c:C.info,ret:"7 days"},growth:{l:"Growth",price:"₹3,000/mo",c:C.gold,ret:"30 days"},enterprise:{l:"Enterprise",price:"Custom",c:"#9B59B6",ret:"365 days"}};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SK=({w="100%",h="14px",r=R.md})=>(<div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#232325 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"v2Shimmer 1.6s ease-in-out infinite",flexShrink:0}}/>);

const Toast=({msg,type="success"})=>{const col=type==="error"?C.red:C.success;return(<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:C.surfaceAct,border:`1px solid ${col}50`,borderLeft:`3px solid ${col}`,borderRadius:R.md,padding:"10px 18px",display:"flex",alignItems:"center",gap:"8px",boxShadow:SH.md,zIndex:3000,fontFamily:FB,fontSize:"13px",color:C.text,animation:"v2SlideIn 0.25s ease"}}>{type==="error"?<RiAlertLine size={14} color={col}/>:<RiCheckLine size={14} color={col}/>}{msg}</div>);};

const Field=({label,hint,error,required,children})=>(<div style={{marginBottom:"16px"}}><label style={{display:"block",fontFamily:FB,fontSize:"12px",fontWeight:600,color:C.sub,marginBottom:"6px"}}>{label}{required&&<span style={{color:C.red,marginLeft:"3px"}}>*</span>}</label>{children}{hint&&!error&&<div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"4px",display:"flex",alignItems:"center",gap:"3px"}}><RiInformationLine size={10}/>{hint}</div>}{error&&<div style={{fontFamily:FB,fontSize:"11px",color:C.red,marginTop:"4px",display:"flex",alignItems:"center",gap:"3px"}}><RiAlertLine size={10}/>{error}</div>}</div>);

const Inp=({error,...props})=>(<input {...props} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${error?C.red:C.border}`,borderRadius:R.md,padding:"10px 14px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none",transition:TR,...(props.style||{})}}/>);
const Sel=({children,...props})=>(<select {...props} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none",appearance:"none",cursor:"pointer",...(props.style||{})}}>{children}</select>);
const Btn=({children,variant="primary",loading:ld,style:st={},icon:Icon,...props})=>(<button {...props} style={{backgroundColor:variant==="primary"?C.gold:"transparent",color:variant==="primary"?"#000":C.text,border:variant==="primary"?"none":`1px solid ${C.border}`,borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:variant==="primary"?700:500,padding:"10px 18px",cursor:props.disabled||ld?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:"6px",opacity:props.disabled||ld?0.6:1,transition:TR,...st}}>{ld?<RiLoader4Line size={14} style={{animation:"v2Spin 0.8s linear infinite"}}/>:Icon&&<Icon size={14}/>}{children}</button>);

// ─── TAB: Profile ─────────────────────────────────────────────────────────────
const ProfileTab=({companyId,onToast})=>{
  const [form,setForm]=useState({name:"",gstNumber:"",industry:"",timezone:"Asia/Kolkata",contactEmail:"",address:""});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [errors,setErrors]=useState({});

  // onSnapshot for company doc
  useEffect(()=>{
    if(!companyId)return;
    const unsub=onSnapshot(doc(db,COLLECTIONS.COMPANIES,companyId),(snap)=>{
      if(snap.exists()){const d=snap.data();setForm({name:d.name||"",gstNumber:d.gstNumber||"",industry:d.industry||"",timezone:d.timezone||"Asia/Kolkata",contactEmail:d.contactEmail||"",address:d.address||""});}
      setLoading(false);
    },(err)=>{console.error("ProfileTab snap:",err);setLoading(false);});
    return()=>unsub();
  },[companyId]);

  const validate=()=>{const e={};if(!form.name.trim())e.name="Company name is required";if(form.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))e.contactEmail="Invalid email";if(form.gstNumber&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))e.gstNumber="Invalid GST format (e.g. 29ABCDE1234F1Z5)";return e;};

  const save=async()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}setSaving(true);try{await setDoc(doc(db,COLLECTIONS.COMPANIES,companyId),{...form,gstNumber:form.gstNumber.toUpperCase(),updatedAt:serverTimestamp()},{merge:true});onToast("Company profile saved");}catch(err){console.error("ProfileTab save:",err);onToast("Failed to save","error");}finally{setSaving(false);};};

  if(loading)return(<div style={{padding:"40px",textAlign:"center"}}><RiLoader4Line size={22} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/></div>);

  return(
    <div style={{maxWidth:"560px"}}>
      <Field label="Company Name" error={errors.name} required><Inp value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. MAINDSOURCE LLP" error={errors.name}/></Field>
      <Field label="GST Number" error={errors.gstNumber} hint="15-character GST Identification Number (GSTIN)"><Inp value={form.gstNumber} onChange={e=>setForm(p=>({...p,gstNumber:e.target.value.toUpperCase()}))} placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} error={errors.gstNumber}/></Field>
      <Field label="Industry"><Sel value={form.industry} onChange={e=>setForm(p=>({...p,industry:e.target.value}))}><option value="">— Select industry —</option>{INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}</Sel></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
        <Field label="Timezone"><Sel value={form.timezone} onChange={e=>setForm(p=>({...p,timezone:e.target.value}))}>{TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}</Sel></Field>
        <Field label="Contact Email" error={errors.contactEmail}><Inp type="email" value={form.contactEmail} onChange={e=>setForm(p=>({...p,contactEmail:e.target.value}))} placeholder="admin@company.com" error={errors.contactEmail}/></Field>
      </div>
      <Field label="Office Address" hint="Shown on invoices (optional)"><textarea value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} rows={3} placeholder="123 MG Road, Bangalore 560001" style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none",resize:"vertical",lineHeight:1.6}}/></Field>
      <Btn icon={RiSaveLine} loading={saving} onClick={save}>Save Profile</Btn>
    </div>
  );
};

// ─── TAB: Pipeline Stages ─────────────────────────────────────────────────────
const PipelineTab=({companyId,onToast})=>{
  const [stages,setStages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [newName,setNewName]=useState("");
  const [addErr,setAddErr]=useState("");

  useEffect(()=>{
    if(!companyId)return;
    getDocs(query(collection(db,COLLECTIONS.PIPELINE_STAGES),where("companyId","==",companyId),orderBy("order","asc"))).then(snap=>{
      if(snap.empty)setStages(DEFAULT_STAGES.map((name,order)=>({id:null,name,order})));
      else setStages(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    }).catch(err=>{console.error("PipelineTab load:",err);setStages(DEFAULT_STAGES.map((name,order)=>({id:null,name,order})));setLoading(false);});
  },[companyId]);

  const move=(idx,dir)=>{const n=[...stages],sw=idx+dir;if(sw<0||sw>=n.length)return;[n[idx],n[sw]]=[n[sw],n[idx]];setStages(n.map((s,i)=>({...s,order:i})));};
  const remove=(idx)=>setStages(p=>p.filter((_,i)=>i!==idx).map((s,i)=>({...s,order:i})));
  const add=()=>{const name=newName.trim();if(!name){setAddErr("Enter a name");return;}if(stages.some(s=>s.name.toLowerCase()===name.toLowerCase())){setAddErr("Already exists");return;}setStages(p=>[...p,{id:null,name,order:p.length}]);setNewName("");setAddErr("");};

  const saveAll=async()=>{setSaving(true);try{const ex=await getDocs(query(collection(db,COLLECTIONS.PIPELINE_STAGES),where("companyId","==",companyId)));await Promise.all(ex.docs.map(d=>deleteDoc(d.ref)));await Promise.all(stages.map((s,i)=>addDoc(collection(db,COLLECTIONS.PIPELINE_STAGES),{name:s.name,order:i,companyId,createdAt:serverTimestamp()})));onToast("Pipeline stages saved");}catch(err){console.error("PipelineTab save:",err);onToast("Failed to save stages","error");}finally{setSaving(false);};};

  if(loading)return(<div style={{padding:"40px",textAlign:"center"}}><RiLoader4Line size={22} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/></div>);

  const STAGE_COLORS=[C.info,C.gold,"#E67E22",C.warning,"#9B59B6",C.success,C.red];

  return(
    <div style={{maxWidth:"460px"}}>
      <p style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginBottom:"16px",lineHeight:1.6}}>Customise the stages in your sales pipeline. Agents and managers see these stages on the Kanban board.</p>
      <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"14px"}}>
        {stages.map((stage,idx)=>{const col=STAGE_COLORS[idx%STAGE_COLORS.length];return(
          <div key={idx} style={{display:"flex",alignItems:"center",gap:"10px",backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px",transition:TR}}>
            <div style={{width:"24px",height:"24px",borderRadius:"50%",backgroundColor:col+"22",border:`1px solid ${col}50`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FB,fontSize:"11px",fontWeight:700,color:col,flexShrink:0}}>{idx+1}</div>
            <div style={{width:"8px",height:"8px",borderRadius:"50%",backgroundColor:col,flexShrink:0,boxShadow:`0 0 4px ${col}`}}/>
            <span style={{flex:1,fontFamily:FB,fontSize:"14px",fontWeight:500,color:C.text}}>{stage.name}</span>
            <button onClick={()=>move(idx,-1)} disabled={idx===0} style={{background:"none",border:"none",color:idx===0?C.border:C.sub,cursor:idx===0?"not-allowed":"pointer",padding:"2px",display:"flex"}}><RiArrowUpLine size={14}/></button>
            <button onClick={()=>move(idx,1)} disabled={idx===stages.length-1} style={{background:"none",border:"none",color:idx===stages.length-1?C.border:C.sub,cursor:idx===stages.length-1?"not-allowed":"pointer",padding:"2px",display:"flex"}}><RiArrowDownLine size={14}/></button>
            <button onClick={()=>remove(idx)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:"2px",display:"flex",opacity:0.6,transition:TR}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.6"}><RiDeleteBinLine size={13}/></button>
          </div>
        );})}
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
        <div style={{flex:1}}>
          <Inp value={newName} onChange={e=>{setNewName(e.target.value);setAddErr("");}} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="New stage name…"/>
          {addErr&&<div style={{fontFamily:FB,fontSize:"11px",color:C.red,marginTop:"4px"}}>{addErr}</div>}
        </div>
        <button onClick={add} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",flexShrink:0,minHeight:"44px"}}><RiAddLine size={14}/>Add</button>
      </div>
      <Btn icon={RiSaveLine} loading={saving} onClick={saveAll}>Save Stages</Btn>
    </div>
  );
};

// ─── TAB: WhatsApp Templates ──────────────────────────────────────────────────
const WhatsAppTab=({companyId,onToast})=>{
  const [templates,setTemplates]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState({name:"",message:""});
  const [formErrors,setFormErrors]=useState({});
  const [saving,setSaving]=useState(false);
  const [preview,setPreview]=useState(false);

  const load=useCallback(async()=>{try{const snap=await getDocs(query(collection(db,COLLECTIONS.WHATSAPP_TEMPLATES),where("companyId","==",companyId),orderBy("createdAt","asc")));setTemplates(snap.docs.map(d=>({id:d.id,...d.data()})));}catch(err){console.error("WhatsAppTab load:",err);}finally{setLoading(false);};},[companyId]);
  useEffect(()=>{load();},[load]);

  const openAdd=()=>{setEditingId(null);setForm({name:"",message:""});setFormErrors({});setPreview(false);setShowForm(true);};
  const openEdit=(t)=>{setEditingId(t.id);setForm({name:t.name,message:t.message});setFormErrors({});setPreview(false);setShowForm(true);};
  const closeForm=()=>{setShowForm(false);setEditingId(null);};

  const validate=()=>{const e={};if(!form.name.trim())e.name="Template name required";if(!form.message.trim())e.message="Message text required";return e;};

  const save=async()=>{const e=validate();if(Object.keys(e).length){setFormErrors(e);return;}setSaving(true);try{if(editingId)await updateDoc(doc(db,COLLECTIONS.WHATSAPP_TEMPLATES,editingId),{name:form.name.trim(),message:form.message.trim(),updatedAt:serverTimestamp()});else await addDoc(collection(db,COLLECTIONS.WHATSAPP_TEMPLATES),{name:form.name.trim(),message:form.message.trim(),companyId,createdAt:serverTimestamp()});await load();closeForm();onToast(editingId?"Template updated":"Template created");}catch(err){console.error("WhatsAppTab save:",err);onToast("Failed to save","error");}finally{setSaving(false);};};

  const del=async(id)=>{try{await deleteDoc(doc(db,COLLECTIONS.WHATSAPP_TEMPLATES,id));await load();onToast("Template deleted");}catch(err){onToast("Failed to delete","error");};};

  const previewMsg=form.message.replace(/\{\{name\}\}/g,"Rahul Sharma").replace(/\{\{company\}\}/g,"MAINDSOURCE LLP").replace(/\{\{phone\}\}/g,"9876543210");

  if(loading)return(<div style={{padding:"40px",textAlign:"center"}}><RiLoader4Line size={22} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/></div>);

  return(
    <div style={{maxWidth:"560px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
        <span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>{templates.length} template{templates.length!==1?"s":""}</span>
        <Btn icon={RiAddLine} onClick={openAdd} style={{padding:"8px 14px",fontSize:"13px"}}>New Template</Btn>
      </div>

      {templates.length===0&&!showForm&&(<div style={{textAlign:"center",padding:"40px 0"}}><RiWhatsappLine size={32} color={C.sub} style={{marginBottom:"12px"}}/><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text,marginBottom:"6px"}}>No templates yet</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Create templates agents can send with one tap.</div></div>)}

      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:showForm?"20px":"0"}}>
        {templates.map(t=>(<div key={t.id} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"14px",transition:TR}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}><RiWhatsappLine size={15} color="#25D366"/><span style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:C.text}}>{t.name}</span></div>
            <div style={{display:"flex",gap:"6px"}}>
              <button onClick={()=>openEdit(t)} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",padding:"2px",display:"flex"}}><RiEditLine size={13}/></button>
              <button onClick={()=>del(t.id)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",padding:"2px",display:"flex",opacity:0.6,transition:TR}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.6"}><RiDeleteBinLine size={13}/></button>
            </div>
          </div>
          <p style={{margin:0,fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{t.message}</p>
        </div>))}
      </div>

      {showForm&&(
        <div style={{backgroundColor:C.surface,border:`1px solid ${C.goldBorder}`,borderRadius:R.xl,padding:"20px",animation:"v2FadeUp 0.2s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <div style={{fontFamily:FH,fontSize:"17px",fontWeight:700,color:C.text}}>{editingId?"Edit Template":"New Template"}</div>
            <button onClick={closeForm} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,display:"flex"}}><RiCloseLine size={18}/></button>
          </div>
          <Field label="Template Name" error={formErrors.name} required><Inp value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Introduction Message" error={formErrors.name}/></Field>
          <Field label="Message Text" error={formErrors.message} hint="Use {{name}}, {{company}}, {{phone}} as placeholders" required>
            <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Hi {{name}}, I'm reaching out from {{company}}…" rows={4} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${formErrors.message?C.red:C.border}`,borderRadius:R.md,padding:"10px 14px",color:C.text,fontFamily:FB,fontSize:"14px",outline:"none",resize:"vertical",lineHeight:1.6}}/>
            {formErrors.message&&<div style={{fontFamily:FB,fontSize:"11px",color:C.red,marginTop:"4px",display:"flex",alignItems:"center",gap:"3px"}}><RiAlertLine size={10}/>{formErrors.message}</div>}
          </Field>
          {/* Preview toggle */}
          {form.message&&(<>
            <button onClick={()=>setPreview(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",color:C.gold,fontFamily:FB,fontSize:"12px",fontWeight:600,padding:"4px 0",marginBottom:preview?"12px":"0"}}><RiEyeLine size={13}/>{preview?"Hide preview":"Preview"}</button>
            {preview&&(<div style={{backgroundColor:C.goldMuted,border:`1px solid ${C.goldBorder}`,borderRadius:R.md,padding:"12px 14px",marginBottom:"14px"}}><div style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:C.gold,marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Preview (with sample data)</div><p style={{margin:0,fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{previewMsg}</p></div>)}
          </>)}
          <div style={{display:"flex",gap:"10px",marginTop:"4px"}}>
            <button onClick={closeForm} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"9px 16px",cursor:"pointer"}}>Cancel</button>
            <Btn icon={RiCheckLine} loading={saving} onClick={save}>{editingId?"Save Changes":"Create Template"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TAB: Billing ─────────────────────────────────────────────────────────────
const BillingTab=({companyId})=>{
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!companyId)return;
    const unsub=onSnapshot(doc(db,COLLECTIONS.COMPANIES,companyId),(snap)=>{setData(snap.exists()?snap.data():null);setLoading(false);},(err)=>{console.error("BillingTab snap:",err);setLoading(false);});
    return()=>unsub();
  },[companyId]);

  if(loading)return(<div style={{padding:"40px",textAlign:"center"}}><RiLoader4Line size={22} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/></div>);

  const plan=data?.plan||"basic";const cfg=PLAN_CFG[plan]||PLAN_CFG.basic;
  const renewal=data?.renewalDate?.toDate?.();
  const wallet=data?.wallet?.balance||0;

  return(
    <div style={{maxWidth:"540px"}}>
      {/* Current plan hero */}
      <div style={{backgroundColor:C.surface,border:`1px solid ${cfg.c}40`,borderRadius:R.xl,padding:"20px 24px",marginBottom:"20px",background:`linear-gradient(135deg,${C.surface} 0%,${cfg.c}10 100%)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",backgroundColor:cfg.c}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px",marginBottom:"16px"}}>
          <div>
            <div style={{fontFamily:FB,fontSize:"11px",fontWeight:600,color:cfg.c,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Current Plan</div>
            <div style={{fontFamily:FH,fontSize:"28px",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>{cfg.l}</div>
          </div>
          <div style={{backgroundColor:cfg.c+"22",border:`1px solid ${cfg.c}40`,borderRadius:R.lg,padding:"8px 16px",textAlign:"right"}}>
            <div style={{fontFamily:FH,fontSize:"22px",fontWeight:700,color:cfg.c}}>{cfg.price}</div>
            <div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"2px"}}>+ 2% per transaction</div>
          </div>
        </div>
        {[{l:"Recording Retention",v:cfg.ret},{l:"Renewal Date",v:renewal?renewal.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}):"—"},{l:"Billing Cycle",v:data?.billingCycle||"Monthly"},{l:"Calling Wallet",v:wallet>0?`₹${wallet.toLocaleString("en-IN")}`:wallet===0?"₹0 — Top up needed":"—"},{l:"GST on invoices",v:data?.gstNumber||"Not set"}].map(row=>(<div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>{row.l}</span><span style={{fontFamily:FB,fontSize:"13px",fontWeight:600,color:row.l==="Calling Wallet"&&wallet===0?C.red:C.text}}>{row.v}</span></div>))}
      </div>

      {/* Plan comparison */}
      <div style={{fontFamily:FH,fontSize:"17px",fontWeight:700,color:C.text,marginBottom:"12px"}}>All Plans</div>
      <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"20px"}}>
        {Object.entries(PLAN_CFG).map(([key,pcfg])=>{const active=key===plan;return(
          <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderRadius:R.md,backgroundColor:active?pcfg.c+"12":"transparent",border:`1px solid ${active?pcfg.c+"50":C.border}`,transition:TR}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              {active&&<RiCheckLine size={14} color={pcfg.c}/>}
              <div><div style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:active?pcfg.c:C.text}}>{pcfg.l}{active&&<span style={{fontFamily:FB,fontSize:"11px",color:C.sub,fontWeight:400,marginLeft:"6px"}}>(Current)</span>}</div><div style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>Recording: {pcfg.ret}</div></div>
            </div>
            <div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:pcfg.c}}>{pcfg.price}</div>
          </div>
        );})}
      </div>

      <div style={{backgroundColor:C.goldMuted,border:`1px solid ${C.goldBorder}`,borderRadius:R.md,padding:"12px 16px",display:"flex",gap:"10px"}}>
        <RiInformationLine size={16} color={C.gold} style={{flexShrink:0,marginTop:"1px"}}/>
        <p style={{margin:0,fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.6}}>To upgrade or top up your wallet, contact Tony directly via WhatsApp. All payments are collected via Razorpay payment link — never through the app.</p>
      </div>
    </div>
  );
};

// ─── CompanySettings ──────────────────────────────────────────────────────────
export const CompanySettings=()=>{
  const {companyId}=useAuth();
  const [activeTab,setActiveTab]=useState("profile");
  const [toast,setToast]=useState(null);
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2SlideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        select option{background:${C.surface};color:${C.text};}
        textarea{font-family:${FB};}
        .cs-nav-btn:hover{background-color:${C.surfaceHov} !important;}
        @media(max-width:768px){.cs-layout{flex-direction:column !important;}.cs-sidebar{width:100% !important;flex-direction:row !important;overflow-x:auto;padding:8px !important;gap:4px !important;border-right:none !important;border-bottom:1px solid ${C.border} !important;}.cs-sidebar button{flex-shrink:0 !important;border-left:none !important;border-bottom:3px solid transparent;}.cs-sidebar button[data-active="true"]{border-left:none !important;border-bottom:3px solid ${C.gold} !important;background-color:${C.goldMuted} !important;}}
      `}</style>

      {/* Header */}
      <div style={{marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Company Settings</h1>
        <p style={{margin:"6px 0 0",fontFamily:FB,fontSize:"14px",color:C.sub}}>Manage your company profile, pipeline, templates, and billing.</p>
      </div>

      <div className="cs-layout" style={{display:"flex",gap:"20px",alignItems:"flex-start",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        {/* Sidebar nav */}
        <div className="cs-sidebar" style={{width:"200px",flexShrink:0,backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {TABS.map(tab=>{const active=activeTab===tab.id;const Icon=tab.icon;return(
            <button
              key={tab.id}
              data-active={active}
              className="cs-nav-btn"
              onClick={()=>setActiveTab(tab.id)}
              style={{width:"100%",background:"none",border:"none",borderLeft:`3px solid ${active?C.gold:"transparent"}`,backgroundColor:active?C.goldMuted:"transparent",padding:"12px 16px",display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",textAlign:"left",transition:TR,fontFamily:FB}}
            >
              <Icon size={15} color={active?C.gold:C.sub}/>
              <span style={{fontFamily:FB,fontSize:"13px",fontWeight:active?600:400,color:active?C.gold:C.sub,lineHeight:1.3}}>{tab.label}</span>
            </button>
          );})}
        </div>

        {/* Content */}
        <div style={{flex:1,minWidth:0,animation:"v2FadeUp 0.2s ease"}}>
          {activeTab==="profile"  &&<ProfileTab  companyId={companyId} onToast={showToast}/>}
          {activeTab==="pipeline" &&<PipelineTab companyId={companyId} onToast={showToast}/>}
          {activeTab==="whatsapp" &&<WhatsAppTab companyId={companyId} onToast={showToast}/>}
          {activeTab==="billing"  &&<BillingTab  companyId={companyId}/>}
        </div>
      </div>

      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
};
