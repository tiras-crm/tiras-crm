// TIRAS CRM V2 — ManagerDashboard.jsx
// Theme: Obsidian Gold | Fonts: Playfair Display + DM Sans
// Real-time via onSnapshot | Mobile cards + Desktop layout
// Queries scoped: managerId == currentUser.uid AND companyId == companyId

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, onSnapshot, Timestamp,
} from "firebase/firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:          "#121212",
  surface:     "#1A1A1B",
  surfaceHov:  "#222223",
  border:      "#2A2A2B",
  gold:        "#D4AF37",
  goldMuted:   "rgba(212,175,55,0.12)",
  red:         "#E63946",
  redMuted:    "rgba(230,57,70,0.12)",
  green:       "#10B981",
  greenMuted:  "rgba(16,185,129,0.12)",
  blue:        "#3B82F6",
  blueMuted:   "rgba(59,130,246,0.12)",
  text:        "#F5F5F5",
  textSub:     "#9A9A9A",
  textMuted:   "#555555",
};

const F = {
  heading: "'Playfair Display', Georgia, serif",
  body:    "'DM Sans', system-ui, sans-serif",
};

// Day labels for chart
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayStart = () => {
  const d = new Date(); d.setHours(0,0,0,0); return Timestamp.fromDate(d);
};

const weekAgoStart = () => {
  const d = new Date(); d.setDate(d.getDate()-6); d.setHours(0,0,0,0);
  return Timestamp.fromDate(d);
};

const buildWeek = () =>
  Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    return { label: i===6 ? "Today" : DAY_LABELS[d.getDay()], dateStr: d.toDateString(), calls: 0 };
  });

const hoursLate = (ts) => {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 3_600_000);
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:9999,
      backgroundColor: type==="error" ? C.red : C.green,
      color:"#fff", padding:"12px 20px", borderRadius:10,
      fontFamily:F.body, fontSize:14, fontWeight:600,
      boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
      animation:"slideIn 0.25s ease",
    }}>
      {msg}
    </div>
  );
};

// ─── Shimmer ──────────────────────────────────────────────────────────────────

const Shimmer = ({ w="100%", h=16, r=8 }) => (
  <div style={{
    width:w, height:h, borderRadius:r,
    background:`linear-gradient(90deg,${C.surface} 25%,#252526 50%,${C.surface} 75%)`,
    backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite",
  }} />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color, loading }) => (
  <div style={{
    backgroundColor:C.surface, border:`1px solid ${C.border}`,
    borderRadius:12, padding:20, flex:"1 1 160px",
    position:"relative", overflow:"hidden",
    transition:"transform 0.15s ease, border-color 0.15s ease",
    minHeight:110,
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.transform="translateY(-2px)"; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform="translateY(0)"; }}
  >
    {/* Gold accent bar on hover — via borderTop */}
    <div style={{ position:"absolute", top:0, left:0, right:0, height:2, backgroundColor:color||C.gold, borderRadius:"12px 12px 0 0" }} />
    {loading ? (
      <><Shimmer h={12} w="40%" /><div style={{marginTop:12}}><Shimmer h={32} w="55%" /></div><div style={{marginTop:8}}><Shimmer h={11} w="65%" /></div></>
    ) : (
      <>
        <div style={{fontSize:22, marginBottom:6}}>{icon}</div>
        <div style={{fontFamily:F.heading, fontSize:30, fontWeight:700, color:color||C.gold, lineHeight:1}}>{value}</div>
        <div style={{fontFamily:F.body, fontSize:13, fontWeight:600, color:C.text, marginTop:6}}>{label}</div>
        {sub && <div style={{fontFamily:F.body, fontSize:12, color:C.textSub, marginTop:2}}>{sub}</div>}
      </>
    )}
  </div>
);

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor:"#1E1E1E", border:`1px solid ${C.border}`,
      borderRadius:8, padding:"8px 14px",
    }}>
      <div style={{fontFamily:F.body, fontSize:11, color:C.textSub, marginBottom:4}}>{label}</div>
      <div style={{fontFamily:F.heading, fontSize:18, fontWeight:700, color:C.gold}}>
        {payload[0].value} call{payload[0].value!==1?"s":""}
      </div>
    </div>
  );
};

// ─── Section Title ────────────────────────────────────────────────────────────

