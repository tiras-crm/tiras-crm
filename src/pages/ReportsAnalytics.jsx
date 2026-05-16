// TIRAS CRM V2 — ReportsAnalytics.jsx  (UPPARA account)
// 4 pre-built Recharts reports · date range picker · agent comparison bar
// CSV export per report · generate on demand (getDocs with range)
//
// src/pages/ReportsAnalytics.jsx
// export { ReportsAnalytics } from "./ReportsAnalytics";

import React, { useState, useCallback } from "react";
import { collection, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  RiCalendarLine, RiLoader4Line, RiDownloadLine,
  RiBarChartBoxLine, RiFundsLine, RiPercentLine,
  RiCheckboxCircleLine, RiRefreshLine, RiTeamLine,
} from "react-icons/ri";

// ─── V2 tokens ────────────────────────────────────────────────────────────────
const C={bg:"#121212",surface:"#1A1A1B",surfaceHov:"#202022",surfaceAct:"#232325",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",goldBorder:"rgba(212,175,55,0.25)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",text:"#F5F5F5",sub:"#9A9A9A",border:"#2A2A2B",success:"#2ECC71",successMuted:"rgba(46,204,113,0.12)",warning:"#F39C12",warningMuted:"rgba(243,156,18,0.12)",info:"#3498DB",infoMuted:"rgba(52,152,219,0.12)"};
const FH="'Playfair Display',Georgia,serif";const FB="'DM Sans',system-ui,sans-serif";
const R={sm:"6px",md:"8px",lg:"12px",xl:"16px",full:"9999px"};
const SH={sm:"0 1px 3px rgba(0,0,0,0.4)",md:"0 4px 16px rgba(0,0,0,0.5)"};

const STAGE_PALETTE=[C.info,C.gold,"#E67E22",C.warning,"#9B59B6",C.success,C.red];

const downloadCSV=(filename,rows)=>{const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);};

const ChartTip=({active,payload,label,unit=""})=>{if(!active||!payload?.length)return null;return(<div style={{backgroundColor:C.surfaceAct,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"8px 14px",boxShadow:SH.md}}><div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginBottom:"2px"}}>{label}</div><div style={{fontFamily:FB,fontSize:"20px",fontWeight:700,color:C.gold}}>{payload[0].value}{unit}</div></div>);};

