// TIRAS CRM V2 — FollowUpCalendar.jsx
// Manager: Day / Week / Month calendar of all team follow-ups
// Real-time onSnapshot | Click chip to see detail drawer | Obsidian Gold

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#121212",surface:"#1A1A1B",surfaceHov:"#222223",border:"#2A2A2B",
  gold:"#D4AF37",goldMuted:"rgba(212,175,55,0.12)",
  red:"#E63946",redMuted:"rgba(230,57,70,0.12)",
  green:"#10B981",greenMuted:"rgba(16,185,129,0.12)",
  blue:"#3B82F6",blueMuted:"rgba(59,130,246,0.12)",
  warn:"#F59E0B",warnMuted:"rgba(245,158,11,0.12)",
  text:"#F5F5F5",textSub:"#9A9A9A",textMuted:"#555555",
};
const F = { heading:"'Playfair Display',Georgia,serif", body:"'DM Sans',system-ui,sans-serif" };

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_META = {
  completed:{ color:C.green, bg:C.greenMuted, label:"Done"    },
  pending:  { color:C.gold,  bg:C.goldMuted,  label:"Pending" },
  scheduled:{ color:C.blue,  bg:C.blueMuted,  label:"Set"     },
  overdue:  { color:C.red,   bg:C.redMuted,   label:"Overdue" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today0 = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const addDays  = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const weekStart= d => { const r=new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; };
const fmtTime  = ts => { if(!ts) return ""; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true}); };
const fmtDateLong = d => d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

const resolveStatus = fu => {
  if (fu.status==="completed") return "completed";
  const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
  if (ts && ts < new Date()) return "overdue";
  return fu.status||"pending";
};

const Shimmer = ({w="100%",h=14,r=6}) => <div style={{width:w,height:h,borderRadius:r,background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}} />;

// ─── Follow-up chip (month/week cell) ────────────────────────────────────────
const FuChip = ({ fu, onClick }) => {
  const status = resolveStatus(fu);
  const m = STATUS_META[status];
  return (
    <div onClick={()=>onClick(fu)} style={{backgroundColor:m.bg,borderLeft:`3px solid ${m.color}`,borderRadius:4,padding:"2px 6px",fontSize:10,color:m.color,cursor:"pointer",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",marginBottom:2,fontFamily:F.body,fontWeight:600}}>
      {fmtTime(fu.scheduledAt)} {fu.leadName||"Lead"}
    </div>
  );
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────
const Drawer = ({ fu, agentMap, onClose }) => {
  if (!fu) return null;
  const status = resolveStatus(fu);
  const m = STATUS_META[status];
  const rows = [
    ["Date",    fu.scheduledAt?.toDate?fu.scheduledAt.toDate().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}):"—"],
    ["Time",    fmtTime(fu.scheduledAt)||"—"],
    ["Agent",   agentMap[fu.agentId]||fu.agentId||"—"],
    ["Phone",   fu.leadPhone||"—"],
    ["Status",  m.label],
    ["Source",  fu.leadSource||"—"],
  ];
  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.6)",zIndex:100}} />
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(360px,100vw)",backgroundColor:C.surface,borderLeft:`1px solid ${C.border}`,zIndex:101,padding:24,overflowY:"auto",fontFamily:F.body}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,display:"inline-block",marginBottom:8}}>{m.label}</span>
          <div style={{fontFamily:F.heading,fontSize:20,fontWeight:700,color:C.text}}>{fu.leadName||"Lead"}</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.textSub,cursor:"pointer",fontSize:22,lineHeight:1,padding:0,marginLeft:12}}>×</button>
      </div>
      {rows.map(([label,value])=>(
        <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,color:C.textSub}}>{label}</span>
          <span style={{fontSize:13,color:C.text,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{value}</span>
        </div>
      ))}
      {fu.note&&<div style={{marginTop:16,backgroundColor:C.surfaceHov,borderRadius:8,padding:14,fontSize:13,color:C.textSub,lineHeight:1.6,fontStyle:"italic"}}>"{fu.note}"</div>}
    </div>
  </>);
};

