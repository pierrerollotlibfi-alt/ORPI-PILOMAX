import { useState, useMemo } from "react";
import { useApp } from "../App";
import { avatarColor, fmt, todayStr, diffDays } from "./Shared";
import ChallengesCustom from "./ChallengesCustom";

var SEMAINES = 8;

function getLundi(date) {
  var d = new Date(date);
  var day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0,0,0,0);
  return d;
}

function getSemainesRecentes(n) {
  var semaines = [];
  var lundi = getLundi(new Date());
  for (var i = n-1; i >= 0; i--) {
    var d = new Date(lundi);
    d.setDate(d.getDate() - i*7);
    var fin = new Date(d); fin.setDate(fin.getDate()+6);
    semaines.push({
      debut: d.toISOString().slice(0,10),
      fin:   fin.toISOString().slice(0,10),
      label: i===0 ? "Cette semaine" : i===1 ? "Semaine -1" : "S-"+i,
    });
  }
  return semaines;
}

export default function ChallengeProspection() {
  var ctx        = useApp();
  var agenceId   = ctx.currentUser.agenceId;
  var agents     = (ctx.users||[]).filter(function(u){ return u.agenceId===agenceId && u.actif && u.role==="agent"; });
  var prospection= (ctx.prospection||[]).filter(function(p){ return p.agenceId===agenceId; });
  var prospConfig= ctx.prospConfig || {};

  var [semFocus, setSemFocus] = useState(null); // null = toutes
  var [agentFocus, setAgentFocus] = useState(null);

  var objectifSemaine = prospConfig.objectifActionsParSemaine || 10;
  var semaines = useMemo(function(){ return getSemainesRecentes(SEMAINES); }, []);

  // ─── Calcul stats par agent par semaine ────────────────────────────────────
  var statsAgents = useMemo(function() {
    return agents.map(function(a) {
      var parSem = semaines.map(function(sem) {
        var acts = prospection.filter(function(p) {
          return p.agentId===a.id && p.date>=sem.debut && p.date<=sem.fin;
        });
        return {
          nb: acts.length,
          rues: new Set(acts.map(function(p){ return p.rueId; })).size,
          types: acts.reduce(function(acc,p){ acc[p.type]=(acc[p.type]||0)+1; return acc; }, {}),
        };
      });
      var totalActions = parSem.reduce(function(s,w){ return s+w.nb; }, 0);
      var semainesActives = parSem.filter(function(w){ return w.nb>=objectifSemaine; }).length;
      var streak = 0;
      for (var i = parSem.length-1; i >= 0; i--) {
        if (parSem[i].nb >= objectifSemaine) streak++;
        else break;
      }
      return { agent:a, parSem, totalActions, semainesActives, streak };
    }).sort(function(a,b){ return b.totalActions - a.totalActions; });
  }, [agents, prospection, semaines, objectifSemaine]);

  // ─── Classement couleurs ───────────────────────────────────────────────────
  var MEDALS = ["🥇","🥈","🥉"];
  var COLORS  = ["#F59E0B","#9CA3AF","#CD7C2F"];

  return (
    <div style={{padding:"0 0 80px"}}>

      {/* ─── HEADER ─── */}
      <div style={{background:"linear-gradient(135deg,var(--navy),#1a3a5c)",borderRadius:14,padding:"16px 18px",marginBottom:16,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:17,marginBottom:4}}>{"🚶 Challenge Prospection"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>{"Classement des "+SEMAINES+" dernières semaines"}</div>
        <div style={{display:"flex",gap:12,marginTop:12}}>
          <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 14px",textAlign:"center",flex:1}}>
            <div style={{fontWeight:900,fontSize:20,color:"#FCD34D"}}>{prospection.length}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{"Actions totales"}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 14px",textAlign:"center",flex:1}}>
            <div style={{fontWeight:900,fontSize:20,color:"#6EE7B7"}}>{agents.length}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{"Agents actifs"}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 14px",textAlign:"center",flex:1}}>
            <div style={{fontWeight:900,fontSize:20,color:"#93C5FD"}}>{objectifSemaine}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{"Objectif/sem"}</div>
          </div>
        </div>
      </div>

      {/* ─── PODIUM TOP 3 ─── */}
      {statsAgents.length >= 3 && (
        <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"flex-end"}}>
          {[1,0,2].map(function(rank) {
            var s = statsAgents[rank];
            if (!s) return null;
            var heights = [110,140,90];
            var col = avatarColor(s.agent.nom);
            return (
              <div key={rank} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:800,color:"var(--navy)",marginBottom:4}}>{s.agent.nom.split(" ")[0]}</div>
                <div style={{fontSize:22,marginBottom:4}}>{MEDALS[rank]}</div>
                <div style={{background:col,borderRadius:"10px 10px 0 0",height:heights[rank],display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",gap:2}}>
                  <div style={{fontWeight:900,fontSize:20}}>{s.totalActions}</div>
                  <div style={{fontSize:10,opacity:.8}}>{"actions"}</div>
                  {s.streak > 1 && <div style={{fontSize:10,background:"rgba(255,255,255,0.2)",borderRadius:10,padding:"1px 6px"}}>{"🔥 "+s.streak+"sem"}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TABLEAU CLASSEMENT COMPLET ─── */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
        <div style={{background:"var(--g50)",padding:"10px 14px",fontWeight:800,fontSize:12,color:"var(--navy)",borderBottom:"1px solid var(--g200)"}}>
          {"📊 Détail par agent"}
        </div>
        {statsAgents.map(function(s, idx) {
          var col = avatarColor(s.agent.nom);
          var pct = Math.min(100, Math.round(s.totalActions / (objectifSemaine * SEMAINES) * 100));
          return (
            <div key={s.agent.id} style={{padding:"12px 14px",borderBottom:"1px solid var(--g50)",cursor:"pointer",background:agentFocus===s.agent.id?"#F0F9FF":"#fff"}}
              onClick={function(){ setAgentFocus(agentFocus===s.agent.id?null:s.agent.id); }}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{fontWeight:900,fontSize:16,color:idx<3?COLORS[idx]:"var(--g400)",width:24,textAlign:"center"}}>{idx<3?MEDALS[idx]:"#"+(idx+1)}</div>
                <div style={{width:32,height:32,borderRadius:16,background:col,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0}}>{s.agent.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{s.agent.nom}</div>
                  <div style={{fontSize:11,color:"var(--g400)"}}>{s.totalActions+" actions · "+s.semainesActives+"/"+SEMAINES+" sem. objectif"}{s.streak>1?" · 🔥 "+s.streak+" sem.":""}</div>
                </div>
                <div style={{fontWeight:900,fontSize:18,color:col}}>{s.totalActions}</div>
              </div>
              {/* Barre progression */}
              <div style={{background:"var(--g100)",borderRadius:4,height:6,overflow:"hidden"}}>
                <div style={{background:col,height:"100%",width:pct+"%",borderRadius:4,transition:"width .3s"}}/>
              </div>
              {/* Détail semaines si focus */}
              {agentFocus===s.agent.id && (
                <div style={{display:"flex",gap:4,marginTop:10,overflowX:"auto",paddingBottom:2}}>
                  {s.parSem.map(function(w, wi) {
                    var ok = w.nb >= objectifSemaine;
                    return (
                      <div key={wi} style={{flexShrink:0,textAlign:"center",minWidth:48}}>
                        <div style={{fontWeight:800,fontSize:15,color:ok?"var(--green)":"var(--g400)"}}>{w.nb}</div>
                        <div style={{height:3,background:ok?"var(--green)":"var(--g200)",borderRadius:2,margin:"3px 0"}}/>
                        <div style={{fontSize:9,color:"var(--g400)"}}>{semaines[wi].label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {statsAgents.length === 0 && (
          <div style={{padding:30,textAlign:"center",color:"var(--g400)"}}>
            <div style={{fontSize:32,marginBottom:8}}>{"🚶"}</div>
            <div style={{fontWeight:700}}>{"Aucune action de prospection enregistrée"}</div>
            <div style={{fontSize:12,marginTop:4}}>{"Les agents peuvent saisir leurs actions depuis l'onglet Prospection"}</div>
          </div>
        )}
      </div>

      {/* ─── CHALLENGES PERSONNALISÉS ─── */}
      <ChallengesCustom />
    </div>
  );
}
