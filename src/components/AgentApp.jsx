import { useState } from "react";
import { useApp } from "../App";
import ProspectionMap from "./ProspectionMap";
import Messagerie from "./Messagerie";
import Leads from "./Leads";
import Recherches from "./Recherches";
import GestionLocative from "./GestionLocative";
import OffMarket from "./OffMarket";
import Feedback from "./Feedback";
import StatsComparatives from "./StatsComparatives";
import { checkMatchesNouveauMandat, checkMatchesNouvelleRecherche } from "../matchingAuto";
import Outils from "./Outils";
import CarteInteractive from "./CarteInteractive";
import PwaInstallButton from "./PwaInstallButton";
import {
  AppShell, KpiCard, MandatForm, BadgeStatut, BadgeType,
  fmt, fmtDate, diffDays, todayStr,
} from "./Shared";
import { notifNouveauMandat, notifBaissePrix, demanderPermission as askPerm, permissionActuelle, notifNouveauCompromis } from "../notifications";
import { jouerApplaudissements } from "../applause";


function SwipeCard({ onSwipeLeft, onSwipeRight, children, style }) {
  var [offset, setOffset] = useState(0);
  var startX = { current: null };
  function onTouchStart(e) { startX.current = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (startX.current === null) return;
    var dx = e.touches[0].clientX - startX.current;
    setOffset(Math.max(-80, Math.min(80, dx)));
  }
  function onTouchEnd() {
    if (offset < -60 && onSwipeLeft)  onSwipeLeft();
    if (offset > 60  && onSwipeRight) onSwipeRight();
    setOffset(0);
    startX.current = null;
  }
  return (
    <div style={{position:"relative",overflow:"hidden",borderRadius:12,marginBottom:10}}>
      {offset < -20 && <div style={{position:"absolute",right:0,top:0,bottom:0,width:70,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,borderRadius:"0 12px 12px 0",zIndex:0}}>{"✏️"}</div>}
      {offset > 20  && <div style={{position:"absolute",left:0,top:0,bottom:0,width:70,background:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,borderRadius:"12px 0 0 12px",zIndex:0}}>{"📞"}</div>}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{transform:"translateX("+offset+"px)",transition:offset===0?"transform 0.2s":"none",position:"relative",zIndex:1,...style}}
      >
        {children}
      </div>
    </div>
  );
}

