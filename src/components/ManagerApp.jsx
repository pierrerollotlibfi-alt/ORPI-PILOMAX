import { useState, useMemo } from "react";
import { notifNouveauMandat, notifBaissePrix, notifNouveauCompromis, notifTacheTerminee, notifTacheConfiee, notifLeadAttribue } from "../notifications";
import { jouerApplaudissements } from "../applause";
import { useApp } from "../App";
import ProspectionMap from "./ProspectionMap";
import Messagerie from "./Messagerie";
import Leads from "./Leads";
import Recherches from "./Recherches";
import GestionLocative from "./GestionLocative";
import DashboardMatin from "./DashboardMatin";
import FicheKPIAgent from "./FicheKPIAgent";
import Feedback from "./Feedback";
import Outils from "./Outils";
import OffMarket from "./OffMarket";
import CarteInteractive from "./CarteInteractive";
import CaRealise from "./CaRealise";
import RapportMensuel from "./RapportMensuel";
import ObjectifsProgression from "./ObjectifsProgression";
import {
  AppShell, SaveBanner, KpiCard, Modal, MandatForm, PeriodSelector,
  BadgeStatut, BadgeType, BadgeNiveau, inPeriod,
  fmt, fmtDate, diffDays, todayStr, avatarColor,
} from "./Shared";

var MEDAL = ["🥇","🥈","🥉"];

