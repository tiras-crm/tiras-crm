// TIRAS CRM V2 — AgentPerformance.jsx
// Manager sees side-by-side agent comparison, targets with SVG rings, leaderboard
// Real-time onSnapshot | Cards + chart toggle | Obsidian Gold theme

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const C = { bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",red:"#E63946",redMuted:"rgba(230,57,70,0.12)",green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",blue:"#3B82F6",text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555" };
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };
const AVATAR_COLORS = [[C.gold,"#000"],[C.green,"#000"],[C.blue,"#fff"],["#8B5CF6","#fff"],["#F97316","#000"]];

const startOfMonth=()=>{const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return Timestamp.fromDate(d);};
const startOfToday=()=>{const d=new Date();d.setHours(0,0,0,0);return Timestamp.fromDate(d);};
const fmtTalk=s=>{if(!s)return"0m";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h>0?`${h}h ${m}m`:`${m}m`;};
const initials=n=>{if(!n)return"?";return n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();};

const Shimmer=({w="100%",h=14,r=6})=><div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;
const Toast=({msg,type,onDone})=>{useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[onDone]);return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,backgroundColor:type==="error"?C.red:C.green,color:"#fff",padding:"12px 20px",borderRadius:10,fontFamily:F.body,fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"slideIn 0.25s ease"}}>{msg}</div>;};

// SVG Ring Progress
const Ring=({pct,color,size=72,label})=>{
  const r=(size-8)/2,circ=2*Math.PI*r,filled=Math.min(pct/100,1)*circ;
  return (
    <div style={{textAlign:"center"}}>
      <div style={{position:"relative",display:"inline-block"}}>
        <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round" style={{transition:"stroke-dasharray 0.6s ease"}} />
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,fontSize:11,fontWeight:700,color:C.text}}>
          {Math.round(Math.min(pct,100))}%
        </div>
      </div>
      <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,marginTop:4}}>{label}</div>
    </div>
  );
};

// Inline editable target row
const TargetRow=({label,current,target,color,onSave})=>{
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(String(target||""));
  const pct=target>0?Math.min((current/target)*100,100):0;
  const save=async()=>{const v=parseInt(draft,10);if(!isNaN(v)&&v>0)await onSave(v);setEditing(false);};
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontFamily:F.body,fontSize:12,color:C.textSub}}>{label}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {editing?(
            <>
              <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEditing(false);}} style={{width:56,backgroundColor:C.bg,border:`1px solid ${C.gold}`,borderRadius:6,padding:"2px 6px",color:C.text,fontFamily:F.body,fontSize:12,textAlign:"center",outline:"none"}} />
              <button onClick={save} style={{background:"none",border:"none",color:C.green,cursor:"pointer",fontSize:14,padding:0}}>✓</button>
              <button onClick={()=>setEditing(false)} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:14,padding:0}}>✕</button>
            </>
          ):(
            <>
              <span style={{fontFamily:"monospace",fontSize:11,color:C.textSub}}>{current}/{target||"—"}</span>
              <button onClick={()=>{setDraft(String(target||""));setEditing(true);}} style={{background:"none",border:"none",color:C.textMuted,cursor:"pointer",fontSize:11,padding:"0 2px"}}>✏</button>
            </>
          )}
        </div>
      </div>
      <div style={{height:6,borderRadius:99,backgroundColor:C.border,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,backgroundColor:pct>=100?C.green:color,borderRadius:99,transition:"width 0.5s ease"}} />
      </div>
      <div style={{fontFamily:F.body,fontSize:10,color:pct>=100?C.green:C.textMuted,textAlign:"right",marginTop:2}}>{target>0?`${Math.round(pct)}%`:"No target"}{pct>=100&&" 🎯"}</div>
    </div>
  );
};

