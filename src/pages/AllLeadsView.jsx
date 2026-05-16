// TIRAS CRM V2 — AllLeadsView.jsx  (UPPARA account)
// Real-time leads via onSnapshot · desktop DataTable · mobile cards
// CSV import · bulk assign/stage/delete · search + filters
//
// src/pages/AllLeadsView.jsx
// export { AllLeadsView } from "./AllLeadsView";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, query, where, getDocs, doc, onSnapshot,
  updateDoc, deleteDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  RiSearchLine, RiAddLine, RiDownloadLine, RiUploadLine,
  RiLoader4Line, RiDeleteBinLine, RiEditLine, RiPhoneLine,
  RiCheckboxLine, RiCheckboxBlankLine, RiArrowUpLine,
  RiArrowDownLine, RiArrowLeftLine, RiArrowRightLine,
  RiFundsLine, RiCheckLine, RiAlertLine, RiFilterLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};const TR="all 0.15s ease";

const STAGES=["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const SOURCES=["IndiaMART","Website","Cold Call","Referral","Walk-in","Social Media","WhatsApp","Trade Show","Other"];
const PAGE_SIZE=25;

const STAGE_C={"New":C.info,"Contacted":C.gold,"Interested":"#E67E22","Follow-up":C.warning,"Negotiation":"#9B59B6","Closed Won":C.success,"Closed Lost":C.red};
const SCORE_C={hot:{l:"🔥 Hot",c:"#FF6B35"},warm:{l:"♨ Warm",c:C.warning},cold:{l:"❄ Cold",c:C.info},dead:{l:"☠ Dead",c:C.sub}};

const formatINR=(n)=>{if(!n)return"—";if(n>=100000)return`₹${(n/100000).toFixed(1)}L`;if(n>=1000)return`₹${(n/1000).toFixed(1)}K`;return`₹${n.toLocaleString("en-IN")}`;};
const relTime=(ts)=>{if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts),s=Math.floor((Date.now()-d)/1000);if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;};

const SK=({w="100%",h="14px",r=R.md})=>(<div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#232325 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"v2Shimmer 1.6s ease-in-out infinite",flexShrink:0}}/>);
const Toast=({msg,type="success"})=>{const col=type==="error"?C.red:C.success;return(<div style={{position:"fixed",bottom:"24px",right:"24px",backgroundColor:C.surfaceAct,border:`1px solid ${col}50`,borderLeft:`3px solid ${col}`,borderRadius:R.md,padding:"10px 18px",display:"flex",alignItems:"center",gap:"8px",boxShadow:SH.md,zIndex:3000,fontFamily:FB,fontSize:"13px",color:C.text,animation:"v2SlideIn 0.25s ease"}}>{type==="error"?<RiAlertLine size={14} color={col}/>:<RiCheckLine size={14} color={col}/>}{msg}</div>);};

const StageBadge=({stage})=>{const col=STAGE_C[stage]||C.sub;return(<span style={{fontSize:"11px",fontWeight:600,fontFamily:FB,color:col,backgroundColor:col+"22",border:`1px solid ${col}35`,borderRadius:R.full,padding:"3px 10px",whiteSpace:"nowrap"}}>{stage||"—"}</span>);};
const ScoreBadge=({score})=>{const cfg=SCORE_C[score];if(!cfg)return<span style={{color:C.sub,fontSize:"11px"}}>—</span>;return(<span style={{fontSize:"11px",fontWeight:600,fontFamily:FB,color:cfg.c,backgroundColor:cfg.c+"20",borderRadius:R.full,padding:"3px 10px",whiteSpace:"nowrap"}}>{cfg.l}</span>);};

const SelBtn=({style={},children,...rest})=>(<button style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"6px 14px",cursor:"pointer",transition:TR,...style}} {...rest}>{children}</button>);

