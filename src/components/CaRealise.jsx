import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, avatarColor } from "./Shared";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
var NOW   = new Date();
var YEAR  = NOW.getFullYear();
var MONTH = NOW.getMonth(); // 0-indexed

var MOIS_LABELS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function dateToYM(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function inYear(dateStr, year) {
  if (!dateStr) return false;
  return new Date(dateStr).getFullYear() === year;
}

function inMonth(dateStr, year, month) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

// CA d'une vente = dateSignature si vendu, dateSignature si date connue
function getMandatCaDate(m) {
  if (m.statut === "vendu") return m.dateSignature || m.dateMandat;
  return null;
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function CaRealise() {
  var ctx       = useApp();
  var agenceId  = ctx.currentUser.agenceId;
  var agents    = ctx.users.filter(function(u){ return u.role==="agent" && u.agenceId===agenceId; });
  var mandats   = ctx.mandats.filter(function(m){ return m.agenceId===agenceId; });
  var locations = ctx.locations.filter(function(l){ return l.agenceId===agenceId; });
  var gestion   = ctx.gestion.filter(function(g){ return g.agenceId===agenceId && g.actif; });
  var objectifs = ctx.objectifs ? ctx.objectifs.filter(function(o){ return o.agenceId===agenceId; }) : [];

  var [annee,    setAnnee]    = useState(YEAR);
  var [tabView,  setTabView]  = useState("apercu"); // apercu | mensuel | agents
  var [agentFil, setAgentFil] = useState("");

  // ─── CA VENTES ──────────────────────────────────────────────────────────────
  var ventesAnnee = mandats.filter(function(m){
    return m.statut==="vendu" && inYear(getMandatCaDate(m), annee);
  });
  var ventesN1 = mandats.filter(function(m){
    return m.statut==="vendu" && inYear(getMandatCaDate(m), annee-1);
  });

  // CA par mois pour l'année
  var caVentesParMois = MOIS_LABELS.map(function(_, i){
    return mandats.filter(function(m){
      return m.statut==="vendu" && inMonth(getMandatCaDate(m), annee, i);
    }).reduce(function(s,m){ return s + (m.commission||0); }, 0);
  });
  var caVentesParMoisN1 = MOIS_LABELS.map(function(_, i){
    return mandats.filter(function(m){
      return m.statut==="vendu" && inMonth(getMandatCaDate(m), annee-1, i);
    }).reduce(function(s,m){ return s + (m.commission||0); }, 0);
  });

  // ─── CA LOCATIONS ───────────────────────────────────────────────────────────
  var locsAnnee = locations.filter(function(l){
    return l.locataireTrouve && inYear(l.dateSignature, annee);
  });
  var locsN1 = locations.filter(function(l){
    return l.locataireTrouve && inYear(l.dateSignature, annee-1);
  });
  var caLocsParMois = MOIS_LABELS.map(function(_, i){
    return locations.filter(function(l){
      return l.locataireTrouve && inMonth(l.dateSignature, annee, i);
    }).reduce(function(s,l){ return s + (l.commission||0); }, 0);
  });

  // ─── CA GESTION ─────────────────────────────────────────────────────────────
  // Gestion = commission mensuelle × mois actifs dans l'année
  var caGestionAnnuel = gestion.reduce(function(s, g) {
    var debut = g.dateDebutGestion ? new Date(g.dateDebutGestion) : new Date(annee, 0, 1);
    var debutAnnee = new Date(annee, 0, 1);
    var finAnnee   = new Date(annee, 11, 31);
    var from = debut > debutAnnee ? debut : debutAnnee;
    var to   = finAnnee;
    if (from > to) return s;
    var mois = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    return s + (g.commissionMensuelle||0) * Math.min(mois, 12);
  }, 0);
  var caGestionParMois = MOIS_LABELS.map(function(_, i) {
    return gestion.reduce(function(s, g) {
      var debut = g.dateDebutGestion ? new Date(g.dateDebutGestion) : new Date(annee, 0, 1);
      var moisDate = new Date(annee, i, 1);
      return debut <= moisDate ? s + (g.commissionMensuelle||0) : s;
    }, 0);
  });

  // ─── TOTAUX ─────────────────────────────────────────────────────────────────
  var caVentesTotal  = ventesAnnee.reduce(function(s,m){ return s+(m.commission||0); }, 0);
  var caVentesN1Tot  = ventesN1.reduce(function(s,m){ return s+(m.commission||0); }, 0);
  var caLocsTotal    = locsAnnee.reduce(function(s,l){ return s+(l.commission||0); }, 0);
  var caLocsN1Tot    = locsN1.reduce(function(s,l){ return s+(l.commission||0); }, 0);
  var caTotal        = caVentesTotal + caLocsTotal + caGestionAnnuel;
  var caTotalN1      = caVentesN1Tot + caLocsN1Tot + caGestionAnnuel; // approximation N-1

  var objAnnuel = objectifs.reduce(function(s,o){ return o.annee===annee ? s+(o.montantHT||0) : s; }, 0);
  var pctObj    = objAnnuel > 0 ? Math.round(caVentesTotal / objAnnuel * 100) : null;

  // Mois en cours
  var caMoisActuel = caVentesParMois[MONTH] + caLocsParMois[MONTH] + caGestionParMois[MONTH];
  var caMoisPrec   = MONTH > 0
    ? caVentesParMois[MONTH-1] + caLocsParMois[MONTH-1] + caGestionParMois[MONTH-1]
    : caVentesParMoisN1[11] + caLocsParMois[11] + caGestionParMois[11];

  var evoMois = caMoisPrec > 0 ? Math.round((caMoisActuel - caMoisPrec) / caMoisPrec * 100) : null;
  var evoAnnee= caTotalN1  > 0 ? Math.round((caTotal       - caTotalN1)  / caTotalN1  * 100) : null;

  // ─── CA PAR AGENT ───────────────────────────────────────────────────────────
  var caParAgent = agents.map(function(a) {
    var ventes = mandats.filter(function(m){
      return m.statut==="vendu" && m.agentId===a.id && inYear(getMandatCaDate(m), annee);
    });
    var locs = locations.filter(function(l){
      return l.locataireTrouve && l.agentId===a.id && inYear(l.dateSignature, annee);
    });
    var gest = gestion.filter(function(g){ return g.agentId===a.id; });
    var caV = ventes.reduce(function(s,m){ return s+(m.commission||0); }, 0);
    var caL = locs.reduce(function(s,l){ return s+(l.commission||0); }, 0);
    var caG = gest.reduce(function(s,g){ return s+(g.commissionMensuelle||0)*12; }, 0);
    var obj = objectifs.find(function(o){ return o.agentId===a.id && o.annee===annee; });
    var pct = obj && obj.montantHT > 0 ? Math.round(caV/obj.montantHT*100) : null;
    return { agent:a, caVentes:caV, caLocs:caL, caGestion:caG, caTotal:caV+caL+caG, nbVentes:ventes.length, nbLocs:locs.length, objectif:obj?obj.montantHT:0, pctObj:pct };
  }).sort(function(a,b){ return b.caTotal - a.caTotal; });

  // ─── DONNÉES GRAPHE ─────────────────────────────────────────────────────────
  var maxGraphe = Math.max.apply(null,
    MOIS_LABELS.map(function(_,i){ return caVentesParMois[i]+caLocsParMois[i]+caGestionParMois[i]; }).concat([1])
  );

  // ─── TABS ────────────────────────────────────────────────────────────────────
  var tabs = [
    { id:"apercu",  label:"📊 Aperçu" },
    { id:"mensuel", label:"📅 Mensuel" },
    { id:"agents",  label:"👥 Par agent" },
  ];

  return (
    <div>
      {/* Header sélecteur année */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4}}>
          {[YEAR-1, YEAR, YEAR+1].map(function(y) {
            return (
              <button key={y} onClick={function(){setAnnee(y);}} style={{padding:"6px 16px",borderRadius:7,border:"none",background:annee===y?"#fff":"transparent",color:annee===y?"var(--navy)":"var(--g400)",fontWeight:annee===y?800:600,fontSize:13,cursor:"pointer",boxShadow:annee===y?"0 1px 4px rgba(0,0,0,0.08)":"none",fontFamily:"var(--font)"}}>
                {y}
              </button>
            );
          })}
        </div>
        {pctObj !== null && (
          <div style={{background:pctObj>=100?"#F0FDF4":pctObj>=75?"#FFFBEB":"#FEF2F2",border:"1px solid "+(pctObj>=100?"#A7F3D0":pctObj>=75?"#FDE68A":"#FECACA"),borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800,color:pctObj>=100?"#059669":pctObj>=75?"#D97706":"#DC2626"}}>
            {"🎯 "+pctObj+"% de l'objectif annuel"}
          </div>
        )}
        <div style={{flex:1}}></div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4,marginBottom:16}}>
        {tabs.map(function(t) {
          return (
            <button key={t.id} onClick={function(){setTabView(t.id);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:tabView===t.id?"#fff":"transparent",color:tabView===t.id?"var(--navy)":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font)",boxShadow:tabView===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ────────────────── APERÇU ────────────────── */}
      {tabView==="apercu" && (
        <div>
          {/* KPIs globaux */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            <KpiBlock label="CA Ventes HT" value={caVentesTotal} prevValue={caVentesN1Tot} icon="🏆" color="var(--red)" sub={ventesAnnee.length+" vente(s) actée(s)"}/>
            <KpiBlock label="CA Locations HT" value={caLocsTotal} prevValue={caLocsN1Tot} icon="🏠" color="var(--blue)" sub={locsAnnee.length+" location(s) signée(s)"}/>
            <KpiBlock label="CA Gestion HT" value={caGestionAnnuel} prevValue={null} icon="🔑" color="var(--purple)" sub={gestion.length+" biens · "+(Math.round(caGestionAnnuel/12))+"€/mois"}/>
            <KpiBlock label={"CA Total HT "+annee} value={caTotal} prevValue={caTotalN1} icon="💎" color="var(--green)" highlight sub={"vs "+(annee-1)+" : "+fmt(caTotalN1)}/>
          </div>

          {/* Mois en cours */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{MOIS_LABELS[MONTH]+" "+annee+" — Mois en cours"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                ["Ventes", caVentesParMois[MONTH], "var(--red)"],
                ["Locations", caLocsParMois[MONTH], "var(--blue)"],
                ["Gestion", caGestionParMois[MONTH], "var(--purple)"],
              ].map(function(row) {
                return (
                  <div key={row[0]} style={{background:"var(--g50)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                    <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{row[0]}</div>
                    <div style={{fontSize:18,fontWeight:900,color:row[2]}}>{fmt(row[1])}</div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:15}}>{"Total mois : "+fmt(caMoisActuel)}</span>
              {evoMois!==null && <EvoTag pct={evoMois} label={"vs "+MOIS_LABELS[MONTH>0?MONTH-1:11]}/>}
            </div>
          </div>

          {/* Répartition visuelle */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"Répartition CA "+annee}</div>
            {caTotal===0 ? (
              <div style={{textAlign:"center",color:"var(--g400)",fontSize:13,padding:"20px 0"}}>{"Aucune donnée pour cette année"}</div>
            ) : (
              <div>
                {[
                  {label:"Ventes", val:caVentesTotal, color:"var(--red)"},
                  {label:"Locations", val:caLocsTotal, color:"var(--blue)"},
                  {label:"Gestion", val:caGestionAnnuel, color:"var(--purple)"},
                ].map(function(row) {
                  var pct = caTotal > 0 ? Math.round(row.val/caTotal*100) : 0;
                  return (
                    <div key={row.label} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:"var(--navy)"}}>{row.label}</span>
                        <span style={{fontSize:12,fontWeight:800,color:row.color}}>{fmt(row.val)+" · "+pct+"%"}</span>
                      </div>
                      <div style={{height:8,background:"var(--g100)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:pct+"%",background:row.color,borderRadius:4,transition:"width 0.5s"}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Objectif annuel */}
          {objAnnuel > 0 && (
            <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px 16px"}}>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"🎯 Objectif ventes "+annee}</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:13,color:"var(--g500)"}}>{"Réalisé : "+fmt(caVentesTotal)}</span>
                <span style={{fontSize:13,fontWeight:800,color:"var(--navy)"}}>{"Objectif : "+fmt(objAnnuel)}</span>
              </div>
              <div style={{height:12,background:"var(--g100)",borderRadius:6,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:Math.min(pctObj||0,100)+"%",background:pctObj>=100?"var(--green)":pctObj>=75?"var(--amber)":"var(--red)",borderRadius:6,transition:"width 0.5s"}}></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"var(--g400)"}}>{"Manquant : "+fmt(Math.max(0, objAnnuel-caVentesTotal))}</span>
                <span style={{fontWeight:800,color:pctObj>=100?"var(--green)":pctObj>=75?"var(--amber)":"var(--red)"}}>{(pctObj||0)+"%"}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── MENSUEL ────────────────── */}
      {tabView==="mensuel" && (
        <div>
          {/* Graphe barres */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"CA mensuel "+annee+" vs "+(annee-1)}</span>
              <div style={{display:"flex",gap:12,fontSize:10,color:"var(--g400)"}}>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--navy)",borderRadius:2,display:"inline-block"}}></span>{annee}</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--g200)",borderRadius:2,display:"inline-block"}}></span>{annee-1}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:110}}>
              {MOIS_LABELS.map(function(label, i) {
                var valN  = caVentesParMois[i] + caLocsParMois[i] + caGestionParMois[i];
                var valN1 = caVentesParMoisN1[i];
                var hN  = maxGraphe > 0 ? Math.round(valN  / maxGraphe * 95) : 0;
                var hN1 = maxGraphe > 0 ? Math.round(valN1 / maxGraphe * 95) : 0;
                var isCurr = i === MONTH && annee === YEAR;
                return (
                  <div key={label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:98}}>
                      <div style={{flex:1,height:hN1||1,background:"var(--g200)",borderRadius:"2px 2px 0 0",alignSelf:"flex-end"}}></div>
                      <div style={{flex:1,height:hN||1,background:isCurr?"var(--red)":"var(--navy)",borderRadius:"2px 2px 0 0",alignSelf:"flex-end",opacity:isCurr?1:0.8}}></div>
                    </div>
                    <span style={{fontSize:8,color:isCurr?"var(--red)":"var(--g400)",fontWeight:isCurr?800:600}}>{label}</span>
                    {valN>0 && <span style={{fontSize:8,color:"var(--g500)"}}>{Math.round(valN/1000)+"k"}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tableau mensuel */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
                <thead>
                  <tr style={{background:"var(--g50)"}}>
                    {["Mois","Ventes","Locations","Gestion","Total","vs N-1"].map(function(h){
                      return <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--g400)",fontWeight:700,letterSpacing:.7,textTransform:"uppercase",borderBottom:"1px solid var(--g100)"}}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {MOIS_LABELS.map(function(label, i) {
                    var v  = caVentesParMois[i];
                    var l  = caLocsParMois[i];
                    var g  = caGestionParMois[i];
                    var tot= v + l + g;
                    var n1 = caVentesParMoisN1[i];
                    var evo= n1>0 ? Math.round((v-n1)/n1*100) : null;
                    var isCurr = i===MONTH && annee===YEAR;
                    var isFut  = annee===YEAR && i>MONTH;
                    return (
                      <tr key={label} style={{background:isCurr?"#FFF5F5":isFut?"var(--g50)":"#fff",opacity:isFut?0.5:1}}>
                        <td style={{padding:"9px 12px",fontWeight:isCurr?800:600,color:isCurr?"var(--red)":"var(--navy)",fontSize:12,borderBottom:"1px solid var(--g100)"}}>{label+(isCurr?" ★":"")}</td>
                        <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:"var(--red)",borderBottom:"1px solid var(--g100)"}}>{v>0?fmt(v):"—"}</td>
                        <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:"var(--blue)",borderBottom:"1px solid var(--g100)"}}>{l>0?fmt(l):"—"}</td>
                        <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:"var(--purple)",borderBottom:"1px solid var(--g100)"}}>{g>0?fmt(g):"—"}</td>
                        <td style={{padding:"9px 12px",fontSize:13,fontWeight:900,color:"var(--navy)",borderBottom:"1px solid var(--g100)"}}>{tot>0?fmt(tot):"—"}</td>
                        <td style={{padding:"9px 12px",borderBottom:"1px solid var(--g100)"}}>{evo!==null?<EvoTag pct={evo}/>:"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"var(--navy)"}}>
                    <td style={{padding:"10px 12px",fontWeight:900,color:"#fff",fontSize:12}}>{"TOTAL "+annee}</td>
                    <td style={{padding:"10px 12px",fontWeight:900,color:"#FCA5A5",fontSize:12}}>{fmt(caVentesTotal)}</td>
                    <td style={{padding:"10px 12px",fontWeight:900,color:"#93C5FD",fontSize:12}}>{fmt(caLocsTotal)}</td>
                    <td style={{padding:"10px 12px",fontWeight:900,color:"#C4B5FD",fontSize:12}}>{fmt(caGestionAnnuel)}</td>
                    <td style={{padding:"10px 12px",fontWeight:900,color:"#fff",fontSize:14}}>{fmt(caTotal)}</td>
                    <td style={{padding:"10px 12px"}}>{evoAnnee!==null?<EvoTag pct={evoAnnee} light/>:""}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── PAR AGENT ────────────────── */}
      {tabView==="agents" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
            <select className="form-select" style={{width:"auto"}} value={agentFil} onChange={function(e){setAgentFil(e.target.value);}}>
              <option value="">{"Tous les agents"}</option>
              {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
            </select>
            <span style={{fontSize:12,color:"var(--g400)"}}>{"CA total agence "+annee+" : "}<strong>{fmt(caTotal)}</strong></span>
          </div>

          {caParAgent.filter(function(r){ return !agentFil || r.agent.id===agentFil; }).map(function(r, i) {
            var col = ["var(--red)","var(--amber)","var(--blue)","var(--green)","var(--purple)"][i] || "var(--g400)";
            var pctAgence = caTotal > 0 ? Math.round(r.caTotal/caTotal*100) : 0;
            return (
              <div key={r.agent.id} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px 16px",marginBottom:12,borderLeft:"4px solid "+col}}>
                {/* Header agent */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div style={{width:42,height:42,borderRadius:21,background:col,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{r.agent.avatar}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:15,color:"var(--navy)"}}>{r.agent.nom}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{r.nbVentes+" vente(s) · "+r.nbLocs+" location(s)"}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontWeight:900,fontSize:17,color:col}}>{fmt(r.caTotal)}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{pctAgence+"% du CA agence"}</div>
                  </div>
                </div>

                {/* Détail par type */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {[
                    {label:"Ventes",    val:r.caVentes,  color:"var(--red)"},
                    {label:"Locations", val:r.caLocs,    color:"var(--blue)"},
                    {label:"Gestion",   val:r.caGestion, color:"var(--purple)"},
                  ].map(function(cell) {
                    return (
                      <div key={cell.label} style={{background:"var(--g50)",borderRadius:9,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:3}}>{cell.label}</div>
                        <div style={{fontSize:14,fontWeight:900,color:cell.val>0?cell.color:"var(--g300)"}}>{cell.val>0?fmt(cell.val):"—"}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Objectif */}
                {r.objectif > 0 && (
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                      <span style={{color:"var(--g500)"}}>{"Objectif : "+fmt(r.objectif)}</span>
                      <span style={{fontWeight:800,color:r.pctObj>=100?"var(--green)":r.pctObj>=75?"var(--amber)":"var(--red)"}}>{(r.pctObj||0)+"%"}</span>
                    </div>
                    <div style={{height:7,background:"var(--g100)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:Math.min(r.pctObj||0,100)+"%",background:r.pctObj>=100?"var(--green)":r.pctObj>=75?"var(--amber)":"var(--red)",borderRadius:4}}></div>
                    </div>
                  </div>
                )}

                {/* Contribution barre */}
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:3}}>{"Contribution agence"}</div>
                  <div style={{height:5,background:"var(--g100)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pctAgence+"%",background:col,borderRadius:3}}></div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ligne total */}
          <div style={{background:"var(--navy)",borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:13}}>{"Total agence "+annee}</span>
            <span style={{color:"#fff",fontWeight:900,fontSize:18}}>{fmt(caTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────
function KpiBlock({ label, value, prevValue, icon, color, sub, highlight }) {
  var evo = prevValue && prevValue>0 ? Math.round((value-prevValue)/prevValue*100) : null;
  return (
    <div style={{background:"#fff",borderRadius:12,padding:"14px 16px",border:"1px solid var(--g200)",borderLeft:"4px solid "+color}}>
      <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{icon+" "+label}</div>
      <div style={{fontSize:highlight?22:18,fontWeight:900,color:color,marginBottom:4}}>{fmt(value)}</div>
      {sub && <div style={{fontSize:11,color:"var(--g400)"}}>{sub}</div>}
      {evo!==null && <div style={{marginTop:6}}><EvoTag pct={evo} label={"vs "+(new Date().getFullYear()-1)}/></div>}
    </div>
  );
}

function EvoTag({ pct, label, light }) {
  var pos = pct >= 0;
  return (
    <span style={{background:light?(pos?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.1)"):(pos?"#F0FDF4":"#FEF2F2"),color:light?"#fff":(pos?"#059669":"#DC2626"),padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:800,display:"inline-flex",alignItems:"center",gap:3}}>
      {(pos?"▲":"▼")+" "+(pct>0?"+":"")+pct+"%"+(label?" "+label:"")}
    </span>
  );
}