export default function ManagerApp({ agenceIdOverride, onRetourGroupe }) {
  var ctx = useApp();
  var { currentUser, users, agences, mandats, setMandats, locations, setLocations, gestion, setGestion, setUsers, inviterAgent, invitations, objectifs, setObjectifs, tasks, setTasks, addJournal, journal, resets, resetMdpParManager, changerMotDePasse, prospection, kpiConfig, setKpiConfig } = ctx;

  var [tab, _setTabRaw] = useState(function(){ try{ return localStorage.getItem("orpi_tab_manager")||"dashboard"; }catch(e){ return "dashboard"; } });
  function setTab(v){ try{ localStorage.setItem("orpi_tab_manager",v); }catch(e){} _setTabRaw(v); }
  var [showMandatForm,  setShowMandatForm]  = useState(false);
  var [editingMandat,   setEditingMandat]   = useState(null);
  var [detailMandat,    setDetailMandat]    = useState(null);
  var [showLocForm,     setShowLocForm]     = useState(false);
  var [editingLoc,      setEditingLoc]      = useState(null);
  var [showGestForm,    setShowGestForm]    = useState(false);
  var [editingGest,     setEditingGest]     = useState(null);
  var [showInvite,      setShowInvite]      = useState(false);
  var [showObjModal,    setShowObjModal]    = useState(false);
  var [showBravo,       setShowBravo]       = useState(null); // { mandatRef, agentNom }
  var [ficheKPIAgent,   setFicheKPIAgent]   = useState(null); // agent à afficher
  var [showConfigKPI,   setShowConfigKPI]   = useState(false);
  var [showTaskModal,   setShowTaskModal]   = useState(false);
  var [inviteResult,    setInviteResult]    = useState(null);
  var [period,      setPeriod]      = useState("year");
  var [customFrom,  setCustomFrom]  = useState("");
  var [customTo,    setCustomTo]    = useState("");
  var [filterAgent, setFilterAgent] = useState("");
  var [filterStatut,setFilterStatut]= useState("");
  var [critereClassement, setCritereClassement] = useState("caRealise");
  var [showKpiDetail,    setShowKpiDetail]    = useState(null);
  var [filterType,  setFilterType]  = useState("");
  var [searchText,  setSearchText]  = useState("");
  var [filterBien,  setFilterBien]  = useState("");
  var [prixMin,     setPrixMin]     = useState("");
  var [prixMax,     setPrixMax]     = useState("");

  var agenceId  = agenceIdOverride || currentUser.agenceId;
  var agents    = users.filter(function(u){return (u.role==="agent"||u.role==="manager") && u.agenceId===agenceId && u.actif;});
  var myMandats = mandats.filter(function(m){return m.agenceId===agenceId;});
  var myLocs    = locations.filter(function(l){return l.agenceId===agenceId;});
  var myGestion = gestion.filter(function(g){return g.agenceId===agenceId && g.actif;});

  // Stats transaction
  var active    = myMandats.filter(function(m){return m.statut==="mandat";});
  var sousOffre = myMandats.filter(function(m){return m.statut==="sous_offre";});

  // Taux commission moyen agence (tous agents)
  var agenceVendus = myMandats.filter(function(m){ return m.statut==="vendu" && m.prix>0 && m.commission>0; });
  // Leads confiés par agent
  var leads = ctx.tasks ? ctx.tasks.filter(function(t){ return t.agenceId===agenceId && t.type==="lead"; }) : [];
  var leadsParAgent = agents.map(function(a){
    return { ...a, nbLeads: (ctx.leads||[]).filter(function(l){ return l.agentId===a.id && l.agenceId===agenceId; }).length };
  });
  var txCommMoyenAgence = agenceVendus.length > 0
    ? Math.round(agenceVendus.reduce(function(s,m){ return s+(m.commission/m.prix*100); },0)/agenceVendus.length*100)/100
    : null;
  // Taux par agent (pour comparatif)
  var txCommParAgent = agents.map(function(a){
    var av = agenceVendus.filter(function(m){ return m.agentId===a.id; });
    var tx = av.length>0 ? Math.round(av.reduce(function(s,m){return s+(m.commission/m.prix*100);},0)/av.length*100)/100 : null;
    return { ...a, txComm: tx, nbVentes: av.length };
  }).filter(function(a){ return a.txComm !== null; }).sort(function(a,b){ return b.txComm-a.txComm; });
  var compromis = myMandats.filter(function(m){return m.statut==="compromis";});
  var vendus    = myMandats.filter(function(m){return m.statut==="vendu";});
  // Offres acceptées ce mois (dateCompromis dans le mois en cours)
  var _now       = new Date();
  var _annee     = _now.getFullYear();
  var _mois      = _now.getMonth();
  function _inMoisCourant(d) {
    if (!d) return false;
    var dt = new Date(d);
    return dt.getFullYear()===_annee && dt.getMonth()===_mois;
  }
  var offresMoisCourant  = myMandats.filter(function(m){ return _inMoisCourant(m.dateCompromis); });
  var ventesMoisCourant  = myMandats.filter(function(m){ return m.statut==="vendu" && _inMoisCourant(m.dateSignature||m.dateCompromis); });
  var caOffresMois       = offresMoisCourant.reduce(function(s,m){return s+(m.commission||0);},0);
  var caVentesMois       = ventesMoisCourant.reduce(function(s,m){return s+(m.commission||0);},0);
  var caStock   = active.reduce(function(s,m){return s+m.commission;},0);
  var caSigne   = compromis.reduce(function(s,m){return s+m.commission;},0);
  var caEnc     = compromis.filter(function(m){return m.clausesSuspensivesLevees;}).reduce(function(s,m){return s+m.commission;},0);
  var caReal    = vendus.reduce(function(s,m){return s+m.commission;},0);
  var lt1m = active.filter(function(m){return diffDays(m.dateMandat,todayStr)<=30;});
  var lt3m = active.filter(function(m){return diffDays(m.dateMandat,todayStr)<=90;});
  var lt6m = active.filter(function(m){return diffDays(m.dateMandat,todayStr)<=180;});
  var gt6m = active.filter(function(m){return diffDays(m.dateMandat,todayStr)>180;});
  var nbExcl   = active.filter(function(m){return m.typeMandat==="exclusif";}).length;
  var nbSimple = active.filter(function(m){return m.typeMandat==="simple";}).length;
  var upcomingSig = compromis.filter(function(m){return !!m.dateSignature;}).sort(function(a,b){return new Date(a.dateSignature)-new Date(b.dateSignature);});

  // Stats location
  var locTrouvees = myLocs.filter(function(l){return l.locataireTrouve;});
  var locEnCours  = myLocs.filter(function(l){return !l.locataireTrouve;});
  var caLocation  = locTrouvees.reduce(function(s,l){return s+l.commission;},0);

  // Stats gestion
  var caGestionMensuel = myGestion.reduce(function(s,g){return s+g.commissionMensuelle;},0);
  var caGestionAnnuel  = caGestionMensuel * 12;

  // Classement
  var periodMandats = useMemo(function() {
    return myMandats.filter(function(m) {
      var ref = m.statut==="vendu" ? m.dateSignature : m.dateMandat;
      return inPeriod(ref, period, customFrom, customTo);
    });
  }, [myMandats, period, customFrom, customTo]);

  // Période "mois en cours" pour les métriques mensuelles du classement
  var _moisDebut = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().slice(0,10);
  var _moisFin   = new Date(_now.getFullYear(), _now.getMonth()+1, 0).toISOString().slice(0,10);
  function inMoisActuel(d) { return d && d >= _moisDebut && d <= _moisFin; }

  var ranking = agents.map(function(a) {
    // Sur la période sélectionnée (pour les indicateurs principaux)
    var myM  = periodMandats.filter(function(m){return m.agentId===a.id;});
    var vend = myM.filter(function(m){return m.statut==="vendu";});
    var comp = myM.filter(function(m){return m.statut==="compromis";});
    var act  = myM.filter(function(m){return m.statut==="mandat";});
    var myL  = myLocs.filter(function(l){return l.agentId===a.id && l.locataireTrouve;});
    var obj  = objectifs.find(function(o){return o.agentId===a.id && o.annee===new Date().getFullYear();});
    var caRealise = vend.reduce(function(s,m){return s+m.commission;},0);

    // Indicateurs MENSUELS spécifiques (toujours sur mois en cours)
    var allAgentMandats = myMandats.filter(function(m){return m.agentId===a.id;});
    // Actes définitifs signés notaire ce mois (dateSignature dans le mois)
    var actesDefMois = allAgentMandats.filter(function(m){ return m.statut==="vendu" && inMoisActuel(m.dateSignature); });
    // Plus grosse commission acte définitif ce mois
    var maxCommMois = actesDefMois.reduce(function(max,m){ return Math.max(max, m.commission||0); }, 0);
    // Offres acceptées ce mois (dateCompromis dans le mois)
    var offresMois = allAgentMandats.filter(function(m){ return inMoisActuel(m.dateCompromis); });
    // Mandats pris ce mois (dateMandat dans le mois)
    var mandatsMois = allAgentMandats.filter(function(m){ return inMoisActuel(m.dateMandat); });
    // Mandats actifs en stock aujourd'hui
    var mandatsActuels = allAgentMandats.filter(function(m){return m.statut==="mandat";}).length;
    // Évolution stock : mandats actifs vs il y a 30 jours
    var il30j = new Date(_now - 30*86400000).toISOString().slice(0,10);
    var mandatsIl30j = allAgentMandats.filter(function(m){
      return m.dateMandat && m.dateMandat <= il30j && (m.statut==="mandat" || (m.dateCompromis && m.dateCompromis > il30j));
    }).length;
    var evolutionStock = mandatsActuels - mandatsIl30j;
    // Prospection ce mois
    var prospecMois = (prospection||[]).filter(function(p){ return p.agentId===a.id && inMoisActuel(p.dateVisite||p.date); }).length;

    // Taux moyen de commission (commission / prix) sur toutes les ventes de la période
    var vendusAvecPrix = vend.filter(function(m){ return m.prix && m.prix > 0 && m.commission && m.commission > 0; });
    var txCommMoyen = vendusAvecPrix.length > 0
      ? Math.round(vendusAvecPrix.reduce(function(s,m){ return s + (m.commission/m.prix*100); }, 0) / vendusAvecPrix.length * 100) / 100
      : null;
    // Taux commission sur compromis également
    var compAvecPrix = comp.filter(function(m){ return m.prix && m.prix > 0 && m.commission && m.commission > 0; });
    var txCommCompromis = compAvecPrix.length > 0
      ? Math.round(compAvecPrix.reduce(function(s,m){ return s + (m.commission/m.prix*100); }, 0) / compAvecPrix.length * 100) / 100
      : null;

    return {
      ...a,
      caRealise,
      caSigne:       comp.reduce(function(s,m){return s+m.commission;},0),
      caEncaissable: comp.filter(function(m){return m.clausesSuspensivesLevees;}).reduce(function(s,m){return s+m.commission;},0),
      caStock:       act.reduce(function(s,m){return s+m.commission;},0),
      caLocation:    myL.reduce(function(s,l){return s+l.commission;},0),
      nbVendus:vend.length, nbCompromis:comp.length, nbMandats:act.length,
      exclusifs:myM.filter(function(m){return m.typeMandat==="exclusif";}).length,
      nbLocations:myL.length,
      objectif: obj ? obj.montantHT : 0,
      progress: obj && obj.montantHT > 0 ? Math.min(100, Math.round(caRealise/obj.montantHT*100)) : 0,
      txCommMoyen, txCommCompromis,
      // Mensuels
      nbActesDefMois: actesDefMois.length,
      maxCommMois,
      nbOffresMois: offresMois.length,
      nbMandatsMois: mandatsMois.length,
      evolutionStock,
      prospecMois,
    };
  }).sort(function(a,b){
    var val = function(x){ return x[critereClassement]||0; };
    return val(b) - val(a);
  });
  var filteredMandats = useMemo(function() {
    return myMandats.filter(function(m) {
      if (filterAgent  && m.agentId!==filterAgent)    return false;
      if (filterStatut && m.statut!==filterStatut)    return false;
      if (filterType   && m.typeMandat!==filterType)  return false;
      if (filterBien   && m.typeBien!==filterBien)       return false;
      if (prixMin && (m.prix||0) < Number(prixMin)) return false;
      if (prixMax && (m.prix||0) > Number(prixMax)) return false;
      if (searchText) {
        var q = searchText.toLowerCase();
        var match = (m.adresse||"").toLowerCase().includes(q) || (m.ref||"").toLowerCase().includes(q) || (m.typeBien||"").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [myMandats, filterAgent, filterStatut, filterType, filterBien, searchText, prixMin, prixMax]);

  // Tasks
  var pendingTasks = tasks.filter(function(t){return t.agenceId===agenceId && t.statut!=="terminee";});
  var nbTasks = pendingTasks.length;

  // Alertes
  // Signatures à venir (dans les 30 prochains jours)
  var signaturesProches = compromis.filter(function(m){
    if (!m.dateSignature) return false;
    var j = diffDays(todayStr, m.dateSignature);
    return j >= 0 && j <= 30;
  }).sort(function(a,b){ return new Date(a.dateSignature)-new Date(b.dateSignature); });
  // Mandats > 3 mois sans compromis (potentielle baisse de prix)
  var mandatsAnciensAlerte = active.filter(function(m){
    return m.dateMandat && diffDays(m.dateMandat, todayStr) > 90;
  }).sort(function(a,b){ return new Date(a.dateMandat)-new Date(b.dateMandat); });
  var nbAlertes = signaturesProches.length + mandatsAnciensAlerte.length;

  // CRUD
  function saveMandat(form) {
    var data = {...form, agenceId:agenceId, id:editingMandat ? editingMandat.id : "m-"+Date.now()};
    var isNew = !editingMandat;
    setMandats(function(prev) { var ex=prev.find(function(m){return m.id===data.id;}); return ex?prev.map(function(m){return m.id===data.id?data:m;}): [...prev,data]; });
    if (addJournal) addJournal({ type:isNew?"creation":"modification", description:(isNew?"Mandat créé : ":"Mandat modifié : ")+data.ref+" — "+data.adresse, cible:"mandat", cibleId:data.id });
    if (isNew) { notifNouveauMandat(data, currentUser.nom); }
    else {
      if (editingMandat && editingMandat.prix && data.prix < editingMandat.prix) { notifBaissePrix(data, editingMandat.prix, data.prix); }
      if (editingMandat && editingMandat.statut !== "compromis" && data.statut === "compromis") {
        var agentM = users.find(function(u){ return u.id===data.agentId; });
        notifNouveauCompromis(data, agentM ? agentM.nom : "");
      }
    }
    setShowMandatForm(false); setEditingMandat(null);
  }
  function deleteMandat(id) {
    if (!window.confirm("Supprimer ce mandat ?")) return;
    var m2del = mandats.find(function(m){return m.id===id;});
    setMandats(function(prev){return prev.filter(function(m){return m.id!==id;});});
    if (addJournal) addJournal({ type:"suppression", description:"Mandat supprimé : "+(m2del?m2del.ref+" — "+m2del.adresse:id), cible:"mandat", cibleId:id });
  }
  function saveLoc(form) {
    var data = {...form, agenceId:agenceId, id:editingLoc ? editingLoc.id : "loc-"+Date.now()};
    var isNewL = !editingLoc;
    setLocations(function(prev){ var ex=prev.find(function(l){return l.id===data.id;}); return ex?prev.map(function(l){return l.id===data.id?data:l;}):[...prev,data]; });
    if (addJournal) addJournal({ type:isNewL?"creation":"modification", description:(isNewL?"Location créée : ":"Location modifiée : ")+data.ref+" — "+data.adresse, cible:"location", cibleId:data.id });
    setShowLocForm(false); setEditingLoc(null);
  }
  function deleteLoc(id) {
    if (!window.confirm("Supprimer cette location ?")) return;
    var l2del = locations.find(function(l){return l.id===id;});
    setLocations(function(prev){return prev.filter(function(l){return l.id!==id;});});
    if (addJournal) addJournal({ type:"suppression", description:"Location supprimée : "+(l2del?l2del.ref+" — "+l2del.adresse:id), cible:"location", cibleId:id });
  }
  function saveGest(form) {
    var data = {...form, agenceId:agenceId, id:editingGest ? editingGest.id : "g-"+Date.now()};
    var isNewG = !editingGest;
    setGestion(function(prev){ var ex=prev.find(function(g){return g.id===data.id;}); return ex?prev.map(function(g){return g.id===data.id?data:g;}):[...prev,data]; });
    if (addJournal) addJournal({ type:isNewG?"creation":"modification", description:(isNewG?"Gestion créée : ":"Gestion modifiée : ")+data.ref+" — "+data.adresse, cible:"gestion", cibleId:data.id });
    setShowGestForm(false); setEditingGest(null);
  }
  function deleteGest(id) {
    if (!window.confirm("Supprimer ce bien en gestion ?")) return;
    var g2del = gestion.find(function(g){return g.id===id;});
    setGestion(function(prev){return prev.filter(function(g){return g.id!==id;});});
    if (addJournal) addJournal({ type:"suppression", description:"Gestion supprimée : "+(g2del?g2del.ref+" — "+g2del.adresse:id), cible:"gestion", cibleId:id });
  }
  function celebrerOffreAcceptee(mandat) {
    var agent = users.find(function(u){ return u.id===mandat.agentId; });
    jouerApplaudissements();
    setShowBravo({ mandatRef: mandat.ref, adresse: mandat.adresse, agentNom: agent?agent.nom:"", commission: mandat.commission });
    setTimeout(function(){ setShowBravo(null); }, 5000);
    // Notification push à toute l'équipe
    notifNouveauCompromis(mandat, agent?agent.nom:"");
  }

  function toggleAgentActif(id) {
    setUsers(function(prev){return prev.map(function(u){return u.id===id?{...u,actif:!u.actif}:u;});});
  }

  // Nav items
  var navItems = [
    {id:"dashboard",  icon:"📊", label:"Dashboard",  shortLabel:"Board",  active:tab==="dashboard",  onClick:function(){setTab("dashboard");}},
    {id:"ca",         icon:"📈", label:"CA Réalisé",  shortLabel:"CA",      active:tab==="ca",         onClick:function(){setTab("ca");}},
    {id:"rapport",    icon:"📄", label:"Rapport mensuel", shortLabel:"Rapport", active:tab==="rapport", onClick:function(){setTab("rapport");}},
    {id:"mandats",    icon:"📋", label:"Mandats",     shortLabel:"Mandats",active:tab==="mandats",    onClick:function(){setTab("mandats");},    badge:nbAlertes||null},
    {id:"locations",  icon:"🏠", label:"Locations",   shortLabel:"Locs",   active:tab==="locations",  onClick:function(){setTab("locations");}},
    {id:"gestion",    icon:"🔑", label:"Gestion",     shortLabel:"Gestion",active:tab==="gestion",    onClick:function(){setTab("gestion");}},
    {id:"classement", icon:"🏆", label:"Classement",  shortLabel:"Classe", active:tab==="classement", onClick:function(){setTab("classement");}},
    {id:"objectifs",  icon:"🎯", label:"Objectifs",    shortLabel:"Objectifs",active:tab==="objectifs",  onClick:function(){setTab("objectifs");}},
    {id:"agents",     icon:"👥", label:"Agents",      shortLabel:"Agents", active:tab==="agents",     onClick:function(){setTab("agents");}, badge:(resets||[]).filter(function(r){return !r.traite;}).length||null},
    {id:"prospection",icon:"🗺️", label:"Prospection", shortLabel:"Prosp",  active:tab==="prospection",onClick:function(){setTab("prospection");}},
    {id:"taches",     icon:"✅", label:"Tâches",      shortLabel:"Tâches", active:tab==="taches",     onClick:function(){setTab("taches");},     badge:nbTasks||null},
    {id:"leads",      icon:"📥", label:"Leads",       shortLabel:"Leads",   active:tab==="leads",      onClick:function(){setTab("leads");}},
    {id:"recherches", icon:"🔍", label:"Recherches",  shortLabel:"Rech.",   active:tab==="recherches", onClick:function(){setTab("recherches");}},
    {id:"messagerie", icon:"💬", label:"Messagerie",  shortLabel:"Msgs",    active:tab==="messagerie", onClick:function(){setTab("messagerie");}},
    {id:"offmarket",  icon:"🔒", label:"Off Market",   shortLabel:"OffMkt",  active:tab==="offmarket",  onClick:function(){setTab("offmarket");}},
    {id:"carte",      icon:"🗺️", label:"Carte",         shortLabel:"Carte",   active:tab==="carte",      onClick:function(){setTab("carte");}},
    {id:"outils",     icon:"🛠️", label:"Outils",         shortLabel:"Outils",  active:tab==="outils",     onClick:function(){setTab("outils");}},
    {id:"feedback",   icon:"💡", label:"Suggestions",   shortLabel:"Ideas",   active:tab==="feedback",   onClick:function(){setTab("feedback");}},
    {id:"profil",     icon:"👤", label:"Mon profil",    shortLabel:"Profil",  active:tab==="profil",     onClick:function(){setTab("profil");}},
  ];

  return (
    <AppShell navItems={navItems} title={tab==="objectifs"?"🎯 Objectifs & Progression":tab==="rapport"?"📄 Rapport mensuel":tab==="ca"?"📈 CA Réalisé":tab==="dashboard"?"📊 Dashboard":tab==="mandats"?"📋 Mandats":tab==="locations"?"🏠 Locations":tab==="gestion"?"🔑 Gestion locative":tab==="offmarket"?"🔒 Off Market":tab==="outils"?"🛠️ Outils":tab==="feedback"?"💡 Suggestions":tab==="carte"?"🗺️ Carte interactive":tab==="classement"?"🏆 Classement":tab==="agents"?"👥 Agents":tab==="prospection"?"🗺️ Prospection":tab==="taches"?"✅ Tâches":tab==="leads"?"📥 Leads":tab==="recherches"?"🔍 Recherches":"💬 Messagerie"}
      topbarActions={
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {(ctx.notifPerm||"default")!=="granted"
            ? <button onClick={async function(){ if(ctx.demanderPermission) await ctx.demanderPermission(); }} style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:"#D97706",cursor:"pointer",fontFamily:"var(--font)"}}>{"🔔 Notifs"}</button>
            : <span style={{fontSize:11,color:"#059669",fontWeight:700}}>{"🔔"}</span>}
          {tab==="mandats"    && <button className="btn btn-primary btn-sm" onClick={function(){setEditingMandat(null);setShowMandatForm(true);}}>{"+ Mandat"}</button>}
          {tab==="locations"  && <button className="btn btn-primary btn-sm" onClick={function(){setEditingLoc(null);setShowLocForm(true);}}>{"+ Location"}</button>}
          {tab==="gestion"    && <button className="btn btn-primary btn-sm" onClick={function(){setEditingGest(null);setShowGestForm(true);}}>{"+ Bien en gestion"}</button>}
          {onRetourGroupe && <button className="btn btn-secondary btn-sm" onClick={onRetourGroupe}>{"← Vue groupe"}</button>}
          {tab==="agents"     && <button className="btn btn-navy btn-sm" onClick={function(){setShowInvite(true);}}>{"📩 Inviter un agent"}</button>}
          {tab==="taches"     && <button className="btn btn-primary btn-sm" onClick={function(){setShowTaskModal(true);}}>{"+ Nouvelle tâche"}</button>}
        </div>
      }>

      <SaveBanner/>

      {/* ──────────── DASHBOARD ──────────── */}
      {tab==="dashboard" && (
        <div>
          <DashboardMatin onNavigate={function(t){setTab(t);}}/>
          <div style={{height:1,background:"var(--g100)",margin:"16px 0"}}></div>
          {/* Signatures qui approchent */}
          {signaturesProches.length>0 && (
            <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontWeight:800,color:"#065F46",fontSize:13,marginBottom:8}}>{"🖊️ "+signaturesProches.length+" signature"+(signaturesProches.length>1?"s":"")+" programmée"+(signaturesProches.length>1?"s":"")+" dans les 30 jours"}</div>
              {signaturesProches.map(function(m){
                var a = users.find(function(u){return u.id===m.agentId;});
                var j = diffDays(todayStr,m.dateSignature);
                return (
                  <div key={m.id} onClick={function(){setDetailMandat(m);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #D1FAE5",cursor:"pointer"}}>
                    <div>
                      <span style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{m.ref}</span>
                      <span style={{fontSize:11,color:"var(--g500)",marginLeft:8}}>{m.adresse.split(",")[0]}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                      {a && <span style={{fontSize:11,color:"var(--g400)"}}>{a.nom}</span>}
                      <span style={{background:j<=7?"#D1FAE5":"#F0FDF4",color:j<=7?"#059669":"#065F46",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{"J-"+j}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Mandats > 3 mois — envisager baisse de prix */}
          {mandatsAnciensAlerte.length>0 && (
            <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontWeight:800,color:"#9A3412",fontSize:13,marginBottom:4}}>{"📉 "+mandatsAnciensAlerte.length+" mandat"+(mandatsAnciensAlerte.length>1?"s":"")+" > 3 mois — baisse de prix à envisager"}</div>
              <div style={{fontSize:11,color:"#C2410C",marginBottom:8}}>{"Contactez le propriétaire pour réévaluer le prix de vente."}</div>
              {mandatsAnciensAlerte.slice(0,5).map(function(m){
                var a = users.find(function(u){return u.id===m.agentId;});
                var age = diffDays(m.dateMandat, todayStr);
                return (
                  <div key={m.id} onClick={function(){setDetailMandat(m);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #FDE68A",cursor:"pointer"}}>
                    <div>
                      <span style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{m.ref}</span>
                      <span style={{fontSize:11,color:"var(--g500)",marginLeft:8}}>{m.adresse.split(",")[0]}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                      {a && <span style={{fontSize:11,color:"var(--g400)"}}>{a.nom}</span>}
                      <span style={{fontSize:12,fontWeight:800,color:"var(--navy)"}}>{m.prix?m.prix.toLocaleString("fr-FR")+"€":"—"}</span>
                      <span style={{background:"#FEF3C7",color:"#D97706",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>{age+"j"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="CA Stock (mandats)" value={fmt(caStock)} color="var(--purple)" icon="📦" sub={nbExcl+" excl. · "+nbSimple+" simples"}/>
            <KpiCard label="CA Signé (compromis)" value={fmt(caSigne)} color="var(--amber)" icon="✍️" sub={compromis.length+" compromis actifs"}/>
            <KpiCard label="CA Encaissable" value={fmt(caEnc)} color="var(--green)" icon="💰" sub="CS levées"/>
            <KpiCard label="CA Réalisé (ventes)" value={fmt(caReal)} color="var(--red)" icon="🏆" sub={vendus.length+" ventes actées"}/>
          </div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Offres acceptées ce mois" value={offresMoisCourant.length} color="var(--amber)" icon="🤝" sub={fmt(caOffresMois)+" · "+new Date().toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}/>
            <KpiCard label="Ventes actées ce mois" value={ventesMoisCourant.length} color="var(--green)" icon="🏆" sub={fmt(caVentesMois)+" commissions"}/>
            <KpiCard label="Locations signées" value={locTrouvees.length} color="var(--blue)" icon="🏠" sub={fmt(caLocation)+" commissions"}/>
            <KpiCard label="Gestion locative" value={myGestion.length+" biens"} color="var(--navy)" icon="🔑" sub={fmt(caGestionMensuel)+"/mois"}/>
          </div>

          {/* Signatures à venir */}
          {upcomingSig.length>0 && (
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header"><span className="card-title">{"📅 Signatures prévisionnelles"}</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr>{["Réf","Type","Adresse","Agent","Commission","CS","Date sig.","J-"].map(function(h){return <th key={h}>{h}</th>;})}</tr></thead>
                  <tbody>
                    {upcomingSig.map(function(m) {
                      var a = users.find(function(u){return u.id===m.agentId;});
                      var j = diffDays(todayStr, m.dateSignature);
                      return (
                        <tr key={m.id}>
                          <td style={{fontWeight:800,color:"var(--navy)"}}>{m.ref}</td>
                          <td><BadgeType type={m.typeMandat}/></td>
                          <td style={{maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.adresse}</td>
                          <td>{a&&a.nom}</td>
                          <td style={{fontWeight:700,color:"var(--green)"}}>{fmt(m.commission)}</td>
                          <td>{m.clausesSuspensivesLevees?"✅":"—"}</td>
                          <td>{fmtDate(m.dateSignature)}</td>
                          <td><span style={{background:j<=30?"#FEF3C7":"#F0FDF4",color:j<=30?"#D97706":"#059669",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:800}}>{"J-"+j}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Courbe évolution stock */}
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><span className="card-title">{"📈 Évolution du stock (4 semaines)"}</span></div>
            <div className="card-body">
              {(function(){
                var semaines = [];
                for (var i=3; i>=0; i--) {
                  var dRef = new Date(_now - i*7*86400000);
                  var dStr = dRef.toISOString().slice(0,10);
                  var count = myMandats.filter(function(m){
                    return m.dateMandat && m.dateMandat <= dStr && m.statut!=="vendu";
                  }).length;
                  semaines.push({label:"S-"+i, count, dStr});
                }
                var maxC = Math.max(...semaines.map(function(s){return s.count;}), 1);
                return (
                  <div style={{display:"flex",gap:8,alignItems:"flex-end",height:80}}>
                    {semaines.map(function(s,i) {
                      var isLast = i===semaines.length-1;
                      var h = Math.round(s.count/maxC*70);
                      return (
                        <div key={s.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <div style={{fontSize:11,fontWeight:800,color:isLast?"var(--blue)":"var(--g400)"}}>{s.count}</div>
                          <div style={{width:"100%",height:h+"px",background:isLast?"var(--blue)":"var(--g200)",borderRadius:"4px 4px 0 0",minHeight:4,transition:"height 0.3s"}}></div>
                          <div style={{fontSize:10,color:"var(--g400)",fontWeight:600}}>{isLast?"Auj.":s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {(function(){
                var delaiVendus = myMandats.filter(function(m){return m.statut==="vendu"&&m.dateMandat&&m.dateSignature;});
                if (delaiVendus.length===0) return null;
                var moy = Math.round(delaiVendus.reduce(function(s,m){return s+Math.round((new Date(m.dateSignature)-new Date(m.dateMandat))/86400000);},0)/delaiVendus.length);
                return <div style={{marginTop:12,fontSize:12,color:"var(--g500)",textAlign:"center"}}>{"⏱ Délai moyen mandat → vente : "+moy+" jours (sur "+delaiVendus.length+" ventes)"}</div>;
              })()}
            </div>
          </div>

          {/* Taux de commission moyen agence */}
          {txCommMoyenAgence !== null && (
            <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
              <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📐 Taux de commission moyen agence"}</span>
                <span style={{fontWeight:900,fontSize:16,color:txCommMoyenAgence>=4?"var(--green)":txCommMoyenAgence>=3?"var(--amber)":"var(--red)"}}>{txCommMoyenAgence+"%"}</span>
              </div>
              <div style={{padding:"10px 14px"}}>
                {txCommParAgent.map(function(a,i){
                  var diff = Math.round((a.txComm - txCommMoyenAgence)*100)/100;
                  return (
                    <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<txCommParAgent.length-1?"1px solid var(--g50)":"none"}}>
                      <div style={{width:30,height:30,borderRadius:15,background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:11,flexShrink:0}}>{a.avatar}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,color:"var(--navy)",fontSize:12}}>{a.nom}</div>
                        <div style={{fontSize:10,color:"var(--g400)"}}>{a.nbVentes+" vente"+(a.nbVentes>1?"s":"")}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:900,fontSize:14,color:a.txComm>=txCommMoyenAgence?"var(--green)":"var(--red)"}}>{a.txComm+"%"}</div>
                        <div style={{fontSize:10,color:diff>=0?"var(--green)":"var(--red)",fontWeight:700}}>{(diff>0?"+":"")+diff+" pt"}</div>
                      </div>
                    </div>
                  );
                })}
                {txCommParAgent.length===0 && <div style={{fontSize:12,color:"var(--g400)",textAlign:"center",padding:"8px"}}>{"Aucune vente actée avec prix et commission renseignés"}</div>}
              </div>
            </div>
          )}

          {/* Recommandations par agent */}
          <RecommandationsEquipe
            agents={agents}
            mandats={myMandats}
            locations={myLocs}
            gestion={myGestion}
            objectifs={objectifs}
          />

          {/* Ancienneté mandats */}
          <div className="card">
            <div className="card-header"><span className="card-title">{"⏱ Ancienneté mandats actifs"}</span></div>
            <div className="card-body">
              {[{label:"< 1 mois",count:lt1m.length,color:"var(--green)"},{label:"1-3 mois",count:lt3m.length-lt1m.length,color:"var(--blue)"},{label:"3-6 mois",count:lt6m.length-lt3m.length,color:"var(--amber)"},{label:"> 6 mois",count:gt6m.length,color:"var(--red)"}].map(function(r) {
                return (
                  <div key={r.label} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{r.label}</span>
                      <span style={{fontSize:13,fontWeight:800,color:r.color}}>{r.count}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{width:(active.length>0?r.count/active.length*100:0)+"%",background:r.color}}></div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ──────────── MANDATS ──────────── */}
      {tab==="mandats" && (
        <div>
          {/* Barre de recherche + filtres */}
          <div style={{marginBottom:10}}>
            <input
              className="form-input"
              value={searchText}
              onChange={function(e){setSearchText(e.target.value);}}
              placeholder="🔍 Rechercher par adresse ou référence…"
              style={{width:"100%",marginBottom:8}}
            />
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
              <input
                className="form-input"
                type="number"
                value={prixMin}
                onChange={function(e){setPrixMin(e.target.value);}}
                placeholder="Prix min (€)"
                style={{width:"auto",flex:1,fontSize:12,minWidth:100}}
              />
              <span style={{fontSize:12,color:"var(--g400)",flexShrink:0}}>{"—"}</span>
              <input
                className="form-input"
                type="number"
                value={prixMax}
                onChange={function(e){setPrixMax(e.target.value);}}
                placeholder="Prix max (€)"
                style={{width:"auto",flex:1,fontSize:12,minWidth:100}}
              />
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <select className="form-select" style={{width:"auto",fontSize:12}} value={filterBien} onChange={function(e){setFilterBien(e.target.value);}}>
                <option value="">{"Tous types de bien"}</option>
                <option value="appartement">{"🏢 Appartement"}</option>
                <option value="maison">{"🏠 Maison"}</option>
                <option value="terrain">{"🌿 Terrain"}</option>
                <option value="immeuble">{"🏗️ Immeuble"}</option>
                <option value="garage">{"🚗 Garage"}</option>
                <option value="local_pro_location">{"🏬 Local pro à louer"}</option>
                <option value="local_pro_vente">{"🏪 Local pro à vendre"}</option>
              </select>
              <select className="form-select" style={{width:"auto",fontSize:12}} value={filterAgent} onChange={function(e){setFilterAgent(e.target.value);}}>
                <option value="">{"Tous agents"}</option>
                {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
              </select>
              <select className="form-select" style={{width:"auto",fontSize:12}} value={filterStatut} onChange={function(e){setFilterStatut(e.target.value);}}>
                <option value="">{"Tous statuts"}</option>
                <option value="mandat">{"Mandat"}</option>
                <option value="compromis">{"Compromis"}</option>
                <option value="vendu">{"Vendu"}</option>
              </select>
              <select className="form-select" style={{width:"auto",fontSize:12}} value={filterType} onChange={function(e){setFilterType(e.target.value);}}>
                <option value="">{"Exclu. & Simple"}</option>
                <option value="exclusif">{"Exclusif"}</option>
                <option value="simple">{"Simple"}</option>
              </select>
              {(searchText||filterBien||filterAgent||filterStatut||filterType||prixMin||prixMax) && (
                <button className="btn btn-secondary btn-sm" onClick={function(){setSearchText("");setFilterBien("");setFilterAgent("");setFilterStatut("");setFilterType("");setPrixMin("");setPrixMax("");}}>{"✕ Effacer"}</button>
              )}
              <span style={{fontSize:12,color:"var(--g400)",marginLeft:"auto"}}>{filteredMandats.length+" mandat(s)"}</span>
            </div>
          </div>
          {/* Cartes mandats cliquables avec miniature */}
          <div>
            {filteredMandats.map(function(m) {
              var a    = users.find(function(u){return u.id===m.agentId;});
              var exp  = m.dateExpiration && diffDays(todayStr,m.dateExpiration)>=0 && diffDays(todayStr,m.dateExpiration)<=14;
              var bord = m.statut==="vendu"?"var(--green)":m.statut==="compromis"?"var(--amber)":"var(--blue)";
              var thumb= (m.photos&&m.photos.length>0) ? m.photos[0] : null;
              return (
                <div key={m.id} className="m-card" style={{borderLeft:"4px solid "+bord,marginBottom:10,cursor:"pointer"}} onClick={function(){setDetailMandat(m);}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    {/* Miniature photo */}
                    <div style={{width:72,height:72,borderRadius:10,flexShrink:0,overflow:"hidden",background:"var(--g100)",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--g200)"}}>
                      {thumb
                        ? <img src={thumb} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        : <span style={{fontSize:24,opacity:0.3}}>{"🏠"}</span>
                      }
                    </div>
                    {/* Infos principales */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4,alignItems:"center"}}>
                        <span style={{fontWeight:800,color:"var(--navy)"}}>{m.ref}</span>
                        <BadgeType type={m.typeMandat}/>
                        <BadgeStatut statut={m.statut}/>
                        {m.typeBien && <span className="badge" style={{background:"var(--g100)",color:"var(--g500)",border:"1px solid var(--g200)"}}>{{appartement:"🏢 Appart.",maison:"🏠 Maison",terrain:"🌿 Terrain",immeuble:"🏗️ Immeuble",garage:"🚗 Garage",local_pro_location:"🏬 Local à louer",local_pro_vente:"🏪 Local à vendre"}[m.typeBien]||m.typeBien}</span>}
                      {m.surface && <span className="badge" style={{background:"var(--g100)",color:"var(--g500)",border:"1px solid var(--g200)"}}>{"📐 "+m.surface+"m²"}</span>}
                      {m.nbPieces && <span className="badge" style={{background:"var(--g100)",color:"var(--g500)",border:"1px solid var(--g200)"}}>{"🛏️ "+m.nbPieces+"P"}</span>}
                      {m.dpe && <span className="badge" style={{background:"var(--g100)",color:"var(--g500)",border:"1px solid var(--g200)"}}>{"🌿 DPE "+m.dpe}</span>}
                        {exp && <span className="badge" style={{background:"#FEF2F2",color:"var(--red)",border:"1px solid #FECACA"}}>{"⚠️ Expire bientôt"}</span>}
                        {(m.photos&&m.photos.length>0) && <span style={{fontSize:10,background:"#EFF6FF",color:"var(--blue)",padding:"1px 7px",borderRadius:20,fontWeight:700}}>{"📷 "+(m.photos.length)}</span>}
                      </div>
                      <div style={{fontSize:13,color:"var(--g700)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.adresse}</div>
                      <div style={{fontSize:12,color:"var(--g400)",marginBottom:4}}>{(a&&a.nom)||"—"}</div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontWeight:800,color:"var(--green)",fontSize:14}}>{fmt(m.commission)}</span>
                        <span style={{fontSize:11,color:"var(--g400)"}}>{fmt(m.prix)}</span>
                        {m.surface && <span style={{fontSize:11,color:"var(--g400)"}}>{m.surface+"m²"}</span>}
                      </div>
                    </div>
                    {/* Bouton actions rapides */}
                    <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}} onClick={function(e){e.stopPropagation();}}>
                      <button className="btn btn-secondary btn-sm" onClick={function(e){e.stopPropagation();setEditingMandat(m);setShowMandatForm(true);}}>{"✏️"}</button>
                      {m.statut==="sous_offre" && (
                        <button onClick={function(e){e.stopPropagation();celebrerOffreAcceptee(m);}} title="Célébrer cette offre !" title="Célébrer cette offre !" style={{background:"linear-gradient(135deg,#F59E0B,#EF4444)",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,boxShadow:"0 2px 8px rgba(239,68,68,0.4)"}}>{"🎉"}</button>
                      )}
                      <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(e){e.stopPropagation();deleteMandat(m.id);}}>{"🗑"}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────── LOCATIONS ──────────── */}
      {tab==="locations" && (
        <div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Locataires trouvés" value={locTrouvees.length} color="var(--green)" icon="✅" sub={fmt(caLocation)+" commissions"}/>
            <KpiCard label="En recherche" value={locEnCours.length} color="var(--amber)" icon="🔍"/>
            <KpiCard label="Total locations" value={myLocs.length} color="var(--navy)" icon="🏠"/>
          </div>
          {myLocs.map(function(l) {
            var a = users.find(function(u){return u.id===l.agentId;});
            return (
              <div key={l.id} className="m-card" style={{borderLeft:"4px solid "+(l.locataireTrouve?"var(--green)":"var(--amber)"),marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",gap:6,marginBottom:3}}>
                      <span style={{fontWeight:800,color:"var(--navy)"}}>{l.ref}</span>
                      <span className={"badge "+(l.locataireTrouve?"badge-vendu":"badge-compromis")}>{l.locataireTrouve?"✅ Trouvé":"🔍 En recherche"}</span>
                    </div>
                    <div style={{fontSize:13,color:"var(--g700)"}}>{l.adresse}</div>
                    <div style={{fontSize:12,color:"var(--g400)",marginTop:2}}>{a&&a.nom}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,color:"var(--green)"}}>{fmt(l.commission)}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{l.loyer+"€/mois"}</div>
                  </div>
                </div>
                {l.locataireTrouve && (
                  <div style={{fontSize:12,color:"var(--g700)",background:"var(--g50)",borderRadius:8,padding:"7px 10px",marginBottom:8}}>
                    {"Locataire : "+l.locatairePrenom+" "+l.locataireNom}
                    {l.locataireTel && <a href={"tel:"+l.locataireTel.replace(/\s/g,"")} style={{display:"inline-block",marginLeft:8,background:"#059669",color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:800,textDecoration:"none"}}>{"📞"}</a>}
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setEditingLoc(l);setShowLocForm(true);}}>{"✏️ Modifier"}</button>
                  <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(){deleteLoc(l.id);}}>{"🗑"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── GESTION LOCATIVE ──────────── */}
      {tab==="gestion" && <GestionLocative/>}
      {tab==="outils" && <Outils/>}
      {tab==="feedback" && <Feedback/>}
      {tab==="offmarket" && <OffMarket/>}
      {tab==="carte" && <CarteInteractive onNavigate={function(targetTab, bienId, bienType){
        if ((bienType==="mandat"||bienType==="compromis"||bienType==="vendu") && bienId) {
          var found = myMandats.find(function(m){ return m.id===bienId; });
          if (found) { setDetailMandat(found); return; }
        }
        setTab(targetTab);
      }}/>}

      {/* ──────────── CLASSEMENT ──────────── */}
      {tab==="classement" && (
        <div>
          {/* Contrôles */}
          <div style={{background:"#fff",borderRadius:"var(--r)",padding:"12px 14px",marginBottom:12,boxShadow:"var(--sh)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:13}}>{"Période :"}</span>
              <PeriodSelector value={period} onChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo}/>
              <button className="btn btn-secondary btn-sm" onClick={function(){setShowObjModal(true);}}>{"🎯 Objectifs"}</button>
            </div>
            {/* Critères de tri */}
            <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>{"🏆 Trier par"}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[
                {id:"nbActesDefMois",   label:"🔏 Actes définitifs",    sub:"ce mois"},
                {id:"nbOffresMois",     label:"🤝 Offres acceptées",     sub:"ce mois"},
                {id:"nbMandatsMois",    label:"📋 Mandats pris",          sub:"ce mois"},
                {id:"evolutionStock",   label:"📈 Évolution stock",       sub:"vs -30 jours"},
                {id:"prospecMois",      label:"🚶 Prospection",           sub:"ce mois"},
                {id:"maxCommMois",      label:"💎 Meilleure commission",  sub:"acte ce mois"},
                {id:"caRealise",        label:"💰 CA réalisé",            sub:"période"},
                {id:"txCommMoyen",      label:"📐 Taux commission",        sub:"moy. sur ventes"},
              ].map(function(crit){
                var actif = critereClassement===crit.id;
                return (
                  <button key={crit.id} onClick={function(){setCritereClassement(crit.id);}} style={{padding:"6px 12px",borderRadius:10,border:"2px solid "+(actif?"var(--navy)":"var(--g200)"),background:actif?"var(--navy)":"#fff",color:actif?"#fff":"var(--g500)",fontWeight:700,fontSize:11,cursor:"pointer",textAlign:"left",lineHeight:1.3}}>
                    <div>{crit.label}</div>
                    <div style={{fontSize:9,opacity:.7,fontWeight:600}}>{crit.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Classement */}
          {ranking.map(function(a, i) {
            var col = ["var(--red)","var(--amber)","var(--blue)","var(--green)","var(--purple)"][i] || "var(--g400)";
            // Valeur mise en avant selon le critère sélectionné
            var heroVal, heroLabel;
            if (critereClassement==="nbActesDefMois")   { heroVal=a.nbActesDefMois+" acte"+(a.nbActesDefMois!==1?"s":""); heroLabel="actes définitifs ce mois"; }
            else if (critereClassement==="nbOffresMois") { heroVal=a.nbOffresMois+" offre"+(a.nbOffresMois!==1?"s":""); heroLabel="offres acceptées ce mois"; }
            else if (critereClassement==="nbMandatsMois"){ heroVal=a.nbMandatsMois+" mandat"+(a.nbMandatsMois!==1?"s":""); heroLabel="mandats pris ce mois"; }
            else if (critereClassement==="evolutionStock"){ heroVal=(a.evolutionStock>0?"+":"")+a.evolutionStock; heroLabel="évolution stock vs -30j"; }
            else if (critereClassement==="prospecMois")  { heroVal=a.prospecMois+" action"+(a.prospecMois!==1?"s":""); heroLabel="prospections ce mois"; }
            else if (critereClassement==="maxCommMois")  { heroVal=fmt(a.maxCommMois); heroLabel="meilleure commission acte"; }
            else if (critereClassement==="txCommMoyen") { heroVal=a.txCommMoyen!=null?(a.txCommMoyen+"%"):"—"; heroLabel="taux comm. moyen ventes"; }
            else { heroVal=fmt(a.caRealise); heroLabel="CA réalisé"; }

            return (
              <div key={a.id} className="m-card" style={{borderLeft:"4px solid "+col,marginBottom:10}}>
                {/* En-tête agent */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <span style={{fontSize:22,fontWeight:900,minWidth:28,textAlign:"center"}}>{MEDAL[i]||(i+1)+"."}</span>
                  <div style={{width:40,height:40,borderRadius:20,background:col,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{a.avatar}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14,color:"var(--navy)"}}>{a.nom}</div>
                    <BadgeNiveau niveau={a.niveau}/>
                  </div>
                  {/* Valeur hero (critère sélectionné) */}
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontWeight:900,fontSize:18,color:col,lineHeight:1}}>{heroVal}</div>
                    <div style={{fontSize:9,color:"var(--g400)",maxWidth:80,textAlign:"right",lineHeight:1.2,marginTop:2}}>{heroLabel}</div>
                  </div>
                </div>

                {/* Grille métriques mensuelles */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:10}}>
                  {[
                    {label:"🔏 Actes déf.",  val:a.nbActesDefMois,              raw:a.nbActesDefMois,  highlight:critereClassement==="nbActesDefMois"},
                    {label:"🤝 Offres",       val:a.nbOffresMois,                raw:a.nbOffresMois,    highlight:critereClassement==="nbOffresMois"},
                    {label:"📋 Mandats pris", val:a.nbMandatsMois,               raw:a.nbMandatsMois,   highlight:critereClassement==="nbMandatsMois"},
                    {label:"📈 Stock",         val:(a.evolutionStock>0?"+":"")+a.evolutionStock+" ("+a.nbMandats+")", raw:a.evolutionStock, highlight:critereClassement==="evolutionStock"},
                    {label:"🚶 Prospec.",     val:a.prospecMois,                 raw:a.prospecMois,     highlight:critereClassement==="prospecMois"},
                    {label:"💎 Top comm.",    val:fmt(a.maxCommMois),            raw:a.maxCommMois,     highlight:critereClassement==="maxCommMois"},
                  ].map(function(cell){
                    return (
                      <div key={cell.label} style={{background:cell.highlight?"var(--navy)":"var(--g50)",borderRadius:9,padding:"8px 8px",textAlign:"center",border:cell.highlight?"none":"1px solid var(--g100)"}}>
                        <div style={{fontWeight:900,fontSize:13,color:cell.highlight?"#fff":col,lineHeight:1}}>{cell.val}</div>
                        <div style={{fontSize:9,color:cell.highlight?"rgba(255,255,255,0.7)":"var(--g400)",marginTop:3,fontWeight:600}}>{cell.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* CA + taux commission */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:a.objectif>0?10:0}}>
                  <div style={{background:"var(--g50)",borderRadius:9,padding:"7px 10px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700}}>{"CA réalisé"}</div>
                    <div style={{fontWeight:800,color:"var(--green)",fontSize:13}}>{fmt(a.caRealise)}</div>
                  </div>
                  <div style={{background:"var(--g50)",borderRadius:9,padding:"7px 10px"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700}}>{"CA signé"}</div>
                    <div style={{fontWeight:800,color:"var(--amber)",fontSize:13}}>{fmt(a.caSigne)}</div>
                  </div>
                  <div style={{background:critereClassement==="txCommMoyen"?"var(--navy)":"var(--g50)",borderRadius:9,padding:"7px 10px",border:"1px solid "+(critereClassement==="txCommMoyen"?"var(--navy)":"var(--g100)")}}>
                    <div style={{fontSize:10,color:critereClassement==="txCommMoyen"?"rgba(255,255,255,0.7)":"var(--g400)",fontWeight:700}}>{"📐 Tx comm. moy."}</div>
                    <div style={{fontWeight:900,fontSize:15,color:critereClassement==="txCommMoyen"?"#fff":(a.txCommMoyen!=null&&a.txCommMoyen<3?"var(--red)":a.txCommMoyen!=null&&a.txCommMoyen>=4?"var(--green)":"var(--amber)")}}>{a.txCommMoyen!=null?(a.txCommMoyen+"%"):"—"}</div>
                    {a.txCommCompromis!=null && a.txCommCompromis!==a.txCommMoyen && <div style={{fontSize:9,color:critereClassement==="txCommMoyen"?"rgba(255,255,255,0.5)":"var(--g400)",marginTop:1}}>{"Compr. : "+a.txCommCompromis+"%"}</div>}
                  </div>
                </div>

                {a.objectif > 0 && (
                  <div style={{marginTop:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{color:"var(--g500)"}}>{"Objectif annuel : "+fmt(a.objectif)}</span>
                      <span style={{fontWeight:700,color:col}}>{a.progress+"%"}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{width:a.progress+"%",background:col}}></div></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── AGENTS ──────────── */}
      {tab==="agents" && (
        <div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Agents actifs" value={agents.length} color="var(--navy)" icon="👥"/>
            <KpiCard label="Seniors" value={agents.filter(function(a){return a.niveau==="senior";}).length} color="var(--amber)" icon="🏆"/>
            <KpiCard label="Juniors" value={agents.filter(function(a){return a.niveau==="junior";}).length} color="var(--blue)" icon="🌱"/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <button className="btn btn-secondary btn-sm" onClick={function(){setShowConfigKPI(true);}}>{"⚙️ Paramétrer les seuils KPI"}</button>
          </div>
          {agents.map(function(a, i) {
            var myM  = mandats.filter(function(m){return m.agentId===a.id;});
            var vend = myM.filter(function(m){return m.statut==="vendu";});
            var comp = myM.filter(function(m){return m.statut==="compromis";});
            var act  = myM.filter(function(m){return m.statut==="mandat";});
            var col  = [avatarColor(a.nom)][0];
            return (
              <div key={a.id} className="m-card" style={{borderLeft:"4px solid "+col,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <div className="avatar" style={{background:col}}>{a.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,color:"var(--navy)"}}>{a.nom}</div>
                    <div style={{fontSize:12,color:"var(--g400)"}}>{a.email}</div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <BadgeNiveau niveau={a.niveau}/>
                      {(function(){
                        if (!a.derniereConnexion) return <span style={{fontSize:10,color:"var(--g400)",fontStyle:"italic"}}>{"Jamais connecté"}</span>;
                        var d = new Date(a.derniereConnexion);
                        var now = new Date();
                        var diffH = Math.floor((now-d)/3600000);
                        var diffJ = Math.floor(diffH/24);
                        var label = diffH < 1 ? "Il y a moins d'1h"
                          : diffH < 24 ? "Il y a "+diffH+"h"
                          : diffJ === 1 ? "Hier"
                          : diffJ < 7  ? "Il y a "+diffJ+" jours"
                          : d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"});
                        var col2 = diffJ < 1 ? "#059669" : diffJ < 7 ? "#D97706" : "#DC2626";
                        var bg2  = diffJ < 1 ? "#F0FDF4" : diffJ < 7 ? "#FFFBEB" : "#FEF2F2";
                        return (
                          <span title={d.toLocaleString("fr-FR")} style={{fontSize:10,background:bg2,color:col2,padding:"2px 8px",borderRadius:20,fontWeight:700,cursor:"help"}}>
                            {"🕐 "+label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span className={"badge "+(a.actif?"badge-vendu":"badge-mandat")}>{a.actif?"Actif":"Inactif"}</span>
                    {a.derniereConnexion && (
                      <div style={{fontSize:10,color:"var(--g400)",marginTop:3}}>
                        {new Date(a.derniereConnexion).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
                        {" · "}
                        {new Date(a.derniereConnexion).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                  {[["Mandats",act.length,"var(--blue)"],["Compromis",comp.length,"var(--amber)"],["Vendus",vend.length,"var(--green)"]].map(function(trio){
                    return (
                      <div key={trio[0]} style={{background:"var(--g50)",borderRadius:9,padding:"8px 10px",textAlign:"center"}}>
                        <div style={{fontWeight:800,color:trio[2],fontSize:18}}>{trio[1]}</div>
                        <div style={{fontSize:10,color:"var(--g400)",marginTop:2}}>{trio[0]}</div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-secondary btn-sm w-full" onClick={function(){toggleAgentActif(a.id);}}>
                  {a.actif ? "🚫 Désactiver le compte" : "✅ Réactiver le compte"}
                </button>
              </div>
            );
          })}
          {/* Invitations en attente */}
          {invitations.filter(function(i){return !i.used;}).length > 0 && (
            <div className="card" style={{marginTop:16}}>
              <div className="card-header"><span className="card-title">{"📩 Invitations en attente"}</span></div>
              <div className="card-body">
                {invitations.filter(function(i){return !i.used;}).map(function(inv) {
                  var u = users.find(function(x){return x.id===inv.userId;});
                  return (
                    <div key={inv.token} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--g100)"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{u&&u.nom}</div>
                        <div style={{fontSize:12,color:"var(--g400)"}}>{inv.email}</div>
                      </div>
                      <span className="badge badge-compromis">{"En attente"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── DEMANDES RESET MOT DE PASSE ── */}
          <DemandesReset resets={resets||[]} resetMdpParManager={resetMdpParManager}/>

          {/* ── JOURNAL D'ACTIVITÉ ── */}
          <JournalActivite journal={journal||[]} users={users} agenceId={agenceId}/>
        </div>
      )}

      {/* ──────────── PROSPECTION ──────────── */}
      {tab==="prospection" && (
        <ProspectionMap currentUser={currentUser} isManager={true}/>
      )}

      {/* ──────────── TÂCHES ──────────── */}
      {tab==="taches" && (
        <div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Tâches en cours" value={pendingTasks.length} color="var(--amber)" icon="⏳"/>
            <KpiCard label="Terminées" value={tasks.filter(function(t){return t.agenceId===agenceId&&t.statut==="terminee";}).length} color="var(--green)" icon="✅"/>
          </div>
          {pendingTasks.map(function(t) {
            var a = users.find(function(u){return u.id===t.agentId;});
            var ech = t.echeance ? diffDays(todayStr, t.echeance) : null;
            return (
              <div key={t.id} className="m-card" style={{borderLeft:"4px solid "+(t.priorite==="haute"?"var(--red)":t.priorite==="moyenne"?"var(--amber)":"var(--blue)"),marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,color:"var(--navy)",marginBottom:4}}>{t.titre}</div>
                    <div style={{fontSize:12,color:"var(--g500)"}}>{t.description}</div>
                  </div>
                  <div style={{flexShrink:0,marginLeft:10}}>
                    <span className={"badge "+(t.statut==="en_cours"?"badge-compromis":"badge-mandat")}>{t.statut==="en_cours"?"▶ En cours":"⏳ Attente"}</span>
                  </div>
                </div>
                <div style={{fontSize:12,color:"var(--g400)",marginBottom:8}}>
                  {"→ "+(a&&a.nom||"Tous")+(ech!==null?(" · "+(ech<0?"⚠️ Dépassé":"J+"+ech)):"")+" · Priorité : "+(t.priorite||"normale")}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setTasks(function(prev){return prev.map(function(x){return x.id===t.id?{...x,statut:"terminee"}:x;});});var ag=users.find(function(u){return u.id===t.agentId;});notifTacheTerminee(t,ag?ag.nom:"");}}>{"✅ Marquer terminée"}</button>
                  <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(){setTasks(function(prev){return prev.filter(function(x){return x.id!==t.id;});});}}>{"🗑"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── MODALS ──────────── */}
      {tab==="objectifs" && <ObjectifsProgression/>}
      {tab==="rapport" && <RapportMensuel/>}
      {tab==="ca" && <CaRealise/>}
      {tab==="leads" && <Leads/>}
      {tab==="recherches" && <Recherches/>}
      {tab==="messagerie" && <Messagerie/>}
      {tab==="profil" && <ProfilManager currentUser={currentUser} users={users} changerMotDePasse={changerMotDePasse}/>}

            {detailMandat && (
        <MandatDetail
          mandat={detailMandat}
          users={users}
          onEdit={function(m){setDetailMandat(null);setEditingMandat(m);setShowMandatForm(true);}}
          onDelete={function(id){deleteMandat(id);setDetailMandat(null);}}
          onClose={function(){setDetailMandat(null);}}
          onUpdateMandat={function(updated){setMandats(function(prev){return prev.map(function(m){return m.id===updated.id?updated:m;});});setDetailMandat(updated);}}
        />
      )}

            {showMandatForm && (
        <MandatForm initial={editingMandat} agents={agents} agenceId={agenceId} onSave={saveMandat} onCancel={function(){setShowMandatForm(false);setEditingMandat(null);}}/>
      )}
      {showLocForm && (
        <LocForm initial={editingLoc} agents={agents} agenceId={agenceId} onSave={saveLoc} onCancel={function(){setShowLocForm(false);setEditingLoc(null);}}/>
      )}
      {showGestForm && (
        <GestForm initial={editingGest} agents={agents} agenceId={agenceId} onSave={saveGest} onCancel={function(){setShowGestForm(false);setEditingGest(null);}}/>
      )}
      {showInvite && (
        <InviteModal agents={agents} agenceId={agenceId} onInvite={inviterAgent} onClose={function(){setShowInvite(false);setInviteResult(null);}} result={inviteResult} setResult={setInviteResult}/>
      )}
      {/* ── OVERLAY BRAVO ── */}
      {showBravo && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(){setShowBravo(null);}}>
          <div style={{background:"#fff",borderRadius:24,padding:"40px 32px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 40px 100px rgba(0,0,0,0.4)",animation:"bravo-in 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>
            <div style={{fontSize:60,marginBottom:8,lineHeight:1}}>{"🎉"}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#1D3557",marginBottom:6}}>{"Offre acceptée !"}</div>
            <div style={{fontSize:16,color:"#E63946",fontWeight:800,marginBottom:4}}>{showBravo.mandatRef}</div>
            <div style={{fontSize:13,color:"#64748B",marginBottom:8}}>{showBravo.adresse}</div>
            {showBravo.agentNom && <div style={{fontSize:14,color:"#1D3557",fontWeight:700,marginBottom:12}}>{"🏆 Bravo "+showBravo.agentNom+" !"}</div>}
            <div style={{fontSize:20,fontWeight:900,color:"#10B981",marginBottom:20}}>{showBravo.commission?(Math.round(showBravo.commission).toLocaleString("fr-FR")+"€ de commission"):""}
            </div>
            <div style={{fontSize:12,color:"#94A3B8"}}>{"Cliquez pour fermer"}</div>
          </div>
          <style>{"@keyframes bravo-in{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}"}</style>
        </div>
      )}

      {showObjModal && (
        <ObjectifsModal agents={agents} objectifs={objectifs} setObjectifs={setObjectifs} onClose={function(){setShowObjModal(false);}}/>
      )}
      {showTaskModal && (
        <TaskForm agents={agents} agenceId={agenceId} setTasks={setTasks} onClose={function(){setShowTaskModal(false);}}/>
      )}
    </AppShell>
  );
}

// ─── LOCATION FORM ─────────────────────────────────────────────────────────────
function LocForm({ initial, agents, agenceId, onSave, onCancel }) {
  var init = initial || {};
  var [f, setF] = useState({ref:"",adresse:"",loyer:"",commission:"",agentId:"",agenceId:agenceId,dateSignature:"",locataireNom:"",locatairePrenom:"",locataireTel:"",locataireMail:"",locataireTrouve:false,...init});
  function set(k,v){setF(function(p){return{...p,[k]:v};});}
  return (
    <Modal title={init.id?"✏️ Modifier la location":"➕ Nouvelle location"} onClose={onCancel}
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onCancel}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={function(){onSave(f);}}>{"Enregistrer"}</button></div>}>
      <div className="form-grid">
        <div className="form-group"><label className="form-label">{"Référence"}</label><input className="form-input" value={f.ref} onChange={function(e){set("ref",e.target.value);}} placeholder="LOC-009"/></div>
        <div className="form-group"><label className="form-label">{"Agent"}</label><select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}><option value="">{"— Choisir —"}</option>{agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}</select></div>
        <div className="form-group form-full"><label className="form-label">{"Adresse"}</label><input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}} placeholder="5 Rue de la Paix, Amiens"/></div>
        <div className="form-group"><label className="form-label">{"Loyer (€/mois)"}</label><input className="form-input" type="number" value={f.loyer} onChange={function(e){set("loyer",Number(e.target.value));}} placeholder="750"/></div>
        <div className="form-group"><label className="form-label">{"Commission (€)"}</label><input className="form-input" type="number" value={f.commission} onChange={function(e){set("commission",Number(e.target.value));}} placeholder="750"/></div>
        <div className="form-group"><label className="form-label">{"Date signature"}</label><input className="form-input" type="date" value={f.dateSignature||""} onChange={function(e){set("dateSignature",e.target.value);}}/></div>
        <div className="checkbox-row form-full" onClick={function(){set("locataireTrouve",!f.locataireTrouve);}}>
          <input type="checkbox" checked={!!f.locataireTrouve} onChange={function(){}}/><label>{"✅ Locataire trouvé"}</label>
        </div>
        {f.locataireTrouve && (
          <div className="form-group form-full">
            <div className="form-grid">
              <div className="form-group"><label className="form-label">{"Nom locataire"}</label><input className="form-input" value={f.locataireNom} onChange={function(e){set("locataireNom",e.target.value);}}/></div>
              <div className="form-group"><label className="form-label">{"Prénom"}</label><input className="form-input" value={f.locatairePrenom} onChange={function(e){set("locatairePrenom",e.target.value);}}/></div>
              <div className="form-group"><label className="form-label">{"Téléphone"}</label><input className="form-input" value={f.locataireTel} onChange={function(e){set("locataireTel",e.target.value);}}/></div>
              <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.locataireMail} onChange={function(e){set("locataireMail",e.target.value);}}/></div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── GESTION FORM ──────────────────────────────────────────────────────────────
function GestForm({ initial, agents, agenceId, onSave, onCancel }) {
  var init = initial || {};
  var [f, setF] = useState({ref:"",adresse:"",loyer:"",commissionPct:8,commissionMensuelle:"",agentId:"",agenceId:agenceId,proprietaireNom:"",proprietairePrenom:"",dateDebutGestion:"",actif:true,...init});
  function set(k,v){setF(function(p){return{...p,[k]:v};});}
  return (
    <Modal title={init.id?"✏️ Modifier":"➕ Nouveau bien en gestion"} onClose={onCancel}
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onCancel}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={function(){onSave(f);}}>{"Enregistrer"}</button></div>}>
      <div className="form-grid">
        <div className="form-group"><label className="form-label">{"Référence"}</label><input className="form-input" value={f.ref} onChange={function(e){set("ref",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Agent"}</label><select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}><option value="">{"— Choisir —"}</option>{agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}</select></div>
        <div className="form-group form-full"><label className="form-label">{"Adresse"}</label><input className="form-input" value={f.adresse} onChange={function(e){set("adresse",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Propriétaire (Nom)"}</label><input className="form-input" value={f.proprietaireNom} onChange={function(e){set("proprietaireNom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Prénom"}</label><input className="form-input" value={f.proprietairePrenom} onChange={function(e){set("proprietairePrenom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Loyer (€/mois)"}</label><input className="form-input" type="number" value={f.loyer} onChange={function(e){set("loyer",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Commission (%)"}</label><input className="form-input" type="number" value={f.commissionPct} onChange={function(e){set("commissionPct",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Commission mensuelle (€)"}</label><input className="form-input" type="number" value={f.commissionMensuelle} onChange={function(e){set("commissionMensuelle",Number(e.target.value));}}/></div>
        <div className="form-group"><label className="form-label">{"Début gestion"}</label><input className="form-input" type="date" value={f.dateDebutGestion||""} onChange={function(e){set("dateDebutGestion",e.target.value);}}/></div>
      </div>
    </Modal>
  );
}

// ─── INVITE MODAL ─────────────────────────────────────────────────────────────
function InviteModal({ agents, agenceId, onInvite, onClose, result, setResult }) {
  var [f,   setF]   = useState({nom:"", email:"", niveau:"junior", motDePasse:""});
  var [err, setErr] = useState("");
  function set(k,v){setF(function(p){return{...p,[k]:v};});}
  function genPwd() {
    var chars = "abcdefghjkmnpqrstuvwxyz23456789";
    var pwd = "";
    for (var i=0;i<6;i++) pwd += chars[Math.floor(Math.random()*chars.length)];
    set("motDePasse", pwd);
  }
  function send() {
    if (!f.nom.trim())       { setErr("Le nom est requis"); return; }
    if (!f.email.trim())     { setErr("L'email est requis"); return; }
    if (!f.motDePasse.trim()){ setErr("Définissez un mot de passe temporaire"); return; }
    var r = onInvite(f, agenceId);
    if (!r.success) { setErr(r.error||"Erreur"); return; }
    setResult(r);
  }
  function copyMsg() {
    if (result && result.emailMessage) {
      navigator.clipboard.writeText(result.emailMessage).then(function(){alert("✅ Copié !");}).catch(function(){});
    }
  }
  return (
    <Modal title={"👤 Créer un compte agent"} onClose={onClose}
      footer={!result && <div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onClose}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={send}>{"Créer le compte"}</button></div>}>
      {!result ? (
        <div>
          {err && <div className="alert alert-danger" style={{marginBottom:12}}>{"⚠️ "+err}</div>}
          <div className="form-grid">
            <div className="form-group form-full"><label className="form-label">{"Nom complet *"}</label><input className="form-input" value={f.nom} onChange={function(e){set("nom",e.target.value);setErr("");}} placeholder="Prénom Nom" autoFocus/></div>
            <div className="form-group form-full"><label className="form-label">{"Email *"}</label><input className="form-input" type="email" value={f.email} onChange={function(e){set("email",e.target.value);setErr("");}} placeholder="prenom.nom@orpi.com"/></div>
            <div className="form-group"><label className="form-label">{"Niveau"}</label><select className="form-select" value={f.niveau} onChange={function(e){set("niveau",e.target.value);}}><option value="junior">{"🌱 Junior"}</option><option value="senior">{"🏆 Senior"}</option></select></div>
            <div className="form-group">
              <label className="form-label">{"Mot de passe temporaire *"}</label>
              <div style={{display:"flex",gap:6}}>
                <input className="form-input" value={f.motDePasse} onChange={function(e){set("motDePasse",e.target.value);setErr("");}} placeholder="Ex: orpi2024" style={{flex:1,fontFamily:"monospace",letterSpacing:2}}/>
                <button onClick={genPwd} className="btn btn-secondary btn-sm" style={{flexShrink:0}}>{"🎲"}</button>
              </div>
              <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{"À communiquer à l'agent — il pourra le changer"}</div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:12,padding:"16px",marginBottom:14}}>
            <div style={{fontWeight:800,color:"#065F46",fontSize:14,marginBottom:12}}>{"✅ Compte créé pour "+f.nom}</div>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"8px 12px",fontSize:13}}>
              <span style={{color:"var(--g400)"}}>{"🌐 Application :"}</span>
              <strong style={{color:"var(--navy)",wordBreak:"break-all"}}>{result.appUrl}</strong>
              <span style={{color:"var(--g400)"}}>{"📧 Email :"}</span>
              <strong style={{color:"var(--navy)"}}>{f.email}</strong>
              <span style={{color:"var(--g400)"}}>{"🔑 Mot de passe :"}</span>
              <strong style={{color:"var(--red)",fontSize:16,letterSpacing:2,fontFamily:"monospace"}}>{result.motDePasse}</strong>
            </div>
          </div>
          <div style={{background:"var(--g50)",border:"1px solid var(--g200)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:12,color:"var(--g500)",marginBottom:6}}>{"📋 Message prêt à envoyer :"}</div>
            <pre style={{fontSize:12,color:"var(--g700)",whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.7}}>{result.emailMessage}</pre>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={copyMsg}>{"📋 Copier le message"}</button>
            <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={onClose}>{"Fermer"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── OBJECTIFS MODAL ──────────────────────────────────────────────────────────
function ObjectifsModal({ agents, objectifs, setObjectifs, onClose }) {
  var annee = new Date().getFullYear();
  function updateObj(agentId, montant) {
    setObjectifs(function(prev) {
      var ex = prev.find(function(o){return o.agentId===agentId && o.annee===annee;});
      if (ex) return prev.map(function(o){return (o.agentId===agentId&&o.annee===annee)?{...o,montantHT:Number(montant)}:o;});
      return [...prev, {agentId:agentId, agenceId:agents[0]&&agents[0].agenceId, annee:annee, montantHT:Number(montant)}];
    });
  }
  return (
    <Modal title={"🎯 Objectifs "+annee} onClose={onClose} footer={<button className="btn btn-primary" style={{width:"100%"}} onClick={onClose}>{"Fermer"}</button>}>
      {agents.map(function(a) {
        var obj = objectifs.find(function(o){return o.agentId===a.id&&o.annee===annee;});
        return (
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid var(--g100)"}}>
            <div className="avatar" style={{background:avatarColor(a.nom),width:34,height:34,fontSize:12}}>{a.avatar}</div>
            <div style={{flex:1}}><div style={{fontWeight:700}}>{a.nom}</div><div style={{fontSize:12,color:"var(--g400)"}}>{a.niveau}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="number" defaultValue={obj?obj.montantHT:""} onBlur={function(e){updateObj(a.id,e.target.value);}} className="form-input" style={{width:110,textAlign:"right"}} placeholder="Ex: 40000"/>
              <span style={{fontSize:13,color:"var(--g400)"}}>{"€ HT"}</span>
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

// ─── TASK FORM ────────────────────────────────────────────────────────────────
function TaskForm({ agents, agenceId, setTasks, onClose }) {
  var [f, setF] = useState({titre:"", description:"", agentId:"", priorite:"normale", echeance:"", statut:"en_attente"});
  function set(k,v){setF(function(p){return{...p,[k]:v};});}
  function save() {
    if (!f.titre) return;
    var newTask = {...f, id:"t-"+Date.now(), agenceId:agenceId, createdAt:new Date().toISOString().slice(0,10)};
    setTasks(function(prev){return [...prev, newTask];});
    if (newTask.agentId) { notifTacheConfiee(newTask); }
    onClose();
  }
  return (
    <Modal title={"✅ Nouvelle tâche"} onClose={onClose}
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onClose}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={save}>{"Créer la tâche"}</button></div>}>
      <div className="form-grid">
        <div className="form-group form-full"><label className="form-label">{"Titre *"}</label><input className="form-input" value={f.titre} onChange={function(e){set("titre",e.target.value);}} placeholder="Ex: Relancer les mandats expirant..."/></div>
        <div className="form-group form-full"><label className="form-label">{"Description"}</label><textarea className="form-input" rows={3} value={f.description} onChange={function(e){set("description",e.target.value);}} style={{resize:"vertical",fontFamily:"var(--font)"}}></textarea></div>
        <div className="form-group"><label className="form-label">{"Agent (vide = tous)"}</label><select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}><option value="">{"Tous les agents"}</option>{agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}</select></div>
        <div className="form-group"><label className="form-label">{"Priorité"}</label><select className="form-select" value={f.priorite} onChange={function(e){set("priorite",e.target.value);}}><option value="basse">{"🔵 Basse"}</option><option value="normale">{"🟡 Normale"}</option><option value="haute">{"🔴 Haute"}</option></select></div>
        <div className="form-group"><label className="form-label">{"Échéance"}</label><input className="form-input" type="date" value={f.echeance} onChange={function(e){set("echeance",e.target.value);}}/></div>
      </div>
    </Modal>
  );
}

// ─── MANDAT DETAIL MODAL ──────────────────────────────────────────────────────


// ─── CONFIGURATION SEUILS KPI ─────────────────────────────────────────────────
function ConfigKPI({ onClose }) {
  var ctx = useApp();
  var cfg = ctx.kpiConfig || {};
  var setKpiConfig = ctx.setKpiConfig;

  var [f, setF] = useState({
    txCommBon:          cfg.txCommBon         != null ? cfg.txCommBon         : 4.0,
    txCommExcellent:    cfg.txCommExcellent   != null ? cfg.txCommExcellent   : 4.5,
    txCommAlerte:       cfg.txCommAlerte      != null ? cfg.txCommAlerte      : 3.0,
    txConvBon:          cfg.txConvBon         != null ? cfg.txConvBon         : 25,
    txConvExcellent:    cfg.txConvExcellent   != null ? cfg.txConvExcellent   : 40,
    txConvAlerte:       cfg.txConvAlerte      != null ? cfg.txConvAlerte      : 15,
    ratioProspBon:      cfg.ratioProspBon     != null ? cfg.ratioProspBon     : 0.15,
    ratioProspExcellent:cfg.ratioProspExcellent!=null ? cfg.ratioProspExcellent: 0.3,
    stockBon:           cfg.stockBon          != null ? cfg.stockBon          : 8,
    stockAlerte:        cfg.stockAlerte       != null ? cfg.stockAlerte       : 2,
    exclExcellent:      cfg.exclExcellent     != null ? cfg.exclExcellent     : 60,
    exclBon:            cfg.exclBon           != null ? cfg.exclBon           : 40,
    exclAlerte:         cfg.exclAlerte        != null ? cfg.exclAlerte        : 25,
    delaiExcellent:     cfg.delaiExcellent    != null ? cfg.delaiExcellent    : 60,
    delaiBon:           cfg.delaiBon          != null ? cfg.delaiBon          : 90,
    delaiAlerte:        cfg.delaiAlerte       != null ? cfg.delaiAlerte       : 150,
    objAvancePts:       cfg.objAvancePts      != null ? cfg.objAvancePts      : 15,
    objRetardPts:       cfg.objRetardPts      != null ? cfg.objRetardPts      : 20,
    connexionsBon:      cfg.connexionsBon     != null ? cfg.connexionsBon     : 10,
    connexionsAlerte:   cfg.connexionsAlerte  != null ? cfg.connexionsAlerte  : 3,
    secteursMin:        cfg.secteursMin       != null ? cfg.secteursMin       : 4,
    recherchesMin:      cfg.recherchesMin     != null ? cfg.recherchesMin     : 5,
  });
  var [saved, setSaved] = useState(false);
  function set(k,v){ setF(function(p){ return {...p,[k]:Number(v)}; }); setSaved(false); }
  function save() {
    setKpiConfig(f);
    setSaved(true);
    setTimeout(function(){ setSaved(false); }, 2500);
  }
  function reset() {
    var defaults = {txCommBon:4.0,txCommExcellent:4.5,txCommAlerte:3.0,txConvBon:25,txConvExcellent:40,txConvAlerte:15,ratioProspBon:0.15,ratioProspExcellent:0.3,stockBon:8,stockAlerte:2,exclExcellent:60,exclBon:40,exclAlerte:25,delaiExcellent:60,delaiBon:90,delaiAlerte:150,objAvancePts:15,objRetardPts:20,connexionsBon:10,connexionsAlerte:3,secteursMin:4,recherchesMin:5};
    setF(defaults);
    setKpiConfig(defaults);
    setSaved(true);
    setTimeout(function(){ setSaved(false); }, 2500);
  }

  var sections = [
    {
      titre:"📐 Taux de commission (%)",
      desc:"Sur le prix de vente",
      fields:[
        {key:"txCommExcellent",label:"Excellent ≥",unit:"%",step:0.1},
        {key:"txCommBon",label:"Bon ≥",unit:"%",step:0.1},
        {key:"txCommAlerte",label:"Alerte <",unit:"%",step:0.1},
      ]
    },
    {
      titre:"🎯 Taux de conversion mandat → vente (%)",
      desc:"Mandats aboutissant à compromis ou vente",
      fields:[
        {key:"txConvExcellent",label:"Excellent ≥",unit:"%",step:1},
        {key:"txConvBon",label:"Bon ≥",unit:"%",step:1},
        {key:"txConvAlerte",label:"Alerte <",unit:"%",step:1},
      ]
    },
    {
      titre:"🚶 Ratio prospection / mandat",
      desc:"Mandats pris par action de prospection",
      fields:[
        {key:"ratioProspExcellent",label:"Excellent ≥",unit:" mandat/contact",step:0.01},
        {key:"ratioProspBon",label:"Bon ≥",unit:" mandat/contact",step:0.01},
      ]
    },
    {
      titre:"📦 Stock de mandats actifs",
      desc:"Nombre de mandats actifs en portefeuille",
      fields:[
        {key:"stockBon",label:"Bon ≥",unit:" mandats",step:1},
        {key:"stockAlerte",label:"Alerte ≤",unit:" mandats",step:1},
      ]
    },
    {
      titre:"⭐ Taux d'exclusivité (%)",
      desc:"Part des mandats exclusifs",
      fields:[
        {key:"exclExcellent",label:"Excellent ≥",unit:"%",step:1},
        {key:"exclBon",label:"Bon ≥",unit:"%",step:1},
        {key:"exclAlerte",label:"Alerte <",unit:"%",step:1},
      ]
    },
    {
      titre:"⏱ Délai moyen mandat → acte (jours)",
      desc:"Plus c'est bas, mieux c'est",
      fields:[
        {key:"delaiExcellent",label:"Excellent ≤",unit:" jours",step:5},
        {key:"delaiBon",label:"Bon ≤",unit:" jours",step:5},
        {key:"delaiAlerte",label:"Alerte >",unit:" jours",step:5},
      ]
    },
    {
      titre:"🏆 Progression objectif annuel (points)",
      desc:"Écart entre progression réelle et attendue",
      fields:[
        {key:"objAvancePts",label:"Force si avance ≥",unit:" pts",step:1},
        {key:"objRetardPts",label:"Alerte si retard ≥",unit:" pts",step:1},
      ]
    },
    {
      titre:"📱 Connexions à l'app / mois",
      desc:"Nombre de connexions enregistrées",
      fields:[
        {key:"connexionsBon",label:"Bon ≥",unit:" connexions",step:1},
        {key:"connexionsAlerte",label:"Alerte <",unit:" connexions",step:1},
      ]
    },
    {
      titre:"🗺️ Diversification géographique",
      desc:"Minimum de secteurs différents couverts",
      fields:[
        {key:"secteursMin",label:"Objectif ≥",unit:" secteurs",step:1},
      ]
    },
    {
      titre:"🔍 Recherches acheteurs enregistrées",
      desc:"Nombre de fiches acquéreurs actives",
      fields:[
        {key:"recherchesMin",label:"Objectif ≥",unit:" recherches",step:1},
      ]
    },
  ];

  return (
    <Modal title={"⚙️ Paramétrer les seuils KPI"} onClose={onClose} wide
      footer={
        <div style={{display:"flex",gap:8,width:"100%",alignItems:"center"}}>
          <button className="btn btn-secondary btn-sm" onClick={reset}>{"↺ Réinitialiser par défaut"}</button>
          <div style={{flex:1}}/>
          {saved && <span style={{fontSize:12,color:"var(--green)",fontWeight:700}}>{"✅ Enregistré !"}</span>}
          <button className="btn btn-primary" onClick={save}>{"💾 Enregistrer"}</button>
        </div>
      }
    >
      <div style={{marginBottom:14,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#1D4ED8"}}>
        {"Ces seuils s'appliquent à toutes les fiches KPI agents de l'agence. Ils définissent ce qui est affiché en 💪 Force (vert) ou 🎯 Axe de progression (orange)."}
      </div>
      {sections.map(function(sec) {
        return (
          <div key={sec.titre} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:12}}>
            <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"10px 14px"}}>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{sec.titre}</div>
              <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{sec.desc}</div>
            </div>
            <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"repeat("+Math.min(sec.fields.length,3)+",1fr)",gap:10}}>
              {sec.fields.map(function(field) {
                var isAlerte = field.label.toLowerCase().includes("alerte");
                var isExcellent = field.label.toLowerCase().includes("excellent");
                var borderCol = isExcellent?"#A7F3D0":isAlerte?"#FECACA":"#BFDBFE";
                var labelCol  = isExcellent?"#059669":isAlerte?"#EF4444":"#2563EB";
                return (
                  <div key={field.key} style={{background:isExcellent?"#F0FDF4":isAlerte?"#FEF2F2":"#EFF6FF",borderRadius:10,padding:"10px 12px",border:"1px solid "+borderCol}}>
                    <label style={{fontSize:11,fontWeight:700,color:labelCol,display:"block",marginBottom:6}}>{field.label}</label>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input
                        type="number"
                        step={field.step}
                        value={f[field.key]}
                        onChange={function(e){set(field.key,e.target.value);}}
                        style={{width:"100%",padding:"6px 8px",border:"1px solid "+borderCol,borderRadius:8,fontSize:14,fontWeight:800,color:labelCol,background:"#fff",outline:"none"}}
                      />
                      <span style={{fontSize:10,color:labelCol,fontWeight:600,whiteSpace:"nowrap"}}>{field.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

// ─── CO-AGENT (partage mandat 25%/25%) ───────────────────────────────────────
function CoAgentSection({ m, users, onUpdate }) {
  var ctx2 = useApp();
  var agenceId = ctx2.currentUser.agenceId;
  var coAgents = m.coAgents || [];
  var [showAdd, setShowAdd] = useState(false);
  var [selAgent, setSelAgent] = useState("");
  var [pctEntree, setPctEntree] = useState(25);
  var [pctSortie, setPctSortie] = useState(25);

  var agentsDispos = (users||[]).filter(function(u){
    return u.actif && (u.role==="agent"||u.role==="manager") && u.agenceId===agenceId
      && u.id !== m.agentId
      && !coAgents.find(function(ca){ return ca.agentId===u.id; });
  });

  function addCoAgent() {
    if (!selAgent) return;
    var updated = {...m, coAgents:[...coAgents,{agentId:selAgent,pctEntree:Number(pctEntree),pctSortie:Number(pctSortie),dateAjout:new Date().toISOString().slice(0,10)}]};
    onUpdate(updated);
    setShowAdd(false); setSelAgent(""); setPctEntree(25); setPctSortie(25);
  }
  function removeCoAgent(agentId) {
    var updated = {...m, coAgents:coAgents.filter(function(ca){return ca.agentId!==agentId;})};
    onUpdate(updated);
  }

  // Commission co-agent calculée
  function commCoAgent(ca) {
    if (!m.commission) return null;
    // Entrée = % des hono si mandat rentré ensemble, Sortie = % si vente apportée par co-agent
    var partEntree = Math.round(m.commission * ca.pctEntree / 100);
    var partSortie = Math.round(m.commission * ca.pctSortie / 100);
    return {partEntree, partSortie};
  }

  return (
    <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:12,overflow:"hidden",marginBottom:12}}>
      <div style={{background:"#7C3AED",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{"🤝"}</span>
          <span style={{fontWeight:800,color:"#fff",fontSize:13}}>{"Partage de mandat (co-agent)"}</span>
          {coAgents.length>0 && <span style={{background:"rgba(255,255,255,0.2)",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700}}>{coAgents.length+" co-agent"+(coAgents.length>1?"s":"")}</span>}
        </div>
        {!showAdd && agentsDispos.length>0 && (
          <button onClick={function(){setShowAdd(true);}} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"+ Ajouter"}</button>
        )}
      </div>
      <div style={{padding:"12px 14px"}}>
        {/* Formulaire ajout */}
        {showAdd && (
          <div style={{background:"#fff",borderRadius:10,padding:"12px",marginBottom:12,border:"1px solid #DDD6FE"}}>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:10}}>{"Ajouter un co-agent"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div className="form-group" style={{gridColumn:"1/-1"}}>
                <label className="form-label">{"Agent"}</label>
                <select className="form-select" value={selAgent} onChange={function(e){setSelAgent(e.target.value);}}>
                  <option value="">{"— Choisir un agent —"}</option>
                  {agentsDispos.map(function(u){ return <option key={u.id} value={u.id}>{u.nom}</option>; })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{"% Entrée (apport mandat)"}</label>
                <select className="form-select" value={pctEntree} onChange={function(e){setPctEntree(Number(e.target.value));}}>
                  {[0,10,15,20,25,30,33,40,50].map(function(v){ return <option key={v} value={v}>{v+"%"}</option>; })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{"% Sortie (apport acheteur)"}</label>
                <select className="form-select" value={pctSortie} onChange={function(e){setPctSortie(Number(e.target.value));}}>
                  {[0,10,15,20,25,30,33,40,50].map(function(v){ return <option key={v} value={v}>{v+"%"}</option>; })}
                </select>
              </div>
            </div>
            {m.commission && selAgent && (
              <div style={{background:"#F5F3FF",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#7C3AED",fontWeight:700}}>
                {"Commission totale : "+(m.commission||0).toLocaleString("fr-FR")+"€ · Entrée co-agent : "+Math.round((m.commission||0)*pctEntree/100).toLocaleString("fr-FR")+"€ · Sortie : "+Math.round((m.commission||0)*pctSortie/100).toLocaleString("fr-FR")+"€"}
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setShowAdd(false);}}>{"Annuler"}</button>
              <button className="btn btn-primary btn-sm" style={{flex:2,background:"#7C3AED",border:"none"}} onClick={addCoAgent}>{"💾 Confirmer le partage"}</button>
            </div>
          </div>
        )}

        {/* Liste co-agents */}
        {coAgents.length===0 && !showAdd && (
          <div style={{textAlign:"center",padding:"12px 0",color:"#7C3AED",fontSize:12,opacity:.7}}>{"Aucun co-agent sur ce mandat"}</div>
        )}
        {coAgents.map(function(ca) {
          var agent = (users||[]).find(function(u){return u.id===ca.agentId;});
          var comm  = commCoAgent(ca);
          return (
            <div key={ca.agentId} style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #DDD6FE"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{agent?agent.nom:"Agent inconnu"}</div>
                  <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>
                    {"Entrée "+ca.pctEntree+"% · Sortie "+ca.pctSortie+"% · Ajouté le "+fmtDate(ca.dateAjout)}
                  </div>
                  {comm && (
                    <div style={{display:"flex",gap:6,marginTop:4}}>
                      <span style={{fontSize:11,background:"#F0FDF4",color:"var(--green)",borderRadius:20,padding:"1px 8px",fontWeight:700}}>{"Entrée : "+(comm.partEntree).toLocaleString("fr-FR")+"€"}</span>
                      <span style={{fontSize:11,background:"#EFF6FF",color:"var(--blue)",borderRadius:20,padding:"1px 8px",fontWeight:700}}>{"Sortie : "+(comm.partSortie).toLocaleString("fr-FR")+"€"}</span>
                    </div>
                  )}
                </div>
                <button onClick={function(){removeCoAgent(ca.agentId);}} style={{background:"#FEF2F2",border:"none",color:"var(--red)",borderRadius:8,padding:"4px 8px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>{"Retirer"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MandatDetail({ mandat, users, onEdit, onDelete, onClose, onUpdateMandat }) {
  var m = mandat;
  var agent = users.find(function(u){return u.id===m.agentId;});
  var [photoIdx,    setPhotoIdx]    = useState(0);
  var [sweepTab,    setSweepTab]    = useState("view");   // view | url | upload
  var [detailTab,   setDetailTab]   = useState("infos"); // infos | visites | commentaires
  var [newVisite,   setNewVisite]   = useState({date:"",acheteur:"",telephone:"",retour:"",suite:"interesse"});
  var [newComm,     setNewComm]     = useState("");
  var ctx2 = useApp();
  var [sweepUrlIn,  setSweepUrlIn]  = useState(m.sweepUrl||"");
  var [sweepMsg,    setSweepMsg]    = useState("");
  var photos = m.photos || [];

  function saveSweepUrl() {
    if (!sweepUrlIn.trim()) { setSweepMsg("❌ URL vide"); return; }
    var updated = {...m, sweepUrl: sweepUrlIn.trim(), sweepPdf: null};
    if (onUpdateMandat) onUpdateMandat(updated);
    setSweepMsg("✅ Lien enregistré !");
    setSweepTab("view");
    setTimeout(function(){ setSweepMsg(""); }, 3000);
  }

  function handlePdfUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { setSweepMsg("❌ Fichier trop lourd (max 5 Mo)"); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      var updated = {...m, sweepPdf: ev.target.result, sweepPdfName: file.name, sweepUrl: null};
      if (onUpdateMandat) onUpdateMandat(updated);
      setSweepMsg("✅ Fiche PDF chargée !");
      setSweepTab("view");
      setTimeout(function(){ setSweepMsg(""); }, 3000);
    };
    reader.readAsDataURL(file);
  }

  function removeSweep() {
    if (!window.confirm("Supprimer la fiche SweepBright ?")) return;
    var updated = {...m, sweepUrl: null, sweepPdf: null, sweepPdfName: null};
    if (onUpdateMandat) onUpdateMandat(updated);
  }

  function openSweep() {
    if (m.sweepUrl) { window.open(m.sweepUrl, "_blank"); return; }
    if (m.sweepPdf) {
      var a = document.createElement("a");
      a.href = m.sweepPdf;
      a.download = m.sweepPdfName || "fiche-sweepbright-"+m.ref+".pdf";
      a.click();
    }
  }

  function saveVisite() {
    if (!newVisite.date || !newVisite.acheteur) return;
    var visites = [...(m.visites||[]), {...newVisite, id:"vis-"+Date.now(), addedBy:ctx2.currentUser.nom, addedAt:new Date().toISOString()}];
    onUpdateMandat({...m, visites});
    setNewVisite({date:"",acheteur:"",telephone:"",retour:"",suite:"interesse"});
  }

  function saveCommentaire() {
    if (!newComm.trim()) return;
    var commentaires = [...(m.commentaires||[]), {id:"com-"+Date.now(), texte:newComm.trim(), auteur:ctx2.currentUser.nom, ts:new Date().toISOString()}];
    onUpdateMandat({...m, commentaires});
    setNewComm("");
  }

  function deleteCommentaire(id) {
    var commentaires = (m.commentaires||[]).filter(function(c){ return c.id!==id; });
    onUpdateMandat({...m, commentaires});
  }

  function partagerFiche() {
    var agenceInfo = (ctx2.agences||[]).find(function(a){return a.id===m.agenceId;});
    var photoSrc = m.photoBase64||m.photoUrl||"";
    var commHTVal = Math.round((m.commission||0)/1.2);
    var rows = [
      m.surface?"📐 Surface : "+m.surface+" m²":"",
      m.nbPieces?"🛏️ Pièces : "+m.nbPieces:"",
      m.nbChambres?"🛏️ Chambres : "+m.nbChambres:"",
      m.dpe?"🌿 DPE : "+m.dpe:"",
      m.avecJardin?"🌿 Jardin : Oui":"",
      m.avecGarage?"🚗 Garage : Oui":"",
      m.avecTerrasse?"☀️ Terrasse : Oui":"",
    ].filter(Boolean);
    var html = "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>"+m.ref+"</title>"
      +"<style>*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}body{background:#f0f4f8;padding:16px;}"
      +".c{background:#fff;border-radius:16px;overflow:hidden;max-width:560px;margin:0 auto;box-shadow:0 8px 40px rgba(0,0,0,.12);}"
      +".h{background:linear-gradient(135deg,#1D3557,#2a4a7a);padding:20px;color:#fff;}"
      +".ref{font-size:11px;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;}"
      +".adr{font-size:18px;font-weight:900;margin-bottom:8px;}"
      +".bdg{display:inline-block;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;margin:2px;}"
      +".photo{width:100%;max-height:260px;object-fit:cover;}"
      +".prix{background:#F0FDF4;border-left:4px solid #059669;padding:14px 18px;}"
      +".pv{font-size:28px;font-weight:900;color:#059669;}"
      +".ps{font-size:11px;color:#6B7280;margin-top:3px;}"
      +".sec{padding:14px 18px;border-bottom:1px solid #F1F5F9;}"
      +".st{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin-bottom:10px;}"
      +".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}"
      +".it{background:#F8FAFC;border-radius:8px;padding:8px 10px;}"
      +".il{font-size:10px;color:#94A3B8;font-weight:700;}"
      +".iv{font-size:13px;font-weight:700;color:#1D3557;}"
      +".ag{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#EFF6FF;}"
      +".av{width:40px;height:40px;border-radius:20px;background:#1D3557;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;}"
      +".ft{padding:10px 18px;background:#F8FAFC;text-align:center;font-size:10px;color:#94A3B8;}"
      +"@media print{body{background:#fff;}}"
      +"</style></head><body><div class='c'>"
      +"<div class='h'><div class='ref'>"+m.ref+" · "+(m.typeMandat==="exclusif"?"⭐ Exclusif":"Simple")+"</div>"
      +"<div class='adr'>"+m.adresse+"</div>"
      +(m.typeBien?"<span class='bdg'>"+(m.typeBien.charAt(0).toUpperCase()+m.typeBien.slice(1).replace(/_/g," "))+"</span>":"")
      +(m.surface?"<span class='bdg'>"+m.surface+" m²</span>":"")
      +(m.nbPieces?"<span class='bdg'>"+m.nbPieces+"P</span>":"")
      +(m.statut==="sous_offre"?"<span class='bdg'>🤝 Sous offre</span>":"")
      +"</div>"
      +(photoSrc?"<img class='photo' src='"+photoSrc+"' alt=''/>" : "")
      +"<div class='prix'><div class='pv'>"+(m.prix?m.prix.toLocaleString("fr-FR")+"€"+(isTVA(m.typeBien)?" HT":""):"Prix sur demande")+"</div>"
      +(m.commission?"<div class='ps'>Honoraires : "+m.commission.toLocaleString("fr-FR")+"€ TTC ("+commHTVal.toLocaleString("fr-FR")+"€ HT)</div>":"")
      +"</div>"
      +(rows.length?"<div class='sec'><div class='st'>Caractéristiques</div><div class='grid'>"+rows.map(function(r){var p=r.split(" : ");return "<div class='it'><div class='il'>"+p[0]+"</div><div class='iv'>"+(p[1]||"")+"</div></div>";}).join("")+"</div></div>":"")
      +(m.dpe?"<div class='sec'><div class='st'>DPE</div><span style='background:#059669;color:#fff;border-radius:6px;padding:3px 10px;font-weight:900;'>"+m.dpe+"</span></div>":"")
      +(m.notes?"<div class='sec'><div class='st'>Description</div><p style='font-size:13px;color:#4B5563;line-height:1.7;'>"+m.notes+"</p></div>":"")
      +(agent?"<div class='ag'><div class='av'>"+(agent.avatar||"?")+"</div><div><div style='font-weight:800;font-size:13px;'>"+agent.nom+"</div>"+(agent.telephone?"<div style='font-size:12px;color:#4B5563;'>"+agent.telephone+"</div>":"")+( agenceInfo?"<div style='font-size:11px;color:#94A3B8;'>"+agenceInfo.nom+"</div>":"")+"</div></div>":"")
      +"<div class='ft'>"+(agenceInfo?agenceInfo.nom+" — ":"")+"Fiche du "+new Date().toLocaleDateString("fr-FR")+"</div>"
      +"</div></body></html>";
    var w=window.open("","_blank");
    if(w){w.document.write(html);w.document.close();w.focus();setTimeout(function(){try{w.print();}catch(e){}},600);}
  }

  // ─── DUMMY (ancien code remplacé) ───
  function _old_partage_unused() {
    var texte = [
      "🏠 FICHE BIEN — "+m.ref,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "📍 "+m.adresse,
      "🏷️ Type : "+(m.typeMandat==="exclusif"?"⭐ Mandat exclusif":"Mandat simple"),
      "💰 Prix de vente : "+(m.prix?m.prix.toLocaleString("fr-FR")+"€":"—"),
      m.surface ? "📐 Surface : "+m.surface+" m²" : "",
      m.nbPieces ? "🛏️ Pièces : "+m.nbPieces : "",
      m.dpe ? "🌿 DPE : "+m.dpe : "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      agent ? "👤 Agent : "+agent.nom : "",
      "📅 Mandat signé le : "+(m.dateMandat||"—"),
      m.dateExpiration ? "⏳ Expiration : "+m.dateExpiration : "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      m.notes ? "📝 "+m.notes : "",
      "",
      "ORPI Pro Amiens — TEAM DECLIC IMMO"
    ].filter(Boolean).join("\n");

    if (navigator.share) {
      navigator.share({ title:"Fiche mandat "+m.ref, text:texte }).catch(function(){});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texte).then(function(){
        alert("✅ Fiche copiée dans le presse-papier !");
      });
    } else {
      var w = window.open("","_blank");
      w.document.write("<pre style='font-family:monospace;padding:20px'>"+texte+"</pre>");
    }
  }

  return (
    <Modal title={m.ref+" — Fiche détail"} onClose={onClose} wide
      footer={
        <div style={{display:"flex",gap:8,width:"100%",flexWrap:"wrap"}}>
          <button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={function(){if(window.confirm("Supprimer ce mandat ?")) onDelete(m.id);}}>{"🗑 Supprimer"}</button>
          <div style={{flex:1}}></div>
          <button className="btn btn-secondary" onClick={partagerFiche}>{"📤 Partager la fiche"}</button>
          <button className="btn btn-primary" onClick={function(){onEdit(m);}}>{"✏️ Modifier"}</button>
        </div>
      }>

      {/* Tabs navigation */}
      <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4,marginBottom:14}}>
        {[["infos","📋 Infos"],["visites","🚪 Visites ("+(m.visites||[]).length+")"],["commentaires","💬 Notes ("+(m.commentaires||[]).length+")"]].map(function(t){
          return <button key={t[0]} onClick={function(){setDetailTab(t[0]);}} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",background:detailTab===t[0]?"#fff":"transparent",color:detailTab===t[0]?"var(--navy)":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font)",boxShadow:detailTab===t[0]?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{t[1]}</button>;
        })}
      </div>

      {/* ─── ONGLET VISITES ─── */}
      {detailTab==="visites" && (
        <div>
          <div style={{background:"var(--g50)",borderRadius:10,padding:"14px",marginBottom:14,border:"1px solid var(--g200)"}}>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:10}}>{"+ Enregistrer une visite"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div className="form-group"><label className="form-label">{"Date *"}</label><input className="form-input" type="date" value={newVisite.date} onChange={function(e){setNewVisite(function(p){return{...p,date:e.target.value};});}}/></div>
              <div className="form-group"><label className="form-label">{"Acheteur *"}</label><input className="form-input" value={newVisite.acheteur} onChange={function(e){setNewVisite(function(p){return{...p,acheteur:e.target.value};});}} placeholder="Nom prénom"/></div>
              <div className="form-group"><label className="form-label">{"Téléphone"}</label><input className="form-input" value={newVisite.telephone} onChange={function(e){setNewVisite(function(p){return{...p,telephone:e.target.value};});}}/></div>
              <div className="form-group"><label className="form-label">{"Suite donnée"}</label>
                <select className="form-select" value={newVisite.suite} onChange={function(e){setNewVisite(function(p){return{...p,suite:e.target.value};});}}>
                  <option value="interesse">{"Intéressé"}</option>
                  <option value="offre">{"Offre à venir"}</option>
                  <option value="sans_suite">{"Sans suite"}</option>
                  <option value="2eme_visite">{"2ème visite prévue"}</option>
                </select>
              </div>
              <div className="form-group" style={{gridColumn:"1/-1"}}><label className="form-label">{"Retour / commentaire"}</label><textarea className="form-input" rows={2} value={newVisite.retour} onChange={function(e){setNewVisite(function(p){return{...p,retour:e.target.value};});}}/></div>
            </div>
            <button className="btn btn-primary btn-sm" style={{width:"100%",marginTop:6}} onClick={saveVisite}>{"💾 Enregistrer la visite"}</button>
          </div>
          {(m.visites||[]).length===0 && <div style={{textAlign:"center",padding:"20px",color:"var(--g400)",fontSize:13}}>{"Aucune visite enregistrée"}</div>}
          {[...(m.visites||[])].reverse().map(function(v) {
            var suiteCol = {interesse:"#FEF3C7",offre:"#D1FAE5",sans_suite:"#FEE2E2","2eme_visite":"#EFF6FF"};
            var suiteLabel = {interesse:"Intéressé",offre:"Offre à venir",sans_suite:"Sans suite","2eme_visite":"2ème visite"};
            return (
              <div key={v.id} style={{padding:"12px",background:"var(--g50)",borderRadius:10,marginBottom:8,border:"1px solid var(--g200)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{v.acheteur}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{fmtDate(v.date)+(v.addedBy?" · par "+v.addedBy:"")}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {v.telephone && <a href={"tel:"+v.telephone.replace(/\s/g,"")} style={{background:"#059669",color:"#fff",borderRadius:8,padding:"4px 8px",fontSize:11,fontWeight:800,textDecoration:"none"}}>{"📞"}</a>}
                    <span style={{background:suiteCol[v.suite]||"var(--g100)",color:"var(--navy)",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>{suiteLabel[v.suite]||v.suite}</span>
                  </div>
                </div>
                {v.retour && <div style={{fontSize:12,color:"var(--g600)",fontStyle:"italic"}}>{v.retour}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ONGLET COMMENTAIRES ─── */}
      {detailTab==="commentaires" && (
        <div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <input className="form-input" value={newComm} onChange={function(e){setNewComm(e.target.value);}} placeholder="Ajouter une note interne…" onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveCommentaire();}}}/>
            <button className="btn btn-primary btn-sm" onClick={saveCommentaire}>{"Envoyer"}</button>
          </div>
          {(m.commentaires||[]).length===0 && <div style={{textAlign:"center",padding:"20px",color:"var(--g400)",fontSize:13}}>{"Aucune note interne"}</div>}
          {[...(m.commentaires||[])].reverse().map(function(com) {
            var isMine = com.auteur===ctx2.currentUser.nom;
            return (
              <div key={com.id} style={{marginBottom:10,display:"flex",flexDirection:isMine?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                <div style={{width:30,height:30,borderRadius:15,background:isMine?"var(--blue)":"var(--g300)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:11,flexShrink:0}}>
                  {com.auteur.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{background:isMine?"#EFF6FF":"var(--g50)",borderRadius:10,padding:"9px 12px",maxWidth:"80%",border:"1px solid "+(isMine?"#BFDBFE":"var(--g200)")}}>
                  <div style={{fontSize:10,color:"var(--g400)",marginBottom:4}}>{com.auteur+" · "+new Date(com.ts).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                  <div style={{fontSize:13,color:"var(--navy)"}}>{com.texte}</div>
                </div>
                {isMine && <button onClick={function(){deleteCommentaire(com.id);}} style={{background:"none",border:"none",color:"var(--g300)",cursor:"pointer",fontSize:14,alignSelf:"center",padding:"4px"}}>{"×"}</button>}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ONGLET INFOS (conditionnel) ─── */}
      {detailTab==="infos" && (
        <div>

      {/* Galerie photos */}
      {photos.length>0 && (
        <div style={{marginBottom:16}}>
          <div style={{borderRadius:12,overflow:"hidden",height:220,background:"var(--g100)",position:"relative",marginBottom:8}}>
            <img src={photos[photoIdx]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            {photos.length>1 && (
              <div>
                <button onClick={function(){setPhotoIdx(function(i){return(i-1+photos.length)%photos.length;});}} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",width:34,height:34,borderRadius:17,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>{"‹"}</button>
                <button onClick={function(){setPhotoIdx(function(i){return(i+1)%photos.length;});}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",width:34,height:34,borderRadius:17,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>{"›"}</button>
                <div style={{position:"absolute",bottom:10,right:10,background:"rgba(0,0,0,0.55)",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{(photoIdx+1)+"/"+photos.length}</div>
              </div>
            )}
          </div>
          {photos.length>1 && (
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
              {photos.map(function(p,i){
                return (
                  <img key={i} src={p} alt="" onClick={function(){setPhotoIdx(i);}} style={{width:56,height:56,borderRadius:8,objectFit:"cover",cursor:"pointer",border:i===photoIdx?"3px solid var(--red)":"2px solid transparent",flexShrink:0,opacity:i===photoIdx?1:0.7}}/>
                );
              })}
            </div>
          )}
        </div>
      )}
      {photos.length===0 && (
        <div style={{borderRadius:12,height:100,background:"var(--g50)",border:"2px dashed var(--g200)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,flexDirection:"column",gap:6}}>
          <span style={{fontSize:28,opacity:0.3}}>{"🏠"}</span>
          <span style={{fontSize:12,color:"var(--g400)"}}>{"Aucune photo — ajoutez-en via Modifier"}</span>
        </div>
      )}

      {/* Infos bien */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          ["📍","Adresse",m.adresse],
          ["🏷️","Type",m.typeMandat==="exclusif"?"⭐ Exclusif":"Simple"],
          ["📊","Statut",m.statut.charAt(0).toUpperCase()+m.statut.slice(1)],
          ["💰","Prix",m.prix?m.prix.toLocaleString("fr-FR")+"€":"—"],
          ["💎","Commission",m.commission?m.commission.toLocaleString("fr-FR")+"€ HT":"—"],
          ["📐","Surface",m.surface?m.surface+" m²":"—"],
          ["🛏️","Pièces",m.nbPieces||"—"],
          ["🌿","DPE",m.dpe||"—"],
          ["📞","Tél. agent",agent&&agent.telephone?agent.telephone:"—"],
          ["👤","Agent",agent?agent.nom:"—"],
          ["📅","Date mandat",m.dateMandat||"—"],
          ["⏳","Expiration",m.dateExpiration||"—"],
          ["✅","CS levées",m.clausesSuspensivesLevees?"Oui":"Non"],
        ].map(function(row){
          var isAdresse = row[1]==="Adresse";
          return (
            <div key={row[1]} style={{background:"var(--g50)",borderRadius:9,padding:"9px 12px",gridColumn:isAdresse?"1 / -1":"auto"}}>
              <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:2}}>{row[0]+" "+row[1]}</div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--navy)"}}>{row[2]}</div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      {m.notes && (
        <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontSize:10,color:"var(--amber)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{"📝 Notes"}</div>
          <div style={{fontSize:13,color:"var(--g700)",lineHeight:1.6}}>{m.notes}</div>
        </div>
      )}

      </div>)} {/* fin onglet infos */}

      {/* ─── PARTAGE CO-AGENT ─── */}
      {detailTab==="infos" && (
        <CoAgentSection m={m} users={users} onUpdate={onUpdateMandat}/>
      )}

      {/* ─── FICHE SWEEPBRIGHT ─── */}
      <div style={{background:"#F8FAFF",border:"1px solid #BFDBFE",borderRadius:12,overflow:"hidden",marginBottom:4}}>
        <div style={{background:"linear-gradient(90deg,#1D3557,#2563EB)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{"🏷️"}</span>
            <span style={{fontWeight:800,color:"#fff",fontSize:13}}>{"Fiche SweepBright"}</span>
            {(m.sweepUrl||m.sweepPdf) && <span style={{background:"#22C55E",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{"✓ Chargée"}</span>}
          </div>
          {!(m.sweepUrl||m.sweepPdf) && sweepTab==="view" && (
            <div style={{display:"flex",gap:6}}>
              <button onClick={function(){setSweepTab("url");}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"🔗 URL"}</button>
              <button onClick={function(){setSweepTab("upload");}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"📄 PDF"}</button>
            </div>
          )}
          {(m.sweepUrl||m.sweepPdf) && (
            <div style={{display:"flex",gap:6}}>
              <button onClick={function(){setSweepTab(sweepTab==="view"?"url":"view");}} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"✏️"}</button>
              <button onClick={removeSweep} style={{background:"rgba(239,68,68,0.3)",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{"🗑"}</button>
            </div>
          )}
        </div>

        <div style={{padding:"14px 16px"}}>
          {sweepMsg && <div style={{marginBottom:10,fontSize:12,fontWeight:700,color:sweepMsg.startsWith("✅")?"#059669":"#EF4444"}}>{sweepMsg}</div>}

          {/* Vue : fiche chargée */}
          {sweepTab==="view" && (m.sweepUrl||m.sweepPdf) && (
            <div>
              {m.sweepUrl && (
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#EFF6FF",borderRadius:9,marginBottom:10}}>
                  <span style={{fontSize:20}}>{"🔗"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:2}}>{"Lien SweepBright"}</div>
                    <div style={{fontSize:12,color:"#2563EB",wordBreak:"break-all",fontWeight:600}}>{m.sweepUrl}</div>
                  </div>
                </div>
              )}
              {m.sweepPdf && (
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#FFF7ED",borderRadius:9,marginBottom:10}}>
                  <span style={{fontSize:24}}>{"📄"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,color:"var(--g400)",fontWeight:700,marginBottom:2}}>{"Fiche PDF"}</div>
                    <div style={{fontSize:12,color:"var(--navy)",fontWeight:600}}>{m.sweepPdfName||"fiche-sweepbright.pdf"}</div>
                  </div>
                </div>
              )}
              <button onClick={openSweep} style={{width:"100%",background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {m.sweepUrl ? "🔗 Ouvrir dans SweepBright" : "📥 Télécharger la fiche PDF"}
              </button>
            </div>
          )}

          {/* Vue : pas encore de fiche */}
          {sweepTab==="view" && !m.sweepUrl && !m.sweepPdf && (
            <div style={{textAlign:"center",padding:"14px 0",color:"var(--g400)"}}>
              <div style={{fontSize:32,marginBottom:6}}>{"📋"}</div>
              <div style={{fontWeight:700,fontSize:13,color:"var(--navy)",marginBottom:4}}>{"Aucune fiche SweepBright"}</div>
              <div style={{fontSize:12,marginBottom:12}}>{"Ajoutez un lien de partage ou uploadez le PDF exporté depuis SweepBright"}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <button onClick={function(){setSweepTab("url");}} style={{background:"#EFF6FF",color:"#2563EB",border:"1px solid #BFDBFE",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"🔗 Coller un lien"}</button>
                <button onClick={function(){setSweepTab("upload");}} style={{background:"#FFF7ED",color:"#EA580C",border:"1px solid #FED7AA",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"📄 Uploader un PDF"}</button>
              </div>
            </div>
          )}

          {/* Formulaire URL */}
          {sweepTab==="url" && (
            <div>
              <div style={{fontSize:12,color:"var(--g400)",marginBottom:8}}>{"Collez ici le lien de partage SweepBright (ex: https://app.sweepbright.com/...)"}</div>
              <input
                className="form-input"
                type="url"
                value={sweepUrlIn}
                onChange={function(e){setSweepUrlIn(e.target.value);}}
                placeholder="https://app.sweepbright.com/publication/..."
                style={{marginBottom:10}}
                autoFocus
              />
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setSweepTab("view");setSweepUrlIn(m.sweepUrl||"");}}>{"Annuler"}</button>
                <button className="btn btn-primary btn-sm" style={{flex:2}} onClick={saveSweepUrl}>{"💾 Enregistrer le lien"}</button>
              </div>
            </div>
          )}

          {/* Formulaire upload PDF */}
          {sweepTab==="upload" && (
            <div>
              <div style={{fontSize:12,color:"var(--g400)",marginBottom:10}}>{"Exportez la fiche depuis SweepBright en PDF, puis uploadez-la ici (max 5 Mo)"}</div>
              <label style={{display:"block",border:"2px dashed #BFDBFE",borderRadius:10,padding:"24px 16px",textAlign:"center",cursor:"pointer",background:"#EFF6FF",marginBottom:10}}>
                <input type="file" accept="application/pdf" style={{display:"none"}} onChange={handlePdfUpload}/>
                <div style={{fontSize:28,marginBottom:6}}>{"📄"}</div>
                <div style={{fontWeight:700,color:"#2563EB",fontSize:13}}>{"Cliquez pour choisir un PDF"}</div>
                <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{"ou glissez-déposez le fichier ici"}</div>
              </label>
              <button className="btn btn-secondary btn-sm" style={{width:"100%"}} onClick={function(){setSweepTab("view");}}>{"Annuler"}</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── DEMANDES RESET MOT DE PASSE ─────────────────────────────────────────────
function DemandesReset({ resets, resetMdpParManager }) {
  var enAttente = (resets||[]).filter(function(r){ return !r.traite; });
  var [nouveauMdp, setNouveauMdp] = useState({});

  if (enAttente.length === 0) return null;

  return (
    <div style={{background:"#FEF2F2",border:"2px solid #E63946",borderRadius:12,overflow:"hidden",marginTop:16}}>
      <div style={{background:"#E63946",padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>{"🔑"}</span>
        <span style={{fontWeight:800,color:"#fff",fontSize:13}}>{enAttente.length+" demande(s) de réinitialisation de mot de passe"}</span>
      </div>
      <div style={{padding:"12px 16px"}}>
        {enAttente.map(function(r) {
          return (
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #FECACA",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:"#1D3557",fontSize:13}}>{r.userNom}</div>
                <div style={{fontSize:11,color:"#94A3B8"}}>{r.userEmail}</div>
                <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>{"Demande : "+new Date(r.ts).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nouveau mot de passe"
                  value={nouveauMdp[r.userId]||""}
                  onChange={function(e){ var v=e.target.value; setNouveauMdp(function(p){return{...p,[r.userId]:v};}); }}
                  style={{width:160,fontSize:12}}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!(nouveauMdp[r.userId]&&nouveauMdp[r.userId].length>=4)}
                  onClick={function(){
                    resetMdpParManager(r.userId, nouveauMdp[r.userId]);
                    setNouveauMdp(function(p){return{...p,[r.userId]:""};});
                  }}>
                  {"✅ Réinitialiser"}
                </button>
              </div>
            </div>
          );
        })}
        <div style={{fontSize:11,color:"#94A3B8",marginTop:8}}>
          {"Communiquez le nouveau mot de passe à l'agent par téléphone ou SMS — il pourra le changer depuis Mon Profil."}
        </div>
      </div>
    </div>
  );
}

// ─── JOURNAL D'ACTIVITÉ ───────────────────────────────────────────────────────
function JournalActivite({ journal, users, agenceId }) {
  var [filtre,    setFiltre]    = useState(""); // agentId
  var [filtreType,setFiltreType]= useState(""); // type action
  var [limite,    setLimite]    = useState(30);

  var agents = users.filter(function(u){ return u.agenceId===agenceId && u.actif; });

  var filtered = journal.filter(function(e){
    if (filtre     && e.userId !== filtre)     return false;
    if (filtreType && e.type   !== filtreType) return false;
    return true;
  });
  var visible = filtered.slice(0, limite);

  var TYPE_CONFIG = {
    "creation":     { label:"Création",     color:"#059669", bg:"#F0FDF4", icon:"✨" },
    "modification": { label:"Modification", color:"#D97706", bg:"#FFFBEB", icon:"✏️" },
    "suppression":  { label:"Suppression",  color:"#DC2626", bg:"#FEF2F2", icon:"🗑️" },
  };

  function fmtTs(ts) {
    var d = new Date(ts);
    var now = new Date();
    var diffH = Math.floor((now-d)/3600000);
    var diffJ = Math.floor(diffH/24);
    if (diffH < 1)  return "Il y a moins d'1h";
    if (diffH < 24) return "Il y a "+diffH+"h";
    if (diffJ === 1) return "Hier à "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})+" à "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
  }

  return (
    <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginTop:16}}>
      {/* Header */}
      <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,color:"var(--navy)",fontSize:13,flex:"0 0 auto"}}>{"📋 Historique des modifications"}</span>
        <span style={{fontSize:11,color:"var(--g400)",background:"var(--g100)",borderRadius:20,padding:"2px 10px",fontWeight:700}}>{filtered.length+" entrée(s)"}</span>
        <div style={{flex:1}}></div>
        {/* Filtre agent */}
        <select value={filtre} onChange={function(e){setFiltre(e.target.value);setLimite(30);}} className="form-select" style={{width:"auto",fontSize:12,padding:"5px 10px"}}>
          <option value="">{"Tous les agents"}</option>
          {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.nom}</option>; })}
        </select>
        {/* Filtre type */}
        <select value={filtreType} onChange={function(e){setFiltreType(e.target.value);setLimite(30);}} className="form-select" style={{width:"auto",fontSize:12,padding:"5px 10px"}}>
          <option value="">{"Toutes actions"}</option>
          <option value="creation">{"✨ Créations"}</option>
          <option value="modification">{"✏️ Modifications"}</option>
          <option value="suppression">{"🗑️ Suppressions"}</option>
        </select>
      </div>

      {/* Liste */}
      {visible.length === 0 ? (
        <div style={{textAlign:"center",padding:"32px 16px",color:"var(--g400)"}}>
          <div style={{fontSize:32,marginBottom:8}}>{"📋"}</div>
          <div style={{fontWeight:700}}>{"Aucune activité enregistrée"}</div>
          <div style={{fontSize:12,marginTop:4}}>{"Les modifications apparaîtront ici en temps réel"}</div>
        </div>
      ) : (
        <div>
          {visible.map(function(e) {
            var cfg  = TYPE_CONFIG[e.type] || { label:e.type, color:"var(--g400)", bg:"var(--g50)", icon:"•" };
            var user = users.find(function(u){ return u.id===e.userId; });
            var uCol = user ? avatarColor(user.nom) : "var(--g300)";
            return (
              <div key={e.id} style={{display:"flex",gap:12,padding:"11px 16px",borderBottom:"1px solid var(--g50)",alignItems:"flex-start"}}>
                {/* Avatar utilisateur */}
                <div style={{width:32,height:32,borderRadius:16,background:uCol,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:11,flexShrink:0,marginTop:1}}>
                  {user ? user.avatar : "?"}
                </div>
                {/* Contenu */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                    <span style={{fontWeight:700,fontSize:12,color:"var(--navy)"}}>{e.userNom}</span>
                    <span style={{background:cfg.bg,color:cfg.color,fontSize:10,fontWeight:700,padding:"1px 8px",borderRadius:20,flexShrink:0}}>{cfg.icon+" "+cfg.label}</span>
                    <span style={{fontSize:10,color:"var(--g400)",marginLeft:"auto",flexShrink:0}}>{fmtTs(e.ts)}</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--g600)",lineHeight:1.4}}>{e.description}</div>
                </div>
              </div>
            );
          })}
          {/* Voir plus */}
          {filtered.length > limite && (
            <div style={{padding:"10px 16px",textAlign:"center"}}>
              <button onClick={function(){setLimite(function(l){return l+30;});}} className="btn btn-secondary btn-sm">
                {"Voir plus ("+(filtered.length-limite)+" restantes)"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PROFIL MANAGER ───────────────────────────────────────────────────────────
function ProfilManager({ currentUser, users, changerMotDePasse }) {
  var [ancien,   setAncien]   = useState("");
  var [nouveau,  setNouveau]  = useState("");
  var [confirm,  setConfirm]  = useState("");
  var [darkMode, setDarkMode] = useState(function(){ return document.body.classList.contains("dark-mode"); });
  function toggleDark() {
    var next = !darkMode;
    setDarkMode(next);
    if (next) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
    try { localStorage.setItem("orpi_dark_mode", next?"1":"0"); } catch(e) {}
  }
  var [msg,     setMsg]     = useState(null);

  function sauvegarder() {
    if (!ancien)                          { setMsg({type:"err", text:"Saisissez votre mot de passe actuel"}); return; }
    var userReel = (users||[]).find(function(u){return u.id===currentUser.id;}) || currentUser;
    if (ancien !== userReel.password)  { setMsg({type:"err", text:"Mot de passe actuel incorrect"}); return; }
    if (nouveau.length < 4)              { setMsg({type:"err", text:"Le nouveau mot de passe doit faire au moins 4 caractères"}); return; }
    if (nouveau !== confirm)              { setMsg({type:"err", text:"Les mots de passe ne correspondent pas"}); return; }
    changerMotDePasse(currentUser.id, nouveau);
    setMsg({type:"ok", text:"✅ Mot de passe modifié avec succès !"});
    setAncien(""); setNouveau(""); setConfirm("");
  }

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:"20px",marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:28,background:"var(--red)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20,flexShrink:0}}>
          {currentUser.avatar}
        </div>
        <div>
          <div style={{fontWeight:900,fontSize:17,color:"var(--navy)"}}>{currentUser.nom}</div>
          <div style={{fontSize:13,color:"var(--g400)",marginTop:2}}>{currentUser.email}</div>
          <div style={{fontSize:11,marginTop:4,background:"#EFF6FF",borderRadius:20,padding:"2px 10px",display:"inline-block",color:"var(--blue)",fontWeight:700}}>{"Manager"}</div>
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:"20px"}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:16}}>{"🔑 Changer mon mot de passe"}</div>
        {msg && (
          <div style={{background:msg.type==="ok"?"#F0FDF4":"#FEF2F2",border:"1px solid "+(msg.type==="ok"?"#A7F3D0":"#FECACA"),borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:msg.type==="ok"?"#065F46":"#DC2626",fontWeight:600}}>
            {msg.text}
          </div>
        )}
        <div className="form-group" style={{marginBottom:12}}>
          <label className="form-label">{"Mot de passe actuel"}</label>
          <input type="password" className="form-input" placeholder="Votre mot de passe actuel"
            value={ancien} onChange={function(e){setAncien(e.target.value);setMsg(null);}}/>
        </div>
        <div className="form-group" style={{marginBottom:12}}>
          <label className="form-label">{"Nouveau mot de passe"}</label>
          <input type="password" className="form-input" placeholder="Minimum 4 caractères"
            value={nouveau} onChange={function(e){setNouveau(e.target.value);setMsg(null);}}/>
        </div>
        <div className="form-group" style={{marginBottom:20}}>
          <label className="form-label">{"Confirmer"}</label>
          <input type="password" className="form-input" placeholder="Répétez le nouveau mot de passe"
            value={confirm} onChange={function(e){setConfirm(e.target.value);setMsg(null);}}
            onKeyDown={function(e){if(e.key==="Enter")sauvegarder();}}/>
        </div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={sauvegarder}>
          {"💾 Enregistrer le nouveau mot de passe"}
        </button>
      </div>
    </div>
  );
}

// ─── RECOMMANDATIONS ÉQUIPE (vue manager) ─────────────────────────────────────
function RecommandationsEquipe({ agents, mandats, locations, gestion, objectifs }) {
  var now = new Date();
  var annee = now.getFullYear();
  var mois  = now.getMonth();

  // Même logique que genererRecommandations côté agent
  function getConseils(agent) {
    var myM   = mandats.filter(function(m){return m.agentId===agent.id;});
    var active= myM.filter(function(m){return m.statut==="mandat";});
    var vendus= myM.filter(function(m){return m.statut==="vendu";});
    var compromis= myM.filter(function(m){return m.statut==="compromis";});
    var totalPris = active.length+compromis.length+vendus.length;
    var txTransfo = totalPris > 0 ? vendus.length/totalPris : 0;
    var activeMoyen = mandats.filter(function(m){return m.statut==="mandat";}).length / Math.max(1, agents.length);
    var obj = objectifs.find(function(o){return o.agentId===agent.id&&o.annee===annee;});
    var caReal = vendus.reduce(function(s,m){return s+(m.commission||0);},0);
    var pctObj = obj&&obj.montantHT>0 ? caReal/obj.montantHT : null;

    var mandatsAnciens = active.filter(function(m){
      if(!m.dateMandat) return false;
      return Math.floor((now-new Date(m.dateMandat))/86400000) > 90;
    });

    var alertes = [];
    if (active.length===0 && compromis.length===0) alertes.push("🗺️ Stock vide — prospection recommandée");
    else if (active.length < activeMoyen*0.6 && activeMoyen>2) alertes.push("📋 Stock sous la moyenne agence");
    if (active.length>=5 && vendus.length===0) alertes.push("📸 Beaucoup de mandats, peu de ventes — travailler la visibilité ou les prix");
    if (mandatsAnciens.length>0) alertes.push("⏰ "+mandatsAnciens.length+" mandat"+(mandatsAnciens.length>1?"s":"")+" sans activité > 3 mois");
    if (pctObj!==null && pctObj<0.4 && mois>=6) alertes.push("🎯 Objectif en retard — "+Math.round(pctObj*100)+"% atteint");
    if (txTransfo>0.45&&vendus.length>=2) alertes.push("🌟 Excellent taux de transformation : "+Math.round(txTransfo*100)+"%");
    if (pctObj!==null && pctObj>=1) alertes.push("🎉 Objectif annuel dépassé !");

    return alertes;
  }

  var lignes = agents.map(function(a){ return {agent:a, conseils:getConseils(a)}; })
    .filter(function(l){ return l.conseils.length > 0; });

  if (lignes.length === 0) return null;

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
      <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"10px 16px"}}>
        <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"💡 Recommandations par agent"}</span>
      </div>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {lignes.map(function(l) {
          return (
            <div key={l.agent.id} style={{borderRadius:10,border:"1px solid var(--g100)",padding:"10px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:14,background:"var(--red)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11}}>{l.agent.avatar}</div>
                <span style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{l.agent.nom}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {l.conseils.map(function(txt, i){
                  var isPositif = txt.startsWith("🌟")||txt.startsWith("🎉");
                  return (
                    <div key={i} style={{fontSize:12,color:isPositif?"#065F46":"#92400E",background:isPositif?"#F0FDF4":"#FFFBEB",borderRadius:6,padding:"5px 10px"}}>
                      {txt}
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
}