const SectionTitle = ({ title, count }) => (
  <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14}}>
    <div style={{width:3, height:18, backgroundColor:C.gold, borderRadius:99}} />
    <span style={{fontFamily:F.heading, fontSize:16, fontWeight:700, color:C.text}}>{title}</span>
    {count!==undefined && (
      <span style={{fontFamily:F.body, fontSize:11, fontWeight:600, padding:"2px 9px", borderRadius:20, backgroundColor:C.goldMuted, color:C.gold}}>{count}</span>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ManagerDashboard = () => {
  const { currentUser, companyId } = useAuth();
  const navigate = useNavigate();

  const [agents,      setAgents]    = useState([]);
  const [leads,       setLeads]     = useState([]);
  const [callsToday,  setToday]     = useState([]);
  const [callsWeek,   setWeek]      = useState([]);
  const [overdue,     setOverdue]   = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [toast,       setToast]     = useState(null);

  // ─── Real-time listeners ──────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser?.uid || !companyId) return;
    const uid = currentUser.uid;
    const unsubs = [];
    let resolved = 0;
    const maybeLoaded = () => { resolved++; if (resolved>=4) setLoading(false); };

    // 1. Agents under this manager
    unsubs.push(onSnapshot(
      query(collection(db,COLLECTIONS.USERS), where("managerId","==",uid), where("companyId","==",companyId)),
      snap => { setAgents(snap.docs.map(d=>({id:d.id,...d.data()}))); maybeLoaded(); },
      err => { console.error(err); maybeLoaded(); }
    ));

    // 2. Leads under this manager
    unsubs.push(onSnapshot(
      query(collection(db,COLLECTIONS.LEADS), where("managerId","==",uid), where("companyId","==",companyId)),
      snap => { setLeads(snap.docs.map(d=>({id:d.id,...d.data()}))); maybeLoaded(); },
      err => { console.error(err); maybeLoaded(); }
    ));

    // 3. Calls today (across team agents — batch by managerId for simplicity)
    unsubs.push(onSnapshot(
      query(collection(db,COLLECTIONS.CALLS), where("managerId","==",uid), where("companyId","==",companyId), where("createdAt",">=",todayStart())),
      snap => { setToday(snap.docs.map(d=>({id:d.id,...d.data()}))); maybeLoaded(); },
      err => { console.error(err); maybeLoaded(); }
    ));

    // 4. Overdue follow-ups
    unsubs.push(onSnapshot(
      query(
        collection(db,COLLECTIONS.FOLLOWUPS),
        where("managerId","==",uid),
        where("companyId","==",companyId),
        where("scheduledAt","<",Timestamp.now()),
        where("status","in",["pending","scheduled"])
      ),
      snap => { setOverdue(snap.docs.map(d=>({id:d.id,...d.data()}))); maybeLoaded(); },
      err => { console.error(err); maybeLoaded(); }
    ));

    // 5. Calls this week — separate snapshot (no loading gate, bonus data)
    unsubs.push(onSnapshot(
      query(collection(db,COLLECTIONS.CALLS), where("managerId","==",uid), where("companyId","==",companyId), where("createdAt",">=",weekAgoStart())),
      snap => setWeek(snap.docs.map(d=>({id:d.id,...d.data()}))),
      err => console.error(err)
    ));

    return () => unsubs.forEach(u=>u());
  }, [currentUser?.uid, companyId]);

  // ─── Derived ──────────────────────────────────────────────────────────

  // Calls per agent today — sorted by count desc
  const agentCallMap = useMemo(() => {
    const m = {};
    callsToday.forEach(c => { m[c.agentId] = (m[c.agentId]||0)+1; });
    return m;
  }, [callsToday]);

  const agentList = useMemo(() =>
    [...agents].sort((a,b) => (agentCallMap[b.id]||0)-(agentCallMap[a.id]||0)),
  [agents, agentCallMap]);

  // Stage breakdown
  const stageMap = useMemo(() => {
    const m = {};
    leads.forEach(l => { const s=l.stage||"New"; m[s]=(m[s]||0)+1; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }, [leads]);

  const STAGE_COLORS = {
    New:"#6B7280", Contacted:C.blue, Interested:"#F59E0B",
    "Follow-up":"#F97316", Negotiation:"#8B5CF6",
    "Closed Won":C.green, "Closed Lost":C.red,
  };

  // Weekly chart
  const weekChart = useMemo(() => {
    const sk = buildWeek();
    callsWeek.forEach(c => {
      const ds = c.createdAt?.toDate ? c.createdAt.toDate().toDateString() : null;
      const slot = sk.find(s=>s.dateStr===ds);
      if (slot) slot.calls++;
    });
    return sk;
  }, [callsWeek]);

  const maxAgentCalls = Math.max(...agentList.map(a=>agentCallMap[a.id]||0), 1);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideIn{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        body{margin:0;background:${C.bg};font-family:${F.body}}
        @media(max-width:640px){
          .desk-only{display:none!important}
          .stat-grid{grid-template-columns:repeat(2,1fr)!important}
          .main-grid{grid-template-columns:1fr!important}
          .bottom-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      <div style={{minHeight:"100vh", backgroundColor:C.bg, padding:"24px 20px", animation:"fadeIn 0.3s ease"}}>

        {/* ── Header ── */}
        <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12}}>
          <div>
            <div style={{fontFamily:F.body, fontSize:11, fontWeight:600, color:C.gold, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:4}}>
              Manager · Live View
            </div>
            <h1 style={{fontFamily:F.heading, fontSize:26, fontWeight:700, color:C.text, margin:0, lineHeight:1.1}}>
              Team Dashboard
            </h1>
            <div style={{fontFamily:F.body, fontSize:13, color:C.textSub, marginTop:4}}>
              {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}
              {" · "}<span style={{color:C.green}}>● Live</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/manager/leads")}
            style={{
              fontFamily:F.body, fontSize:13, fontWeight:700,
              backgroundColor:C.gold, color:"#000",
              border:"none", borderRadius:8, padding:"9px 18px",
              cursor:"pointer", minHeight:44,
            }}
          >
            All Team Leads →
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="stat-grid" style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20}}>
          <StatCard icon="📞" label="Calls Today"      value={loading?"…":callsToday.length}  sub={`by ${agents.length} agent${agents.length!==1?"s":""}`} color={C.gold}  loading={loading} />
          <StatCard icon="👥" label="Team Size"        value={loading?"…":agents.length}       sub="active agents"          color={C.blue}  loading={loading} />
          <StatCard icon="📋" label="Total Leads"      value={loading?"…":leads.length}        sub="across all stages"      color={C.green} loading={loading} />
          <StatCard icon="🔴" label="Overdue"          value={loading?"…":overdue.length}      sub={overdue.length>0?"needs attention":"all clear"} color={overdue.length>0?C.red:C.green} loading={loading} />
        </div>

        {/* ── Main Grid: Chart + Agent List ── */}
        <div className="main-grid" style={{display:"grid", gridTemplateColumns:"1fr 340px", gap:14, marginBottom:14}}>

          {/* Weekly calls chart */}
          <div style={{backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20}}>
            <SectionTitle title="Team Calls — Last 7 Days" />
            {loading ? <Shimmer h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekChart} margin={{top:6,right:6,left:-22,bottom:0}} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" tick={{fill:C.textSub, fontSize:11, fontFamily:F.body}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:C.textSub, fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{fill:"rgba(255,255,255,0.04)"}} />
                  <Bar dataKey="calls" radius={[4,4,0,0]}>
                    {weekChart.map((entry,i) => (
                      <Cell key={i} fill={entry.label==="Today" ? C.gold : i===5 ? C.gold+"99" : C.gold+"44"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Agent calls today */}
          <div style={{backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20}}>
            <SectionTitle title="Agent Calls Today" count={agents.length} />
            {loading ? (
              Array.from({length:4}).map((_,i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:10, marginBottom:12}}>
                  <Shimmer w={32} h={32} r={16} />
                  <div style={{flex:1}}><Shimmer h={12} w="60%" /></div>
                  <Shimmer w={24} h={18} />
                </div>
              ))
            ) : agents.length===0 ? (
              <div style={{textAlign:"center", padding:"32px 0", color:C.textSub, fontFamily:F.body, fontSize:13}}>
                No agents assigned yet.
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:6, maxHeight:240, overflowY:"auto"}}>
                {agentList.map((agent,idx) => {
                  const cnt = agentCallMap[agent.id]||0;
                  const pct = (cnt/maxAgentCalls)*100;
                  const colors = [C.gold, C.green, C.blue, "#8B5CF6", "#F59E0B"];
                  const col = colors[idx%colors.length];
                  return (
                    <div key={agent.id} style={{
                      display:"flex", alignItems:"center", gap:10,
                      padding:"8px 10px", borderRadius:8,
                      backgroundColor: idx===0&&cnt>0 ? C.goldMuted : "transparent",
                      border: `1px solid ${idx===0&&cnt>0 ? C.gold+"33" : "transparent"}`,
                    }}>
                      {/* Rank */}
                      <div style={{
                        width:22, height:22, borderRadius:"50%", flexShrink:0,
                        backgroundColor: idx===0 ? C.gold : C.border,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:F.body, fontSize:11, fontWeight:700,
                        color: idx===0 ? "#000" : C.textSub,
                      }}>{idx+1}</div>
                      {/* Name + bar */}
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontFamily:F.body, fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                          {agent.displayName||agent.email||"Agent"}
                        </div>
                        <div style={{marginTop:3, height:3, borderRadius:99, backgroundColor:C.border, overflow:"hidden"}}>
                          <div style={{height:"100%", width:`${pct}%`, backgroundColor:col, borderRadius:99, transition:"width 0.5s ease"}} />
                        </div>
                      </div>
                      {/* Count */}
                      <div style={{fontFamily:F.heading, fontSize:18, fontWeight:700, color:cnt>0?col:C.textMuted, flexShrink:0}}>{cnt}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Grid: Leads by Stage + Overdue ── */}
        <div className="bottom-grid" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>

          {/* Leads by stage */}
          <div style={{backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20}}>
            <SectionTitle title="Leads by Stage" count={leads.length} />
            {loading ? (
              Array.from({length:5}).map((_,i) => <div key={i} style={{marginBottom:10}}><Shimmer h={28} /></div>)
            ) : stageMap.length===0 ? (
              <div style={{textAlign:"center", padding:"28px 0", color:C.textSub, fontFamily:F.body, fontSize:13}}>
                No leads in your team yet.
              </div>
            ) : stageMap.map(([stage,count]) => {
              const max = Math.max(...stageMap.map(([,c])=>c),1);
              const pct = (count/max)*100;
              const col = STAGE_COLORS[stage]||C.textSub;
              return (
                <div key={stage} style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
                  <div style={{width:8, height:8, borderRadius:"50%", backgroundColor:col, flexShrink:0}} />
                  <div style={{fontFamily:F.body, fontSize:12, color:C.textSub, width:100, flexShrink:0}}>{stage}</div>
                  <div style={{flex:1, height:6, borderRadius:99, backgroundColor:C.border, overflow:"hidden"}}>
                    <div style={{height:"100%", width:`${pct}%`, backgroundColor:col, borderRadius:99}} />
                  </div>
                  <div style={{fontFamily:F.body, fontSize:13, fontWeight:600, color:C.text, width:24, textAlign:"right", flexShrink:0}}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Overdue follow-ups */}
          <div style={{backgroundColor:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20}}>
            <SectionTitle title="Overdue Follow-ups" count={overdue.length} />
            {loading ? (
              Array.from({length:3}).map((_,i) => <div key={i} style={{marginBottom:10}}><Shimmer h={52} /></div>)
            ) : overdue.length===0 ? (
              <div style={{textAlign:"center", padding:"28px 0"}}>
                <div style={{fontSize:32, marginBottom:8}}>✓</div>
                <div style={{fontFamily:F.body, fontSize:13, color:C.green, fontWeight:600}}>All follow-ups on schedule</div>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:8, maxHeight:260, overflowY:"auto"}}>
                {overdue.map(fu => {
                  const h = hoursLate(fu.scheduledAt);
                  const late = h!==null ? (h>=24 ? `${Math.floor(h/24)}d late` : `${h}h late`) : "Overdue";
                  return (
                    <div key={fu.id} style={{
                      backgroundColor:C.redMuted, border:`1px solid ${C.red}33`,
                      borderLeft:`3px solid ${C.red}`, borderRadius:8,
                      padding:"10px 12px", display:"flex", alignItems:"flex-start", gap:10,
                    }}>
                      <div style={{width:6, height:6, borderRadius:"50%", backgroundColor:C.red, flexShrink:0, marginTop:5}} />
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontFamily:F.body, fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                          {fu.leadName||"Unnamed Lead"}
                        </div>
                        <div style={{fontFamily:F.body, fontSize:11, color:C.textSub, marginTop:2}}>
                          Agent: {fu.agentName||fu.agentId||"—"}
                        </div>
                      </div>
                      <div style={{fontFamily:F.body, fontSize:11, fontWeight:700, color:C.red, flexShrink:0}}>{late}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </>
  );
};

export default ManagerDashboard;