// ─── Month View ───────────────────────────────────────────────────────────────
const MonthView = ({ cursor, fus, agentFilter, agentMap, onChipClick }) => {
  const tod = today0();
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = weekStart(first);
  const cells = Array.from({length:42}, (_,i) => addDays(gridStart, i));
  const fuForDay = d => fus.filter(fu => {
    if (agentFilter!=="all" && fu.agentId!==agentFilter) return false;
    const ts = fu.scheduledAt?.toDate?fu.scheduledAt.toDate():null;
    return ts && sameDay(ts, d);
  }).sort((a,b)=>(a.scheduledAt?.seconds||0)-(b.scheduledAt?.seconds||0));

  return (
    <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${C.border}`}}>
        {DAYS_SHORT.map(d=><div key={d} style={{fontFamily:F.body,fontSize:10,fontWeight:600,color:C.textSub,textTransform:"uppercase",letterSpacing:"0.08em",textAlign:"center",padding:"10px 0"}}>{d}</div>)}
      </div>
      <div style={{flex:1,display:"grid",gridTemplateRows:"repeat(6,1fr)",overflow:"hidden"}}>
        {Array.from({length:6}).map((_,wi)=>(
          <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${C.border}`}}>
            {Array.from({length:7}).map((_,di)=>{
              const cell = cells[wi*7+di];
              const isToday = sameDay(cell, tod);
              const inMonth = cell.getMonth()===cursor.getMonth();
              const dayFus  = fuForDay(cell);
              return (
                <div key={di} style={{borderRight:di<6?`1px solid ${C.border}`:"none",padding:4,minHeight:80,backgroundColor:isToday?C.goldMuted:"transparent",overflow:"hidden"}}>
                  <div style={{textAlign:"right",marginBottom:3}}>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:"50%",fontFamily:F.body,fontSize:12,fontWeight:isToday?700:400,backgroundColor:isToday?C.gold:"transparent",color:isToday?"#000":inMonth?C.textSub:C.textMuted}}>
                      {cell.getDate()}
                    </span>
                  </div>
                  {dayFus.slice(0,3).map(fu=><FuChip key={fu.id} fu={fu} onClick={onChipClick} />)}
                  {dayFus.length>3&&<div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,padding:"0 4px"}}>+{dayFus.length-3} more</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Week View ────────────────────────────────────────────────────────────────
const WeekView = ({ cursor, fus, agentFilter, onChipClick }) => {
  const tod = today0();
  const ws  = weekStart(cursor);
  const days= Array.from({length:7},(_,i)=>addDays(ws,i));
  const fuForDay = d => fus.filter(fu=>{
    if (agentFilter!=="all"&&fu.agentId!==agentFilter) return false;
    const ts=fu.scheduledAt?.toDate?fu.scheduledAt.toDate():null;
    return ts&&sameDay(ts,d);
  }).sort((a,b)=>(a.scheduledAt?.seconds||0)-(b.scheduledAt?.seconds||0));
  return (
    <div style={{flex:1,overflowX:"auto",overflowY:"auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(120px,1fr))",minWidth:700}}>
        {days.map((d,i)=>{
          const isToday=sameDay(d,tod);
          const dayFus=fuForDay(d);
          return (
            <div key={i} style={{borderRight:i<6?`1px solid ${C.border}`:"none",minHeight:480}}>
              <div style={{padding:"12px 8px",textAlign:"center",borderBottom:`1px solid ${C.border}`,backgroundColor:isToday?C.goldMuted:C.surface,position:"sticky",top:0,zIndex:1}}>
                <div style={{fontFamily:F.body,fontSize:10,color:C.textSub,textTransform:"uppercase"}}>{DAYS_SHORT[d.getDay()]}</div>
                <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:"50%",margin:"4px auto 0",backgroundColor:isToday?C.gold:"transparent",fontFamily:F.heading,fontSize:16,fontWeight:700,color:isToday?"#000":C.text}}>{d.getDate()}</div>
                {dayFus.length>0&&<div style={{fontFamily:F.body,fontSize:10,color:isToday?C.gold:C.textMuted,marginTop:2}}>{dayFus.length} item{dayFus.length!==1?"s":""}</div>}
              </div>
              <div style={{padding:6}}>
                {dayFus.length===0?<div style={{textAlign:"center",paddingTop:24,fontFamily:F.body,fontSize:11,color:C.textMuted}}>—</div>:dayFus.map(fu=>{
                  const s=resolveStatus(fu); const m=STATUS_META[s];
                  return (
                    <div key={fu.id} onClick={()=>onChipClick(fu)} style={{backgroundColor:m.bg,borderLeft:`3px solid ${m.color}`,borderRadius:6,padding:"8px 8px",marginBottom:6,cursor:"pointer"}}>
                      <div style={{fontFamily:F.body,fontSize:11,fontWeight:700,color:m.color}}>{fmtTime(fu.scheduledAt)}</div>
                      <div style={{fontFamily:F.body,fontSize:11,color:C.text,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fu.leadName||"Lead"}</div>
                      <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,marginTop:1}}>{fu.agentName||""}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Day View ─────────────────────────────────────────────────────────────────
const DayView = ({ cursor, fus, agentFilter, agentMap, onChipClick }) => {
  const tod=today0();
  const dayFus=fus.filter(fu=>{
    if(agentFilter!=="all"&&fu.agentId!==agentFilter)return false;
    const ts=fu.scheduledAt?.toDate?fu.scheduledAt.toDate():null;
    return ts&&sameDay(ts,cursor);
  }).sort((a,b)=>(a.scheduledAt?.seconds||0)-(b.scheduledAt?.seconds||0));

  if(dayFus.length===0) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.textSub,fontFamily:F.body}}>
      <div style={{fontSize:40,marginBottom:14}}>📅</div>
      <div style={{fontSize:15}}>{sameDay(cursor,tod)?"No follow-ups today":"No follow-ups on this day"}</div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        {dayFus.map((fu,idx)=>{
          const s=resolveStatus(fu); const m=STATUS_META[s];
          return (
            <div key={fu.id} style={{display:"flex",gap:14,marginBottom:16,cursor:"pointer"}} onClick={()=>onChipClick(fu)}>
              <div style={{width:60,flexShrink:0,textAlign:"right",paddingTop:14}}>
                <div style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:C.textSub}}>{fmtTime(fu.scheduledAt)||"—"}</div>
              </div>
              <div style={{width:2,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:"50%",backgroundColor:m.color,marginTop:14,flexShrink:0}} />
                {idx<dayFus.length-1&&<div style={{flex:1,width:2,backgroundColor:C.border,marginTop:4}} />}
              </div>
              <div style={{flex:1,backgroundColor:m.bg,borderLeft:`4px solid ${m.color}`,borderRadius:10,padding:"12px 16px",marginBottom:idx<dayFus.length-1?8:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color:C.text}}>{fu.leadName||"Lead"}</div>
                    <div style={{fontFamily:F.body,fontSize:12,color:C.textSub,marginTop:3}}>Agent: {agentMap[fu.agentId]||"—"}</div>
                    {fu.note&&<div style={{fontFamily:F.body,fontSize:12,color:C.textMuted,marginTop:6,fontStyle:"italic"}}>"{fu.note}"</div>}
                  </div>
                  <span style={{fontFamily:F.body,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,backgroundColor:m.bg,color:m.color,border:`1px solid ${m.color}44`,flexShrink:0}}>{m.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const FollowUpCalendar = () => {
  const { currentUser, companyId } = useAuth();
  const [fus,    setFus]    = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading,setLoading]= useState(true);
  const [view,   setView]   = useState("Month");
  const [cursor, setCursor] = useState(today0());
  const [agentF, setAgentF] = useState("all");
  const [selFu,  setSelFu]  = useState(null);

  useEffect(()=>{
    if(!currentUser?.uid||!companyId)return;
    const uid=currentUser.uid;
    const winStart=new Date(); winStart.setDate(winStart.getDate()-45); winStart.setHours(0,0,0,0);
    const winEnd=new Date();   winEnd.setDate(winEnd.getDate()+90);     winEnd.setHours(23,59,59,999);
    let r=0; const ck=()=>{r++;if(r>=2)setLoading(false);};
    const u1=onSnapshot(query(collection(db,COLLECTIONS.USERS),where("managerId","==",uid),where("companyId","==",companyId)),s=>{setAgents(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    const u2=onSnapshot(query(collection(db,COLLECTIONS.FOLLOWUPS),where("managerId","==",uid),where("companyId","==",companyId),where("scheduledAt",">=",Timestamp.fromDate(winStart)),where("scheduledAt","<=",Timestamp.fromDate(winEnd))),s=>{setFus(s.docs.map(d=>({id:d.id,...d.data()})));ck();},e=>{console.error(e);ck();});
    return()=>{u1();u2();};
  },[currentUser?.uid,companyId]);

  const agentMap = useMemo(()=>{const m={};agents.forEach(a=>{m[a.id]=a.displayName||a.email||"Agent";});return m;},[agents]);

  const nav = dir => setCursor(prev=>{
    const d=new Date(prev);
    if(view==="Day")   d.setDate(d.getDate()+dir);
    if(view==="Week")  d.setDate(d.getDate()+dir*7);
    if(view==="Month") d.setMonth(d.getMonth()+dir);
    return d;
  });

  const cursorLabel = useMemo(()=>{
    if(view==="Day")   return fmtDateLong(cursor);
    if(view==="Week")  { const s=weekStart(cursor),e=addDays(s,6); return `${s.toLocaleDateString("en-IN",{day:"numeric",month:"short"})} – ${e.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`; }
    if(view==="Month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  },[view,cursor]);

  const now=new Date(), tod=today0();
  const dueToday   = fus.filter(fu=>{const ts=fu.scheduledAt?.toDate?fu.scheduledAt.toDate():null;return ts&&sameDay(ts,tod);});
  const overdueAll = fus.filter(fu=>{const ts=fu.scheduledAt?.toDate?fu.scheduledAt.toDate():null;return ts&&ts<now&&fu.status!=="completed";});
  const doneTod    = dueToday.filter(fu=>fu.status==="completed");

  return (<>
    <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}`}</style>
    <div style={{height:"100vh",display:"flex",flexDirection:"column",backgroundColor:C.bg,fontFamily:F.body,color:C.text,overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{backgroundColor:C.surface,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",flexShrink:0}}>
        <div style={{marginRight:8}}>
          <div style={{fontFamily:F.body,fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Manager</div>
          <div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:C.text}}>Follow-up Calendar</div>
        </div>
        {/* Stats */}
        {!loading&&[
          {label:"Due Today",value:dueToday.length,color:C.gold},
          {label:"Completed",value:doneTod.length,color:C.green},
          {label:"Overdue",  value:overdueAll.length,color:overdueAll.length>0?C.red:C.textMuted},
        ].map(({label,value,color})=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:6,backgroundColor:C.surfaceHov,borderRadius:20,padding:"5px 12px"}}>
            <span style={{fontFamily:F.heading,fontSize:15,fontWeight:700,color}}>{value}</span>
            <span style={{fontFamily:F.body,fontSize:11,color:C.textSub}}>{label}</span>
          </div>
        ))}
        <div style={{flex:1}} />
        {/* Agent filter */}
        <select value={agentF} onChange={e=>setAgentF(e.target.value)} style={{backgroundColor:C.surfaceHov,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontFamily:F.body,fontSize:13,cursor:"pointer",outline:"none"}}>
          <option value="all">All Agents</option>
          {agents.map(a=><option key={a.id} value={a.id}>{a.displayName||a.email||"Agent"}</option>)}
        </select>
        {/* View toggle */}
        <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {["Day","Week","Month"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:"none",backgroundColor:view===v?C.goldMuted:"transparent",color:view===v?C.gold:C.textSub,cursor:"pointer"}}>
              {v}
            </button>
          ))}
        </div>
        <span style={{fontFamily:F.body,fontSize:12,color:C.green}}>● Live</span>
      </div>

      {/* Nav bar */}
      <div style={{backgroundColor:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={()=>nav(-1)} style={{fontFamily:F.body,fontSize:18,fontWeight:700,padding:"5px 12px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>‹</button>
        <button onClick={()=>nav(1)}  style={{fontFamily:F.body,fontSize:18,fontWeight:700,padding:"5px 12px",minHeight:36,border:`1px solid ${C.border}`,borderRadius:8,backgroundColor:"transparent",color:C.text,cursor:"pointer"}}>›</button>
        <div style={{fontFamily:F.heading,fontSize:18,fontWeight:700,color:C.text,flex:1}}>{cursorLabel}</div>
        <button onClick={()=>setCursor(today0())} style={{fontFamily:F.body,fontSize:13,fontWeight:600,padding:"7px 14px",minHeight:36,border:`1px solid ${sameDay(cursor,today0())?C.gold:C.border}`,borderRadius:8,backgroundColor:sameDay(cursor,today0())?C.goldMuted:"transparent",color:sameDay(cursor,today0())?C.gold:C.textSub,cursor:"pointer"}}>Today</button>
      </div>

      {/* Calendar body */}
      {loading?(
        <div style={{flex:1,padding:20,display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
          {Array.from({length:35}).map((_,i)=><Shimmer key={i} h={80} />)}
        </div>
      ):(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {view==="Month"&&<MonthView cursor={cursor} fus={fus} agentFilter={agentF} agentMap={agentMap} onChipClick={setSelFu} />}
          {view==="Week" &&<WeekView  cursor={cursor} fus={fus} agentFilter={agentF} onChipClick={setSelFu} />}
          {view==="Day"  &&<DayView   cursor={cursor} fus={fus} agentFilter={agentF} agentMap={agentMap} onChipClick={setSelFu} />}
        </div>
      )}

      {/* Legend */}
      <div style={{backgroundColor:C.surface,borderTop:`1px solid ${C.border}`,padding:"8px 20px",display:"flex",gap:20,flexShrink:0,flexWrap:"wrap"}}>
        {Object.entries(STATUS_META).map(([key,m])=>(
          <div key={key} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:2,backgroundColor:m.color}} />
            <span style={{fontFamily:F.body,fontSize:11,color:C.textSub}}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>

    {selFu&&<Drawer fu={selFu} agentMap={agentMap} onClose={()=>setSelFu(null)} />}
  </>);
};
export default FollowUpCalendar;