export default function AgentApp() {
  var ctx = useApp();
  var { currentUser, mandats, setMandats, locations, gestion, objectifs, tasks, setTasks, addJournal, changerMotDePasse, recherches, offmarket, users, prospection,
} = ctx;


  var [tab, _setTabRaw] = useState(function(){ try{ return localStorage.getItem("orpi_tab_agent")||"mandats"; }catch(e){ return "mandats"; } });
  function setTab(v){ try{ localStorage.setItem("orpi_tab_agent",v); }catch(e){} _setTabRaw(v); }
  var [sweepOpen,    setSweepOpen]    = useState(null);
  var [showMandatForm,   setShowMandatForm]   = useState(false);
  var [confirmMandat,   setConfirmMandat]   = useState(null); // { ref, adresse, isNew }
  var [editingMandat,  setEditingMandat]  = useState(null);
  var [showBravo,      setShowBravo]      = useState(null);

  var agenceId   = currentUser.agenceId;
  var agenceMandats = (mandats||[]).filter(function(m){return m.agenceId===agenceId;});
  var myMandats     = (mandats||[]).filter(function(m){return m.agentId===currentUser.id;});
  var myLocs     = (locations||[]).filter(function(l){return l.agentId===currentUser.id;});
  var myGestion  = (gestion||[]).filter(function(g){return g.agentId===currentUser.id && g.actif;});
  var myTasks    = (tasks||[]).filter(function(t){return (t.agentId===currentUser.id||!t.agentId) && t.agenceId===agenceId && t.statut!=="terminee";});
  var nbTasks    = myTasks.length;

  // Stats
  var active    = myMandats.filter(function(m){return m.statut==="mandat";});
  var compromis = myMandats.filter(function(m){return m.statut==="compromis";});
  var vendus    = myMandats.filter(function(m){return m.statut==="vendu";});
  var _nowA = new Date(); var _yA = _nowA.getFullYear(); var _mA = _nowA.getMonth();
  var offresMois = myMandats.filter(function(m){ if(!m.dateCompromis)return false; var d=new Date(m.dateCompromis); return d.getFullYear()===_yA&&d.getMonth()===_mA; });
  var caStock   = active.reduce(function(s,m){return s+m.commission;},0);
  var caSigne   = compromis.reduce(function(s,m){return s+m.commission;},0);
  var caEnc     = compromis.filter(function(m){return m.clausesSuspensivesLevees;}).reduce(function(s,m){return s+m.commission;},0);
  var caReal    = vendus.reduce(function(s,m){return s+m.commission;},0);
  var caLoc     = myLocs.filter(function(l){return l.locataireTrouve;}).reduce(function(s,l){return s+l.commission;},0);
  var caGest    = myGestion.reduce(function(s,g){return s+g.commissionMensuelle;},0);
  var obj       = (objectifs||[]).find(function(o){return o.agentId===currentUser.id && o.annee===new Date().getFullYear();});
  var progress  = obj && obj.montantHT>0 ? Math.min(100, Math.round(caReal/obj.montantHT*100)) : 0;

  // Taux commission moyen agent
  var vendusAvecPrix = vendus.filter(function(m){ return m.prix>0 && m.commission>0; });
  var txCommAgent = vendusAvecPrix.length > 0
    ? Math.round(vendusAvecPrix.reduce(function(s,m){ return s+(m.commission/m.prix*100); },0)/vendusAvecPrix.length*100)/100
    : null;

  // Moyenne agence (tous agents vendus)
  var agenceVendus = (agenceMandats||[]).filter(function(m){ return m.statut==="vendu" && m.prix>0 && m.commission>0; });
  var txCommAgence = agenceVendus.length > 0
    ? Math.round(agenceVendus.reduce(function(s,m){ return s+(m.commission/m.prix*100); },0)/agenceVendus.length*100)/100
    : null;
  var diffTxComm = (txCommAgent!=null && txCommAgence!=null) ? Math.round((txCommAgent-txCommAgence)*100)/100 : null;

  function celebrerOffreAcceptee(mandat) {
    jouerApplaudissements();
    setShowBravo({ mandatRef: mandat.ref, adresse: mandat.adresse, agentNom: currentUser.nom, commission: mandat.commission });
    setTimeout(function(){ setShowBravo(null); }, 5000);
    notifNouveauCompromis(mandat, currentUser.nom);
  }

  // Changer le statut d'un mandat + dates automatiques
  function changerStatut(mandat, nouveauStatut) {
    var patch = { statut: nouveauStatut };
    if (nouveauStatut === "compromis") {
      patch.dateCompromis = new Date().toISOString().slice(0,10);
    }
    if (nouveauStatut === "vendu") {
      patch.dateSignature = patch.dateSignature || new Date().toISOString().slice(0,10);
    }
    if (nouveauStatut === "compromis" || nouveauStatut === "vendu") {
      patch.clausesSuspensivesLevees = nouveauStatut === "vendu" ? true : mandat.clausesSuspensivesLevees;
    }
    if (nouveauStatut === "mandat") {
      // Retour en mandat = réinitialiser
      patch.dateCompromis = "";
      patch.clausesSuspensivesLevees = false;
    }
    var updated = {...mandat, ...patch};
    setMandats(function(prev){ return prev.map(function(m){ return m.id===mandat.id ? updated : m; }); });
    if (addJournal) addJournal({ type:"statut", description:"Statut mandat "+mandat.ref+" → "+nouveauStatut, cible:"mandat", cibleId:mandat.id });
    // Notifications manager
    try {
      var SK = "orpi_data_messages_v1";
      var msgs = JSON.parse(localStorage.getItem(SK)||"[]");
      var managers = (ctx.users||[]).filter(function(u){ return u.agenceId===agenceId && u.actif && (u.role==="manager"||u.role==="superadmin"); });
      var labels = { compromis:"🤝 Offre acceptée / Compromis", vendu:"✅ Acte définitif signé", sous_offre:"📝 Sous offre", mandat:"📋 Retour en mandat" };
      (managers||[]).forEach(function(mgr){
        msgs.push({ id:"statut-"+Date.now()+mgr.id, channelId:"priv-match-"+mgr.id, senderId:currentUser.id, senderNom:currentUser.nom, senderAvatar:currentUser.avatar||"👤",
          content:(labels[nouveauStatut]||nouveauStatut)+"\n\nMandat : "+mandat.ref+" — "+mandat.adresse+"\nPrix : "+(mandat.prix||0).toLocaleString("fr-FR")+"€\n\nMis à jour par "+currentUser.nom,
          ts:new Date().toISOString(), type:"statut_mandat", read:[], targetAgentId:mgr.id });
      });
      localStorage.setItem(SK, JSON.stringify(msgs));
    } catch(e){}
    // Levée CS → applaudissements
    if (nouveauStatut === "vendu") jouerApplaudissements();
  }

  function lever_cs(mandat) {
    var updated = {...mandat, clausesSuspensivesLevees:true};
    setMandats(function(prev){ return prev.map(function(m){ return m.id===mandat.id ? updated : m; }); });
  }

  function saveMandat(form) {
    var newId = editingMandat ? editingMandat.id : "m-"+Date.now();
    if (editingMandat && editingMandat.agentId && editingMandat.agentId !== currentUser.id) {
      alert("⛔ Vous ne pouvez pas modifier les mandats d'un autre agent.");
      setShowMandatForm(false); setEditingMandat(null); return;
    }
    var isNew = !editingMandat;
    var data = {...form, agentId:form.agentId||currentUser.id, agenceId:agenceId, id:newId};
    // Sécurité : si prix est string, le convertir
    data.prix       = Number(data.prix)||0;
    data.commission = Number(data.commission)||0;
    setMandats(function(prev){ var ex=prev.find(function(m){return m.id===data.id;}); return ex?prev.map(function(m){return m.id===data.id?data:m;}):[...prev,data]; });
    if (addJournal) addJournal({ type: isNew?"creation":"modification", description: (isNew?"Nouveau mandat créé : ":"Mandat modifié : ")+data.ref+" — "+data.adresse, cible:"mandat", cibleId:data.id });
    if (isNew) {
      notifNouveauMandat(data, currentUser.nom);
      // Notifier les managers via messagerie privée
      var SK_MSG = "orpi_data_messages_v1";
      try {
        var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
        var managers = (ctx.users||[]).filter(function(u){ return u.agenceId===agenceId && u.actif && (u.role==="manager"||u.role==="superadmin"); });
        (managers||[]).forEach(function(mgr){
          msgs.push({
            id:"new-mandat-"+Date.now()+"-"+mgr.id,
            channelId:"priv-match-"+mgr.id,
            senderId:currentUser.id,
            senderNom:currentUser.nom,
            senderAvatar:currentUser.avatar||"👤",
            content:"📋 Nouveau mandat créé\n\n"
              +"Ref : "+data.ref+"\n"
              +"Adresse : "+data.adresse+"\n"
              +"Prix : "+(data.prix||0).toLocaleString("fr-FR")+"€\n"
              +"Type : "+(data.typeBien||"—")+" · "+(data.typeMandat==="exclusif"?"⭐ Exclusif":"Simple")+"\n"
              +"Commission TTC : "+(data.commission||0).toLocaleString("fr-FR")+"€\n\n"
              +"Agent : "+currentUser.nom,
            ts:new Date().toISOString(),
            type:"nouveau_mandat",
            read:[],
            targetAgentId:mgr.id,
          });
        });
        localStorage.setItem(SK_MSG, JSON.stringify(msgs));
      } catch(e) {}
      // Matching automatique
      if (typeof checkMatchesNouveauMandat === "function") {
        checkMatchesNouveauMandat(data, ctx.recherches||[], ctx.offmarket||[], ctx.users||[], agenceId);
      }
    }
    else if (editingMandat && editingMandat.prix && data.prix < editingMandat.prix) { notifBaissePrix(data, editingMandat.prix, data.prix); }
    // Confirmation visuelle
    setConfirmMandat({ ref:data.ref, adresse:data.adresse, isNew });
    setTimeout(function(){ setConfirmMandat(null); }, 4000);
    setShowMandatForm(false); setEditingMandat(null);
  }

  var [showMoreMenuA, setShowMoreMenuA] = useState(false);
  var [showKpiDetailA, setShowKpiDetailA] = useState(null);
  var NAV_PRIMARY_A   = ["mandats","recherches","stats","messagerie","outils"];
  var NAV_SECONDARY_A = ["locations","gestion","gestion-loc","offmarket","carte","prospection","taches","leads","feedback","profil"];
  var ALL_TABS_A = {
    mandats:    {icon:"📋", label:"Mandats",         shortLabel:"Mandats"},
    recherches: {icon:"🔍", label:"Recherches",      shortLabel:"Rech."},
    stats:      {icon:"📊", label:"Mes stats",       shortLabel:"Stats"},
    messagerie: {icon:"💬", label:"Messagerie",      shortLabel:"Messages"},
    outils:     {icon:"🛠️", label:"Outils",          shortLabel:"Outils"},
    locations:  {icon:"🏠", label:"Mes locations",   shortLabel:"Locs"},
    gestion:    {icon:"🔑", label:"Mes gestions",    shortLabel:"Gestion"},
    "gestion-loc":{icon:"🏘️",label:"Parc locatif",   shortLabel:"Parc"},
    offmarket:  {icon:"🔒", label:"Off Market",      shortLabel:"OffMkt"},
    carte:      {icon:"🗺️", label:"Carte",           shortLabel:"Carte"},
    prospection:{icon:"🚶", label:"Prospection",     shortLabel:"Prosp."},
    taches:     {icon:"✅", label:"Tâches",          shortLabel:"Tâches"},
    leads:      {icon:"📥", label:"Leads",           shortLabel:"Leads"},
    feedback:   {icon:"💡", label:"Suggestions",     shortLabel:"Ideas"},
    profil:     {icon:"👤", label:"Mon profil",      shortLabel:"Profil"},
  };
  var navItems = [
    ...NAV_PRIMARY_A.map(function(id){ var t=ALL_TABS_A[id]||{}; return {id, icon:t.icon, label:t.label, shortLabel:t.shortLabel, active:tab===id, onClick:function(){setTab(id);setShowMoreMenuA(false);}}; }),
    {id:"more", icon:"···", label:"Plus", shortLabel:"Plus", active:NAV_SECONDARY_A.includes(tab), onClick:function(){setShowMoreMenuA(function(p){return !p;});}, isMore:true},
  ];

  var notifPerm = ctx.notifPerm || permissionActuelle();


  // ─── MINI MODAL SWEEPBRIGHT ────────────────────────────────────────────────
  function SweepModal({ m }) {
    var [sweepTab,   setSweepTab]   = useState("view");
    var [sweepUrlIn, setSweepUrlIn] = useState(m.sweepUrl||"");
    var [sweepMsg,   setSweepMsg]   = useState("");

    function saveSweepUrl() {
      if (!sweepUrlIn.trim()) { setSweepMsg("❌ URL vide"); return; }
      var updated = {...m, sweepUrl: sweepUrlIn.trim(), sweepPdf: null};
      setMandats(function(prev){ return prev.map(function(x){ return x.id===m.id?updated:x; }); });
      setSweepMsg("✅ Lien enregistré !"); setSweepTab("view");
      setTimeout(function(){ setSweepMsg(""); setSweepOpen(null); }, 1500);
    }
    function handlePdfUpload(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 5*1024*1024) { setSweepMsg("❌ Fichier trop lourd (max 5 Mo)"); return; }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var updated = {...m, sweepPdf: ev.target.result, sweepPdfName: file.name, sweepUrl: null};
        setMandats(function(prev){ return prev.map(function(x){ return x.id===m.id?updated:x; }); });
        setSweepMsg("✅ PDF chargé !"); setSweepTab("view");
        setTimeout(function(){ setSweepMsg(""); setSweepOpen(null); }, 1500);
      };
      reader.readAsDataURL(file);
    }
    function removeSweep() {
      var updated = {...m, sweepUrl:null, sweepPdf:null, sweepPdfName:null};
      setMandats(function(prev){ return prev.map(function(x){ return x.id===m.id?updated:x; }); });
      setSweepOpen(null);
    }
    function openSweep() {
      if (m.sweepUrl) { window.open(m.sweepUrl, "_blank"); return; }
      if (m.sweepPdf) {
        var a = document.createElement("a"); a.href=m.sweepPdf;
        a.download=m.sweepPdfName||"fiche-"+m.ref+".pdf"; a.click();
      }
    }
    return (
      <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.45)"}} onClick={function(){setSweepOpen(null);}}>
        <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,padding:"20px 16px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}} onClick={function(e){e.stopPropagation();}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontWeight:900,color:"var(--navy)",fontSize:15}}>{"🏷️ Fiche SweepBright"}</div>
              <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{m.ref+" · "+m.adresse}</div>
            </div>
            <button onClick={function(){setSweepOpen(null);}} style={{border:"none",background:"var(--g100)",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16,color:"var(--g500)"}}>{"✕"}</button>
          </div>
          {sweepMsg && <div style={{marginBottom:10,fontSize:12,fontWeight:700,color:sweepMsg.startsWith("✅")?"#059669":"#EF4444"}}>{sweepMsg}</div>}

          {sweepTab==="view" && (m.sweepUrl||m.sweepPdf) && (
            <div>
              <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:24}}>{m.sweepUrl?"🔗":"📄"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:"var(--g400)",fontWeight:700}}>{m.sweepUrl?"Lien SweepBright":"Fiche PDF"}</div>
                  <div style={{fontSize:12,color:"var(--navy)",fontWeight:600,wordBreak:"break-all"}}>{m.sweepUrl||m.sweepPdfName}</div>
                </div>
              </div>
              <button onClick={openSweep} style={{width:"100%",background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:12,fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:8}}>
                {m.sweepUrl?"🔗 Ouvrir SweepBright":"📥 Télécharger PDF"}
              </button>
              <div style={{display:"flex",gap:8}}>
                <button onClick={function(){setSweepTab("url");}} style={{flex:1,background:"var(--g50)",color:"var(--navy)",border:"1px solid var(--g200)",borderRadius:8,padding:"8px",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"✏️ Modifier"}</button>
                <button onClick={removeSweep} style={{flex:1,background:"#FEF2F2",color:"var(--red)",border:"1px solid #FECACA",borderRadius:8,padding:"8px",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"🗑 Supprimer"}</button>
              </div>
            </div>
          )}

          {sweepTab==="view" && !m.sweepUrl && !m.sweepPdf && (
            <div style={{textAlign:"center",paddingBottom:8}}>
              <div style={{fontSize:36,marginBottom:8}}>{"📋"}</div>
              <div style={{fontWeight:700,color:"var(--navy)",marginBottom:4}}>{"Aucune fiche chargée"}</div>
              <div style={{fontSize:12,color:"var(--g400)",marginBottom:14}}>{"Ajoutez un lien ou un PDF SweepBright"}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <button onClick={function(){setSweepTab("url");}} style={{background:"#EFF6FF",color:"#2563EB",border:"1px solid #BFDBFE",borderRadius:9,padding:"10px 18px",fontWeight:800,fontSize:13,cursor:"pointer"}}>{"🔗 Coller un lien"}</button>
                <button onClick={function(){setSweepTab("upload");}} style={{background:"#FFF7ED",color:"#EA580C",border:"1px solid #FED7AA",borderRadius:9,padding:"10px 18px",fontWeight:800,fontSize:13,cursor:"pointer"}}>{"📄 Upload PDF"}</button>
              </div>
            </div>
          )}

          {sweepTab==="url" && (
            <div>
              <input className="form-input" type="url" value={sweepUrlIn} onChange={function(e){setSweepUrlIn(e.target.value);}} placeholder="https://app.sweepbright.com/..." style={{marginBottom:10}} autoFocus/>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setSweepTab("view");}}>{"Annuler"}</button>
                <button className="btn btn-primary btn-sm" style={{flex:2}} onClick={saveSweepUrl}>{"💾 Enregistrer"}</button>
              </div>
            </div>
          )}

          {sweepTab==="upload" && (
            <div>
              <label style={{display:"block",border:"2px dashed #BFDBFE",borderRadius:10,padding:"20px",textAlign:"center",cursor:"pointer",background:"#EFF6FF",marginBottom:10}}>
                <input type="file" accept="application/pdf" style={{display:"none"}} onChange={handlePdfUpload}/>
                <div style={{fontSize:28,marginBottom:4}}>{"📄"}</div>
                <div style={{fontWeight:700,color:"#2563EB",fontSize:13}}>{"Choisir un PDF"}</div>
                <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"Max 5 Mo"}</div>
              </label>
              <button className="btn btn-secondary btn-sm" style={{width:"100%"}} onClick={function(){setSweepTab("view");}}>{"Annuler"}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  var sweepMandat = sweepOpen ? (agenceMandats||[]).find(function(m){ return m.id===sweepOpen; }) : null;
  return (
    <AppShell navItems={navItems} title={tab==="mandats"?"📋 Mandats agence":tab==="locations"?"🏠 Mes locations":tab==="gestion"?"🔑 Mes gestions":tab==="gestion-loc"?"🏘️ Parc locatif":tab==="offmarket"?"🔒 Off Market":tab==="outils"?"🛠️ Outils":tab==="feedback"?"💡 Suggestions":tab==="carte"?"🗺️ Carte interactive":tab==="prospection"?"🗺️ Prospection":tab==="taches"?"✅ Mes tâches":tab==="stats"?"📊 Mes stats":tab==="leads"?"📥 Mes leads":tab==="recherches"?"🔍 Recherches":tab==="profil"?"👤 Mon profil":"💬 Messagerie"}
      topbarActions={
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {notifPerm!=="granted" && <button onClick={async function(){ await (ctx.demanderPermission||askPerm)(); }} style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:"#D97706",cursor:"pointer",fontFamily:"var(--font)",display:"flex",alignItems:"center",gap:4}}>{"🔔 Activer notifs"}</button>}
          {notifPerm==="granted" && <span style={{fontSize:11,color:"#059669",fontWeight:700}}>{"🔔 ✓"}</span>}
          {tab==="mandats" && <button className="btn btn-primary btn-sm" onClick={function(){setEditingMandat(null);setShowMandatForm(true);}}>{"+ Mandat"}</button>}
        </div>
      }>

      {/* ──────────── MANDATS ──────────── */}
      {tab==="mandats" && (
        <div>
          {/* Carte mini sur l'onglet mandats agent */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"8px 14px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:700,color:"var(--navy)",fontSize:12}}>{"🗺️ Biens en stock"}</span>
              <button onClick={function(){setTab("carte");}} style={{fontSize:11,color:"var(--blue)",fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>{"Plein écran →"}</button>
            </div>
            <CarteInteractive mini={true} onNavigate={function(t,id,type){setTab(t);}}/>
          </div>
          <div className="kpi-grid" style={{marginBottom:16,overflowX:"hidden"}}>
            <KpiCard label="CA Stock" value={fmt(caStock)} color="var(--purple)" icon="📦" sub={active.filter(function(m){return m.typeMandat==="exclusif";}).length+" excl."}/>
            <KpiCard label="CA Signé" value={fmt(caSigne)} color="var(--amber)" icon="✍️" sub={compromis.length+" compromis"}/>
            <KpiCard label="Offres ce mois" value={offresMois.length} color="var(--blue)" icon="🤝" sub={offresMois.length>0?fmt(offresMois.reduce(function(s,m){return s+(m.commission||0);},0)):"Aucune offre"}/>
            <KpiCard label="CA Réalisé" value={fmt(caReal)} color="var(--red)" icon="🏆" sub={vendus.length+" ventes"}/>
          </div>
          {/* Filtres rapides */}
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"var(--g400)",alignSelf:"center"}}>{agenceMandats.length+" mandat(s)"}</span>
            <div style={{flex:1}}></div>
            <span style={{fontSize:11,background:"#EFF6FF",color:"var(--blue)",padding:"3px 10px",borderRadius:20,fontWeight:700}}>{"📋 Mes mandats : "+myMandats.length}</span>
            <span style={{fontSize:11,background:"var(--g100)",color:"var(--g500)",padding:"3px 10px",borderRadius:20,fontWeight:700}}>{"👥 Équipe : "+(agenceMandats.length-myMandats.length)}}</span>
          </div>
          {(agenceMandats||[]).map(function(m) {
            var isMine = m.agentId === currentUser.id;
            var agentProp = (ctx.users||[]).find(function(u){return u.id===m.agentId;});
            var exp = m.dateExpiration && diffDays(todayStr,m.dateExpiration)>=0 && diffDays(todayStr,m.dateExpiration)<=14;
            return (
              <SwipeCard key={m.id}
              onSwipeLeft={isMine?function(){setEditingMandat(m);setShowMandatForm(true);}:null}
              onSwipeRight={m.proprietaireTel?function(){window.location.href="tel:"+m.proprietaireTel.replace(/\s/g,"");}:null}
            >
            <div className="m-card" style={{borderLeft:"4px solid "+(isMine?"var(--blue)":m.statut==="vendu"?"var(--green)":m.statut==="compromis"?"var(--amber)":"var(--g200)"),margin:0,opacity:isMine?1:0.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4,alignItems:"center"}}>
                      <span style={{fontWeight:800,color:"var(--navy)"}}>{m.ref}</span>
                      <BadgeType type={m.typeMandat}/>
                      <BadgeStatut statut={m.statut}/>
                      {isMine && <span style={{background:"#EFF6FF",color:"var(--blue)",padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:700}}>{"✦ Mon mandat"}</span>}
                      {exp && <span className="badge" style={{background:"#FEF2F2",color:"var(--red)",border:"1px solid #FECACA"}}>{"⚠️ Expire bientôt"}</span>}
                    </div>
                    <div style={{fontSize:13,color:"var(--g700)",marginBottom:2}}>{m.adresse}</div>
                    {agentProp && <div style={{fontSize:11,color:"var(--g400)",display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:16,height:16,borderRadius:8,background:"#E63946",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:7}}>{agentProp.avatar}</div>
                      {isMine ? "Votre mandat" : agentProp.nom}
                    </div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <div style={{fontWeight:800,color:"var(--green)",fontSize:15}}>{fmt(m.commission)}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{fmt(m.prix)}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10,fontSize:12}}>
                  <div style={{background:"var(--g50)",borderRadius:8,padding:"7px 10px"}}>
                    <div style={{color:"var(--g400)",fontSize:10}}>{"Mandat"}</div>
                    <div style={{fontWeight:700}}>{fmtDate(m.dateMandat)}</div>
                  </div>
                  <div style={{background:exp?"#FEF2F2":"var(--g50)",borderRadius:8,padding:"7px 10px"}}>
                    <div style={{color:"var(--g400)",fontSize:10}}>{"Expiration"}</div>
                    <div style={{fontWeight:700,color:exp?"var(--red)":"inherit"}}>{fmtDate(m.dateExpiration)}</div>
                  </div>
                  {m.statut!=="mandat" && (
                    <div style={{background:"var(--g50)",borderRadius:8,padding:"7px 10px"}}>
                      <div style={{color:"var(--g400)",fontSize:10}}>{"CS"}</div>
                      <div style={{fontWeight:700,color:m.clausesSuspensivesLevees?"var(--green)":"var(--amber)"}}>{m.clausesSuspensivesLevees?"✅ Levées":"⏳ En attente"}</div>
                    </div>
                  )}
                  {m.dateSignature && (
                    <div style={{background:"var(--g50)",borderRadius:8,padding:"7px 10px"}}>
                      <div style={{color:"var(--g400)",fontSize:10}}>{"Signature"}</div>
                      <div style={{fontWeight:700}}>{fmtDate(m.dateSignature)}</div>
                    </div>
                  )}
                </div>
                {isMine && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>{"🔄 Changer le statut"}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {[
                        {id:"mandat",     label:"📋 En mandat",     color:"#1D3557", bg:"#EFF6FF",   show: m.statut!=="mandat"},
                        {id:"sous_offre", label:"📝 Sous offre",    color:"#D97706", bg:"#FEF3C7",   show: m.statut==="mandat"},
                        {id:"compromis",  label:"🤝 Compromis",     color:"#059669", bg:"#F0FDF4",   show: m.statut==="mandat"||m.statut==="sous_offre"},
                        {id:"cs_levees",  label:"✅ CS levées",     color:"#7C3AED", bg:"#F5F3FF",   show: m.statut==="compromis"&&!m.clausesSuspensivesLevees},
                        {id:"vendu",      label:"🏆 Acte signé",    color:"#DC2626", bg:"#FEF2F2",   show: m.statut==="compromis"},
                      ].filter(function(s){return s.show;}).map(function(s){
                        return (
                          <button key={s.id} onClick={function(e){
                            e.stopPropagation();
                            if(s.id==="cs_levees") { lever_cs(m); }
                            else { changerStatut(m, s.id); }
                            if(s.id==="compromis"||s.id==="vendu") celebrerOffreAcceptee(m);
                          }}
                          style={{padding:"5px 10px",borderRadius:8,border:"2px solid "+s.color,background:s.bg,color:s.color,fontWeight:800,fontSize:10,cursor:"pointer",fontFamily:"var(--font)"}}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:6,marginTop:2}}>
                  <button
                    className="btn btn-sm"
                    style={{flex:1,background:(m.sweepUrl||m.sweepPdf)?"#EFF6FF":"var(--g50)",color:(m.sweepUrl||m.sweepPdf)?"#2563EB":"var(--g400)",border:"1px solid "+((m.sweepUrl||m.sweepPdf)?"#BFDBFE":"var(--g200)"),fontWeight:700,fontSize:11}}
                    onClick={function(e){e.stopPropagation();setSweepOpen(m.id);}}
                  >
                    {(m.sweepUrl||m.sweepPdf)?"🏷️ Fiche SweepBright ✓":"🏷️ SweepBright"}
                  </button>
                  {isMine && <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setEditingMandat(m);setShowMandatForm(true);}}>{"✏️ Modifier"}</button>}
                {!isMine && <div style={{fontSize:10,color:"var(--g400)",padding:"4px 8px",background:"var(--g50)",borderRadius:7,textAlign:"center"}}>{"🔒 Mandat de "+(agentProp?agentProp.nom:"un collègue")}</div>}
                </div>
                {m.adresseProvisoire && <div style={{fontSize:10,color:"#92400E",background:"#FEF3C7",borderRadius:7,padding:"2px 8px",marginTop:4,display:"inline-block"}}>{"📍 Adresse à compléter"}</div>}
                {!isMine && <div style={{textAlign:"center",fontSize:11,color:"var(--g400)",padding:"5px",background:"var(--g50)",borderRadius:8,marginTop:4}}>{"🔒 Mandat de "+(agentProp?agentProp.nom:"un collègue")}</div>}
              </div>
            </SwipeCard>
            );
          })}
          {agenceMandats.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
              <div style={{fontSize:40,marginBottom:12}}>{"📋"}</div>
              <div style={{fontWeight:700,fontSize:15}}>{"Aucun mandat dans l'agence"}</div>
            </div>
          )}
        </div>
      )}

      {/* ──────────── LOCATIONS ──────────── */}
      {tab==="locations" && (
        <div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Locations" value={myLocs.length} color="var(--blue)" icon="🏠"/>
            <KpiCard label="Trouvées" value={myLocs.filter(function(l){return l.locataireTrouve;}).length} color="var(--green)" icon="✅" sub={fmt(caLoc)+" commissions"}/>
          </div>
          {myLocs.map(function(l) {
            return (
              <div key={l.id} className="m-card" style={{borderLeft:"4px solid "+(l.locataireTrouve?"var(--green)":"var(--amber)"),marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:800,color:"var(--navy)"}}>{l.ref}</div>
                    <div style={{fontSize:13,color:"var(--g700)",marginTop:2}}>{l.adresse}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,color:"var(--green)"}}>{fmt(l.commission)}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{l.loyer+"€/mois"}</div>
                  </div>
                </div>
                <span className={"badge "+(l.locataireTrouve?"badge-vendu":"badge-compromis")}>{l.locataireTrouve?"✅ Locataire trouvé":"🔍 En recherche"}</span>
                {l.locataireTrouve && <div style={{fontSize:12,color:"var(--g500)",marginTop:6}}>{l.locatairePrenom+" "+l.locataireNom+" · "+l.locataireTel}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── GESTION ──────────── */}
      {tab==="gestion" && (
        <div>
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="Biens gérés" value={myGestion.length} color="var(--navy)" icon="🔑"/>
            <KpiCard label="Revenus/mois" value={fmt(caGest)} color="var(--green)" icon="💰"/>
            <KpiCard label="Revenus/an" value={fmt(caGest*12)} color="var(--purple)" icon="📅"/>
          </div>
          {myGestion.map(function(g) {
            return (
              <div key={g.id} className="m-card" style={{borderLeft:"4px solid var(--navy)",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:800,color:"var(--navy)"}}>{g.ref}</div>
                    <div style={{fontSize:13,color:"var(--g700)",marginTop:2}}>{g.adresse}</div>
                    <div style={{fontSize:12,color:"var(--g400)",marginTop:2}}>{"Prop. : "+g.proprietairePrenom+" "+g.proprietaireNom}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,color:"var(--green)"}}>{fmt(g.commissionMensuelle)+"/mois"}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{g.loyer+"€ loyer"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── PROSPECTION ──────────── */}
      {tab==="prospection" && (
        <ProspectionMap currentUser={currentUser} isManager={false}/>
      )}

      {/* ──────────── TÂCHES ──────────── */}
      {tab==="taches" && (
        <div>
          {myTasks.length===0 ? (
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
              <div style={{fontSize:44,marginBottom:12}}>{"✅"}</div>
              <div style={{fontWeight:700,fontSize:15,color:"var(--navy)"}}>{"Aucune tâche en cours"}</div>
              <div style={{fontSize:13,marginTop:6}}>{"Votre manager vous assignera des tâches ici"}</div>
            </div>
          ) : (myTasks||[]).map(function(t) {
            var ech = t.echeance ? diffDays(todayStr,t.echeance) : null;
            return (
              <div key={t.id} className="m-card" style={{borderLeft:"4px solid "+(t.priorite==="haute"?"var(--red)":t.priorite==="moyenne"?"var(--amber)":"var(--blue)"),marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,color:"var(--navy)",marginBottom:4}}>{t.titre}</div>
                    {t.description && <div style={{fontSize:12,color:"var(--g500)",marginBottom:4}}>{t.description}</div>}
                    {ech!==null && <div style={{fontSize:12,fontWeight:700,color:ech<0?"var(--red)":ech<=3?"var(--amber)":"var(--green)"}}>{"📅 "+(ech<0?"Dépassé":ech===0?"Aujourd'hui":"J+"+ech)}</div>}
                  </div>
                  <span className={"badge "+(t.statut==="en_cours"?"badge-compromis":"badge-mandat")}>{t.statut==="en_cours"?"▶ En cours":"⏳ Attente"}</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {t.statut==="en_attente" && (
                    <button className="btn btn-secondary btn-sm" style={{flex:1}} onClick={function(){setTasks(function(prev){return prev.map(function(x){return x.id===t.id?{...x,statut:"en_cours"}:x;});});}}>{"▶ Démarrer"}</button>
                  )}
                  <button className="btn btn-green btn-sm" style={{flex:2}} onClick={function(){setTasks(function(prev){return prev.map(function(x){return x.id===t.id?{...x,statut:"terminee"}:x;});});}}>{"✅ Marquer terminée"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────────── STATS ──────────── */}
      {tab==="stats_old" && (
        <div>
          <Recommandations
            agent={currentUser}
            myMandats={myMandats}
            agenceMandats={agenceMandats}
            locations={ctx.locations||[]}
            gestion={ctx.gestion||[]}
            objectifs={objectifs}
          />
          <div className="kpi-grid" style={{marginBottom:16}}>
            <KpiCard label="CA Total" value={fmt(caReal+caLoc)} color="var(--red)" icon="💎" sub="Transactions + Locations"/>
            <KpiCard label="CA Transactions" value={fmt(caReal)} color="var(--navy)" icon="🏆" sub={vendus.length+" ventes"}/>
            <KpiCard label="CA Locations" value={fmt(caLoc)} color="var(--blue)" icon="🏠"/>
            <KpiCard label="Gestion/mois" value={fmt(caGest)} color="var(--green)" icon="🔑"/>
          </div>
          {/* KPI taux commission vs agence */}
          {txCommAgent !== null && (
            <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
              <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"10px 14px"}}>
                <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📐 Taux de commission moyen"}</span>
              </div>
              <div style={{padding:"14px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div style={{background:txCommAgent>=(txCommAgence||0)?"#F0FDF4":"#FEF2F2",borderRadius:10,padding:"12px 14px",border:"1px solid "+(txCommAgent>=(txCommAgence||0)?"#A7F3D0":"#FECACA")}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{"MON TAUX MOYEN"}</div>
                    <div style={{fontSize:26,fontWeight:900,color:txCommAgent>=(txCommAgence||0)?"var(--green)":"var(--red)",lineHeight:1}}>{txCommAgent+"%"}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{vendusAvecPrix.length+" vente"+(vendusAvecPrix.length>1?"s":"")+" actée"+(vendusAvecPrix.length>1?"s":"")}</div>
                  </div>
                  <div style={{background:"var(--g50)",borderRadius:10,padding:"12px 14px",border:"1px solid var(--g200)"}}>
                    <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:4}}>{"MOYENNE AGENCE"}</div>
                    <div style={{fontSize:26,fontWeight:900,color:"var(--navy)",lineHeight:1}}>{txCommAgence?txCommAgence+"%":"—"}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{agenceVendus.length+" vente"+(agenceVendus.length>1?"s":"")+" total"}</div>
                  </div>
                </div>
                {diffTxComm !== null && (
                  <div style={{background:diffTxComm>=0?"#F0FDF4":"#FEF2F2",borderRadius:9,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid "+(diffTxComm>=0?"#A7F3D0":"#FECACA")}}>
                    <span style={{fontSize:12,color:"var(--g600)",fontWeight:600}}>{diffTxComm>=0?"✅ Au-dessus de la moyenne agence":"⚠️ En dessous de la moyenne agence"}</span>
                    <span style={{fontWeight:900,fontSize:15,color:diffTxComm>=0?"var(--green)":"var(--red)"}}>{(diffTxComm>0?"+":"")+diffTxComm+" pt"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {obj && (
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header"><span className="card-title">{"🎯 Objectif "+new Date().getFullYear()}</span></div>
              <div className="card-body">
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{color:"var(--g500)",fontSize:13}}>{"Objectif : "+fmt(obj.montantHT)}</span>
                  <span style={{fontWeight:800,color:progress>=100?"var(--green)":progress>=70?"var(--amber)":"var(--red)"}}>{progress+"%"}</span>
                </div>
                <div className="progress-bar" style={{height:12}}>
                  <div className="progress-fill" style={{width:progress+"%",background:progress>=100?"var(--green)":progress>=70?"var(--amber)":"var(--red)"}}></div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12,color:"var(--g400)"}}>
                  <span>{"Réalisé : "+fmt(caReal)}</span>
                  <span>{"Reste : "+fmt(Math.max(0,obj.montantHT-caReal))}</span>
                </div>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-header"><span className="card-title">{"📊 Répartition mandats"}</span></div>
            <div className="card-body">
              {[{label:"Actifs",count:active.length,color:"var(--blue)"},{label:"Compromis",count:compromis.length,color:"var(--amber)"},{label:"Vendus",count:vendus.length,color:"var(--green)"}].map(function(r) {
                return (
                  <div key={r.label} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{r.label}</span>
                      <span style={{fontWeight:800,color:r.color}}>{r.count}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{width:(myMandats.length>0?r.count/myMandats.length*100:0)+"%",background:r.color}}></div></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab==="leads" && <Leads/>}
      {tab==="gestion-loc" && <GestionLocative/>}
      {tab==="outils" && <Outils/>}
      {tab==="feedback" && <Feedback/>}
      {tab==="offmarket" && <OffMarket/>}
      {tab==="carte" && <CarteInteractive onNavigate={function(targetTab, bienId, bienType){ setTab(targetTab); }}/>}
      {tab==="recherches" && <Recherches/>}
      {tab==="stats" && <StatsComparatives/>}
      {tab==="messagerie" && <Messagerie/>}
      {tab==="profil"     && <ProfilAgent currentUser={currentUser} changerMotDePasse={changerMotDePasse}/>}

            {showBravo && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(){setShowBravo(null);}}>
          <div style={{background:"#fff",borderRadius:24,padding:"40px 32px",maxWidth:360,width:"100%",textAlign:"center",boxShadow:"0 40px 100px rgba(0,0,0,0.4)",animation:"bravo-in 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}>
            <div style={{fontSize:60,marginBottom:8,lineHeight:1}}>{"🎉"}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#1D3557",marginBottom:6}}>{"Offre acceptée !"}</div>
            <div style={{fontSize:16,color:"#E63946",fontWeight:800,marginBottom:4}}>{showBravo.mandatRef}</div>
            <div style={{fontSize:13,color:"#64748B",marginBottom:12}}>{showBravo.adresse}</div>
            <div style={{fontSize:20,fontWeight:900,color:"#10B981",marginBottom:8}}>{showBravo.commission?(Math.round(showBravo.commission).toLocaleString("fr-FR")+"€"):""}
            </div>
            <div style={{fontSize:14,color:"#1D3557",fontWeight:700,marginBottom:20}}>{"Bravo "+showBravo.agentNom+" ! 👏"}</div>
            <div style={{fontSize:12,color:"#94A3B8"}}>{"Cliquez pour fermer"}</div>
          </div>
          <style>{"@keyframes bravo-in{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}"}</style>
        </div>
      )}

      {showMandatForm && (
        <MandatForm initial={editingMandat} agents={(ctx.users||[]).filter(function(u){return (u.role==="agent"||u.role==="manager"||u.role==="superadmin")&&u.agenceId===agenceId&&u.actif;})} agenceId={agenceId} onSave={saveMandat} onCancel={function(){setShowMandatForm(false);setEditingMandat(null);}}/>
      )}
    {sweepMandat && <SweepModal m={sweepMandat}/>}
      {showKpiDetailA && (function(){
        var agentMandats = (mandats||[]).filter(function(m){return m.agentId===currentUser.id;});
        var kpiMapA = {
          mandats_actifs: {titre:"📋 Mandats actifs",   items:(agentMandats||[]).filter(function(m){return m.statut==="mandat";}),   extra:function(m){return m.adresse.split(",")[0]+" · "+fmt(m.prix||0);}},
          compromis:      {titre:"🤝 Compromis",         items:(agentMandats||[]).filter(function(m){return m.statut==="compromis";}), extra:function(m){return m.adresse.split(",")[0]+" · "+fmt(m.commission||0)+" comm.";}},
          vendus:         {titre:"✅ Ventes actées",      items:(agentMandats||[]).filter(function(m){return m.statut==="vendu";}),     extra:function(m){return m.adresse.split(",")[0]+" · "+fmt(m.prix||0);}},
          ca_realise:     {titre:"🏆 CA Réalisé",        items:(agentMandats||[]).filter(function(m){return m.statut==="vendu";}),     extra:function(m){return m.adresse.split(",")[0]+" · "+fmt(m.commission||0)+" TTC";}},
          locations:      {titre:"🏠 Locations signées", items:myLocs.filter(function(l){return l.locataireTrouve;}),            extra:function(l){return l.adresse.split(",")[0]+" · "+(l.loyer||0)+"€/mois";}},
        };
        var k = kpiMapA[showKpiDetailA];
        if (!k) return null;
        return (
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setShowKpiDetailA(null);}}>
            <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,maxHeight:"70vh",overflowY:"auto",padding:"20px 16px 32px"}} onClick={function(e){e.stopPropagation();}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontWeight:800,color:"var(--navy)",fontSize:15}}>{k.titre}</div>
                <button onClick={function(){setShowKpiDetailA(null);}} style={{background:"var(--g100)",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:13}}>{"✕"}</button>
              </div>
              {k.items.length===0 && <div style={{textAlign:"center",color:"var(--g400)",padding:"20px",fontSize:13}}>{"Aucun élément"}</div>}
              {k.items.map(function(item,i){
                return (
                  <div key={item.id||i} style={{padding:"10px 0",borderBottom:"1px solid var(--g50)"}}>
                    <div style={{fontWeight:700,color:"var(--navy)",fontSize:13}}>{item.ref||item.adresse}</div>
                    <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{k.extra(item)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      {confirmMandat && (
        <div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",zIndex:300,background:confirmMandat.isNew?"var(--green)":"var(--blue)",color:"#fff",borderRadius:14,padding:"14px 20px",boxShadow:"0 8px 30px rgba(0,0,0,0.2)",maxWidth:340,width:"90%",textAlign:"center",animation:"fadeIn 0.3s"}}>
          <div style={{fontSize:22,marginBottom:6}}>{confirmMandat.isNew?"✅":"💾"}</div>
          <div style={{fontWeight:800,fontSize:14}}>{confirmMandat.isNew?"Mandat enregistré !":"Mandat mis à jour !"}</div>
          <div style={{fontSize:12,opacity:.85,marginTop:4}}>{confirmMandat.ref+" — "+confirmMandat.adresse.split(",")[0]}</div>
          {confirmMandat.isNew && <div style={{fontSize:11,opacity:.7,marginTop:4}}>{"Votre manager a été notifié"}</div>}
        </div>
      )}
      {showMoreMenuA && (
        <div style={{position:"fixed",bottom:"var(--mob-nav,56px)",left:0,right:0,zIndex:100,
          background:"#1D3557",boxShadow:"0 -4px 24px rgba(0,0,0,0.35)"}}
          onClick={function(e){e.stopPropagation();}}>
          <div style={{display:"flex",alignItems:"center",padding:"10px 14px 6px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
            <span style={{fontWeight:900,color:"#fff",fontSize:14,flex:1}}>{"Navigation"}</span>
            <button onClick={function(){setShowMoreMenuA(false);}} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{"✕"}</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:6,padding:"10px 10px 14px"}}>
            {(NAV_SECONDARY_A||[]).map(function(id){
              var t = ALL_TABS_A[id]||{icon:"📄",label:id,shortLabel:id};
              var isActive = tab===id;
              return (
                <button key={id} onClick={function(){setTab(id);setShowMoreMenuA(false);}}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    gap:4,padding:"10px 6px",borderRadius:12,border:"none",
                    background:isActive?"rgba(232,0,29,0.85)":"rgba(255,255,255,0.1)",
                    color:"#fff",fontWeight:isActive?800:600,fontSize:11,cursor:"pointer",
                    fontFamily:"var(--font)"}}>
                  <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
                  <span style={{lineHeight:1.3,textAlign:"center",marginTop:2}}>{t.shortLabel||t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ProfilAgent({ currentUser, changerMotDePasse }) {
  var ctx    = useApp();
  var [ancien,   setAncien]   = useState("");
  var [nouveau,  setNouveau]  = useState("");
  var [confirm,  setConfirm]  = useState("");
  var [msg,      setMsg]      = useState(null);
  var [couleur,  setCouleur]  = useState(currentUser.couleur || "#E63946");
  var [photoB64, setPhotoB64] = useState(currentUser.photo  || "");
  var [saved,    setSaved]    = useState(false);

  var COULEURS = ["#E63946","#2196F3","#059669","#7C3AED","#F59E0B","#EC4899","#0891B2","#DC2626","#16A34A","#1D3557","#D97706","#9333EA","#0284C7","#BE185D","#065F46"];

  function sauvegarderProfil() {
    ctx.setUsers(function(prev){ return prev.map(function(u){ return u.id===currentUser.id ? {...u, couleur, photo:photoB64} : u; }); });
    setSaved(true); setTimeout(function(){ setSaved(false); }, 3000);
  }
  function sauvegarderMdp() {
    if (!ancien) { setMsg({type:"err",text:"Saisissez votre mot de passe actuel"}); return; }
    if (ancien !== currentUser.password) { setMsg({type:"err",text:"Mot de passe actuel incorrect"}); return; }
    if (nouveau.length < 6) { setMsg({type:"err",text:"Minimum 6 caracteres"}); return; }
    if (nouveau !== confirm) { setMsg({type:"err",text:"Les mots de passe ne correspondent pas"}); return; }
    changerMotDePasse(currentUser.id, nouveau);
    setMsg({type:"ok",text:"Mot de passe modifie !"}); setAncien(""); setNouveau(""); setConfirm("");
  }
  return (
    <div>
      <div style={{background:"linear-gradient(135deg,"+(couleur||"#E63946")+","+(couleur||"#E63946")+"99)",borderRadius:14,padding:"20px",marginBottom:14,display:"flex",alignItems:"center",gap:16,color:"#fff"}}>
        <div style={{position:"relative",flexShrink:0}}>
          <div style={{width:72,height:72,borderRadius:36,background:"rgba(255,255,255,0.2)",border:"3px solid rgba(255,255,255,0.5)",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {photoB64?<img src={photoB64} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontWeight:900,fontSize:26,color:"#fff"}}>{currentUser.avatar}</span>}
          </div>
        </div>
        <div><div style={{fontWeight:900,fontSize:18}}>{currentUser.nom}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{currentUser.email}</div></div>
      </div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:"20px",marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"Couleur de profil"}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {COULEURS.map(function(col){var actif=couleur===col;return(<button key={col} onClick={function(){setCouleur(col);}} style={{width:36,height:36,borderRadius:18,background:col,border:actif?"3px solid var(--navy)":"3px solid transparent",cursor:"pointer"}}/>);})}
        </div>
        {saved&&<div style={{background:"#F0FDF4",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#065F46",fontWeight:700,marginBottom:10}}>{"Profil sauvegarde !"}</div>}
        <button className="btn btn-primary" style={{width:"100%",background:couleur,border:"none"}} onClick={sauvegarderProfil}>{"Sauvegarder mon profil"}</button>
      </div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:"20px"}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"Changer mon mot de passe"}</div>
        {msg&&<div style={{background:msg.type==="ok"?"#F0FDF4":"#FEF2F2",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:msg.type==="ok"?"#065F46":"#DC2626",fontWeight:600}}>{msg.text}</div>}
        <div className="form-group" style={{marginBottom:12}}><label className="form-label">{"Mot de passe actuel"}</label><input type="password" className="form-input" value={ancien} onChange={function(e){setAncien(e.target.value);setMsg(null);}}/></div>
        <div className="form-group" style={{marginBottom:12}}><label className="form-label">{"Nouveau mot de passe"}</label><input type="password" className="form-input" value={nouveau} onChange={function(e){setNouveau(e.target.value);setMsg(null);}}/></div>
        <div className="form-group" style={{marginBottom:16}}><label className="form-label">{"Confirmer"}</label><input type="password" className="form-input" value={confirm} onChange={function(e){setConfirm(e.target.value);setMsg(null);}}/></div>
        <button className="btn btn-primary" style={{width:"100%"}} onClick={sauvegarderMdp}>{"Enregistrer"}</button>
      </div>
    </div>
  );
}

function genererRecommandations(mandats, recherches, offmarket) {
  var recs = [];
  var nbM = (mandats||[]).filter(function(m){return m.statut==="mandat";}).length;
  var nbC = (mandats||[]).filter(function(m){return m.statut==="compromis";}).length;
  if (nbM > 0 && (recherches||[]).length === 0) recs.push({icon:"🔍",type:"Action",texte:"Vous avez "+nbM+" mandat"+(nbM>1?"s":"")+" en stock. Rentrez des recherches clients pour activer le matching automatique !"});
  if (nbC > 0) recs.push({icon:"✍️",type:"Priorite",texte:nbC+" compromis en cours. Verifiez les conditions suspensives et relancez les notaires."});
  if ((offmarket||[]).length === 0) recs.push({icon:"🔒",type:"Astuce",texte:"Ajoutez des biens off-market pour enrichir votre portefeuille confidentiel."});
  if (recs.length === 0) recs.push({icon:"🎯",type:"Bravo",texte:"Votre portefeuille est bien structure. Continuez a prospecter !"});
  return recs;
}

function Recommandations({ mandats, recherches, offmarket }) {
  var recs = genererRecommandations(mandats||[], recherches||[], offmarket||[]);
  return (
    <div>
      {recs.map(function(r,i){
        return (
          <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid var(--g50)"}}>
            <span style={{fontSize:28,flexShrink:0}}>{r.icon}</span>
            <div>
              <div style={{fontWeight:800,color:"var(--navy)",fontSize:12,marginBottom:3}}>{r.type}</div>
              <div style={{fontSize:13,color:"var(--g600)",lineHeight:1.5}}>{r.texte}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
