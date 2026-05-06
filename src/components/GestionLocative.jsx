import { useState, useMemo } from "react";
import { useApp } from "../App";
import { fmt, fmtDate, avatarColor, canSeeContact, masquer, masquerTel } from "./Shared";

var NOW   = new Date();
var ANNEE = NOW.getFullYear();
var MOIS  = NOW.getMonth();
var MOIS_NOM = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// IRL courant (T3 2024 — à mettre à jour chaque trimestre)
var IRL_ACTUEL = 144.22;

function diffJours(d1, d2) {
  return Math.round((new Date(d2)-new Date(d1))/86400000);
}
function diffMois(d1, d2) {
  var a=new Date(d1), b=new Date(d2);
  return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
}
function moisStr(offset) {
  var d = new Date(ANNEE, MOIS+offset, 1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
}
function prochainerRevision(dateDebut) {
  if (!dateDebut) return null;
  var debut = new Date(dateDebut);
  var rev = new Date(debut); rev.setFullYear(ANNEE);
  if (rev <= NOW) rev.setFullYear(ANNEE+1);
  return { date:rev.toISOString().slice(0,10), jours:Math.round((rev-NOW)/86400000) };
}
function loyerRevise(loyer, irlBase, irlActuel) {
  if (!irlBase||!irlActuel||irlBase===0) return loyer;
  return Math.round(loyer*irlActuel/irlBase*100)/100;
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function GestionLocative() {
  var ctx      = useApp();
  var isManager= ctx.currentUser.role==="manager";
  var agenceId = ctx.currentUser.agenceId;
  var userId   = ctx.currentUser.id;
  var users    = ctx.users||[];
  var allGestion = (ctx.gestion||[]).filter(function(g){ return g.agenceId===agenceId&&g.actif; });
  // Agents voient seulement leurs biens
  var gestion  = isManager ? allGestion : allGestion.filter(function(g){ return g.agentId===userId; });
  var setGestion = ctx.setGestion;
  var addJournal = ctx.addJournal;

  var [onglet,     setOnglet]     = useState("parc");   // parc | reporting | baux | travaux
  var [bienSelec,  setBienSelec]  = useState(null);
  var [showForm,   setShowForm]   = useState(false);
  var [editBien,   setEditBien]   = useState(null);
  var [filtreAgent,setFiltreAgent]= useState("");

  var agents = users.filter(function(u){ return (u.role==="agent"||u.role==="manager")&&u.agenceId===agenceId&&u.actif; });
  var biensFiltres = gestion.filter(function(g){ return !filtreAgent||g.agentId===filtreAgent; });
  var bienActif = gestion.find(function(g){ return g.id===bienSelec; });

  // ─── HELPERS ────────────────────────────────────────────────────────────────
  function getLoyers(g){ return g.loyers||[]; }
  function getInterventions(g){ return g.interventions||[]; }

  function updateBien(id, patch) {
    setGestion(function(prev){ return prev.map(function(g){ return g.id===id?{...g,...patch}:g; }); });
    if (bienActif&&bienActif.id===id) setBienSelec(null);
    setTimeout(function(){ setBienSelec(id); },10);
  }

  function saveBien(form) {
    var isNew = !editBien;
    var id = isNew?"g-"+Date.now():editBien.id;
    var data = {...(editBien||{}), ...form, id, agenceId, actif:true,
      loyers: editBien?editBien.loyers||[]:[], interventions: editBien?editBien.interventions||[]:[] };
    setGestion(function(prev){ var ex=prev.find(function(g){return g.id===id;}); return ex?prev.map(function(g){return g.id===id?data:g;}):[...prev,data]; });
    if(addJournal) addJournal({type:isNew?"creation":"modification",description:(isNew?"Gestion créée : ":"Gestion modifiée : ")+data.ref+" — "+data.adresse,cible:"gestion",cibleId:id});
    setShowForm(false); setEditBien(null);
  }

  function saisirLoyer(bien, mois, statut) {
    var loyers = [...getLoyers(bien)];
    var idx = loyers.findIndex(function(l){ return l.mois===mois; });
    var entry = {mois, statut, date:new Date().toISOString().slice(0,10), montant:bien.loyer||0};
    if(idx>=0) loyers[idx]=entry; else loyers.push(entry);
    loyers.sort(function(a,b){return b.mois.localeCompare(a.mois);});
    updateBien(bien.id, {loyers});
  }

  function ajouterIntervention(bien, interv) {
    var interventions=[...getInterventions(bien),{...interv,id:"int-"+Date.now(),dateCreation:new Date().toISOString().slice(0,10)}];
    updateBien(bien.id, {interventions});
  }
  function updateIntervention(bien, intId, patch) {
    var interventions=getInterventions(bien).map(function(i){return i.id===intId?{...i,...patch}:i;});
    updateBien(bien.id, {interventions});
  }

  // ─── STATS GLOBALES ──────────────────────────────────────────────────────────
  var stats = useMemo(function() {
    var total = allGestion.length;
    var occupe = allGestion.filter(function(g){ return g.locataireNom&&g.locataireNom.trim(); }).length;
    var txOccup = total>0 ? Math.round(occupe/total*100) : 0;
    var caMensuel = allGestion.reduce(function(s,g){return s+(g.commissionMensuelle||0);},0);
    var caAnnuel  = caMensuel*12;
    var loyerTotal= allGestion.reduce(function(s,g){return s+(g.loyer||0);},0);
    var moisCourant = moisStr(0);
    var impayes = allGestion.filter(function(g){
      var l=getLoyers(g).find(function(l){return l.mois===moisCourant;});
      return g.locataireNom&&(!l||l.statut!=="paye");
    }).length;
    var revisions = allGestion.filter(function(g){
      var r=prochainerRevision(g.dateDebutGestion); return r&&r.jours<=60;
    }).length;
    var bailsExpire = allGestion.filter(function(g){
      if(!g.dateFinBail) return false;
      var j=diffJours(NOW.toISOString().slice(0,10),g.dateFinBail);
      return j>=0&&j<=90;
    }).length;
    var travaux = allGestion.reduce(function(s,g){
      return s+getInterventions(g).filter(function(i){return i.statut==="en_cours";}).length;
    },0);

    // CA par propriétaire
    var parProprietaire = {};
    allGestion.forEach(function(g){
      var key = g.proprietaireNom+" "+g.proprietairePrenom;
      if(!parProprietaire[key]) parProprietaire[key]={nom:key,biens:0,loyerTotal:0,caMensuel:0,caAnnuel:0};
      parProprietaire[key].biens++;
      parProprietaire[key].loyerTotal += (g.loyer||0);
      parProprietaire[key].caMensuel  += (g.commissionMensuelle||0);
      parProprietaire[key].caAnnuel   += (g.commissionMensuelle||0)*12;
    });

    return {total,occupe,txOccup,caMensuel,caAnnuel,loyerTotal,impayes,revisions,bailsExpire,travaux,parProprietaire:Object.values(parProprietaire).sort(function(a,b){return b.caMensuel-a.caMensuel;})};
  }, [allGestion]);

  // ─── ONGLET REPORTING ────────────────────────────────────────────────────────
  function OngletReporting() {
    var moisList = [];
    for(var i=0;i<12;i++) moisList.push({key:moisStr(-i),label:MOIS_NOM[((MOIS-i)%12+12)%12]+" "+moisStr(-i).split("-")[0]});

    return (
      <div>
        {/* Taux d'occupation */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:14}}>{"📊 Taux d'occupation du parc"}</div>
          <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:12}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:40,fontWeight:900,color:stats.txOccup>=90?"var(--green)":stats.txOccup>=70?"var(--amber)":"var(--red)"}}>{stats.txOccup+"%"}</div>
              <div style={{fontSize:11,color:"var(--g400)"}}>{"Taux d'occupation"}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{height:16,background:"var(--g100)",borderRadius:8,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:stats.txOccup+"%",background:stats.txOccup>=90?"var(--green)":stats.txOccup>=70?"var(--amber)":"var(--red)",borderRadius:8,transition:"width 0.5s"}}></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"var(--g400)"}}>{stats.occupe+" occupés / "+stats.total+" biens"}</span>
                <span style={{color:"var(--g400)"}}>{(stats.total-stats.occupe)+" vacant(s)"}</span>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[
              {label:"Loyers encaissés/mois",val:fmt(stats.loyerTotal),color:"var(--navy)"},
              {label:"Honoraires/mois",val:fmt(stats.caMensuel),color:"var(--green)"},
              {label:"Honoraires/an",val:fmt(stats.caAnnuel),color:"var(--purple)"},
            ].map(function(k){
              return <div key={k.label} style={{background:"var(--g50)",borderRadius:9,padding:"10px",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:16,color:k.color}}>{k.val}</div>
                <div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{k.label}</div>
              </div>;
            })}
          </div>
        </div>

        {/* CA par propriétaire */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:14}}>{"👤 CA par propriétaire"}</div>
          {stats.parProprietaire.map(function(p,i){
            return (
              <div key={p.nom} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--g50)"}}>
                <div style={{width:32,height:32,borderRadius:16,background:["var(--red)","var(--blue)","var(--green)","var(--amber)","var(--purple)"][i%5],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12,flexShrink:0}}>
                  {p.nom.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--navy)"}}>{p.nom}</div>
                  <div style={{fontSize:11,color:"var(--g400)"}}>{p.biens+" bien(s) · Loyers : "+fmt(p.loyerTotal)+"/mois"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:800,color:"var(--green)",fontSize:14}}>{fmt(p.caMensuel)+"/mois"}</div>
                  <div style={{fontSize:11,color:"var(--g400)"}}>{fmt(p.caAnnuel)+"/an"}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Suivi loyers 6 mois */}
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:16}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:14}}>{"💰 Suivi des encaissements (6 mois)"}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead>
                <tr style={{background:"var(--g50)"}}>
                  <th style={{padding:"6px 10px",textAlign:"left",color:"var(--g400)",fontWeight:700,borderBottom:"1px solid var(--g100)"}}>{"Bien"}</th>
                  {moisList.slice(0,6).map(function(m){ return <th key={m.key} style={{padding:"6px 8px",textAlign:"center",color:"var(--g400)",fontWeight:700,borderBottom:"1px solid var(--g100)",fontSize:10}}>{m.label.slice(0,3)}</th>; })}
                </tr>
              </thead>
              <tbody>
                {gestion.map(function(g){
                  return (
                    <tr key={g.id} style={{borderBottom:"1px solid var(--g50)"}}>
                      <td style={{padding:"7px 10px",fontWeight:600,color:"var(--navy)",fontSize:12}}>{g.ref+" · "+g.adresse.slice(0,25)+(g.adresse.length>25?"…":"")}</td>
                      {moisList.slice(0,6).map(function(m){
                        var l=getLoyers(g).find(function(l){return l.mois===m.key;});
                        var isPaye=l&&l.statut==="paye";
                        var isRetard=l&&l.statut==="retard";
                        return <td key={m.key} style={{padding:"4px 6px",textAlign:"center"}}>
                          <button onClick={function(){saisirLoyer(g,m.key,isPaye?"retard":"paye");}} style={{width:28,height:28,borderRadius:6,border:"none",background:isPaye?"#D1FAE5":isRetard?"#FEE2E2":"var(--g100)",color:isPaye?"#059669":isRetard?"#EF4444":"var(--g400)",cursor:"pointer",fontSize:13,fontWeight:800}}>
                            {isPaye?"✓":isRetard?"✗":"·"}
                          </button>
                        </td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:11,color:"var(--g400)",marginTop:8}}>{"✓ = Encaissé · ✗ = Impayé · · = Non renseigné — Cliquez pour changer le statut"}</div>
        </div>
      </div>
    );
  }

  // ─── ONGLET BAUX ─────────────────────────────────────────────────────────────
  function OngletBaux() {
    var now = NOW.toISOString().slice(0,10);
    var bailsTriés = [...gestion].sort(function(a,b){
      var ja = a.dateFinBail ? diffJours(now,a.dateFinBail) : 9999;
      var jb = b.dateFinBail ? diffJours(now,b.dateFinBail) : 9999;
      return ja-jb;
    });

    return (
      <div>
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:16,marginBottom:14}}>
          <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:14}}>{"📋 Gestion des baux"}</div>
          {bailsTriés.map(function(g){
            var jFin = g.dateFinBail ? diffJours(now,g.dateFinBail) : null;
            var rev  = prochainerRevision(g.dateDebutGestion);
            var irlRevise = loyerRevise(g.loyer||0, g.irlReference||IRL_ACTUEL, IRL_ACTUEL);
            var irlDiff   = irlRevise - (g.loyer||0);
            var urgence   = jFin!==null && jFin>=0 && jFin<=90;
            var expire    = jFin!==null && jFin<0;

            return (
              <div key={g.id} style={{borderRadius:10,border:"1px solid "+(urgence?"#FDBA74":expire?"#FECACA":"var(--g200)"),background:urgence?"#FFF7ED":expire?"#FEF2F2":"#fff",padding:"14px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{g.ref+" — "+g.adresse}</div>
                    <div style={{fontSize:12,color:"var(--g400)",marginTop:2}}>{"Locataire : "+g.locatairePrenom+" "+g.locataireNom+" · Propriétaire : "+g.proprietairePrenom+" "+g.proprietaireNom}</div>
                  </div>
                  {expire && <span style={{background:"#EF4444",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,flexShrink:0}}>{"Expiré"}</span>}
                  {urgence && <span style={{background:"#F97316",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,flexShrink:0}}>{"⚠️ J-"+jFin}</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                  <div style={{background:"var(--g50)",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700}}>{"Début bail"}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--navy)",marginTop:2}}>{g.dateDebutBail?fmtDate(g.dateDebutBail):"—"}</div>
                  </div>
                  <div style={{background:urgence?"#FEF3C7":expire?"#FEE2E2":"var(--g50)",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700}}>{"Fin bail"}</div>
                    <div style={{fontSize:12,fontWeight:700,color:urgence?"#D97706":expire?"#EF4444":"var(--navy)",marginTop:2}}>{g.dateFinBail?fmtDate(g.dateFinBail):"—"}</div>
                  </div>
                  <div style={{background:"var(--g50)",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700}}>{"Durée"}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--navy)",marginTop:2}}>{g.dateDebutBail&&g.dateFinBail?Math.round(diffMois(g.dateDebutBail,g.dateFinBail)/12*10)/10+" ans":"—"}</div>
                  </div>
                </div>
                {/* Révision IRL */}
                {rev && (
                  <div style={{background:rev.jours<=60?"#FFFBEB":"#F0FDF4",border:"1px solid "+(rev.jours<=60?"#FDE68A":"#A7F3D0"),borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                    <div style={{fontWeight:700,fontSize:12,color:rev.jours<=60?"#92400E":"#065F46"}}>
                      {"📅 Révision loyer dans "+rev.jours+" jours ("+fmtDate(rev.date)+")"}
                    </div>
                    <div style={{fontSize:11,color:"var(--g500)",marginTop:3,display:"flex",gap:12}}>
                      <span>{"Loyer actuel : "+(g.loyer||0)+"€"}</span>
                      <span>{"→ Loyer révisé : "+irlRevise+"€"}</span>
                      <span style={{color:irlDiff>=0?"#059669":"#EF4444",fontWeight:700}}>{(irlDiff>=0?"+":"")+irlDiff.toFixed(2)+"€"}</span>
                    </div>
                    <div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{"IRL base : "+(g.irlReference||IRL_ACTUEL)+" · IRL actuel : "+IRL_ACTUEL}</div>
                  </div>
                )}
                {/* Actions renouvellement */}
                {(urgence||expire) && (
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={function(){
                      var nouvelleFin = new Date(g.dateFinBail||NOW);
                      nouvelleFin.setFullYear(nouvelleFin.getFullYear()+3);
                      var newData = {...g, dateDebutBail:g.dateFinBail, dateFinBail:nouvelleFin.toISOString().slice(0,10), loyer:irlRevise, irlReference:IRL_ACTUEL};
                      setGestion(function(prev){return prev.map(function(x){return x.id===g.id?newData:x;});});
                    }}>{"🔄 Renouveler (3 ans) + réviser loyer"}</button>
                    <button className="btn btn-secondary btn-sm" onClick={function(){setEditBien(g);setShowForm(true);setOnglet("parc");}}>{"✏️ Modifier"}</button>
                  </div>
                )}
              </div>
            );
          })}
          {gestion.length===0 && <div style={{textAlign:"center",color:"var(--g400)",padding:"20px 0",fontSize:13}}>{"Aucun bien en gestion"}</div>}
        </div>
      </div>
    );
  }

  // ─── ONGLET TRAVAUX ──────────────────────────────────────────────────────────
  function OngletTravaux() {
    var [showForm2, setShowForm2] = useState(false);
    var [selectedBien, setSelectedBien] = useState("");
    var [intF, setIntF] = useState({type:"plomberie",description:"",prestataire:"",montant:"",statut:"planifie",urgence:false});

    var toutesInterventions = [];
    gestion.forEach(function(g){
      getInterventions(g).forEach(function(i){
        toutesInterventions.push({...i, bienRef:g.ref, bienAdresse:g.adresse, bienId:g.id});
      });
    });
    toutesInterventions.sort(function(a,b){ return (b.dateCreation||"").localeCompare(a.dateCreation||""); });

    var enCours   = toutesInterventions.filter(function(i){return i.statut==="en_cours";});
    var planifies = toutesInterventions.filter(function(i){return i.statut==="planifie";});
    var termines  = toutesInterventions.filter(function(i){return i.statut==="termine";});
    var coutTotal = toutesInterventions.filter(function(i){return i.statut==="termine";}).reduce(function(s,i){return s+Number(i.montant||0);},0);

    var colStatut = {planifie:{bg:"#EFF6FF",color:"#1D4ED8",label:"Planifié"},en_cours:{bg:"#FEF3C7",color:"#D97706",label:"En cours"},termine:{bg:"#F0FDF4",color:"#059669",label:"Terminé"}};
    var typeIcon  = {plomberie:"🚿",electricite:"⚡",chauffage:"🔥",menuiserie:"🪚",peinture:"🎨",nettoyage:"🧹",autre:"🔧"};

    function IntervCard({i}) {
      var bien = gestion.find(function(g){return g.id===i.bienId;});
      var col  = colStatut[i.statut]||colStatut.planifie;
      return (
        <div style={{background:"#fff",borderRadius:10,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:16}}>{typeIcon[i.type]||"🔧"}</span>
                <span style={{fontWeight:700,color:"var(--navy)",fontSize:13,textTransform:"capitalize"}}>{i.type}</span>
                {i.urgence&&<span style={{background:"#FEE2E2",color:"#EF4444",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{"🚨 Urgent"}</span>}
                <span style={{background:col.bg,color:col.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{col.label}</span>
              </div>
              <div style={{fontSize:12,color:"var(--g500)",marginBottom:2}}>{i.bienRef+" · "+i.bienAdresse}</div>
              {i.description&&<div style={{fontSize:12,color:"var(--g600)"}}>{i.description}</div>}
              {i.prestataire&&<div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"Prestataire : "+i.prestataire}</div>}
              <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtDate(i.dateCreation)}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
              {i.montant&&<div style={{fontWeight:800,color:"var(--navy)",fontSize:14}}>{Number(i.montant).toLocaleString("fr-FR")+"€"}</div>}
              {bien&&i.statut!=="termine"&&(
                <div style={{display:"flex",gap:4,marginTop:4,flexDirection:"column"}}>
                  {i.statut==="planifie"&&<button onClick={function(){updateIntervention(bien,i.id,{statut:"en_cours"});}} style={{background:"#FEF3C7",color:"#D97706",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"→ En cours"}</button>}
                  {i.statut==="en_cours"&&<button onClick={function(){updateIntervention(bien,i.id,{statut:"termine",dateFin:new Date().toISOString().slice(0,10)});}} style={{background:"#D1FAE5",color:"#059669",border:"none",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"✓ Terminer"}</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Résumé */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          {[
            {label:"En cours",val:enCours.length,color:"var(--amber)"},
            {label:"Planifiés",val:planifies.length,color:"var(--blue)"},
            {label:"Terminés",val:termines.length,color:"var(--green)"},
            {label:"Coût total",val:fmt(coutTotal),color:"var(--navy)"},
          ].map(function(k){
            return <div key={k.label} style={{background:"#fff",borderRadius:10,border:"1px solid var(--g200)",padding:"10px",textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:16,color:k.color}}>{k.val}</div>
              <div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{k.label}</div>
            </div>;
          })}
        </div>

        {/* Formulaire ajout */}
        <button className="btn btn-primary btn-sm" style={{marginBottom:14}} onClick={function(){setShowForm2(!showForm2);}}>
          {showForm2?"✕ Annuler":"+ Nouvelle intervention"}
        </button>
        {showForm2 && (
          <div style={{background:"var(--g50)",borderRadius:12,border:"1px solid var(--g200)",padding:16,marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div className="form-group" style={{gridColumn:"1/-1"}}>
                <label className="form-label">{"Bien concerné *"}</label>
                <select className="form-select" value={selectedBien} onChange={function(e){setSelectedBien(e.target.value);}}>
                  <option value="">{"— Choisir un bien —"}</option>
                  {gestion.map(function(g){ return <option key={g.id} value={g.id}>{g.ref+" · "+g.adresse}</option>; })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{"Type"}</label>
                <select className="form-select" value={intF.type} onChange={function(e){setIntF(function(p){return{...p,type:e.target.value};});}}>
                  {["plomberie","electricite","chauffage","menuiserie","peinture","nettoyage","autre"].map(function(t){ return <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>; })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{"Statut"}</label>
                <select className="form-select" value={intF.statut} onChange={function(e){setIntF(function(p){return{...p,statut:e.target.value};});}}>
                  <option value="planifie">Planifié</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{"Prestataire"}</label>
                <input className="form-input" value={intF.prestataire} onChange={function(e){setIntF(function(p){return{...p,prestataire:e.target.value};});}}/>
              </div>
              <div className="form-group">
                <label className="form-label">{"Montant estimé (€)"}</label>
                <input className="form-input" type="number" value={intF.montant} onChange={function(e){setIntF(function(p){return{...p,montant:e.target.value};});}}/>
              </div>
              <div className="form-group" style={{gridColumn:"1/-1"}}>
                <label className="form-label">{"Description"}</label>
                <textarea className="form-input" rows={2} value={intF.description} onChange={function(e){setIntF(function(p){return{...p,description:e.target.value};});}}/>
              </div>
              <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" checked={intF.urgence} onChange={function(e){setIntF(function(p){return{...p,urgence:e.target.checked};});}} style={{width:16,height:16}}/>
                <label style={{fontSize:13,color:"var(--navy)",fontWeight:600}}>{"🚨 Urgence"}</label>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" style={{marginTop:12}} disabled={!selectedBien} onClick={function(){
              var bien = gestion.find(function(g){return g.id===selectedBien;});
              if(bien){ ajouterIntervention(bien,intF); setShowForm2(false); setIntF({type:"plomberie",description:"",prestataire:"",montant:"",statut:"planifie",urgence:false}); setSelectedBien(""); }
            }}>{"Enregistrer l'intervention"}</button>
          </div>
        )}

        {/* Listes */}
        {enCours.length>0&&<div style={{fontWeight:700,color:"var(--amber)",fontSize:12,marginBottom:8,marginTop:4}}>{"🔨 En cours ("+enCours.length+")"}</div>}
        {enCours.map(function(i){ return <IntervCard key={i.id} i={i}/>; })}
        {planifies.length>0&&<div style={{fontWeight:700,color:"var(--blue)",fontSize:12,marginBottom:8,marginTop:8}}>{"📋 Planifiés ("+planifies.length+")"}</div>}
        {planifies.map(function(i){ return <IntervCard key={i.id} i={i}/>; })}
        {termines.length>0&&<div style={{fontWeight:700,color:"var(--green)",fontSize:12,marginBottom:8,marginTop:8}}>{"✅ Terminés ("+termines.length+")"}</div>}
        {termines.slice(0,5).map(function(i){ return <IntervCard key={i.id} i={i}/>; })}
        {termines.length===0&&enCours.length===0&&planifies.length===0&&<div style={{textAlign:"center",color:"var(--g400)",padding:"20px",fontSize:13}}>{"Aucune intervention enregistrée"}</div>}
      </div>
    );
  }

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
        {[
          {label:"Biens gérés",      val:stats.total,              icon:"🏘️", color:"var(--navy)"},
          {label:"Taux d'occupation", val:stats.txOccup+"%",        icon:"📊", color:stats.txOccup>=90?"var(--green)":stats.txOccup>=70?"var(--amber)":"var(--red)"},
          {label:"Impayés ce mois",   val:stats.impayes,            icon:"⚠️", color:stats.impayes>0?"var(--red)":"var(--green)"},
          {label:"Baux à renouveler", val:stats.bailsExpire,        icon:"📋", color:stats.bailsExpire>0?"var(--amber)":"var(--green)"},
          {label:"Révisions IRL",     val:stats.revisions,          icon:"📅", color:stats.revisions>0?"var(--amber)":"var(--green)"},
          {label:"Travaux en cours",  val:stats.travaux,            icon:"🔧", color:stats.travaux>0?"var(--blue)":"var(--green)"},
        ].map(function(k){
          return <div key={k.label} style={{background:"#fff",borderRadius:10,border:"1px solid var(--g200)",borderLeft:"3px solid "+k.color,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{k.icon+" "+k.label}</div>
            <div style={{fontSize:18,fontWeight:900,color:k.color,marginTop:3}}>{k.val}</div>
          </div>;
        })}
      </div>

      {/* Navigation onglets */}
      <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4,marginBottom:14}}>
        {[["parc","🏘️ Parc"],["reporting","📊 Reporting"],["baux","📋 Baux"],["travaux","🔧 Travaux"]].map(function(t){
          return <button key={t[0]} onClick={function(){setOnglet(t[0]);setBienSelec(null);setShowForm(false);}} style={{flex:1,padding:"8px 4px",borderRadius:7,border:"none",background:onglet===t[0]?"#fff":"transparent",color:onglet===t[0]?"var(--navy)":"var(--g400)",fontWeight:onglet===t[0]?800:600,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",boxShadow:onglet===t[0]?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
            {t[1]}
          </button>;
        })}
      </div>

      {/* Contenu onglets */}
      {onglet==="reporting" && <OngletReporting/>}
      {onglet==="baux"      && <OngletBaux/>}
      {onglet==="travaux"   && <OngletTravaux/>}

      {/* PARC */}
      {onglet==="parc" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            {isManager&&<button className="btn btn-primary btn-sm" onClick={function(){setEditBien(null);setShowForm(true);setBienSelec(null);}}>{"+ Nouveau bien"}</button>}
            {isManager&&<select className="form-select" style={{width:"auto",fontSize:12}} value={filtreAgent} onChange={function(e){setFiltreAgent(e.target.value);}}>
              <option value="">{"Tous les agents"}</option>
              {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
            </select>}
            <span style={{fontSize:12,color:"var(--g400)"}}>{biensFiltres.length+" bien(s)"}</span>
          </div>

          {showForm&&<GestFormComplet initial={editBien} onSave={saveBien} onCancel={function(){setShowForm(false);setEditBien(null);}} agents={agents} currentUser={ctx.currentUser}/>}

          {bienActif&&<BienDetailCompact bien={bienActif} users={users} saisirLoyer={saisirLoyer} ajouterIntervention={ajouterIntervention} updateIntervention={updateIntervention} onEdit={function(){setEditBien(bienActif);setShowForm(true);}} onArchive={function(){if(window.confirm("Archiver ce bien ? Il n'apparaîtra plus dans la liste active."))setGestion(function(prev){return prev.map(function(g){return g.id===bienActif.id?{...g,actif:false}:g;});});setBienSelec(null);}}
          onDelete={function(){if(window.confirm("⚠️ Supprimer définitivement ce bien ? Cette action est irréversible."))setGestion(function(prev){return prev.filter(function(g){return g.id!==bienActif.id;});});setBienSelec(null);}} gestion={gestion}/>}

          {biensFiltres.map(function(g){
            var a = users.find(function(u){return u.id===g.agentId;});
            var moisCourant = moisStr(0);
            var loyerMois = getLoyers(g).find(function(l){return l.mois===moisCourant;});
            var isImpaye = g.locataireNom&&(!loyerMois||loyerMois.statut!=="paye");
            var nbTravaux = getInterventions(g).filter(function(i){return i.statut==="en_cours"||i.statut==="planifie";}).length;
            var rev = prochainerRevision(g.dateDebutGestion);
            var jBail = g.dateFinBail?diffJours(NOW.toISOString().slice(0,10),g.dateFinBail):null;
            var isSelected = bienSelec===g.id;
            return (
              <div key={g.id} onClick={function(){setBienSelec(isSelected?null:g.id);setShowForm(false);}} style={{background:"#fff",borderRadius:12,border:"2px solid "+(isSelected?"var(--blue)":"var(--g200)"),padding:"14px 16px",marginBottom:8,cursor:"pointer",transition:"border-color 0.15s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:3,alignItems:"center"}}>
                      <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{g.ref}</span>
                      {g.typeLogement&&<span style={{background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700,textTransform:"capitalize"}}>{g.typeLogement}</span>}
                      {isImpaye&&<span style={{background:"#FEE2E2",color:"#EF4444",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{"⚠️ Impayé"}</span>}
                      {nbTravaux>0&&<span style={{background:"#FEF3C7",color:"#D97706",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{"🔧 "+nbTravaux}</span>}
                      {rev&&rev.jours<=60&&<span style={{background:"#FFF7ED",color:"#EA580C",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{"📅 Rev. J-"+rev.jours}</span>}
                      {jBail!==null&&jBail>=0&&jBail<=90&&<span style={{background:"#FEF3C7",color:"#D97706",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{"📋 Bail J-"+jBail}</span>}
                    </div>
                    <div style={{fontSize:12,color:"var(--g600)",marginBottom:1}}>{g.adresse}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{"👤 "+g.proprietairePrenom+" "+g.proprietaireNom+" · 🏠 "+(g.locatairePrenom||"Vacant")+" "+(g.locataireNom||"")}</div>
                    {isManager&&a&&<div style={{fontSize:11,color:"var(--g400)",marginTop:1}}>{"Agent : "+a.nom}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <div style={{fontWeight:900,fontSize:15,color:"var(--green)"}}>{(g.loyer||0)+"€"}</div>
                    <div style={{fontSize:10,color:"var(--g400)"}}>{"Hon. "+(g.commissionMensuelle||0)+"€/mois"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {biensFiltres.length===0&&!showForm&&(
            <div style={{textAlign:"center",padding:"40px",color:"var(--g400)"}}>
              <div style={{fontSize:40,marginBottom:12}}>{"🔑"}</div>
              <div style={{fontWeight:700}}>{"Aucun bien en gestion"}</div>
              {isManager&&<div style={{fontSize:13,marginTop:6}}>{"Cliquez sur + Nouveau bien pour commencer"}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FORMULAIRE COMPLET ───────────────────────────────────────────────────────
function GestFormComplet({ initial, onSave, onCancel, agents, currentUser }) {
  var init = initial||{};
  var [f,setF] = useState({
    ref:init.ref||"", adresse:init.adresse||"", typeLogement:init.typeLogement||"appartement",
    surface:init.surface||"", nbPieces:init.nbPieces||"",
    proprietaireNom:init.proprietaireNom||"", proprietairePrenom:init.proprietairePrenom||"",
    proprietaireTel:init.proprietaireTel||"", proprietaireMail:init.proprietaireMail||"",
    locataireNom:init.locataireNom||"", locatairePrenom:init.locatairePrenom||"",
    locataireTel:init.locataireTel||"", locataireMail:init.locataireMail||"",
    loyer:init.loyer||"", charges:init.charges||"", depot:init.depot||"",
    commissionPct:init.commissionPct||8, commissionMensuelle:init.commissionMensuelle||"",
    agentId:init.agentId||currentUser.id,
    dateDebutGestion:init.dateDebutGestion||"", dateDebutBail:init.dateDebutBail||"",
    dateFinBail:init.dateFinBail||"", irlReference:init.irlReference||IRL_ACTUEL,
    notes:init.notes||"",
  });
  function set(k,v){setF(function(p){return{...p,[k]:v};});}
  function calcComm(){if(f.loyer&&f.commissionPct)set("commissionMensuelle",Math.round(Number(f.loyer)*Number(f.commissionPct)/100));}

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:20,marginBottom:14}}>
      <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{initial?"✏️ Modifier le bien":"➕ Nouveau bien en gestion"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="form-group"><label className="form-label">{"Référence"}</label><input className="form-input" value={f.ref} onChange={function(e){set("ref",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Type"}</label>
          <select className="form-select" value={f.typeLogement} onChange={function(e){set("typeLogement",e.target.value);}}>
            {["appartement","maison","studio","local commercial","parking"].map(function(t){return <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>;})}
          </select>
        </div>
        <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Adresse"}</label><input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Surface (m²)"}</label><input className="form-input" type="number" value={f.surface} onChange={function(e){set("surface",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Pièces"}</label><input className="form-input" type="number" value={f.nbPieces} onChange={function(e){set("nbPieces",e.target.value);}}/></div>

        <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--g100)",paddingTop:10,fontWeight:700,color:"var(--navy)",fontSize:12}}>{"👤 Propriétaire"}</div>
        <div className="form-group"><label className="form-label">{"Nom"}</label><input className="form-input" value={f.proprietaireNom} onChange={function(e){set("proprietaireNom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Prénom"}</label><input className="form-input" value={f.proprietairePrenom} onChange={function(e){set("proprietairePrenom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Tél."}</label><input className="form-input" value={f.proprietaireTel} onChange={function(e){set("proprietaireTel",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.proprietaireMail} onChange={function(e){set("proprietaireMail",e.target.value);}}/></div>

        <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--g100)",paddingTop:10,fontWeight:700,color:"var(--navy)",fontSize:12}}>{"🏠 Locataire"}</div>
        <div className="form-group"><label className="form-label">{"Nom"}</label><input className="form-input" value={f.locataireNom} onChange={function(e){set("locataireNom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Prénom"}</label><input className="form-input" value={f.locatairePrenom} onChange={function(e){set("locatairePrenom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Tél."}</label><input className="form-input" value={f.locataireTel} onChange={function(e){set("locataireTel",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.locataireMail} onChange={function(e){set("locataireMail",e.target.value);}}/></div>

        <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--g100)",paddingTop:10,fontWeight:700,color:"var(--navy)",fontSize:12}}>{"💰 Financier"}</div>
        <div className="form-group"><label className="form-label">{"Loyer CC (€/mois)"}</label><input className="form-input" type="number" value={f.loyer} onChange={function(e){set("loyer",Number(e.target.value));}} onBlur={calcComm}/></div>
        <div className="form-group"><label className="form-label">{"Charges (€/mois)"}</label><input className="form-input" type="number" value={f.charges} onChange={function(e){set("charges",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Dépôt garantie (€)"}</label><input className="form-input" type="number" value={f.depot} onChange={function(e){set("depot",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Commission (%)"}</label><input className="form-input" type="number" value={f.commissionPct} onChange={function(e){set("commissionPct",Number(e.target.value));}} onBlur={calcComm}/></div>
        <div className="form-group"><label className="form-label">{"Honoraires (€/mois)"}</label><input className="form-input" type="number" value={f.commissionMensuelle} onChange={function(e){set("commissionMensuelle",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"IRL de référence"}</label><input className="form-input" type="number" step="0.01" value={f.irlReference} onChange={function(e){set("irlReference",Number(e.target.value));}}/></div>

        <div style={{gridColumn:"1/-1",borderTop:"1px solid var(--g100)",paddingTop:10,fontWeight:700,color:"var(--navy)",fontSize:12}}>{"📅 Bail & Gestion"}</div>
        <div className="form-group"><label className="form-label">{"Début gestion"}</label><input className="form-input" type="date" value={f.dateDebutGestion||""} onChange={function(e){set("dateDebutGestion",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Début bail"}</label><input className="form-input" type="date" value={f.dateDebutBail||""} onChange={function(e){set("dateDebutBail",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Fin bail"}</label><input className="form-input" type="date" value={f.dateFinBail||""} onChange={function(e){set("dateFinBail",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Agent responsable"}</label>
          <select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}>
            {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
          </select>
        </div>
        <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Notes"}</label><textarea className="form-input" rows={2} value={f.notes} onChange={function(e){set("notes",e.target.value);}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button className="btn btn-secondary" style={{flex:1}} onClick={onCancel}>{"Annuler"}</button>
        <button className="btn btn-primary" style={{flex:2}} onClick={function(){onSave(f);}}>{"💾 Enregistrer"}</button>
      </div>
    </div>
  );
}

// ─── FICHE DÉTAIL COMPACT ─────────────────────────────────────────────────────
function BienDetailCompact({ bien, users, saisirLoyer, ajouterIntervention, updateIntervention, onEdit, onArchive, onDelete, gestion }) {
  var [tabD,setTabD] = useState("infos");
  var [showIntForm,setShowIntForm] = useState(false);
  var [intF,setIntF] = useState({type:"plomberie",description:"",prestataire:"",montant:"",statut:"planifie",urgence:false});
  var loyers = bien.loyers||[];
  var interventions = bien.interventions||[];
  var agent = users.find(function(u){return u.id===bien.agentId;});
  var rev = prochainerRevision(bien.dateDebutGestion);
  var irlRevise = loyerRevise(bien.loyer||0, bien.irlReference||IRL_ACTUEL, IRL_ACTUEL);
  var moisList = [];
  for(var i=0;i<12;i++) moisList.push(moisStr(-i));
  var impayesMois = moisList.filter(function(m){var l=loyers.find(function(l){return l.mois===m;});return !l||l.statut!=="paye";}).length;

  return (
    <div style={{background:"#fff",borderRadius:14,border:"2px solid var(--blue)",overflow:"hidden",marginBottom:14}}>
      <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:10,marginBottom:2}}>{bien.ref+" · "+(bien.typeLogement||"Bien")+(bien.surface?" · "+bien.surface+"m²":"")}</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:14}}>{bien.adresse}</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>{"👤 "+bien.proprietairePrenom+" "+bien.proprietaireNom+" · 🏠 "+bien.locatairePrenom+" "+bien.locataireNom}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#6EE7B7",fontWeight:900,fontSize:17}}>{(bien.loyer||0)+"€/mois"}</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{"Hon. "+(bien.commissionMensuelle||0)+"€"}</div>
          {impayesMois>0&&<div style={{background:"#EF4444",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800,marginTop:3}}>{"⚠️ "+impayesMois+" impayé(s)"}</div>}
        </div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid var(--g100)"}}>
        {[["infos","📋"],["loyers","💰"],["travaux","🔧"]].map(function(t){
          return <button key={t[0]} onClick={function(){setTabD(t[0]);}} style={{flex:1,padding:"9px",border:"none",background:tabD===t[0]?"#fff":"var(--g50)",fontWeight:tabD===t[0]?800:600,color:tabD===t[0]?"var(--navy)":"var(--g400)",fontSize:12,cursor:"pointer",fontFamily:"var(--font)",borderBottom:tabD===t[0]?"2px solid var(--blue)":"2px solid transparent"}}>{t[1]+" "+t[0].charAt(0).toUpperCase()+t[0].slice(1)}</button>;
        })}
      </div>
      <div style={{padding:"14px 16px"}}>
        {tabD==="infos"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              {[["📞 Proprio",bien.proprietaireTel||"—"],["✉️ Proprio",bien.proprietaireMail||"—"],["📞 Locataire",bien.locataireTel||"—"],["✉️ Locataire",bien.locataireMail||"—"],["Début bail",bien.dateDebutBail?fmtDate(bien.dateDebutBail):"—"],["Fin bail",bien.dateFinBail?fmtDate(bien.dateFinBail):"—"],["Charges",(bien.charges||(0))+"€/mois"],["Dépôt",(bien.depot||0)+"€"]].map(function(r){
                return <div key={r[0]} style={{background:"var(--g50)",borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:9,color:"var(--g400)",fontWeight:700}}>{r[0]}</div><div style={{fontSize:12,fontWeight:600,color:"var(--navy)",marginTop:1}}>{r[1]}</div></div>;
              })}
            </div>
            {rev&&(<div style={{background:rev.jours<=60?"#FFFBEB":"#F0FDF4",border:"1px solid "+(rev.jours<=60?"#FDE68A":"#A7F3D0"),borderRadius:8,padding:"8px 12px",marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:rev.jours<=60?"#92400E":"#065F46"}}>{"📅 Révision dans "+rev.jours+" jours · "+fmtDate(rev.date)}</div>
              <div style={{fontSize:11,color:"var(--g500)",marginTop:2}}>{"Actuel : "+(bien.loyer||0)+"€ → Révisé : "+irlRevise+"€ (IRL "+IRL_ACTUEL+")"}</div>
            </div>)}
            {bien.notes&&<div style={{background:"var(--g50)",borderRadius:8,padding:"8px 10px",fontSize:12,color:"var(--g600)",fontStyle:"italic",marginBottom:10}}>{bien.notes}</div>}
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={onEdit}>{"✏️ Modifier"}</button>
              <button className="btn btn-sm" style={{background:"#FFF7ED",color:"var(--amber)",border:"none",flex:1}} onClick={onArchive}>{"📦 Archiver"}</button>
              <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none",flex:1}} onClick={onDelete}>{"🗑 Supprimer"}</button>
            </div>
          </div>
        )}
        {tabD==="loyers"&&(
          <div>
            <div style={{fontSize:11,color:"var(--g400)",marginBottom:10}}>{"Cliquez pour changer le statut d'encaissement"}</div>
            {moisList.map(function(mois){
              var l=loyers.find(function(l){return l.mois===mois;});
              var isPaye=l&&l.statut==="paye"; var isRetard=l&&l.statut==="retard";
              var idx=parseInt(mois.split("-")[1])-1;
              var label=MOIS_NOM[idx]+" "+mois.split("-")[0];
              return (
                <div key={mois} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--g50)"}}>
                  <div style={{flex:1,fontSize:12,fontWeight:600,color:"var(--navy)"}}>{label}</div>
                  <div style={{fontSize:12,color:"var(--g500)"}}>{(bien.loyer||0)+"€"}</div>
                  <button onClick={function(){saisirLoyer(bien,mois,"paye");}} style={{padding:"3px 10px",borderRadius:7,border:"none",background:isPaye?"#D1FAE5":"var(--g100)",color:isPaye?"#059669":"var(--g500)",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                    {isPaye?"✅ Encaissé":"Encaisser"}
                  </button>
                  <button onClick={function(){saisirLoyer(bien,mois,"retard");}} style={{padding:"3px 10px",borderRadius:7,border:"none",background:isRetard?"#FEE2E2":"var(--g100)",color:isRetard?"#EF4444":"var(--g500)",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                    {isRetard?"⚠️ Impayé":"Impayé"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {tabD==="travaux"&&(
          <div>
            {!showIntForm&&<button className="btn btn-primary btn-sm" style={{marginBottom:10}} onClick={function(){setShowIntForm(true);}}>{"+ Intervention"}</button>}
            {showIntForm&&(
              <div style={{background:"var(--g50)",borderRadius:10,padding:12,marginBottom:12,border:"1px solid var(--g200)"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div className="form-group"><label className="form-label">{"Type"}</label>
                    <select className="form-select" value={intF.type} onChange={function(e){setIntF(function(p){return{...p,type:e.target.value};});}}>
                      {["plomberie","electricite","chauffage","menuiserie","peinture","nettoyage","autre"].map(function(t){return <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>;})}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">{"Statut"}</label>
                    <select className="form-select" value={intF.statut} onChange={function(e){setIntF(function(p){return{...p,statut:e.target.value};});}}>
                      <option value="planifie">Planifié</option><option value="en_cours">En cours</option><option value="termine">Terminé</option>
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">{"Prestataire"}</label><input className="form-input" value={intF.prestataire} onChange={function(e){setIntF(function(p){return{...p,prestataire:e.target.value};});}}/></div>
                  <div className="form-group"><label className="form-label">{"Montant (€)"}</label><input className="form-input" type="number" value={intF.montant} onChange={function(e){setIntF(function(p){return{...p,montant:e.target.value};});}}/></div>
                  <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Description"}</label><textarea className="form-input" rows={2} value={intF.description} onChange={function(e){setIntF(function(p){return{...p,description:e.target.value};});}}/></div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn btn-secondary btn-sm" onClick={function(){setShowIntForm(false);}}>{"Annuler"}</button>
                  <button className="btn btn-primary btn-sm" onClick={function(){ajouterIntervention(bien,intF);setShowIntForm(false);setIntF({type:"plomberie",description:"",prestataire:"",montant:"",statut:"planifie",urgence:false});}}>{"Enregistrer"}</button>
                </div>
              </div>
            )}
            {interventions.length===0&&<div style={{textAlign:"center",color:"var(--g400)",fontSize:12,padding:"16px 0"}}>{"Aucune intervention"}</div>}
            {[...interventions].reverse().map(function(i){
              var colS={planifie:"#EFF6FF",en_cours:"#FEF3C7",termine:"#F0FDF4"};
              var lblS={planifie:"Planifié",en_cours:"En cours",termine:"Terminé"};
              return (
                <div key={i.id} style={{padding:"8px 0",borderBottom:"1px solid var(--g50)"}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:"var(--navy)",textTransform:"capitalize"}}>{i.type}{i.urgence?" 🚨":""}</div>
                      {i.description&&<div style={{fontSize:11,color:"var(--g500)"}}>{i.description}</div>}
                      {i.prestataire&&<div style={{fontSize:11,color:"var(--g400)"}}>{"Presta : "+i.prestataire}</div>}
                    </div>
                    <div style={{textAlign:"right"}}>
                      {i.montant&&<div style={{fontWeight:700,fontSize:12}}>{Number(i.montant).toLocaleString("fr-FR")+"€"}</div>}
                      <span style={{background:colS[i.statut]||"#E2E8F0",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{lblS[i.statut]||i.statut}</span>
                      {i.statut!=="termine"&&<div style={{marginTop:4}}>
                        <button onClick={function(){updateIntervention(bien,i.id,{statut:i.statut==="planifie"?"en_cours":"termine"});}} style={{background:"var(--g100)",border:"none",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"var(--font)"}}>
                          {i.statut==="planifie"?"→ En cours":"✓ Terminer"}
                        </button>
                      </div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