const ReportCard=({icon:Icon,title,subtitle,onExport,loading,noData,children})=>{
  const [hov,setHov]=useState(false);
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{backgroundColor:C.surface,border:`1px solid ${hov?C.goldBorder:C.border}`,borderRadius:R.lg,padding:"20px",transition:"border-color 0.15s ease,box-shadow 0.15s ease",boxShadow:hov?`${SH.sm},0 0 20px rgba(212,175,55,0.08)`:SH.sm,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:"2px",backgroundColor:C.gold,opacity:hov?1:0,transition:"opacity 0.15s ease"}}/>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"36px",height:"36px",borderRadius:R.md,backgroundColor:C.goldMuted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon size={17} color={C.gold}/></div>
          <div><div style={{fontFamily:FH,fontSize:"16px",fontWeight:700,color:C.text}}>{title}</div>{subtitle&&<div style={{fontFamily:FB,fontSize:"12px",color:C.sub,marginTop:"2px"}}>{subtitle}</div>}</div>
        </div>
        {onExport&&!noData&&(<button onClick={onExport} disabled={loading} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.text,fontFamily:FB,fontSize:"12px",fontWeight:500,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px",opacity:loading?0.4:1}}><RiDownloadLine size={12}/>CSV</button>)}
      </div>
      {loading?(<div style={{height:"220px",display:"flex",alignItems:"center",justifyContent:"center"}}><RiLoader4Line size={24} color={C.sub} style={{animation:"v2Spin 1s linear infinite"}}/></div>):noData?(<div style={{height:"220px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"8px"}}><Icon size={28} color={C.sub}/><span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>No data for this period</span></div>):children}
    </div>
  );
};

export const ReportsAnalytics=()=>{
  const {companyId}=useAuth();
  const today=new Date();
  const defFrom=new Date(today);defFrom.setDate(defFrom.getDate()-29);

  const [fromDate,setFromDate]=useState(defFrom.toISOString().split("T")[0]);
  const [toDate,setToDate]=useState(today.toISOString().split("T")[0]);
  const [loading,setLoading]=useState(false);
  const [ran,setRan]=useState(false);

  const [callsPerAgent,setCallsPerAgent]=useState([]);
  const [leadsPerStage,setLeadsPerStage]=useState([]);
  const [convBySource,setConvBySource]=useState([]);
  const [followUpRate,setFollowUpRate]=useState({completed:0,total:0,pct:0});
  const [agentComparison,setAgentComparison]=useState([]);

  const setQuickRange=(days)=>{const t=new Date(),f=new Date(t);f.setDate(f.getDate()-(days-1));setFromDate(f.toISOString().split("T")[0]);setToDate(t.toISOString().split("T")[0]);};

  const generate=useCallback(async()=>{
    if(!companyId)return;
    setLoading(true);
    try{
      const from=new Date(fromDate);from.setHours(0,0,0,0);
      const to=new Date(toDate);to.setHours(23,59,59,999);
      const fromTs=Timestamp.fromDate(from),toTs=Timestamp.fromDate(to);

      const [callsSnap,leadsSnap,monthLeadsSnap,fupSnap]=await Promise.all([
        getDocs(query(collection(db,COLLECTIONS.CALLS),where("companyId","==",companyId),where("createdAt",">=",fromTs),where("createdAt","<=",toTs))),
        getDocs(query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId))),
        getDocs(query(collection(db,COLLECTIONS.LEADS),where("companyId","==",companyId),where("createdAt",">=",fromTs),where("createdAt","<=",toTs))),
        getDocs(query(collection(db,COLLECTIONS.FOLLOW_UPS),where("companyId","==",companyId),where("dueAt",">=",fromTs),where("dueAt","<=",toTs))),
      ]);

      // 1. Calls per agent
      const agMap={};
      callsSnap.forEach(d=>{const{agentName="Unknown",agentId,durationSeconds=0}=d.data();const k=agentId||agentName;if(!agMap[k])agMap[k]={name:agentName,calls:0,totalDur:0};agMap[k].calls++;agMap[k].totalDur+=durationSeconds;});
      const agArr=Object.values(agMap).sort((a,b)=>b.calls-a.calls).slice(0,10).map(a=>({name:a.name.split(" ")[0],calls:a.calls,avgDur:a.calls>0?Math.round(a.totalDur/a.calls):0}));
      setCallsPerAgent(agArr);
      setAgentComparison(agArr.slice(0,6));

      // 2. Leads per stage (all-time)
      const stMap={};leadsSnap.forEach(d=>{const s=d.data().stage||"Unknown";stMap[s]=(stMap[s]||0)+1;});
      setLeadsPerStage(Object.entries(stMap).sort((a,b)=>b[1]-a[1]).map(([stage,count])=>({stage,count})));

      // 3. Conversion by source
      const srcMap={};
      monthLeadsSnap.forEach(d=>{const{source="Unknown",stage}=d.data();if(!srcMap[source])srcMap[source]={total:0,closed:0};srcMap[source].total++;if(stage==="Closed Won")srcMap[source].closed++;});
      setConvBySource(Object.entries(srcMap).filter(([,v])=>v.total>=1).sort((a,b)=>b[1].total-a[1].total).slice(0,8).map(([source,{total,closed}])=>({source,rate:total>0?Math.round((closed/total)*100):0,total})));

      // 4. Follow-up rate
      let fuTotal=0,fuDone=0;fupSnap.forEach(d=>{fuTotal++;if(d.data().status==="completed")fuDone++;});
      setFollowUpRate({completed:fuDone,total:fuTotal,pct:fuTotal>0?Math.round((fuDone/fuTotal)*100):0});

    }catch(err){console.error("ReportsAnalytics generate:",err);}
    finally{setLoading(false);setRan(true);}
  },[companyId,fromDate,toDate]);

  const inp={backgroundColor:C.bg,border:`1px solid ${C.border}`,borderRadius:R.md,padding:"9px 14px",color:C.text,fontFamily:FB,fontSize:"13px",outline:"none"};

  return(
    <div style={{backgroundColor:C.bg,minHeight:"calc(100vh - 56px)",padding:"28px",fontFamily:FB,boxSizing:"border-box"}}>
      <style>{`
        @keyframes v2FadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes v2Spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      `}</style>

      {/* Header */}
      <div style={{marginBottom:"24px",animation:"v2FadeUp 0.3s ease"}}>
        <h1 style={{margin:0,fontFamily:FH,fontSize:"clamp(24px,3vw,36px)",fontWeight:700,color:C.text,letterSpacing:"-0.5px"}}>Reports & Analytics</h1>
        <p style={{margin:"6px 0 0",fontFamily:FB,fontSize:"14px",color:C.sub}}>Generate reports for any date range — calls, conversion, follow-ups.</p>
      </div>

      {/* Controls */}
      <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:R.lg,padding:"16px 20px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",marginBottom:"24px",animation:"v2FadeUp 0.3s ease 0.05s both"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",color:C.sub,fontSize:"13px",fontFamily:FB,flexShrink:0}}><RiCalendarLine size={15}/>Date Range</div>
        <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{...inp,width:"148px"}}/>
        <span style={{fontFamily:FB,fontSize:"13px",color:C.sub}}>to</span>
        <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{...inp,width:"148px"}}/>
        <div style={{display:"flex",gap:"6px"}}>
          {[{l:"7d",d:7},{l:"30d",d:30},{l:"90d",d:90}].map(({l,d})=>(<button key={l} onClick={()=>setQuickRange(d)} style={{backgroundColor:"transparent",border:`1px solid ${C.border}`,borderRadius:R.md,color:C.sub,fontFamily:FB,fontSize:"12px",fontWeight:500,padding:"6px 12px",cursor:"pointer"}}>{l}</button>))}
        </div>
        <button onClick={generate} disabled={loading} style={{backgroundColor:C.gold,color:"#000",border:"none",borderRadius:R.md,fontFamily:FB,fontSize:"14px",fontWeight:700,padding:"9px 20px",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:"6px",marginLeft:"auto",opacity:loading?0.6:1,minHeight:"44px"}}>
          {loading?<><RiLoader4Line size={14} style={{animation:"v2Spin 0.7s linear infinite"}}/>Generating…</>:<><RiRefreshLine size={14}/>Generate</>}
        </button>
      </div>

      {/* Prompt */}
      {!ran&&!loading&&(
        <div style={{textAlign:"center",padding:"60px 0",animation:"v2FadeUp 0.3s ease 0.1s both"}}>
          <RiBarChartBoxLine size={48} color={C.sub} style={{marginBottom:"16px"}}/>
          <div style={{fontFamily:FH,fontSize:"22px",fontWeight:700,color:C.text,marginBottom:"8px"}}>Select a date range and generate</div>
          <div style={{fontFamily:FB,fontSize:"14px",color:C.sub}}>Reports are built on demand — click Generate above.</div>
        </div>
      )}

      {/* 2×2 Report grid */}
      {(ran||loading)&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(480px,1fr))",gap:"14px",animation:"v2FadeUp 0.3s ease"}}>

          {/* 1 — Calls Per Agent */}
          <ReportCard icon={RiPhoneLine||RiBarChartBoxLine} title="Calls Per Agent" subtitle="Top callers in the selected period" loading={loading} noData={callsPerAgent.length===0}
            onExport={()=>downloadCSV("calls-per-agent.csv",[["Agent","Calls","Avg Duration (s)"],...callsPerAgent.map(r=>[r.name,r.calls,r.avgDur])])}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={callsPerAgent} margin={{top:4,right:4,left:-22,bottom:0}} barSize={28}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false}/>
                <XAxis dataKey="name" tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={{stroke:C.border}} tickLine={false}/>
                <YAxis tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<ChartTip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                <Bar dataKey="calls" radius={[5,5,0,0]}>{callsPerAgent.map((_,i)=>(<Cell key={i} fill={i===0?C.gold:"#3A3A1A"} opacity={i===0?1:0.8}/>))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ReportCard>

          {/* 2 — Leads Per Stage */}
          <ReportCard icon={RiFundsLine} title="Leads Per Stage" subtitle="Current distribution across pipeline" loading={loading} noData={leadsPerStage.length===0}
            onExport={()=>downloadCSV("leads-per-stage.csv",[["Stage","Count"],...leadsPerStage.map(r=>[r.stage,r.count])])}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsPerStage} layout="vertical" margin={{top:4,right:16,left:4,bottom:0}} barSize={16}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <YAxis dataKey="stage" type="category" tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={false} tickLine={false} width={90}/>
                <Tooltip content={<ChartTip/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                <Bar dataKey="count" radius={[0,4,4,0]}>{leadsPerStage.map((_,i)=>(<Cell key={i} fill={STAGE_PALETTE[i%STAGE_PALETTE.length]} opacity={0.9}/>))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ReportCard>

          {/* 3 — Conversion by Source */}
          <ReportCard icon={RiPercentLine} title="Conversion by Source" subtitle="% of leads closed per channel in the period" loading={loading} noData={convBySource.length===0}
            onExport={()=>downloadCSV("conversion-by-source.csv",[["Source","Conversion %","Total Leads"],...convBySource.map(r=>[r.source,r.rate,r.total])])}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={convBySource} margin={{top:4,right:4,left:-22,bottom:0}} barSize={28}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false}/>
                <XAxis dataKey="source" tick={{fill:C.sub,fontSize:10,fontFamily:FB}} axisLine={{stroke:C.border}} tickLine={false}/>
                <YAxis tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={false} tickLine={false} domain={[0,100]} unit="%"/>
                <Tooltip content={<ChartTip unit="%"/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                <Bar dataKey="rate" radius={[5,5,0,0]}>{convBySource.map((e,i)=>(<Cell key={i} fill={e.rate>=30?C.success:e.rate>=15?C.gold:C.info}/>))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ReportCard>

          {/* 4 — Follow-up Completion + Agent Comparison */}
          <ReportCard icon={RiTeamLine} title="Follow-up Rate + Agent Comparison" subtitle="Completion rate & avg call duration per agent" loading={loading} noData={false}>
            {/* Completion rate strip */}
            <div style={{marginBottom:"16px",padding:"12px 14px",backgroundColor:C.surfaceAct,borderRadius:R.md,display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:FH,fontSize:"28px",fontWeight:700,color:followUpRate.pct>=70?C.success:followUpRate.pct>=40?C.warning:C.red,lineHeight:1}}>{followUpRate.pct}%</div>
                <div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"3px"}}>Follow-up completion</div>
              </div>
              <div style={{flex:1,minWidth:"120px"}}>
                <div style={{height:"6px",backgroundColor:C.border,borderRadius:R.full,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${followUpRate.pct}%`,backgroundColor:followUpRate.pct>=70?C.success:followUpRate.pct>=40?C.warning:C.red,borderRadius:R.full,transition:"width 0.6s ease"}}/>
                </div>
                <div style={{fontFamily:FB,fontSize:"11px",color:C.sub,marginTop:"4px"}}>{followUpRate.completed} of {followUpRate.total} completed</div>
              </div>
            </div>
            {/* Agent avg duration */}
            {agentComparison.length>0&&(
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={agentComparison} margin={{top:4,right:4,left:-22,bottom:0}} barSize={22}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={{stroke:C.border}} tickLine={false}/>
                  <YAxis tick={{fill:C.sub,fontSize:11,fontFamily:FB}} axisLine={false} tickLine={false} allowDecimals={false} unit="s"/>
                  <Tooltip content={<ChartTip unit="s"/>} cursor={{fill:"rgba(255,255,255,0.03)"}}/>
                  <Bar dataKey="avgDur" radius={[4,4,0,0]} fill={C.info} opacity={0.8}/>
                </BarChart>
              </ResponsiveContainer>
            )}
            {agentComparison.length===0&&<div style={{textAlign:"center",fontFamily:FB,fontSize:"12px",color:C.sub,padding:"20px"}}>No call data for agent comparison</div>}
          </ReportCard>
        </div>
      )}
    </div>
  );
};
