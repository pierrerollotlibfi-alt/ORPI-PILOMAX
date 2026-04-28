import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, avatarColor } from "./Shared";

var MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
var MOIS_COURTS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
var NOW   = new Date();
var ANNEE = NOW.getFullYear();
var MOIS_ACTUEL = NOW.getMonth();

function inMonth(d, y, m) {
  if (!d) return false;
  var dt = new Date(d);
  return dt.getFullYear()===y && dt.getMonth()===m;
}
function caDateMandat(m) {
  return m.statut==="vendu" ? (m.dateSignature||m.dateMandat) : null;
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function RapportMensuel() {
  var ctx      = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var agences  = ctx.agences || [];
  var agence   = agences.find(function(a){return a.id===agenceId;}) || {};
  var users    = ctx.users;
  var agents   = users.filter(function(u){return u.role==="agent"&&u.agenceId===agenceId;});
  var mandats  = ctx.mandats.filter(function(m){return m.agenceId===agenceId;});
  var locations= ctx.locations.filter(function(l){return l.agenceId===agenceId;});
  var gestion  = ctx.gestion.filter(function(g){return g.agenceId===agenceId&&g.actif;});
  var objectifs= (ctx.objectifs||[]).filter(function(o){return o.agenceId===agenceId;});

  var [mois,  setMois]  = useState(MOIS_ACTUEL > 0 ? MOIS_ACTUEL - 1 : 11);
  var [annee, setAnnee] = useState(MOIS_ACTUEL > 0 ? ANNEE : ANNEE - 1);

  // Année N-1
  var anneeN1 = annee - 1;
  // Mois précédent
  var moisPrec  = mois > 0 ? mois - 1 : 11;
  var anneePrec = mois > 0 ? annee : annee - 1;

  // ─── CALCULS ───────────────────────────────────────────────────────────────
  var data = useMemo(function() {
    // Ventes mois N
    var ventesN = mandats.filter(function(m){ return m.statut==="vendu" && inMonth(caDateMandat(m), annee, mois); });
    var caVentesN = ventesN.reduce(function(s,m){return s+(m.commission||0);},0);
    // Ventes mois N-1 (même mois année précédente)
    var ventesN1 = mandats.filter(function(m){ return m.statut==="vendu" && inMonth(caDateMandat(m), anneeN1, mois); });
    var caVentesN1 = ventesN1.reduce(function(s,m){return s+(m.commission||0);},0);
    // Ventes mois précédent
    var ventesMP = mandats.filter(function(m){ return m.statut==="vendu" && inMonth(caDateMandat(m), anneePrec, moisPrec); });
    var caVentesMP = ventesMP.reduce(function(s,m){return s+(m.commission||0);},0);

    // Locations mois N
    var locsN = locations.filter(function(l){ return l.locataireTrouve && inMonth(l.dateSignature, annee, mois); });
    var caLocsN = locsN.reduce(function(s,l){return s+(l.commission||0);},0);
    var locsN1  = locations.filter(function(l){ return l.locataireTrouve && inMonth(l.dateSignature, anneeN1, mois); });
    var caLocsN1= locsN1.reduce(function(s,l){return s+(l.commission||0);},0);
    var locsMP  = locations.filter(function(l){ return l.locataireTrouve && inMonth(l.dateSignature, anneePrec, moisPrec); });
    var caLocsMP= locsMP.reduce(function(s,l){return s+(l.commission||0);},0);

    // Gestion mois N (commission mensuelle × biens actifs ce mois)
    var caGestN = gestion.reduce(function(s,g){ return s+(g.commissionMensuelle||0); },0);

    // Totaux
    var totalN  = caVentesN  + caLocsN  + caGestN;
    var totalN1 = caVentesN1 + caLocsN1 + caGestN;
    var totalMP = caVentesMP + caLocsMP + caGestN;

    // Mandats actifs fin de mois
    var mandatsActifs = mandats.filter(function(m){return m.statut==="mandat";});
    var mandatsActifsN1 = mandatsActifs.length; // approximation
    var nbCompromis = mandats.filter(function(m){return m.statut==="compromis";}).length;
    var nbExclusifs = mandatsActifs.filter(function(m){return m.typeMandat==="exclusif";}).length;
    var txExclusifs = mandatsActifs.length > 0 ? Math.round(nbExclusifs/mandatsActifs.length*100) : 0;

    // Graphe 6 derniers mois
    var graphe6 = [];
    for (var i=5; i>=0; i--) {
      var gMois  = ((mois - i) % 12 + 12) % 12;
      var gAnnee = mois - i < 0 ? annee - 1 : annee;
      var gV  = mandats.filter(function(m){ return m.statut==="vendu" && inMonth(caDateMandat(m), gAnnee, gMois); }).reduce(function(s,m){return s+(m.commission||0);},0);
      var gL  = locations.filter(function(l){ return l.locataireTrouve && inMonth(l.dateSignature, gAnnee, gMois); }).reduce(function(s,l){return s+(l.commission||0);},0);
      var gG  = caGestN;
      var gVn1= mandats.filter(function(m){ return m.statut==="vendu" && inMonth(caDateMandat(m), gAnnee-1, gMois); }).reduce(function(s,m){return s+(m.commission||0);},0);
      graphe6.push({ label:MOIS_COURTS[gMois]+" "+(gAnnee%100), ventes:gV, locs:gL, gestion:gG, n1:gVn1+gL+gG, total:gV+gL+gG });
    }

    // Par agent
    var parAgent = agents.map(function(a) {
      var aVentesN  = mandats.filter(function(m){return m.statut==="vendu"&&m.agentId===a.id&&inMonth(caDateMandat(m),annee,mois);});
      var aVentesN1 = mandats.filter(function(m){return m.statut==="vendu"&&m.agentId===a.id&&inMonth(caDateMandat(m),anneeN1,mois);});
      var aVentesMP = mandats.filter(function(m){return m.statut==="vendu"&&m.agentId===a.id&&inMonth(caDateMandat(m),anneePrec,moisPrec);});
      var aLocsN    = locations.filter(function(l){return l.locataireTrouve&&l.agentId===a.id&&inMonth(l.dateSignature,annee,mois);});
      var aMandatsA = mandats.filter(function(m){return m.statut==="mandat"&&m.agentId===a.id;});
      var caV  = aVentesN.reduce(function(s,m){return s+(m.commission||0);},0);
      var caVn1= aVentesN1.reduce(function(s,m){return s+(m.commission||0);},0);
      var caVmp= aVentesMP.reduce(function(s,m){return s+(m.commission||0);},0);
      var caL  = aLocsN.reduce(function(s,l){return s+(l.commission||0);},0);
      var obj  = objectifs.find(function(o){return o.agentId===a.id&&o.annee===annee;});
      var objMensuel = obj ? Math.round(obj.montantHT/12) : 0;
      var pctObj = objMensuel>0 ? Math.round(caV/objMensuel*100) : null;
      var evoN1  = caVn1>0 ? Math.round((caV-caVn1)/caVn1*100) : null;
      var evoMP  = caVmp>0 ? Math.round((caV-caVmp)/caVmp*100) : null;
      return {
        agent:a, caVentes:caV, caVentesN1:caVn1, caVentesMP:caVmp,
        caLocs:caL, caTotal:caV+caL,
        nbVentes:aVentesN.length, nbLocs:aLocsN.length,
        nbMandatsActifs:aMandatsA.length,
        objMensuel, pctObj, evoN1, evoMP
      };
    }).sort(function(a,b){return b.caTotal-a.caTotal;});

    return {
      ventesN, caVentesN, caVentesN1, caVentesMP,
      locsN, caLocsN, caLocsN1, caLocsMP, caGestN,
      totalN, totalN1, totalMP,
      nbVentesN:ventesN.length, nbVentesN1:ventesN1.length,
      nbLocsN:locsN.length, nbLocsN1:locsN1.length,
      mandatsActifs, nbCompromis, nbExclusifs, txExclusifs,
      graphe6, parAgent
    };
  }, [mandats, locations, gestion, agents, objectifs, mois, annee]);

  function evo(n, ref) { return ref>0 ? Math.round((n-ref)/ref*100) : null; }

  // ─── IMPRESSION ────────────────────────────────────────────────────────────
  function imprimer() {
    var el = document.getElementById("rapport-print");
    var win = window.open("","_blank","width=900,height=700");
    win.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>Rapport "+MOIS[mois]+" "+annee+"</title><style>");
    win.document.write(PRINT_CSS);
    win.document.write("</style></head><body>");
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    setTimeout(function(){win.print();},400);
  }

  var maxGraphe = Math.max.apply(null, data.graphe6.map(function(g){return Math.max(g.total,g.n1,1);}));

  return (
    <div>
      {/* Contrôles */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select className="form-select" style={{width:"auto"}} value={mois} onChange={function(e){setMois(Number(e.target.value));}}>
          {MOIS.map(function(m,i){return <option key={i} value={i}>{m}</option>;})}
        </select>
        <select className="form-select" style={{width:"auto"}} value={annee} onChange={function(e){setAnnee(Number(e.target.value));}}>
          {[ANNEE-1,ANNEE,ANNEE+1].map(function(y){return <option key={y} value={y}>{y}</option>;})}
        </select>
        <div style={{flex:1}}></div>
        <button className="btn btn-primary" onClick={imprimer} style={{display:"flex",alignItems:"center",gap:8}}>
          {"🖨️ Imprimer / Exporter PDF"}
        </button>
      </div>

      {/* RAPPORT */}
      <div id="rapport-print">

        {/* ── EN-TÊTE ── */}
        <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"24px 28px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{"Rapport mensuel d'activité"}</div>
            <div style={{color:"#fff",fontWeight:900,fontSize:22}}>{MOIS[mois]+" "+annee}</div>
            <div style={{color:"rgba(255,255,255,0.6)",fontSize:13,marginTop:4}}>{agence.nom||"ORPI Pro Amiens"+" · "+(agence.ville||"Amiens")}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{"Généré le"}</div>
            <div style={{color:"#fff",fontSize:13,fontWeight:700}}>{NOW.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</div>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,marginTop:2}}>{"Comparatif vs "+MOIS[mois]+" "+anneeN1+" (N-1) · vs "+MOIS[moisPrec]+" "+(moisPrec>mois?anneePrec:annee)+" (M-1)"}</div>
          </div>
        </div>

        {/* ── SYNTHÈSE GLOBALE ── */}
        <Section titre="📊 Synthèse globale du mois">
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
            <BigKpi label="CA Total HT" val={data.totalN} n1={data.totalN1} mp={data.totalMP} color="#1D3557" icon="💎" highlight/>
            <BigKpi label="CA Transactions" val={data.caVentesN} n1={data.caVentesN1} mp={data.caVentesMP} color="#E63946" icon="🏆"/>
            <BigKpi label="CA Locations HT" val={data.caLocsN} n1={data.caLocsN1} mp={data.caLocsMP} color="#3B82F6" icon="🏠"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {label:"Ventes actées",   val:data.nbVentesN,     ref:data.nbVentesN1,   icon:"✅", unit:""},
              {label:"Locations sign.", val:data.nbLocsN,       ref:data.nbLocsN1,     icon:"🏠", unit:""},
              {label:"Mandats actifs",  val:data.mandatsActifs.length, ref:null,         icon:"📋", unit:""},
              {label:"Taux exclusifs",  val:data.txExclusifs,   ref:null,               icon:"⭐", unit:"%"},
            ].map(function(k){
              var ev = k.ref!=null && k.ref>0 ? evo(k.val,k.ref) : null;
              return (
                <div key={k.label} style={{background:"#fff",borderRadius:10,padding:"12px",border:"1px solid #E2E8F0",textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{k.icon}</div>
                  <div style={{fontSize:20,fontWeight:900,color:"#1D3557"}}>{k.val+(k.unit||"")}</div>
                  <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,marginTop:2}}>{k.label}</div>
                  {ev!==null && <EvoChip pct={ev} style={{marginTop:4}}/>}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── GRAPHE 6 MOIS ── */}
        <Section titre={"📈 Évolution CA — 6 derniers mois"}>
          <div style={{display:"flex",gap:10,marginBottom:8}}>
            <LegendeDot color="#1D3557" label={"CA "+annee}/>
            <LegendeDot color="#E2E8F0" label={"CA "+(annee-1)}/>
            <LegendeDot color="#E63946" label={"Ventes"}/>
            <LegendeDot color="#3B82F6" label={"Locations"}/>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140,marginBottom:8}}>
            {data.graphe6.map(function(g, i) {
              var hTotal = maxGraphe>0 ? Math.round(g.total/maxGraphe*130) : 0;
              var hN1    = maxGraphe>0 ? Math.round(g.n1/maxGraphe*130) : 0;
              var hV     = maxGraphe>0 ? Math.round(g.ventes/maxGraphe*130) : 0;
              var hL     = maxGraphe>0 ? Math.round(g.locs/maxGraphe*130) : 0;
              var isCurr = i===5;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  {g.total>0 && <div style={{fontSize:8,color:isCurr?"#E63946":"#64748B",fontWeight:isCurr?900:600}}>{Math.round(g.total/1000)+"k"}</div>}
                  <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:128}}>
                    <div style={{flex:1,height:hN1||2,background:"#E2E8F0",borderRadius:"3px 3px 0 0",alignSelf:"flex-end"}}></div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignSelf:"flex-end",gap:0}}>
                      <div style={{height:hL,background:"#3B82F6",borderRadius:"0"}}></div>
                      <div style={{height:hV,background:isCurr?"#E63946":"#1D3557",opacity:isCurr?1:0.8,borderRadius:hL===0?"3px 3px 0 0":"0"}}></div>
                    </div>
                  </div>
                  <div style={{fontSize:8,color:isCurr?"#E63946":"#94A3B8",fontWeight:isCurr?900:600,textAlign:"center"}}>{g.label}</div>
                </div>
              );
            })}
          </div>

          {/* Tableau récap 6 mois */}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["Mois","Transactions","Locations","Gestion","Total","vs N-1"].map(function(h){
                  return <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94A3B8",fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:.7,borderBottom:"1px solid #E2E8F0"}}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {data.graphe6.map(function(g, i) {
                var ev = g.n1>0 ? evo(g.total,g.n1) : null;
                var isCurr = i===5;
                return (
                  <tr key={i} style={{background:isCurr?"#FFF5F5":"#fff",fontWeight:isCurr?800:400}}>
                    <td style={{padding:"7px 10px",color:isCurr?"#E63946":"#1D3557",fontSize:12,borderBottom:"1px solid #F1F5F9"}}>{g.label+(isCurr?" ◀":"")}</td>
                    <td style={{padding:"7px 10px",color:"#E63946",fontWeight:700,fontSize:12,borderBottom:"1px solid #F1F5F9"}}>{g.ventes>0?fmt(g.ventes):"—"}</td>
                    <td style={{padding:"7px 10px",color:"#3B82F6",fontWeight:700,fontSize:12,borderBottom:"1px solid #F1F5F9"}}>{g.locs>0?fmt(g.locs):"—"}</td>
                    <td style={{padding:"7px 10px",color:"#8B5CF6",fontWeight:700,fontSize:12,borderBottom:"1px solid #F1F5F9"}}>{g.gestion>0?fmt(g.gestion):"—"}</td>
                    <td style={{padding:"7px 10px",color:"#1D3557",fontWeight:900,fontSize:12,borderBottom:"1px solid #F1F5F9"}}>{g.total>0?fmt(g.total):"—"}</td>
                    <td style={{padding:"7px 10px",borderBottom:"1px solid #F1F5F9"}}>{ev!==null?<EvoChip pct={ev}/>:"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* ── TRANSACTIONS ── */}
        <Section titre={"🏆 Transactions — "+MOIS[mois]+" "+annee}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <ComparatifBloc titre="Ce mois vs N-1 (même mois)" rows={[
              {label:"Ventes actées",    n:data.nbVentesN,   n1:data.nbVentesN1, unit:""},
              {label:"CA commissions",   n:data.caVentesN,   n1:data.caVentesN1, fmt:true},
              {label:"Compromis actifs", n:data.nbCompromis, n1:null, unit:""},
            ]}/>
            <ComparatifBloc titre={"Ce mois vs "+MOIS[moisPrec]} rows={[
              {label:"Ventes actées",  n:data.nbVentesN,  n1:data.nbVentesN1, unit:""},
              {label:"CA commissions", n:data.caVentesN,  n1:data.caVentesMP, fmt:true},
            ]} moisPrec/>
          </div>
          {/* Liste ventes */}
          {data.ventesN.length>0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>{"Détail des ventes actées"}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Réf","Adresse","Agent","Prix","Commission","Type"].map(function(h){return <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94A3B8",fontWeight:700,fontSize:9,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>;})}</tr></thead>
                <tbody>
                  {data.ventesN.map(function(m){
                    var a = users.find(function(u){return u.id===m.agentId;});
                    return (
                      <tr key={m.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"7px 10px",fontWeight:800,color:"#1D3557"}}>{m.ref}</td>
                        <td style={{padding:"7px 10px",color:"#475569",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.adresse}</td>
                        <td style={{padding:"7px 10px",color:"#64748B"}}>{a?a.nom:"—"}</td>
                        <td style={{padding:"7px 10px",fontWeight:700}}>{fmt(m.prix)}</td>
                        <td style={{padding:"7px 10px",fontWeight:800,color:"#10B981"}}>{fmt(m.commission)}</td>
                        <td style={{padding:"7px 10px"}}><span style={{background:m.typeMandat==="exclusif"?"#FEF2F2":"#F1F5F9",color:m.typeMandat==="exclusif"?"#DC2626":"#64748B",padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:700}}>{m.typeMandat==="exclusif"?"⭐ Excl.":"Simple"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data.ventesN.length===0 && <div style={{textAlign:"center",color:"#94A3B8",fontSize:13,padding:"20px 0"}}>{"Aucune vente actée ce mois"}</div>}
        </Section>

        {/* ── LOCATIONS ── */}
        <Section titre={"🏠 Locations — "+MOIS[mois]+" "+annee}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <ComparatifBloc titre="Ce mois vs N-1" rows={[
              {label:"Locations signées", n:data.nbLocsN,  n1:data.nbLocsN1, unit:""},
              {label:"CA commissions",    n:data.caLocsN,  n1:data.caLocsN1, fmt:true},
            ]}/>
            <ComparatifBloc titre="Gestion locative" rows={[
              {label:"Biens en gestion",      n:gestion.length, n1:null, unit:""},
              {label:"Commission mensuelle",  n:data.caGestN,   n1:null, fmt:true},
              {label:"Projection annuelle",   n:data.caGestN*12,n1:null, fmt:true},
            ]}/>
          </div>
          {data.locsN.length>0 && (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#F8FAFC"}}>{["Réf","Adresse","Agent","Loyer","Commission"].map(function(h){return <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94A3B8",fontWeight:700,fontSize:9,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>;})}</tr></thead>
              <tbody>
                {data.locsN.map(function(l){
                  var a = users.find(function(u){return u.id===l.agentId;});
                  return (
                    <tr key={l.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                      <td style={{padding:"7px 10px",fontWeight:800,color:"#1D3557"}}>{l.ref}</td>
                      <td style={{padding:"7px 10px",color:"#475569"}}>{l.adresse}</td>
                      <td style={{padding:"7px 10px",color:"#64748B"}}>{a?a.nom:"—"}</td>
                      <td style={{padding:"7px 10px"}}>{(l.loyer||0)+"€/mois"}</td>
                      <td style={{padding:"7px 10px",fontWeight:800,color:"#10B981"}}>{fmt(l.commission||0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── PAR AGENT ── */}
        <Section titre={"👥 Performance par agent — "+MOIS[mois]+" "+annee}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["Agent","Ventes","CA Trans.","CA Locs","CA Total","vs N-1","vs M-1","Obj. mensuel","Att."].map(function(h){
                  return <th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#94A3B8",fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:.7,borderBottom:"2px solid #E2E8F0"}}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {data.parAgent.map(function(r, i) {
                var cols = ["#E63946","#F59E0B","#3B82F6","#10B981","#8B5CF6"];
                var col  = cols[i] || "#64748B";
                return (
                  <tr key={r.agent.id} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"#fff":"#FAFBFC"}}>
                    <td style={{padding:"9px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:14,background:col,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:10,flexShrink:0}}>{r.agent.avatar}</div>
                        <div>
                          <div style={{fontWeight:700,color:"#1D3557",fontSize:12}}>{r.agent.nom}</div>
                          <div style={{fontSize:9,color:"#94A3B8"}}>{r.nbMandatsActifs+" mandats actifs"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"9px 10px",fontWeight:700,color:"#1D3557"}}>{r.nbVentes>0?r.nbVentes+"  vente(s)":"—"}</td>
                    <td style={{padding:"9px 10px",fontWeight:800,color:"#E63946"}}>{r.caVentes>0?fmt(r.caVentes):"—"}</td>
                    <td style={{padding:"9px 10px",fontWeight:800,color:"#3B82F6"}}>{r.caLocs>0?fmt(r.caLocs):"—"}</td>
                    <td style={{padding:"9px 10px",fontWeight:900,color:"#1D3557",fontSize:13}}>{r.caTotal>0?fmt(r.caTotal):"—"}</td>
                    <td style={{padding:"9px 10px"}}>{r.evoN1!==null?<EvoChip pct={r.evoN1}/>:"—"}</td>
                    <td style={{padding:"9px 10px"}}>{r.evoMP!==null?<EvoChip pct={r.evoMP}/>:"—"}</td>
                    <td style={{padding:"9px 10px",color:"#64748B"}}>{r.objMensuel>0?fmt(r.objMensuel):"—"}</td>
                    <td style={{padding:"9px 10px"}}>
                      {r.pctObj!==null ? (
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:40,height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:Math.min(r.pctObj,100)+"%",background:r.pctObj>=100?"#10B981":r.pctObj>=75?"#F59E0B":"#EF4444",borderRadius:3}}></div>
                          </div>
                          <span style={{fontSize:10,fontWeight:800,color:r.pctObj>=100?"#10B981":r.pctObj>=75?"#F59E0B":"#EF4444"}}>{r.pctObj+"%"}</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#1D3557"}}>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:900,fontSize:12}} colSpan={2}>{"TOTAL AGENCE"}</td>
                <td style={{padding:"10px 10px",color:"#FCA5A5",fontWeight:900}}>{fmt(data.caVentesN)}</td>
                <td style={{padding:"10px 10px",color:"#93C5FD",fontWeight:900}}>{fmt(data.caLocsN)}</td>
                <td style={{padding:"10px 10px",color:"#fff",fontWeight:900,fontSize:13}}>{fmt(data.totalN)}</td>
                <td colSpan={4} style={{padding:"10px 10px"}}>
                  {evo(data.totalN,data.totalN1)!==null && <EvoChip pct={evo(data.totalN,data.totalN1)} light/>}
                </td>
              </tr>
            </tfoot>
          </table>
        </Section>

        {/* ── PIED DE PAGE ── */}
        <div style={{textAlign:"center",color:"#94A3B8",fontSize:11,marginTop:16,paddingTop:12,borderTop:"1px solid #E2E8F0"}}>
          {"Document généré par TEAM ORPI DECLIC IMMO · "+agence.nom+" · "+NOW.toLocaleDateString("fr-FR")}
        </div>

      </div>{/* fin rapport-print */}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────
function Section({ titre, children }) {
  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",marginBottom:14}}>
      <div style={{background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",padding:"10px 16px"}}>
        <span style={{fontWeight:800,color:"#1D3557",fontSize:13}}>{titre}</span>
      </div>
      <div style={{padding:"14px 16px"}}>{children}</div>
    </div>
  );
}

function BigKpi({ label, val, n1, mp, color, icon, highlight }) {
  var evN1 = n1!=null&&n1>0 ? Math.round((val-n1)/n1*100) : null;
  var evMP = mp!=null&&mp>0 ? Math.round((val-mp)/mp*100) : null;
  return (
    <div style={{background:highlight?"#F0F4FF":"#fff",borderRadius:10,border:"1px solid #E2E8F0",borderLeft:"4px solid "+color,padding:"12px 14px"}}>
      <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>{icon+" "+label}</div>
      <div style={{fontSize:highlight?22:18,fontWeight:900,color:color,marginBottom:6}}>{fmt(val)}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {evN1!==null && <EvoChip pct={evN1} label="vs N-1"/>}
        {evMP!==null && <EvoChip pct={evMP} label="vs M-1"/>}
      </div>
      {n1!=null && <div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>{"N-1 : "+fmt(n1)}{mp!=null?" · M-1 : "+fmt(mp):""}</div>}
    </div>
  );
}

function ComparatifBloc({ titre, rows, moisPrec }) {
  return (
    <div style={{background:"var(--g50)",borderRadius:10,border:"1px solid #E2E8F0",overflow:"hidden"}}>
      <div style={{background:"#F1F5F9",padding:"8px 12px",fontSize:11,fontWeight:700,color:"#475569",borderBottom:"1px solid #E2E8F0"}}>{titre}</div>
      <div style={{padding:"10px 12px"}}>
        {rows.map(function(row) {
          var evol = row.n1!=null&&row.n1>0 ? Math.round((row.n-row.n1)/row.n1*100) : null;
          return (
            <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #F1F5F9"}}>
              <span style={{fontSize:12,color:"#475569"}}>{row.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {row.n1!=null && <span style={{fontSize:11,color:"#94A3B8"}}>{row.fmt?fmt(row.n1):row.n1+(row.unit||"")}</span>}
                {row.n1!=null && <span style={{fontSize:11,color:"#94A3B8"}}>{"→"}</span>}
                <span style={{fontWeight:800,color:"#1D3557",fontSize:13}}>{row.fmt?fmt(row.n):row.n+(row.unit||"")}</span>
                {evol!==null && <EvoChip pct={evol}/>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvoChip({ pct, label, light }) {
  var pos = pct >= 0;
  return (
    <span style={{
      background:light?(pos?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.1)"):(pos?"#F0FDF4":"#FEF2F2"),
      color:light?"#fff":(pos?"#059669":"#DC2626"),
      padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:800,
      display:"inline-flex",alignItems:"center",gap:2,whiteSpace:"nowrap"
    }}>
      {(pos?"▲":"▼")+" "+(pct>0?"+":"")+pct+"%"+(label?" "+label:"")}
    </span>
  );
}

function LegendeDot({ color, label }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748B",fontWeight:600}}>
      <div style={{width:10,height:10,background:color,borderRadius:2,flexShrink:0}}></div>
      {label}
    </div>
  );
}

// ─── CSS IMPRESSION ───────────────────────────────────────────────────────────
var PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, Arial, sans-serif; }
  body { background: #fff; color: #1D3557; font-size: 11px; padding: 20px; }
  @media print {
    body { padding: 0; }
    @page { margin: 1.5cm; size: A4; }
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; text-align: left; }
  .no-print { display: none !important; }
`;