export const AllLeadsView=()=>{
  const {companyId}=useAuth();
  const [leads,setLeads]=useState([]);
  const [agents,setAgents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterStage,setFilterStage]=useState("all");
  const [filterAgent,setFilterAgent]=useState("all");
  const [filterScore,setFilterScore]=useState("all");
  const [sortKey,setSortKey]=useState("createdAt");
  const [sortDir,setSortDir]=useState("desc");
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState(new Set());
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [deleting,setDeleting]=useState(false);
  const [toast,setToast]=useState(null);
  const [importing,setImporting]=useState(false);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // onSnapshot for leads
  useEffect(()=>{
    if(!companyId)return;
    const unsub=onSnapshot(
      query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId),orderBy("createdAt","desc")),
      (snap)=>{setLeads(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      (err)=>{console.error("AllLeadsView snap:",err);setLoading(false);}
    );
    getDocs(query(collection(db,COLLECTIONS.USERS),where("companyId","==",companyId),where("role","in",["agent","manager"]))).then(s=>setAgents(s.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>unsub();
  },[companyId]);

  // Filter + sort
  const filtered=useMemo(()=>{
    let list=[...leads];
    const q=search.toLowerCase();
    if(q)list=list.filter(l=>l.name?.toLowerCase().includes(q)||l.phone?.includes(q)||l.email?.toLowerCase().includes(q));
    if(filterStage!=="all")list=list.filter(l=>l.stage===filterStage);
    if(filterAgent!=="all")list=list.filter(l=>l.agentId===filterAgent);
    if(filterScore!=="all")list=list.filter(l=>l.leadScore===filterScore);
    list.sort((a,b)=>{let av=a[sortKey],bv=b[sortKey];if(av?.toDate)av=av.toDate().getTime();if(bv?.toDate)bv=bv.toDate().getTime();if(typeof av==="string")av=av.toLowerCase();if(typeof bv==="string")bv=bv.toLowerCase();if(av<bv)return sortDir==="asc"?-1:1;if(av>bv)return sortDir==="asc"?1:-1;return 0;});
    return list;
  },[leads,search,filterStage,filterAgent,filterScore,sortKey,sortDir]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paginated=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  useEffect(()=>{setPage(1);setSelected(new Set());},[search,filterStage,filterAgent,filterScore]);

  const toggleSort=(key)=>{if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(key);setSortDir("asc");}};
  const toggleSel=(id)=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const allSel=paginated.length>0&&paginated.every(l=>selected.has(l.id));
  const toggleAll=()=>setSelected(allSel?new Set():new Set(paginated.map(l=>l.id)));

  const bulkAssign=async(agentId)=>{const agent=agents.find(a=>a.id===agentId);await Promise.all([...selected].map(id=>updateDoc(doc(db,COLLECTIONS.LEADS,id),{agentId,agentName:agent?.displayName||"",updatedAt:serverTimestamp()})));setSelected(new Set());showToast(`${selected.size} leads assigned`);};
  const bulkStage=async(stage)=>{await Promise.all([...selected].map(id=>updateDoc(doc(db,COLLECTIONS.LEADS,id),{stage,updatedAt:serverTimestamp()})));setSelected(new Set());showToast(`${selected.size} leads moved to ${stage}`);};
  const bulkDelete=async()=>{setDeleting(true);try{await Promise.all([...deleteTarget].map(id=>deleteDoc(doc(db,COLLECTIONS.LEADS,id))));setSelected(new Set());showToast(`${deleteTarget.size} leads deleted`);}catch(e){showToast("Delete failed","error");}finally{setDeleting(false);setDeleteTarget(null);}};

  const exportCSV=()=>{const rows=[["Name","Phone","Email","Stage","Score","Source","Agent","Deal Value","Created"],...filtered.map(l=>[l.name||"",l.phone||"",l.email||"",l.stage||"",l.leadScore||"",l.source||"",l.agentName||"",l.dealValue||"",l.createdAt?.toDate?.().toLocaleDateString("en-IN")||""])];const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="tiras-leads.csv";a.click();URL.revokeObjectURL(url);showToast("CSV exported");};

  // CSV import
  const handleCSVImport=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    setImporting(true);
    try{
      const text=await file.text();
      const rows=text.trim().split("\n").map(r=>r.split(",").map(c=>c.replace(/^"|"$/g,"").trim()));
      const headers=rows[0].map(h=>h.toLowerCase());
      const nameIdx=headers.findIndex(h=>h.includes("name"));
      const phoneIdx=headers.findIndex(h=>h.includes("phone")||h.includes("mobile"));
      const emailIdx=headers.findIndex(h=>h.includes("email"));
      const sourceIdx=headers.findIndex(h=>h.includes("source"));
      if(nameIdx===-1){showToast("CSV must have a Name column","error");setImporting(false);return;}
      const {addDoc}=await import("firebase/firestore");
      let count=0;
      for(const row of rows.slice(1)){
        if(!row[nameIdx]?.trim())continue;
        await addDoc(collection(db,COLLECTIONS.LEADS),{name:row[nameIdx]||"",phone:phoneIdx>=0?row[phoneIdx]||"":"",email:emailIdx>=0?row[emailIdx]||"":"",source:sourceIdx>=0?row[sourceIdx]||"Other":"Other",stage:"New",companyId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        count++;
      }
      showToast(`${count} leads imported`);
    }catch(err){console.error("CSV import:",err);showToast("Import failed — check CSV format","error");}
    finally{setImporting(false);e.target.value="";}
  };

  const ColH=({label,ck,style={}})=>(<div onClick={ck?()=>toggleSort(ck):undefined} style={{fontFamily:FB,fontSize:"10px",fontWeight:600,color:sortKey===ck?C.gold:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",cursor:ck?"pointer":"default",display:"flex",alignItems:"center",gap:"3px",userSelect:"none",...style}}>{label}{ck&&sortKey===ck&&(sortDir==="asc"?<RiArrowUpLine size={10}/>:<RiArrowDownLine size={10}/>)}</div>);

  const COLS="32px 1fr 120px 100px 120px 110px 90px";
  const hotCount=leads.filter(l=>l.leadScore==="hot").length;
  const pipelineVal=leads.reduce((s,l)=>s+(l.dealValue||0),0);

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2Shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2SlideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .al-row:hover{background-color:${C.surfaceHov} !important;}
        select option{background:${C.surface};color:${C.text};}
        @media(max-width:640px){.al-table{display:none !important;}.al-cards{display:flex !important;}.al-filters{flex-direction:column;}.al-header{flex-direction:column;align-items:flex-start;}}
      `}</style>

      {/* Header */}
      <div className="al-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px",marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <div>
          <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>All Leads</h1>
          <p style={{margin:"6px 0 0",fontSize:"14px",color:C.sub}}>Every lead across your company — live updates.</p>
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <label style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",minHeight:"44px",whiteSpace:"nowrap"}}>
            {importing?<RiLoader4Line size={14} style={{animation:"v2Spin 0.8s linear infinite"}}/>:<RiUploadLine size={14}/>}Import CSV
            <input type="file" accept=".csv" onChange={handleCSVImport} style={{display:"none"}} disabled={importing}/>
          </label>
          <button onClick={exportCSV} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"13px",fontWeight:500,padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",minHeight:"44px"}}><RiDownloadLine size={14}/>Export</button>
          <button style={{backgroundColor:C.gold,color:"#000",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"9px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",minHeight:"44px"}}><RiAddLine size={15}/>Add Lead</button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{display:"flex",gap:"10px",marginBottom:"18px",flexWrap:"wrap",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        {[{l:"Total Leads",v:leads.length,c:C.info},{l:"🔥 Hot Leads",v:hotCount,c:"#FF6B35"},{l:"Pipeline Value",v:formatINR(pipelineVal),c:C.gold}].map(s=>(<div key={s.l} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>{s.l}:</span><span style={{fontFamily:FB,fontSize:"15px",fontWeight:700,color:s.c}}>{loading?"—":s.v}</span></div>))}
      </div>

      {/* Filters */}
      <div className="al-filters" style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center",animation:"v2FadeUp 0.3s ease 0.1s both"}}>
        <div style={{position:"relative",flex:"1 1 180px",minWidth:"160px"}}>
          <RiSearchLine size={14} color={C.sub} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
          <input type="text" placeholder="Name, phone or email…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",boxSizing:"border-box",backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px 10px 34px",color:C.text,fontFamily:FB,fontSize:"13px",outline:"none"}}/>
        </div>
        {[{val:filterStage,set:setFilterStage,opts:["all",...STAGES],placeholder:"All Stages"},{val:filterAgent,set:setFilterAgent,opts:["all",...agents.map(a=>a.id)],labels:{all:"All Agents",...Object.fromEntries(agents.map(a=>[a.id,a.displayName||a.email]))},placeholder:"All Agents"},{val:filterScore,set:setFilterScore,opts:["all","hot","warm","cold","dead"],labels:{all:"All Scores",hot:"🔥 Hot",warm:"♨ Warm",cold:"❄ Cold",dead:"☠ Dead"},placeholder:"All Scores"}].map((f,i)=>(<select key={i} value={f.val} onChange={e=>f.set(e.target.value)} style={{backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"10px 14px",color:f.val==="all"?C.sub:C.text,fontFamily:FB,fontSize:"13px",outline:"none",appearance:"none",cursor:"pointer",minWidth:"130px"}}>{f.opts.map(o=><option key={o} value={o}>{f.labels?f.labels[o]||o:o==="all"?f.placeholder:o}</option>)}</select>))}
        {!loading&&<span style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginLeft:"auto"}}>{filtered.length} leads</span>}
      </div>

      {/* Desktop table */}
      <div className="al-table" style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,overflow:"hidden",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        <div style={{display:"grid",gridTemplateColumns:COLS,padding:"10px 20px",backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`,gap:"12px",alignItems:"center"}}>
          <div onClick={toggleAll} style={{cursor:"pointer",color:allSel?C.gold:C.sub,display:"flex",alignItems:"center"}}>{allSel?<RiCheckboxLine size={16}/>:<RiCheckboxBlankLine size={16}/>}</div>
          <ColH label="Lead" ck="name"/><ColH label="Stage"/><ColH label="Score"/><ColH label="Agent" ck="agentName"/><ColH label="Deal Value" ck="dealValue"/><ColH label="Last Activity" ck="updatedAt"/>
        </div>

        {loading&&(<div style={{padding:"48px",textAlign:"center"}}><RiLoader4Line size={24} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/><div style={{fontFamily:FB,fontSize:"13px",color:C.sub,marginTop:"10px"}}>Loading leads…</div></div>)}
        {!loading&&filtered.length===0&&(<div style={{padding:"48px",textAlign:"center"}}><RiFundsLine size={32} color={C.sub} style={{marginBottom:"12px"}}/><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text,marginBottom:"6px"}}>{search||filterStage!=="all"?"No leads match":"No leads yet"}</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Add your first lead or import a CSV.</div></div>)}

        {!loading&&paginated.map((lead,idx)=>(<div key={lead.id} className="al-row" style={{display:"grid",gridTemplateColumns:COLS,padding:"12px 20px",borderBottom:idx<paginated.length-1?`1px solid ${C.border}`:"none",gap:"12px",alignItems:"center",backgroundColor:selected.has(lead.id)?C.goldMuted:C.surface,transition:TR}}>
          <div onClick={()=>toggleSel(lead.id)} style={{cursor:"pointer",color:selected.has(lead.id)?C.gold:C.sub,display:"flex"}}>{selected.has(lead.id)?<RiCheckboxLine size={15}/>:<RiCheckboxBlankLine size={15}/>}</div>
          <div style={{minWidth:0}}><div style={{fontFamily:FB,fontSize:"14px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.name||"—"}</div><div style={{fontFamily:FB,fontSize:"11px",color:C.sub,display:"flex",alignItems:"center",gap:"3px",marginTop:"2px"}}><RiPhoneLine size={10}/>{lead.phone||"—"}</div></div>
          <div><StageBadge stage={lead.stage}/></div>
          <div><ScoreBadge score={lead.leadScore}/></div>
          <div style={{fontFamily:FB,fontSize:"13px",color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.agentName||<span style={{color:C.sub,fontStyle:"italic"}}>Unassigned</span>}</div>
          <div style={{fontFamily:FB,fontSize:"13px",color:lead.dealValue?C.gold:C.sub,fontWeight:lead.dealValue?600:400}}>{formatINR(lead.dealValue)}</div>
          <div style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>{relTime(lead.updatedAt||lead.createdAt)}</div>
        </div>))}
      </div>

      {/* Mobile cards */}
      <div className="al-cards" style={{display:"none",flexDirection:"column",gap:"10px",animation:"v2FadeUp 0.3s ease 0.15s both"}}>
        {loading&&[1,2,3,4].map(i=>(<div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"16px",display:"flex",flexDirection:"column",gap:"10px"}}><SK w="60%" h="18px"/><SK w="80%" h="14px"/><div style={{display:"flex",gap:"8px"}}><SK w="80px" h="22px" r={R.full}/><SK w="70px" h="22px" r={R.full}/></div></div>))}
        {!loading&&paginated.map(lead=>(<div key={lead.id} style={{backgroundColor:C.surface,border:`1px solid ${selected.has(lead.id)?C.goldBorder:C.border}`,borderRadius:R.lg,padding:"16px",transition:TR}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:FB,fontSize:"15px",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.name||"—"}</div>
              <div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px",display:"flex",alignItems:"center",gap:"3px"}}><RiPhoneLine size={10}/>{lead.phone||"—"}</div>
            </div>
            <div onClick={()=>toggleSel(lead.id)} style={{cursor:"pointer",color:selected.has(lead.id)?C.gold:C.sub,marginLeft:"8px"}}>{selected.has(lead.id)?<RiCheckboxLine size={18}/>:<RiCheckboxBlankLine size={18}/>}</div>
          </div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}><StageBadge stage={lead.stage}/><ScoreBadge score={lead.leadScore}/></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontFamily:FB,fontSize:"12px",color:C.sub}}>{lead.agentName||"Unassigned"} · {relTime(lead.updatedAt||lead.createdAt)}</span>
            {lead.dealValue&&<span style={{fontFamily:FB,fontSize:"13px",fontWeight:700,color:C.gold}}>{formatINR(lead.dealValue)}</span>}
          </div>
        </div>))}
      </div>

      {/* Pagination */}
      {!loading&&filtered.length>PAGE_SIZE&&(<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",marginTop:"16px"}}><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:page===1?C.sub:C.text,padding:"8px 12px",cursor:page===1?"not-allowed":"pointer",opacity:page===1?0.4:1,display:"flex",alignItems:"center"}}><RiArrowLeftLine size={14}/></button><span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>Page <strong style={{color:C.text}}>{page}</strong> of {totalPages} · {filtered.length} leads</span><button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:page===totalPages?C.sub:C.text,padding:"8px 12px",cursor:page===totalPages?"not-allowed":"pointer",opacity:page===totalPages?0.4:1,display:"flex",alignItems:"center"}}><RiArrowRightLine size={14}/></button></div>)}

      {/* Bulk bar */}
      {selected.size>0&&(<div style={{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",backgroundColor:C.surfaceAct,border:`1px solid ${C.goldBorder}`,borderRadius:R.lg,padding:"10px 16px",display:"flex",alignItems:"center",gap:"10px",boxShadow:SH.md,zIndex:500,flexWrap:"wrap"}}>
        <span style={{fontFamily:FB,fontSize:"13px",fontWeight:700,color:C.gold,whiteSpace:"nowrap"}}>{selected.size} selected</span>
        <div style={{width:"1px",height:"20px",backgroundColor:C.border}}/>
        <select defaultValue="" onChange={e=>{if(e.target.value){bulkAssign(e.target.value);e.target.value="";}}} style={{backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"7px 12px",color:C.sub,fontFamily:FB,fontSize:"13px",outline:"none",appearance:"none",cursor:"pointer"}}><option value="">Assign to agent…</option>{agents.map(a=><option key={a.id} value={a.id}>{a.displayName||a.email}</option>)}</select>
        <select defaultValue="" onChange={e=>{if(e.target.value){bulkStage(e.target.value);e.target.value="";}}} style={{backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"7px 12px",color:C.sub,fontFamily:FB,fontSize:"13px",outline:"none",appearance:"none",cursor:"pointer"}}><option value="">Change stage…</option>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <button onClick={()=>setDeleteTarget(new Set(selected))} style={{backgroundColor:C.redMuted,border:`1px solid ${C.red}40`,borderRadius:R.md,color:C.red,fontFamily:FB,fontSize:"13px",fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}><RiDeleteBinLine size={13}/>Delete</button>
        <button onClick={()=>setSelected(new Set())} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontFamily:FB,fontSize:"13px"}}>Clear</button>
      </div>)}

      {/* Delete confirm */}
      {deleteTarget&&(<div style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px"}}><div style={{backgroundColor:C.surface,border:`1px solid ${C.red}40`,borderRadius:R.xl,width:"100%",maxWidth:"360px",padding:"24px",boxShadow:SH.md}}><div style={{fontFamily:FH,fontSize:"18px",fontWeight:700,color:C.text,marginBottom:"8px"}}>Delete {deleteTarget.size} lead{deleteTarget.size>1?"s":""}?</div><div style={{fontFamily:FB,fontSize:"13px",color:C.sub,lineHeight:1.6,marginBottom:"20px"}}>This cannot be undone. All call logs, notes, and AI summaries will be permanently removed.</div><div style={{display:"flex",gap:"10px"}}><button onClick={()=>setDeleteTarget(null)} style={{flex:1,backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"14px",fontWeight:500,padding:"10px 0",cursor:"pointer"}}>Cancel</button><button onClick={bulkDelete} disabled={deleting} style={{flex:1,backgroundColor:C.red,color:"#fff",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"10px 0",cursor:deleting?"not-allowed":"pointer",opacity:deleting?0.6:1}}>{deleting?"Deleting…":"Delete"}</button></div></div></div>)}

      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
};
