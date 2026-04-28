import { useState } from "react";
import { useApp } from "../App";
import ProspectionMap from "./ProspectionMap";
import Messagerie from "./Messagerie";
import Leads from "./Leads";
import Recherches from "./Recherches";
import GestionLocative from "./GestionLocative";
import OffMarket from "./OffMarket";
import Feedback from "./Feedback";
import CarteInteractive from "./CarteInteractive";
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
  var { currentUser, mandats, setMandats, locations, gestion, objectifs, tasks, setTasks, addJournal, changerMotDePasse } = ctx;

  var [tab, setTab] = useState("mandats");
  var [sweepOpen,    setSweepOpen]    = useState(null);
  var [showMandatForm, setShowMandatForm] = useState(false);
  var [editingMandat,  setEditingMandat]  = useState(null);
  var [showBravo,      setShowBravo]      = useState(null);

  var agenceId   = currentUser.agenceId;
  var agenceMandats = mandats.filter(function(m){return m.agenceId===agenceId;});
  var myMandats     = mandats.filter(function(m){return m.agentId===currentUser.id;});
  var myLocs     = locations.filter(function(l){return l.agentId===currentUser.id;});
  var myGestion  = gestion.filter(function(g){return g.agentId===currentUser.id && g.actif;});
  var myTasks    = tasks.filter(function(t){return (t.agentId===currentUser.id||!t.agentId) && t.agenceId===agenceId && t.statut!=="terminee";});
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
  var obj       = objectifs.find(function(o){return o.agentId===currentUser.id && o.annee===new Date().getFullYear();});
  var progress  = obj && obj.montantHT>0 ? Math.min(100, Math.round(caReal/obj.montantHT*100)) : 0;

  // Taux commission moyen agent
  var vendusAvecPrix = vendus.filter(function(m){ return m.prix>0 && m.commission>0; });
  var txCommAgent = vendusAvecPrix.length > 0
    ? Math.round(vendusAvecPrix.reduce(function(s,m){ return s+(m.commission/m.prix*100); },0)/vendusAvecPrix.length*100)/100
    : null;

  // Moyenne agence (tous agents vendus)
  var agenceVendus = agenceMandats.filter(function(m){ return m.statut==="vendu" && m.prix>0 && m.commission>0; });
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

  function saveMandat(form) {
    var newId = editingMandat ? editingMandat.id : "m-"+Date.now();
    if (editingMandat && editingMandat.agentId && editingMandat.agentId !== currentUser.id) {
      alert("⛔ Vous ne pouvez pas modifier les mandats d'un autre agent.");
      setShowMandatForm(false); setEditingMandat(null); return;
    }
    var isNew = !editingMandat;
    var data = {...form, agentId:currentUser.id, agenceId:agenceId, id:newId};
    setMandats(function(prev){ var ex=prev.find(function(m){return m.id===data.id;}); return ex?prev.map(function(m){return m.id===data.id?data:m;}):[...prev,data]; });
    if (addJournal) addJournal({ type: isNew?"creation":"modification", description: (isNew?"Nouveau mandat créé : ":"Mandat modifié : ")+data.ref+" — "+data.adresse, cible:"mandat", cibleId:data.id });
    if (isNew) { notifNouveauMandat(data, currentUser.nom); }
    else if (editingMandat && editingMandat.prix && data.prix < editingMandat.prix) { notifBaissePrix(data, editingMandat.prix, data.prix); }
    setShowMandatForm(false); setEditingMandat(null);
  }

  var navItems = [
    {id:"mandats",    icon:"📋", label:"Mes mandats",   shortLabel:"Mandats",  active:tab==="mandats",    onClick:function(){setTab("mandats");}},
    {id:"locations",  icon:"🏠", label:"Mes locations",  shortLabel:"Locations",active:tab==="locations",  onClick:function(){setTab("locations");}},
    {id:"gestion",    icon:"🔑", label:"Gestion locative",shortLabel:"Gestion",  active:tab==="gestion",    onClick:function(){setTab("gestion");}},
    {id:"gestion-loc", icon:"🏘️", label:"Parc locatif",    shortLabel:"Parc",     active:tab==="gestion-loc",onClick:function(){setTab("gestion-loc");}},
    {id:"offmarket",   icon:"🔒", label:"Off Market",     shortLabel:"OffMkt",   active:tab==="offmarket",  onClick:function(){setTab("offmarket");}},
    {id:"carte",       icon:"🗺️", label:"Carte",           shortLabel:"Carte",    active:tab==="carte",      onClick:function(){setTab("carte");}},
    {id:"prospection",icon:"🗺️", label:"Prospection",   shortLabel:"Prosp.",   active:tab==="prospection",onClick:function(){setTab("prospection");}},
    {id:"taches",     icon:"✅", label:"Mes tâches",     shortLabel:"Tâches",   active:tab==="taches",     onClick:function(){setTab("taches");},     badge:nbTasks||null},
    {id:"stats",      icon:"📊", label:"Mes stats",      shortLabel:"Stats",    active:tab==="stats",      onClick:function(){setTab("stats");}},
    {id:"leads",      icon:"📥", label:"Mes leads",      shortLabel:"Leads",    active:tab==="leads",      onClick:function(){setTab("leads");}},
    {id:"recherches", icon:"🔍", label:"Recherches",     shortLabel:"Rech.",    active:tab==="recherches", onClick:function(){setTab("recherches");}},
    {id:"messagerie", icon:"💬", label:"Messagerie",     shortLabel:"Msgs",     active:tab==="messagerie", onClick:function(){setTab("messagerie");}},
    {id:"profil",     icon:"👤", label:"Mon profil",     shortLabel:"Profil",   active:tab==="profil",     onClick:function(){setTab("profil");}},
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

  var sweepMandat = sweepOpen ? agenceMandats.find(function(m){ return m.id===sweepOpen; }) : null;
  return (
    <AppShell navItems={navItems} title={tab==="mandats"?"📋 Mandats agence":tab==="locations"?"🏠 Mes locations":tab==="gestion"?"🔑 Mes gestions":tab==="gestion-loc"?"🏘️ Parc locatif":tab==="offmarket"?"🔒 Off Market":tab==="feedback"?"💡 Suggestions":tab==="carte"?"🗺️ Carte interactive":tab==="prospection"?"🗺️ Prospection":tab==="taches"?"✅ Mes tâches":tab==="stats"?"📊 Mes stats":tab==="leads"?"📥 Mes leads":tab==="recherches"?"🔍 Recherches":tab==="profil"?"👤 Mon profil":"💬 Messagerie"}
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
          <div className="kpi-grid" style={{marginBottom:16}}>
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
          {agenceMandats.map(function(m) {
            var isMine = m.agentId === currentUser.id;
            var agentProp = ctx.users.find(function(u){return u.id===m.agentId;});
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
                {isMine && m.statut==="sous_offre" && (
                  <button onClick={function(){celebrerOffreAcceptee(m);}} style={{width:"100%",marginBottom:6,background:"linear-gradient(135deg,#F59E0B,#EF4444)",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:15,fontWeight:800,color:"#fff",boxShadow:"0 3px 10px rgba(239,68,68,0.35)"}}>
                    {"🎉 Offre acceptée — Célébrer !"}
                  </button>
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
                </div>
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
          ) : myTasks.map(function(t) {
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
      {tab==="stats" && (
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
      {tab==="feedback" && <Feedback/>}
      {tab==="offmarket" && <OffMarket/>}
      {tab==="carte" && <CarteInteractive onNavigate={function(targetTab, bienId, bienType){ setTab(targetTab); }}/>}
      {tab==="recherches" && <Recherches/>}
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
        <MandatForm initial={editingMandat} agents={ctx.users.filter(function(u){return (u.role==="agent"||u.role==="manager")&&u.agenceId===agenceId&&u.actif;})} agenceId={agenceId} onSave={saveMandat} onCancel={function(){setShowMandatForm(false);setEditingMandat(null);}}/>
      )}
    {sweepMandat && <SweepModal m={sweepMandat}/>}
    </AppShell>
  );
}

// ─── PROFIL AGENT ─────────────────────────────────────────────────────────────
function ProfilAgent({ currentUser, changerMotDePasse }) {
  var [ancien,  setAncien]  = useState("");
  var [nouveau, setNouveau] = useState("");
  var [confirm, setConfirm] = useState("");
  var [msg,     setMsg]     = useState(null); // {type:"ok"|"err", text}

  function sauvegarder() {
    if (!ancien)          { setMsg({type:"err", text:"Saisissez votre mot de passe actuel"}); return; }
    if (ancien !== currentUser.password) { setMsg({type:"err", text:"Mot de passe actuel incorrect"}); return; }
    if (nouveau.length < 6) { setMsg({type:"err", text:"Le nouveau mot de passe doit faire au moins 6 caractères"}); return; }
    if (nouveau !== confirm)  { setMsg({type:"err", text:"Les mots de passe ne correspondent pas"}); return; }
    changerMotDePasse(currentUser.id, nouveau);
    setMsg({type:"ok", text:"✅ Mot de passe modifié avec succès !"});
    setAncien(""); setNouveau(""); setConfirm("");
  }

  return (
    <div>
      {/* Carte identité */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:"20px",marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:56,height:56,borderRadius:28,background:"var(--red)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20,flexShrink:0}}>
          {currentUser.avatar}
        </div>
        <div>
          <div style={{fontWeight:900,fontSize:17,color:"var(--navy)"}}>{currentUser.nom}</div>
          <div style={{fontSize:13,color:"var(--g400)",marginTop:2}}>{currentUser.email}</div>
          <div style={{fontSize:11,marginTop:4,display:"flex",gap:8}}>
            <span style={{background:"var(--g100)",borderRadius:20,padding:"2px 10px",color:"var(--g500)",fontWeight:700,textTransform:"capitalize"}}>{currentUser.niveau||"agent"}</span>
            <span style={{background:"#F0FDF4",borderRadius:20,padding:"2px 10px",color:"#059669",fontWeight:700}}>{"Actif"}</span>
          </div>
        </div>
      </div>

      {/* Changement de mot de passe */}
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
          <input type="password" className="form-input" placeholder="Minimum 6 caractères"
            value={nouveau} onChange={function(e){setNouveau(e.target.value);setMsg(null);}}/>
        </div>
        <div className="form-group" style={{marginBottom:20}}>
          <label className="form-label">{"Confirmer le nouveau mot de passe"}</label>
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

// ─── MOTEUR DE RECOMMANDATIONS ────────────────────────────────────────────────
function genererRecommandations(agent, myMandats, agenceMandats, locations, gestion, objectifs) {
  var conseils = [];
  var now = new Date();
  var annee = now.getFullYear();
  var mois  = now.getMonth();

  var active    = myMandats.filter(function(m){return m.statut==="mandat";});
  var compromis = myMandats.filter(function(m){return m.statut==="compromis";});
  var vendus    = myMandats.filter(function(m){return m.statut==="vendu";});
  var myLocs    = locations.filter(function(l){return l.agentId===agent.id&&l.locataireTrouve;});

  // Moyennes agence
  var agentsActifs = [];
  var agentIds = {};
  agenceMandats.forEach(function(m){ agentIds[m.agentId]=1; });
  var nbAgents = Object.keys(agentIds).length || 1;

  var activeMoyen = agenceMandats.filter(function(m){return m.statut==="mandat";}).length / nbAgents;
  var vendusMoyen = agenceMandats.filter(function(m){return m.statut==="vendu";}).length / nbAgents;

  // Taux de transformation perso
  var totalPris   = active.length + compromis.length + vendus.length;
  var txTransfo   = totalPris > 0 ? vendus.length / totalPris : 0;

  // Taux agence
  var totalAgence = agenceMandats.length;
  var vendusAgence= agenceMandats.filter(function(m){return m.statut==="vendu";}).length;
  var txAgence    = totalAgence > 0 ? vendusAgence / totalAgence : 0;

  // Prix moyen m2 (heuristique)
  var prixMoyenAgence = agenceMandats.filter(function(m){return m.statut==="mandat"&&m.prix>0;})
    .reduce(function(s,m){return s+m.prix;},0) / Math.max(1, agenceMandats.filter(function(m){return m.statut==="mandat"&&m.prix>0;}).length);

  // Mandats anciens (> 90 jours sans bouger)
  var mandatsAnciens = active.filter(function(m){
    if (!m.dateMandat) return false;
    var j = Math.floor((now - new Date(m.dateMandat)) / 86400000);
    return j > 90;
  });

  // Mandats chers vs agence
  var mandatsTropCher = active.filter(function(m){
    return prixMoyenAgence > 0 && m.prix > prixMoyenAgence * 1.25;
  });

  // Objectif annuel
  var obj = objectifs.find(function(o){return o.agentId===agent.id && o.annee===annee;});
  var caReal = vendus.reduce(function(s,m){return s+(m.commission||0);},0);
  var pctObj = obj && obj.montantHT > 0 ? caReal / obj.montantHT : null;

  // Ventes mois courant
  var ventesCeMois = vendus.filter(function(m){
    if (!m.dateSignature) return false;
    var d = new Date(m.dateSignature);
    return d.getFullYear()===annee && d.getMonth()===mois;
  });

  // ── GÉNÉRATION DES CONSEILS ────────────────────────────────────────────────

  // Pas de mandat actif
  if (active.length === 0 && compromis.length === 0) {
    conseils.push({ icon:"🗺️", type:"action", texte:"Votre stock est vide pour le moment — c'est le moment idéal pour partir en prospection et prendre de nouveaux mandats !" });
  }

  // Stock inférieur à la moyenne agence
  else if (active.length < activeMoyen * 0.6 && activeMoyen > 2) {
    conseils.push({ icon:"📋", type:"action", texte:"Votre stock de mandats est en dessous de la moyenne de l'agence ("+Math.round(activeMoyen)+" mandats). Un tour de prospection serait judicieux !" });
  }

  // Très bon stock, peu de ventes
  if (active.length >= 5 && vendus.length === 0) {
    conseils.push({ icon:"📸", type:"conseil", texte:"Vous avez un beau stock de "+active.length+" mandats — pensez à booster leur visibilité sur les réseaux sociaux pour générer plus de contacts." });
    if (mandatsTropCher.length > 0) {
      conseils.push({ icon:"💰", type:"prix", texte:mandatsTropCher.length+" de vos biens sont au-dessus du prix moyen du marché local. Une discussion de prix avec les propriétaires pourrait débloquer des offres." });
    }
  }

  // Mandats anciens sans activité
  if (mandatsAnciens.length > 0) {
    conseils.push({ icon:"⏰", type:"prix", texte:mandatsAnciens.length+" mandat"+(mandatsAnciens.length>1?"s":"")+" sans activité depuis plus de 3 mois. C'est peut-être le moment de revoir les conditions avec le"+(mandatsAnciens.length>1?"s":"")+" propriétaire"+(mandatsAnciens.length>1?"s":"")+"." });
  }

  // Bon taux de transfo
  if (txTransfo > 0.4 && vendus.length >= 2) {
    conseils.push({ icon:"🌟", type:"bravo", texte:"Excellent taux de transformation — "+Math.round(txTransfo*100)+"% de vos mandats aboutissent à une vente. Continuez comme ça !" });
  }

  // Vous vendez plus de 50% des ventes agence
  if (vendusAgence > 0 && vendus.length / vendusAgence > 0.5 && vendus.length >= 3) {
    conseils.push({ icon:"🏆", type:"bravo", texte:"Vous réalisez plus de la moitié des ventes de l'agence ce mois — performance remarquable !" });
  }

  // Objectif : en bonne voie
  if (pctObj !== null && pctObj >= 0.75 && pctObj < 1) {
    var restant = obj.montantHT - caReal;
    conseils.push({ icon:"🎯", type:"objectif", texte:"Vous êtes à "+Math.round(pctObj*100)+"% de votre objectif annuel. Plus que "+Math.round(restant).toLocaleString("fr-FR")+"€ à réaliser — vous y êtes presque !" });
  }

  // Objectif dépassé
  if (pctObj !== null && pctObj >= 1) {
    conseils.push({ icon:"🎉", type:"bravo", texte:"Objectif annuel atteint et dépassé ! Bravo pour cette belle performance." });
  }

  // Objectif en retard
  if (pctObj !== null && pctObj < 0.4 && mois >= 6) {
    conseils.push({ icon:"📈", type:"objectif", texte:"L'objectif annuel nécessite un coup d'accélérateur. Identifier 2-3 mandats bien positionnés à relancer pourrait faire la différence." });
  }

  // Bonne activité location
  if (myLocs.length >= 3) {
    conseils.push({ icon:"🏠", type:"conseil", texte:"Votre activité location est dynamique ("+myLocs.length+" locations). Pensez à proposer la gestion locative à vos propriétaires — c'est un revenu récurrent." });
  }

  // Bonne semaine sans conseil négatif
  if (conseils.length === 0) {
    conseils.push({ icon:"👍", type:"bravo", texte:"Votre activité est bien équilibrée. Continuez sur cette lancée et restez attentif aux nouvelles opportunités de mandats dans votre secteur." });
  }

  return conseils;
}

// Composant d'affichage
function Recommandations({ agent, myMandats, agenceMandats, locations, gestion, objectifs, titre }) {
  var conseils = genererRecommandations(agent, myMandats, agenceMandats, locations, gestion, objectifs);
  var COULEURS = {
    bravo:    { bg:"#F0FDF4", border:"#A7F3D0", text:"#065F46" },
    action:   { bg:"#EFF6FF", border:"#BFDBFE", text:"#1E40AF" },
    conseil:  { bg:"#FFFBEB", border:"#FDE68A", text:"#92400E" },
    prix:     { bg:"#FFF7ED", border:"#FDBA74", text:"#9A3412" },
    objectif: { bg:"#F5F3FF", border:"#C4B5FD", text:"#5B21B6" },
  };

  return (
    <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
      <div style={{background:"var(--g50)",borderBottom:"1px solid var(--g100)",padding:"10px 16px"}}>
        <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>
          {"💡 "+(titre||"Recommandations personnalisées")}
        </span>
      </div>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {conseils.map(function(c, i) {
          var col = COULEURS[c.type] || COULEURS.conseil;
          return (
            <div key={i} style={{background:col.bg,border:"1px solid "+col.border,borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:18,flexShrink:0,lineHeight:1.3}}>{c.icon}</span>
              <span style={{fontSize:13,color:col.text,lineHeight:1.5}}>{c.texte}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
