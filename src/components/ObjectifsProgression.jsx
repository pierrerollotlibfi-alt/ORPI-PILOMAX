import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, avatarColor } from "./Shared";

var MOIS_COURTS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
var NOW   = new Date();
var ANNEE = NOW.getFullYear();
var MOIS_EN_COURS = NOW.getMonth();

function inMonth(d, y, m) {
  if (!d) return false;
  var dt = new Date(d);
  return dt.getFullYear()===y && dt.getMonth()===m;
}
function caDate(m) {
  return m.statut==="vendu" ? (m.dateSignature||m.dateMandat) : null;
}

var COULEURS = ["#E63946","#F59E0B","#3B82F6","#10B981","#8B5CF6","#06B6D4","#F97316","#84CC16"];

export default function ObjectifsProgression() {
  var ctx      = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var agents   = ctx.users.filter(function(u){return u.role==="agent"&&u.agenceId===agenceId&&u.actif;});
  var mandats  = ctx.mandats.filter(function(m){return m.agenceId===agenceId;});
  var objectifs= ctx.objectifs||[];
  var setObjectifs = ctx.setObjectifs;

  var [annee,     setAnnee]     = useState(ANNEE);
  var [agentFocus,setAgentFocus]= useState(null); // id agent pour vue détail
  var [editMode,  setEditMode]  = useState(false);
  var [drafts,    setDrafts]    = useState({}); // {agentId: montantHT}

  // ─── CA mensuel par agent ──────────────────────────────────────────────────
  var dataAgents = useMemo(function() {
    return agents.map(function(a, i) {
      var obj = objectifs.find(function(o){return o.agentId===a.id&&o.annee===annee;});
      var objAnnuel = obj ? (obj.montantHT||0) : 0;
      var objMensuel = objAnnuel > 0 ? Math.round(objAnnuel / 12) : 0;

      // CA par mois
      var caMois = MOIS_COURTS.map(function(_, m) {
        return mandats
          .filter(function(mn){ return mn.statut==="vendu" && mn.agentId===a.id && inMonth(caDate(mn), annee, m); })
          .reduce(function(s,mn){return s+(mn.commission||0);},0);
      });

      // Cumul progressif
      var cumul = [];
      var running = 0;
      caMois.forEach(function(v) { running += v; cumul.push(running); });

      // Objectif cumulé progressif (ligne droite)
      var cumulObj = MOIS_COURTS.map(function(_, m) { return objMensuel * (m+1); });

      var caAnnuel  = cumul[11] || cumul[MOIS_EN_COURS] || 0;
      var caMoisEC  = caMois[MOIS_EN_COURS] || 0;
      var pctAnnuel = objAnnuel > 0 ? Math.round(caAnnuel / objAnnuel * 100) : null;
      var pctMensuel= objMensuel > 0 ? Math.round(caMoisEC / objMensuel * 100) : null;
      var manquant  = Math.max(0, objAnnuel - caAnnuel);
      var nbVentes  = mandats.filter(function(mn){return mn.statut==="vendu"&&mn.agentId===a.id&&new Date(caDate(mn)||"").getFullYear()===annee;}).length;
      var couleur   = COULEURS[i % COULEURS.length];

      return { agent:a, objAnnuel, objMensuel, caMois, cumul, cumulObj, caAnnuel, caMoisEC, pctAnnuel, pctMensuel, manquant, nbVentes, couleur };
    });
  }, [agents, mandats, objectifs, annee]);

  // ─── SAISIE OBJECTIFS ─────────────────────────────────────────────────────
  function startEdit() {
    var d = {};
    agents.forEach(function(a) {
      var obj = objectifs.find(function(o){return o.agentId===a.id&&o.annee===annee;});
      d[a.id] = obj ? obj.montantHT : "";
    });
    setDrafts(d);
    setEditMode(true);
  }
  function saveObjectifs() {
    setObjectifs(function(prev) {
      var next = prev.filter(function(o){ return !(o.annee===annee && agents.some(function(a){return a.id===o.agentId;})); });
      agents.forEach(function(a) {
        var v = Number(drafts[a.id]||0);
        if (v > 0) next.push({ agentId:a.id, agenceId:agenceId, annee:annee, montantHT:v });
      });
      return next;
    });
    setEditMode(false);
  }

  // ─── GRAPHE SVG COURBE ────────────────────────────────────────────────────
  function Courbe({ data, width, height, showAll }) {
    var W = width  || 540;
    var H = height || 180;
    var PAD = { t:14, r:14, b:28, l:52 };
    var innerW = W - PAD.l - PAD.r;
    var innerH = H - PAD.t - PAD.b;

    // Données à afficher : agents focalisés ou tous
    var agentData = showAll ? dataAgents : dataAgents.filter(function(d){return d.agent.id===agentFocus;});
    if (agentData.length===0) agentData = dataAgents;

    // Max pour l'axe Y
    var maxVal = Math.max.apply(null,
      agentData.map(function(d){ return Math.max.apply(null, d.cumul.concat(d.cumulObj).concat([1])); })
    );

    function xPos(m) { return PAD.l + (m / 11) * innerW; }
    function yPos(v) { return PAD.t + innerH - (v / maxVal) * innerH; }

    // Points visibles : jusqu'au mois en cours pour l'année en cours
    var lastMois = annee < ANNEE ? 11 : annee > ANNEE ? -1 : MOIS_EN_COURS;

    function toPath(points) {
      return points.map(function(p,i){return (i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1);}).join(" ");
    }

    return (
      <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:H,display:"block"}}>
        {/* Grille */}
        {[0,25,50,75,100].map(function(pct) {
          var yy = PAD.t + innerH - (pct/100)*innerH;
          return (
            <g key={pct}>
              <line x1={PAD.l} y1={yy} x2={W-PAD.r} y2={yy} stroke="#F1F5F9" strokeWidth={1}/>
              <text x={PAD.l-6} y={yy+4} fontSize={8} fill="#94A3B8" textAnchor="end">{Math.round(maxVal*pct/100/1000)+"k"}</text>
            </g>
          );
        })}

        {/* Labels mois */}
        {MOIS_COURTS.map(function(m,i) {
          return <text key={i} x={xPos(i)} y={H-6} fontSize={8} fill="#94A3B8" textAnchor="middle">{m}</text>;
        })}

        {/* Ligne verticale mois en cours */}
        {annee===ANNEE && (
          <line x1={xPos(MOIS_EN_COURS)} y1={PAD.t} x2={xPos(MOIS_EN_COURS)} y2={H-PAD.b} stroke="#E63946" strokeWidth={1} strokeDasharray="3,3" opacity={0.5}/>
        )}

        {/* Courbes objectif (pointillés) */}
        {agentData.filter(function(d){return d.objAnnuel>0;}).map(function(d) {
          var pts = d.cumulObj.map(function(v,i){return [xPos(i), yPos(v)];});
          return <path key={"obj-"+d.agent.id} d={toPath(pts)} fill="none" stroke={d.couleur} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.4}/>;
        })}

        {/* Courbes réalisé (plein) */}
        {agentData.map(function(d) {
          var pts = d.cumul.slice(0, lastMois+1).map(function(v,i){return [xPos(i), yPos(v)];});
          if (pts.length===0) return null;
          return (
            <g key={"real-"+d.agent.id}>
              <path d={toPath(pts)} fill="none" stroke={d.couleur} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
              {/* Point terminal */}
              <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={4} fill={d.couleur} stroke="#fff" strokeWidth={1.5}/>
            </g>
          );
        })}
      </svg>
    );
  }

  // Agent focalisé pour vue détail
  var focusData = agentFocus ? dataAgents.find(function(d){return d.agent.id===agentFocus;}) : null;

  return (
    <div>

      {/* ── HEADER CONTRÔLES ── */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4}}>
          {[ANNEE-1, ANNEE, ANNEE+1].map(function(y) {
            return (
              <button key={y} onClick={function(){setAnnee(y);setAgentFocus(null);}} style={{padding:"7px 16px",borderRadius:7,border:"none",background:annee===y?"#fff":"transparent",color:annee===y?"var(--navy)":"var(--g400)",fontWeight:annee===y?800:600,fontSize:13,cursor:"pointer",boxShadow:annee===y?"0 1px 4px rgba(0,0,0,0.08)":"none",fontFamily:"var(--font)"}}>
                {y}
              </button>
            );
          })}
        </div>
        <div style={{flex:1}}></div>
        {editMode
          ? <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary" onClick={function(){setEditMode(false);}}>{"Annuler"}</button>
              <button className="btn btn-primary" onClick={saveObjectifs}>{"💾 Enregistrer les objectifs"}</button>
            </div>
          : <button className="btn btn-primary btn-sm" onClick={startEdit}>{"🎯 Saisir / modifier les objectifs "+annee}</button>
        }
      </div>

      {/* ── SAISIE OBJECTIFS (mode édition) ── */}
      {editMode && (
        <div style={{background:"#fff",borderRadius:12,border:"2px solid var(--red)",padding:"16px",marginBottom:16}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"🎯 Objectifs annuels "+annee+" — saisie en € HT"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
            {agents.map(function(a, i) {
              return (
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--g50)",borderRadius:10,border:"1px solid var(--g200)"}}>
                  <div style={{width:36,height:36,borderRadius:18,background:COULEURS[i%COULEURS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:13,flexShrink:0}}>{a.avatar}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12,color:"var(--navy)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nom}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input
                        type="number"
                        value={drafts[a.id]||""}
                        onChange={function(e){var v=e.target.value;setDrafts(function(p){return{...p,[a.id]:v};});}}
                        placeholder={"Ex : 40 000"}
                        className="form-input"
                        style={{width:"100%",textAlign:"right",fontSize:13}}
                      />
                      <span style={{fontSize:11,color:"var(--g400)",flexShrink:0}}>{"€"}</span>
                    </div>
                    {drafts[a.id]>0 && <div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{"→ "+fmt(Math.round(Number(drafts[a.id])/12))+"/mois"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:12,padding:"10px 14px",background:"#EFF6FF",borderRadius:10,fontSize:12,color:"#2563EB"}}>
            {"💡 Total objectif agence : "+fmt(agents.reduce(function(s,a){return s+Number(drafts[a.id]||0);},0))+" HT"}
          </div>
        </div>
      )}

      {/* ── COURBE GLOBALE TOUTE L'ÉQUIPE ── */}
      {!agentFocus && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"16px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📈 Progression cumulative — équipe "+annee}</span>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              {dataAgents.map(function(d) {
                return (
                  <button key={d.agent.id} onClick={function(){setAgentFocus(d.agent.id);}} style={{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>
                    <div style={{width:12,height:12,borderRadius:2,background:d.couleur,flexShrink:0}}></div>
                    <span style={{fontSize:11,fontWeight:600,color:"var(--navy)"}}>{d.agent.nom.split(" ")[0]}</span>
                  </button>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:18,height:2,borderTop:"2px dashed #94A3B8"}}></div>
                <span style={{fontSize:10,color:"#94A3B8"}}>{"Objectif"}</span>
              </div>
            </div>
          </div>
          <Courbe showAll/>
          <div style={{fontSize:10,color:"var(--g400)",marginTop:6,textAlign:"center"}}>{"Cliquez sur un nom pour voir le détail de l'agent"}</div>
        </div>
      )}

      {/* ── VUE DÉTAIL AGENT ── */}
      {agentFocus && focusData && (
        <div style={{background:"#fff",borderRadius:12,border:"2px solid "+focusData.couleur,padding:"16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <button onClick={function(){setAgentFocus(null);}} style={{background:"var(--g100)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,fontSize:12,color:"var(--navy)"}}>{"← Équipe"}</button>
            <div style={{width:40,height:40,borderRadius:20,background:focusData.couleur,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{focusData.agent.avatar}</div>
            <div>
              <div style={{fontWeight:900,fontSize:15,color:"var(--navy)"}}>{focusData.agent.nom}</div>
              <div style={{fontSize:11,color:"var(--g400)"}}>{focusData.agent.niveau+" · "+focusData.nbVentes+" vente(s) "+annee}</div>
            </div>
            <div style={{flex:1}}></div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:900,fontSize:18,color:focusData.couleur}}>{fmt(focusData.caAnnuel)}</div>
              <div style={{fontSize:11,color:"var(--g400)"}}>{"réalisé en "+annee}</div>
            </div>
          </div>

          {/* Courbe individuelle */}
          <Courbe/>

          {/* Tableau mensuel */}
          <div style={{marginTop:14,overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
              <thead>
                <tr style={{background:"var(--g50)"}}>
                  {["Mois","CA mois","Cumul réalisé","Objectif cumulé","Écart","Avancement"].map(function(h){
                    return <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:9,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,borderBottom:"1px solid var(--g100)"}}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {MOIS_COURTS.map(function(ml, i) {
                  var isFutur = annee===ANNEE && i > MOIS_EN_COURS;
                  var isCurr  = annee===ANNEE && i === MOIS_EN_COURS;
                  var caM     = focusData.caMois[i];
                  var cum     = focusData.cumul[i];
                  var objCum  = focusData.cumulObj[i];
                  var ecart   = focusData.objAnnuel > 0 ? cum - objCum : null;
                  var pct     = objCum > 0 ? Math.round(cum/objCum*100) : null;
                  return (
                    <tr key={i} style={{background:isCurr?"#FFF5F5":isFutur?"var(--g50)":"#fff",opacity:isFutur?0.45:1,borderBottom:"1px solid var(--g100)"}}>
                      <td style={{padding:"8px 10px",fontWeight:isCurr?900:600,color:isCurr?"var(--red)":"var(--navy)",fontSize:12}}>
                        {ml+" "+(annee%100)}{isCurr?" ◀":""}
                      </td>
                      <td style={{padding:"8px 10px",fontWeight:700,color:caM>0?focusData.couleur:"var(--g300)",fontSize:12}}>
                        {caM>0?fmt(caM):"—"}
                      </td>
                      <td style={{padding:"8px 10px",fontWeight:800,color:"var(--navy)",fontSize:12}}>
                        {isFutur?"—":fmt(cum)}
                      </td>
                      <td style={{padding:"8px 10px",color:"var(--g400)",fontSize:12}}>
                        {objCum>0?fmt(objCum):"—"}
                      </td>
                      <td style={{padding:"8px 10px",fontSize:12}}>
                        {!isFutur && ecart!==null
                          ? <span style={{fontWeight:800,color:ecart>=0?"var(--green)":"var(--red)"}}>{(ecart>=0?"+":"")+fmt(ecart)}</span>
                          : "—"}
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        {!isFutur && pct!==null
                          ? <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:80,height:6,background:"var(--g100)",borderRadius:3,overflow:"hidden"}}>
                                <div style={{height:"100%",width:Math.min(pct,100)+"%",background:pct>=100?"var(--green)":pct>=75?"var(--amber)":"var(--red)",borderRadius:3,transition:"width 0.4s"}}></div>
                              </div>
                              <span style={{fontSize:11,fontWeight:800,color:pct>=100?"var(--green)":pct>=75?"var(--amber)":"var(--red)"}}>{pct+"%"}</span>
                            </div>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:"var(--navy)"}}>
                  <td style={{padding:"10px",color:"#fff",fontWeight:900,fontSize:12}}>{"TOTAL "+annee}</td>
                  <td colSpan={1} style={{padding:"10px",color:"rgba(255,255,255,0.6)",fontSize:11}}>{focusData.nbVentes+" vente(s)"}</td>
                  <td style={{padding:"10px",color:"#fff",fontWeight:900,fontSize:13}}>{fmt(focusData.caAnnuel)}</td>
                  <td style={{padding:"10px",color:"rgba(255,255,255,0.6)",fontSize:11}}>{focusData.objAnnuel>0?fmt(focusData.objAnnuel):"—"}</td>
                  <td style={{padding:"10px"}}>
                    {focusData.objAnnuel>0
                      ? <span style={{fontWeight:800,color:focusData.caAnnuel>=focusData.objAnnuel?"#6EE7B7":"#FCA5A5",fontSize:12}}>{(focusData.caAnnuel>=focusData.objAnnuel?"+":"")+fmt(focusData.caAnnuel-focusData.objAnnuel)}</span>
                      : ""}
                  </td>
                  <td style={{padding:"10px"}}>
                    {focusData.pctAnnuel!==null && <span style={{fontWeight:900,color:"#fff",fontSize:13}}>{focusData.pctAnnuel+"%"}</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CARTES RÉSUMÉ AGENTS ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {dataAgents.map(function(d) {
          var isActive = agentFocus===d.agent.id;
          return (
            <div key={d.agent.id} onClick={function(){setAgentFocus(isActive?null:d.agent.id);}} style={{background:"#fff",borderRadius:12,border:"2px solid "+(isActive?d.couleur:"var(--g200)"),padding:"14px 16px",cursor:"pointer",transition:"border-color 0.15s"}}>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:38,height:38,borderRadius:19,background:d.couleur,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14,flexShrink:0}}>{d.agent.avatar}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:13,color:"var(--navy)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.agent.nom}</div>
                  <div style={{fontSize:11,color:"var(--g400)"}}>{d.nbVentes+" vente(s) · "+d.agent.niveau}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:900,fontSize:16,color:d.couleur}}>{fmt(d.caAnnuel)}</div>
                  <div style={{fontSize:10,color:"var(--g400)"}}>{annee}</div>
                </div>
              </div>

              {/* Mini graphe barres mensuelles */}
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:36,marginBottom:10}}>
                {d.caMois.map(function(v, i) {
                  var maxM = Math.max.apply(null, d.caMois.concat([1]));
                  var h    = Math.round(v/maxM*34);
                  var isCurr = annee===ANNEE && i===MOIS_EN_COURS;
                  var isFut  = annee===ANNEE && i>MOIS_EN_COURS;
                  return (
                    <div key={i} style={{flex:1,height:h||2,background:isCurr?d.couleur:isFut?"var(--g100)":"var(--g200)",borderRadius:"2px 2px 0 0",alignSelf:"flex-end",opacity:isFut?0.4:1}}></div>
                  );
                })}
              </div>

              {/* Objectif annuel */}
              {d.objAnnuel > 0
                ? <div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{color:"var(--g500)"}}>{"Objectif : "+fmt(d.objAnnuel)}</span>
                      <span style={{fontWeight:800,color:d.pctAnnuel>=100?"var(--green)":d.pctAnnuel>=75?"var(--amber)":"var(--red)"}}>{(d.pctAnnuel||0)+"%"}</span>
                    </div>
                    <div style={{height:7,background:"var(--g100)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:Math.min(d.pctAnnuel||0,100)+"%",background:d.pctAnnuel>=100?"var(--green)":d.pctAnnuel>=75?"var(--amber)":"var(--red)",borderRadius:4,transition:"width 0.5s"}}></div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:4,color:"var(--g400)"}}>
                      <span>{"Manquant : "+fmt(d.manquant)}</span>
                      <span>{"→ "+fmt(d.objMensuel)+"/mois"}</span>
                    </div>
                  </div>
                : <div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:"var(--g400)",fontStyle:"italic"}}>
                    {"Aucun objectif saisi"}
                    <button onClick={function(e){e.stopPropagation();startEdit();}} style={{marginLeft:8,background:"none",border:"none",color:"var(--red)",fontWeight:700,cursor:"pointer",fontSize:11,fontFamily:"var(--font)"}}>{"→ Saisir"}</button>
                  </div>
              }
            </div>
          );
        })}
      </div>

      {/* ── TOTAL AGENCE ── */}
      <div style={{background:"var(--navy)",borderRadius:12,padding:"16px 20px",marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{"Total agence "+annee}</div>
          <div style={{color:"#fff",fontWeight:900,fontSize:22}}>{fmt(dataAgents.reduce(function(s,d){return s+d.caAnnuel;},0))}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{"Objectif total agence"}</div>
          <div style={{color:"rgba(255,255,255,0.8)",fontWeight:900,fontSize:18}}>{fmt(dataAgents.reduce(function(s,d){return s+d.objAnnuel;},0))}</div>
        </div>
        {(function() {
          var total = dataAgents.reduce(function(s,d){return s+d.caAnnuel;},0);
          var obj   = dataAgents.reduce(function(s,d){return s+d.objAnnuel;},0);
          var pct   = obj > 0 ? Math.round(total/obj*100) : null;
          return pct !== null ? (
            <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
              <div style={{color:"#fff",fontWeight:900,fontSize:24}}>{pct+"%"}</div>
              <div style={{color:"rgba(255,255,255,0.5)",fontSize:10}}>{"atteint"}</div>
            </div>
          ) : null;
        })()}
      </div>

    </div>
  );
}