const ChartTip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return <div style={{backgroundColor:"#1E1E1E",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px"}}><div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginBottom:4}}>{label}</div>{payload.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontFamily:F.body,fontSize:13,marginBottom:2}}><div style={{width:8,height:8,borderRadius:2,backgroundColor:p.fill||p.color}} /><span style={{color:C.textSub}}>{p.name}:</span><span style={{color:C.text,fontWeight:600}}>{p.value}</span></div>)}</div>;
};

export const AgentPerformance = () => {
  const { currentUser, companyId } = useAuth();
  const [agents,setAgents]=useState([]); const [callsToday,setCallsToday]=useState([]); const [callsMonth,setCallsMonth]=useState([]); const [closedMonth,setClosedMonth]=useState([]); const [fuDone,setFuDone]=useState([]);
  const [loading,setLoading]=useState(true); const [view,setView]=useState("cards");
  const [toast,setToast]=useState(null); const [saving,setSaving]=useState(null);

  useEffect(()=>{
    if(!currentUser?.uid||!companyId)return;
    const uid=currentUser.uid; let r=0; const ck=()=>{r++;if(r>=4)setLoading(false);};
    const u1=onSnapshot(query(collection(db,COLLECTIONS.USERS),where("managerId","==",uid),where("companyId","==",companyId)),s=>{setAgents(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.CALLS),where("managerId","==",uid),where("companyId","==",companyId),where("createdAt",">=",startOfToday())),s=>{setCallsToday(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u3=onSnapshot(query(collection(db,COLLECTIONS.CALLS),where("managerId","==",uid),where("companyId","==",companyId),where("createdAt",">=",startOfMonth())),s=>{setCallsMonth(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u4=onSnapshot(query(collection(db,COLLECTIONS.LEADS),where("managerId","==",uid),where("companyId","==",companyId),where("stage","==","Closed Won")),s=>{setClosedMonth(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u5=onSnapshot(query(collection(db,COLLECTIONS.FOLLOWUPS),where("managerId","==",uid),where("companyId","==",companyId),where("status","==","completed")),s=>{setFuDone(s.docs.map(d=>({id:d.id,...d.data()})));},e=>console.error(e));
    return()=>{u1();u2();u3();u4();u5();};
  },[currentUser?.uid,companyId]);

  const saveTarget=useCallback(async(agentId,field,value)=>{
    setSaving(agentId);
    try{await updateDoc(doc(db,COLLECTIONS.USERS,agentId),{[field]:value,updatedAt:serverTimestamp()});setAgents(prev=>prev.map(a=>a.id===agentId?{...a,[field]:value}:a));setToast({msg:"Target updated","type":"success"});}
    catch(e){setToast({msg:"Failed: "+e.message,type:"error"});}
    finally{setSaving(null);}
  },[]);

  const agentStats=useMemo(()=>agents.map((a,idx)=>({
    ...a,
    colorSet:AVATAR_COLORS[idx%AVATAR_COLORS.length],
    callsToday:callsToday.filter(c=>c.agentId===a.id).length,
    callsMonth:callsMonth.filter(c=>c.agentId===a.id).length,
    closedMonth:closedMonth.filter(l=>l.agentId===a.id).length,
    fuDone:fuDone.filter(f=>f.agentId===a.id).length,
    talkSec:callsMonth.filter(c=>c.agentId===a.id).reduce((s,c)=>s+(c.duration||0),0),
  })),[agents,callsToday,callsMonth,closedMonth,fuDone]);

  const topCaller=agentStats.length?[...agentStats].sort((a,b)=>b.callsToday-a.callsToday)[0]:null;
  const topCloser=agentStats.length?[...agentStats].sort((a,b)=>b.closedMonth-a.closedMonth)[0]:null;
  const chartData=agentStats.map(a=>({name:(a.displayName||a.email||"Agent").split(" ")[0],Calls:a.callsMonth,Closures:a.closedMonth,"Follow-ups":a.fuDone}));
  const barColors=[C.gold,C.green,C.blue];

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}@media(max-width:640px){.ag-grid{grid-template-columns:1fr!important}}`}</style>
    <div style={{minHeight:"100vh",backgroundColor:C.bg,padding:"24px 20px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:F.body,fontSize:11,fontWeight:600,color:C.gold,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Manager</div>
          <h1 style={{fontFamily:F.heading,fontSize:26,fontWeight:700,color:C.text,margin:0}}>Agent Performance</h1>
          <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,marginTop:4}}>{new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})} · <span style={{color:C.green}}>● Live</span></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {["cards","chart"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"9px 18px",minHeight:40,border:`1px solid ${view===v?C.gold:C.border}`,borderRadius:8,backgroundColor:view===v?C.goldMuted:"transparent",color:view===v?C.gold:C.textSub,cursor:"pointer"}}>
              {v==="cards"?"⊞ Cards":"📊 Chart"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:20}}>
        {[
          {title:"Top Caller Today",icon:"📞",agent:topCaller,val:topCaller?.callsToday,lbl:"calls"},
          {title:"Top Closer (Month)",icon:"🏆",agent:topCloser,val:topCloser?.closedMonth,lbl:"deals"},
          {title:"Most Talk Time",icon:"🎙️",agent:[...agentStats].sort((a,b)=>b.talkSec-a.talkSec)[0],val:fmtTalk([...agentStats].sort((a,b)=>b.talkSec-a.talkSec)[0]?.talkSec),lbl:""},
        ].map(({title,icon,agent,val,lbl})=>(
          <div key={title} style={{backgroundColor:C.surface,border:`1px solid ${C.gold}33`,borderRadius:12,padding:20,display:"flex",alignItems:"center",gap:14,background:`linear-gradient(135deg,${C.surface} 60%,${C.goldMuted})`}}>
            <div style={{fontSize:28,flexShrink:0}}>{icon}</div>
            {loading?<div style={{flex:1}}><Shimmer h={12} w="70%" /><div style={{marginTop:8}}><Shimmer h={18} w="50%" /></div></div>:agent?(
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{title}</div>
                <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agent.displayName||"Agent"}</div>
                <div style={{fontFamily:F.body,fontSize:13,color:C.gold,fontWeight:600,marginTop:2}}>{val} {lbl}</div>
              </div>
            ):<div style={{flex:1}}><div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</div><div style={{fontFamily:F.body,fontSize:13,color:C.textMuted,marginTop:4}}>No data yet</div></div>}
          </div>
        ))}
      </div>

      {/* No agents */}
      {!loading&&agents.length===0&&<div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"52px 0",textAlign:"center",color:C.textSub,fontFamily:F.body}}><div style={{fontSize:40,marginBottom:14}}>👥</div><div>No agents assigned to you yet.</div></div>}

      {/* CARDS VIEW */}
      {view==="cards"&&(
        <div className="ag-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {loading?Array.from({length:3}).map((_,i)=>(
            <div key={i} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:20,borderBottom:`1px solid ${C.border}`,display:"flex",gap:14,alignItems:"center"}}><Shimmer w={52} h={52} r={26} /><div style={{flex:1}}><Shimmer h={15} w="55%" /><div style={{marginTop:6}}><Shimmer h={11} w="75%" /></div></div></div>
              <div style={{padding:16}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>{Array.from({length:4}).map((_,j)=><Shimmer key={j} h={52} />)}</div><Shimmer h={8} /><div style={{marginTop:10}}><Shimmer h={8} /></div></div>
            </div>
          )):agentStats.map(agent=>{
            const [bgCol,txtCol]=agent.colorSet;
            const callPct=agent.monthlyCallTarget>0?(agent.callsMonth/agent.monthlyCallTarget)*100:0;
            const closePct=agent.monthlyCloseTarget>0?(agent.closedMonth/agent.monthlyCloseTarget)*100:0;
            return (
              <div key={agent.id} style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                {/* Card Header */}
                <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,background:`linear-gradient(135deg,${C.surface},${bgCol}22)`,display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:52,height:52,borderRadius:"50%",backgroundColor:bgCol+"22",border:`2px solid ${bgCol}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.body,fontSize:18,fontWeight:700,color:bgCol,flexShrink:0}}>
                    {initials(agent.displayName||agent.email)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agent.displayName||"Agent"}</div>
                    <div style={{fontFamily:F.body,fontSize:11,color:C.textSub,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agent.email}</div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontFamily:F.heading,fontSize:24,fontWeight:700,color:bgCol,lineHeight:1}}>{agent.callsToday}</div>
                    <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted}}>today</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{padding:16}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
                    {[["Calls",agent.callsMonth,C.gold],["Closed",agent.closedMonth,C.green],["Follow-ups",agent.fuDone,C.blue],["Talk",fmtTalk(agent.talkSec),"#8B5CF6"]].map(([lbl,val,col])=>(
                      <div key={lbl} style={{backgroundColor:C.surfaceHov,borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
                        <div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:col,lineHeight:1}}>{val}</div>
                        <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,marginTop:3}}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                    <div style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Monthly Targets</div>
                    <TargetRow label="Call Target" current={agent.callsMonth} target={agent.monthlyCallTarget||0} color={C.gold} onSave={v=>saveTarget(agent.id,"monthlyCallTarget",v)} />
                    <TargetRow label="Closure Target" current={agent.closedMonth} target={agent.monthlyCloseTarget||0} color={C.green} onSave={v=>saveTarget(agent.id,"monthlyCloseTarget",v)} />
                  </div>

                  {(agent.monthlyCallTarget>0||agent.monthlyCloseTarget>0)&&(
                    <div style={{display:"flex",justifyContent:"center",gap:28,marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                      {agent.monthlyCallTarget>0&&<Ring pct={callPct} color={C.gold} label="Calls" />}
                      {agent.monthlyCloseTarget>0&&<Ring pct={closePct} color={C.green} label="Closures" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CHART VIEW */}
      {view==="chart"&&!loading&&agentStats.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <div style={{fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Monthly Performance Comparison</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{top:8,right:16,left:-16,bottom:0}} barCategoryGap="25%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{fill:C.textSub,fontSize:12,fontFamily:F.body}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:C.textMuted,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{fill:"rgba(255,255,255,0.04)"}} />
                <Legend wrapperStyle={{fontFamily:F.body,fontSize:12,color:C.textSub,paddingTop:12}} iconType="square" iconSize={10} />
                {["Calls","Closures","Follow-ups"].map((k,i)=><Bar key={k} dataKey={k} fill={barColors[i]} radius={[3,3,0,0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div style={{backgroundColor:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontFamily:F.heading,fontSize:16,fontWeight:700,color:C.text}}>Side-by-Side</div>
            <div style={{display:"grid",gridTemplateColumns:`160px repeat(${agentStats.length},1fr)`,backgroundColor:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 20px"}}>Metric</div>
              {agentStats.map((a,i)=><div key={a.id} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:AVATAR_COLORS[i%AVATAR_COLORS.length][0],textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 12px",textAlign:"center"}}>{(a.displayName||"Agent").split(" ")[0]}</div>)}
            </div>
            {[
              {label:"Calls Today",key:"callsToday",color:C.gold},
              {label:"Calls (Month)",key:"callsMonth",color:C.gold},
              {label:"Closures",key:"closedMonth",color:C.green},
              {label:"Follow-ups",key:"fuDone",color:C.blue},
              {label:"Talk Time",key:"talkSec",fmt:v=>fmtTalk(v),color:"#8B5CF6"},
              {label:"Call Target",key:"monthlyCallTarget",fmt:v=>v||"—",color:C.textMuted},
              {label:"Close Target",key:"monthlyCloseTarget",fmt:v=>v||"—",color:C.textMuted},
            ].map((row,ri)=>{
              const vals=agentStats.map(a=>a[row.key]||0);
              const maxV=Math.max(...vals);
              return (
                <div key={row.key} style={{display:"grid",gridTemplateColumns:`160px repeat(${agentStats.length},1fr)`,borderBottom:`1px solid ${C.border}`,backgroundColor:ri%2===0?"transparent":C.surface+"55"}}>
                  <div style={{fontFamily:F.body,fontSize:13,color:C.textSub,padding:"10px 20px"}}>{row.label}</div>
                  {agentStats.map(a=>{const v=a[row.key]||0;const isTop=v===maxV&&maxV>0;return <div key={a.id} style={{fontFamily:isTop?F.heading:F.body,fontSize:isTop?15:13,fontWeight:isTop?700:400,color:isTop?row.color:C.textSub,padding:"10px 12px",textAlign:"center"}}>{row.fmt?row.fmt(v):v}{isTop&&maxV>0&&" ▲"}</div>;})}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
  </>);
};
export default AgentPerformance;
