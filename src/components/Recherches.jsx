import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, fmt, BadgeType } from "./Shared";

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
var TYPES_BIEN = [
  { id:"Appartement à vendre",  label:"🏢 Appartement à vendre",  mode:"achat"    },
  { id:"Maison à vendre",       label:"🏠 Maison à vendre",        mode:"achat"    },
  { id:"Terrain à vendre",      label:"🌿 Terrain à vendre",       mode:"achat"    },
  { id:"Immeuble à vendre",     label:"🏗️ Immeuble à vendre",     mode:"achat"    },
  { id:"Local pro à vendre",    label:"🏪 Local pro à vendre",     mode:"achat"    },
  { id:"Appartement à louer",   label:"🏢 Appartement à louer",    mode:"location" },
  { id:"Maison à louer",        label:"🏠 Maison à louer",         mode:"location" },
  { id:"Local pro à louer",     label:"🏬 Local pro à louer",      mode:"location" },
  { id:"Fonds de commerce",      label:"🏪 Fonds de commerce",       mode:"achat"    },
  { id:"Garage à louer",        label:"🚗 Garage à louer",         mode:"location" },
];

var STATUTS_RECH = [
  { id:"active",   label:"Active",   color:"#059669", bg:"#F0FDF4" },
  { id:"standby",  label:"Stand-by", color:"#D97706", bg:"#FFFBEB" },
  { id:"acquise",  label:"Acquise",  color:"#7C3AED", bg:"#F5F3FF" },
  { id:"perdue",   label:"Perdue",   color:"#DC2626", bg:"#FEF2F2" },
];

var NB_PIECES_OPTS = ["1","2","3","4","5","6+"];
var NB_CHAMBRES_OPTS = ["1","2","3","4","5+"];
var DPE_OPTS = ["A","B","C","D","E","F","G"];
var ORIENTATIONS = ["Nord","Sud","Est","Ouest","Sud-Est","Sud-Ouest"];
var ETAGES = ["RDC","1er","2ème","3ème","4ème","5ème+","Dernier étage"];

// ─── SCORE MATCHING (vente) ───────────────────────────────────────────────────
// Score matching off market (vendeur motivé → acheteur)
function scoreMatchOffMarket(recherche, om) {
  var score = 0;
  var raisons = [];
  if (!om.prix || !recherche.budgetMax) return null;
  // Prix off market souvent négociable — on accepte jusqu'à 10% au-dessus budget
  if (om.prix <= recherche.budgetMax * 1.05) {
    score += 40; raisons.push("✅ Prix compatible ("+om.prix.toLocaleString("fr-FR")+"€)");
  } else { return null; }
  if (om.prix >= (recherche.budgetMin||0) * 0.85) { score += 10; } // pas trop en dessous du budget
  // Secteur
  var adr = (om.adresse||"").toLowerCase();
  if ((recherche.secteurs||[]).some(function(s){ return adr.includes(s.toLowerCase()) || adr.includes("amiens"); })) {
    score += 25; raisons.push("✅ Secteur compatible");
  }
  // Surface
  if (om.surface && recherche.surfaceMin && om.surface >= recherche.surfaceMin*0.9) {
    score += 10; raisons.push("✅ Surface OK ("+om.surface+"m²)");
  } else if (recherche.surfaceMin) { score += 3; }
  // Options
  if (recherche.avecJardin && om.avecJardin)   { score += 5; raisons.push("✅ Jardin"); }
  if (recherche.avecGarage && om.avecGarage)   { score += 5; raisons.push("✅ Garage"); }
  if (recherche.avecTerrasse && om.avecTerrasse){ score += 3; raisons.push("✅ Terrasse"); }
  // Motivation vendeur = bonus
  if (om.motivation==="Fort")  { score += 10; raisons.push("🔥 Vendeur très motivé"); }
  if (om.motivation==="Moyen") { score += 5;  raisons.push("⏳ Vendeur motivé"); }
  return score >= 35 ? { score: Math.min(score,100), raisons } : null;
}

function agenceNom(agenceId, agences) {
  var ag = (agences||[]).find(function(a){ return a.id===agenceId; });
  return ag ? ag.nom : agenceId;
}

function scoreMatchVente(recherche, mandat) {
  var score = 0;
  var raisons = [];
  if (!mandat.prix || !recherche.budgetMax) return null;
  // Budget — budgetMin optionnel
  var bMin = recherche.budgetMin || 0;
  var bMax = recherche.budgetMax;
  if (mandat.prix >= bMin * 0.9 && mandat.prix <= bMax * 1.1) {
    score += 35; raisons.push("✅ Budget compatible ("+mandat.prix.toLocaleString("fr-FR")+"€)");
  } else if (mandat.prix <= bMax * 1.2) {
    score += 12; raisons.push("⚠️ Budget légèrement dépassé");
  } else { return null; }
  // Compatibilité type de bien (flexible : appartement ↔ "Appartement à vendre")
  var rbien = (recherche.typeBien||"").toLowerCase();
  var mbien = (mandat.typeBien||"").toLowerCase();
  if (rbien && mbien && !rbien.includes(mbien) && !mbien.includes(rbien.split(" ")[0])) {
    // Types incompatibles → léger malus mais pas bloquant
    score -= 5;
  }
  // Secteur
  var adresseLow = (mandat.adresse||"").toLowerCase();
  var sectMatch = (recherche.secteurs||[]).some(function(s){ return adresseLow.includes(s.toLowerCase()) || adresseLow.includes("amiens"); });
  if (sectMatch) { score += 25; raisons.push("✅ Secteur compatible"); }
  // Surface
  if (mandat.surface && recherche.surfaceMin) {
    if (mandat.surface >= recherche.surfaceMin * 0.9) { score += 15; raisons.push("✅ Surface compatible ("+mandat.surface+"m²)"); }
    else { raisons.push("⚠️ Surface insuffisante"); }
  } else { score += 8; }
  // Pièces
  if (recherche.nbPieces && mandat.nbPieces) {
    if (Number(mandat.nbPieces) >= Number(recherche.nbPieces)) { score += 10; raisons.push("✅ Nb pièces OK"); }
  } else { score += 5; }
  // Chambres
  if (recherche.nbChambres && mandat.nbChambres) {
    if (Number(mandat.nbChambres) >= Number(recherche.nbChambres)) { score += 8; raisons.push("✅ Nb chambres OK"); }
  }
  // Options
  if (recherche.avecJardin && mandat.avecJardin) { score += 5; raisons.push("✅ Jardin"); }
  if (recherche.avecGarage && mandat.avecGarage) { score += 5; raisons.push("✅ Garage"); }
  if (recherche.avecTerrasse && mandat.avecTerrasse) { score += 3; raisons.push("✅ Terrasse"); }
  if (recherche.avecCave && mandat.avecCave) { score += 2; raisons.push("✅ Cave"); }
  // DPE
  if (recherche.dpe && recherche.dpe.length > 0 && mandat.dpe) {
    if (recherche.dpe.includes(mandat.dpe)) { score += 5; raisons.push("✅ DPE "+mandat.dpe); }
  }
  // Exclusif = bonus
  if (mandat.typeMandat === "exclusif") { score += 7; raisons.push("⭐ Exclusif"); }
  return score >= 30 ? { score: Math.min(score, 100), raisons } : null;
}

// ─── SCORE MATCHING (location) ────────────────────────────────────────────────
function scoreMatchLocation(recherche, loc) {
  var score = 0;
  var raisons = [];
  if (!loc.loyer || !recherche.budgetMax) return null;
  var bMin = recherche.budgetMin || 0;
  var bMax = recherche.budgetMax;
  // Loyer
  if (loc.loyer >= bMin * 0.9 && loc.loyer <= bMax * 1.1) {
    score += 40; raisons.push("✅ Loyer compatible ("+loc.loyer+"€/mois)");
  } else if (loc.loyer <= bMax * 1.2) {
    score += 15; raisons.push("⚠️ Loyer légèrement dépassé");
  } else { return null; }
  // Secteur
  var adresseLow = (loc.adresse||"").toLowerCase();
  var sectMatch = (recherche.secteurs||[]).some(function(s){ return adresseLow.includes(s.toLowerCase()) || adresseLow.includes("amiens"); });
  if (sectMatch) { score += 30; raisons.push("✅ Secteur compatible"); }
  // Pièces
  if (recherche.nbPieces && loc.nbPieces) {
    if (Number(loc.nbPieces) >= Number(recherche.nbPieces)) { score += 15; raisons.push("✅ Nb pièces OK"); }
  } else { score += 7; }
  // Chambres
  if (recherche.nbChambres && loc.nbChambres) {
    if (Number(loc.nbChambres) >= Number(recherche.nbChambres)) { score += 10; raisons.push("✅ Nb chambres OK"); }
  }
  // Surface
  if (loc.surface && recherche.surfaceMin) {
    if (loc.surface >= recherche.surfaceMin * 0.9) { score += 10; raisons.push("✅ Surface OK ("+loc.surface+"m²)"); }
  }
  // Options
  if (recherche.avecJardin && loc.avecJardin)   { score += 5; raisons.push("✅ Jardin"); }
  if (recherche.avecGarage && loc.avecGarage)   { score += 5; raisons.push("✅ Garage"); }
  if (recherche.avecTerrasse && loc.avecTerrasse){ score += 3; raisons.push("✅ Terrasse"); }
  return score >= 35 ? { score: Math.min(score, 100), raisons } : null;
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function Recherches() {
  var ctx = useApp();
  var isManager = ctx.currentUser.role === "manager";
  var agenceId  = ctx.currentUser.agenceId;
  var agents    = ctx.users.filter(function(u){ return (u.role==="agent"||u.role==="manager") && u.actif && u.agenceId===agenceId; });
  // S'assurer que le currentUser est toujours dans la liste (ex: superadmin)
  if (!agents.find(function(a){ return a.id===ctx.currentUser.id; })) {
    agents = [ctx.currentUser, ...agents];
  }
  // Matching cross-agences : on cherche dans TOUT le réseau
  var mandats   = ctx.mandats.filter(function(m){ return m.statut==="mandat"; });
  var locations = (ctx.locations||[]).filter(function(l){ return !l.locataireTrouve; });
  var offmarketBiens = (ctx.offmarket||[]).filter(function(o){ return o.actif; });

  var recherches = ctx.recherches || [];
  function setRecherches(updater) { ctx.setRecherches(updater); }

  var myRech = isManager
    ? recherches.filter(function(r){ return r.agenceId===agenceId; })
    : recherches.filter(function(r){ return r.agentId===ctx.currentUser.id; });

  var [showForm,     setShowForm]     = useState(false);
  var [showDetail,   setShowDetail]   = useState(null);
  var [filterStatut, setFilterStatut] = useState("active");
  var [filterMode,   setFilterMode]   = useState(""); // achat | location | ""
  var [tab,          setTab]          = useState("recherches");

  var filtered = myRech.filter(function(r){
    if (filterStatut && r.statut !== filterStatut) return false;
    if (filterMode) {
      var tb = TYPES_BIEN.find(function(t){ return t.id === r.typeBien; });
      if (!tb || tb.mode !== filterMode) return false;
    }
    return true;
  });

  // Matching global
  var allMatches = useMemo(function() {
    var result = [];
    myRech.filter(function(r){ return r.statut==="active"; }).forEach(function(r) {
      var tb = TYPES_BIEN.find(function(t){ return t.id===r.typeBien; });
      // Détection location : via TYPES_BIEN ou via le label du typeBien directement
      var isLoc = (tb && tb.mode==="location") || (!tb && r.typeBien && r.typeBien.toLowerCase().includes("louer"));
      if (isLoc) {
        locations.forEach(function(l) {
          var match = scoreMatchLocation(r, l);
          if (match) {
            var agent = agents.find(function(a){ return a.id===r.agentId; });
            var crossAgence = l.agenceId !== agenceId;
            var agentBien = ctx.users.find(function(u){ return u.id===l.agentId; });
            result.push({ recherche:r, bien:l, bienRef:l.ref, bienAdresse:l.adresse, bienPrix:l.loyer, bienPrixLabel:l.loyer+"€/mois", score:match.score, raisons:match.raisons, agent, isLoc:true, crossAgence, agentBien, bienAgenceId:l.agenceId });
          }
        });
      } else {
        mandats.forEach(function(m) {
          var match = scoreMatchVente(r, m);
          if (match) {
            var agent = agents.find(function(a){ return a.id===r.agentId; });
            var crossAgence = m.agenceId !== agenceId;
            var agentBien = ctx.users.find(function(u){ return u.id===m.agentId; });
            result.push({ recherche:r, bien:m, bienRef:m.ref, bienAdresse:m.adresse, bienPrix:m.prix, bienPrixLabel:m.prix.toLocaleString("fr-FR")+"€", score:match.score, raisons:match.raisons, agent, isLoc:false, crossAgence, agentBien, bienAgenceId:m.agenceId });
          }
        });
      }
    });
    // Matching off market (pour recherches achat uniquement)
    myRech.filter(function(r){ return r.statut==="active"; }).forEach(function(r) {
      var tb2 = TYPES_BIEN.find(function(t){ return t.id===r.typeBien; });
      if (tb2 && tb2.mode==="location") return; // pas de match off market pour location
      offmarketBiens.forEach(function(om) {
        var match = scoreMatchOffMarket(r, om);
        if (match) {
          var agent = agents.find(function(a){ return a.id===r.agentId; });
          var agentBien = (ctx.users||[]).find(function(u){ return u.id===om.agentId; });
          var crossAgence = om.agenceId !== agenceId;
          result.push({ recherche:r, bien:om, bienRef:om.ref, bienAdresse:om.adresse, bienPrix:om.prix, bienPrixLabel:om.prix.toLocaleString("fr-FR")+"€", score:match.score, raisons:match.raisons, agent, isLoc:false, isOffMarket:true, crossAgence, agentBien, bienAgenceId:om.agenceId });
        }
      });
    });

    return result.sort(function(a,b){ return b.score-a.score; });
  }, [myRech, mandats, locations, offmarketBiens]);

  function notifierMatch(match) {
    var msg = "🎯 Rapprochement — Score "+match.score+"%\n"
      + "Client : "+match.recherche.nom+" · Budget : "+(match.recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(match.recherche.budgetMax||0).toLocaleString("fr-FR")+(match.isLoc?"€/mois":"€")+"\n"
      + "Bien : "+match.bienRef+" — "+match.bienAdresse+" — "+match.bienPrixLabel+"\n"
      + (match.agent ? "Agent : "+match.agent.nom : "");
    var SK_MSG = "orpi_data_messages_v1";
    try {
      var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
      msgs.push({ id:"msg-match-"+Date.now(), channelId:"equipe", senderId:"system", senderNom:"Système", senderAvatar:"🎯", content:msg, ts:new Date().toISOString(), type:"system", read:[] });
      localStorage.setItem(SK_MSG, JSON.stringify(msgs));
      alert("✅ Notification envoyée dans la messagerie Équipe !");
    } catch(e) {}
  }

  function deleteRech(id) {
    if (!window.confirm("Supprimer cette recherche ?")) return;
    setRecherches(function(prev){ return prev.filter(function(r){ return r.id!==id; }); });
    setShowDetail(null);
  }

  return (
    <div>
      {/* Stats par statut */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {STATUTS_RECH.map(function(s) {
          var count = myRech.filter(function(r){ return r.statut===s.id; }).length;
          return (
            <div key={s.id} onClick={function(){setFilterStatut(filterStatut===s.id?"":s.id);}} style={{background:s.bg,border:"1px solid "+s.color+"44",borderRadius:10,padding:"10px 12px",cursor:"pointer",outline:filterStatut===s.id?"3px solid "+s.color:"none"}}>
              <div style={{fontWeight:900,fontSize:20,color:s.color,lineHeight:1}}>{count}</div>
              <div style={{fontSize:10,color:s.color,fontWeight:600,marginTop:2}}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filtres achat / location */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["","Tous"],["achat","🏠 Achat"],["location","🔑 Location"]].map(function(pair) {
          return (
            <button key={pair[0]} onClick={function(){setFilterMode(pair[0]);}} style={{padding:"5px 14px",borderRadius:20,border:"2px solid "+(filterMode===pair[0]?"var(--navy)":"var(--g200)"),background:filterMode===pair[0]?"var(--navy)":"#fff",color:filterMode===pair[0]?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {pair[1]}
            </button>
          );
        })}
        <span style={{fontSize:12,color:"var(--g400)",alignSelf:"center",marginLeft:4}}>{filtered.length+" recherche(s)"}</span>
        <div style={{flex:1}}></div>
        <button className="btn btn-primary btn-sm" onClick={function(){setShowForm(true);}}>{"+ Nouvelle recherche"}</button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4,marginBottom:14}}>
        {[["recherches","🔍 Recherches ("+myRech.length+")"],["matching","🎯 Rapprochements ("+allMatches.length+")"]].map(function(pair) {
          return (
            <button key={pair[0]} onClick={function(){setTab(pair[0]);}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:tab===pair[0]?"#fff":"transparent",color:tab===pair[0]?"var(--navy)":"var(--g400)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"var(--font)",boxShadow:tab===pair[0]?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {pair[1]}
            </button>
          );
        })}
      </div>

      {/* LISTE RECHERCHES */}
      {tab==="recherches" && (
        <div>
          {filtered.map(function(r) {
            var statutM = STATUTS_RECH.find(function(s){return s.id===r.statut;}) || STATUTS_RECH[0];
            var agent   = agents.find(function(a){return a.id===r.agentId;});
            var tb      = TYPES_BIEN.find(function(t){return t.id===r.typeBien;});
            var isLoc   = tb && tb.mode==="location";
            var myMatchCount = isLoc
              ? locations.map(function(l){ return scoreMatchLocation(r,l); }).filter(Boolean).length
              : mandats.map(function(m){ return scoreMatchVente(r,m); }).filter(Boolean).length;
            return (
              <div key={r.id} className="m-card" style={{borderLeft:"4px solid "+statutM.color,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontWeight:800,color:"var(--navy)",fontSize:14}}>
                      {(ctx.currentUser.role==="manager"||ctx.currentUser.role==="superadmin"||ctx.currentUser.id===r.agentId)?r.nom:(r.confidentiel?"🔒 Confidentiel":r.nom)}
                    </span>
                      <span style={{background:statutM.bg,color:statutM.color,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{statutM.label}</span>
                      {tb && <span style={{background:isLoc?"#FFF7ED":"#EFF6FF",color:isLoc?"#EA580C":"#2563EB",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{tb.label}</span>}
                      {myMatchCount>0 && <span style={{background:"#F5F3FF",color:"#7C3AED",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:800}}>{"🎯 "+myMatchCount+" corresp."}</span>}
                    </div>
                    <div style={{fontSize:12,color:"var(--g500)"}}>
                      {r.budgetMin?r.budgetMin.toLocaleString("fr-FR")+"€":""}{r.budgetMax?" — "+r.budgetMax.toLocaleString("fr-FR")+"€"+(isLoc?"/mois":""):""}
                      {r.surfaceMin?" · "+r.surfaceMin+"m² min":""}
                      {r.nbPieces?" · "+r.nbPieces+"P":""}
                      {r.nbChambres?" · "+r.nbChambres+" ch.":""}
                    </div>
                    {/* Options */}
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                      {r.avecJardin   && <span style={{fontSize:10,background:"#F0FDF4",color:"#059669",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🌿 Jardin"}</span>}
                      {r.avecGarage   && <span style={{fontSize:10,background:"#EFF6FF",color:"#2563EB",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🚗 Garage"}</span>}
                      {r.avecTerrasse && <span style={{fontSize:10,background:"#FFF7ED",color:"#EA580C",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"☀️ Terrasse"}</span>}
                      {r.avecAscenseur&& <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🛗 Ascenseur"}</span>}
                      {r.avecCave     && <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"📦 Cave"}</span>}
                      {r.avecParking  && <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🅿️ Parking"}</span>}
                    </div>
                    {r.secteurs && r.secteurs.length>0 && <div style={{fontSize:11,color:"var(--g400)",marginTop:3}}>{"📍 "+r.secteurs.join(", ")}</div>}
                    {agent && <div style={{fontSize:11,color:"var(--navy)",fontWeight:600,marginTop:2}}>{"Agent : "+agent.nom}</div>}
                    {r.notes && <div style={{fontSize:11,color:"var(--g700)",fontStyle:"italic",marginTop:3}}>{'"'+r.notes+'"'}</div>}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{marginLeft:8,flexShrink:0}} onClick={function(){setShowDetail(r);}}>{"Voir →"}</button>
                </div>
              </div>
            );
          })}
          {filtered.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
              <div style={{fontSize:40,marginBottom:12}}>{"🔍"}</div>
              <div style={{fontWeight:700,fontSize:15}}>{"Aucune recherche"}</div>
            </div>
          )}
        </div>
      )}

      {/* RAPPROCHEMENTS */}
      {tab==="matching" && (
        <div>
          {allMatches.length===0 ? (
            <div style={{textAlign:"center",padding:"40px",color:"var(--g400)"}}>
              <div style={{fontSize:36,marginBottom:10}}>{"🎯"}</div>
              <div style={{fontWeight:700,fontSize:14,color:"var(--navy)"}}>{"Aucune correspondance détectée"}</div>
              <div style={{fontSize:12,marginTop:6}}>{"Ajoutez des recherches et des mandats/locations actifs."}</div>
            </div>
          ) : (
            <div>
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#1D4ED8",fontWeight:600}}>
                {"🎯 "+allMatches.filter(function(m){return !m.crossAgence && !m.isOffMarket;}).length+" corresp. dans votre agence"}
                {allMatches.filter(function(m){return m.crossAgence;}).length>0 && (
                  <span style={{marginLeft:8,background:"#FEF3C7",color:"#92400E",borderRadius:20,padding:"2px 10px",fontWeight:800}}>{"🌐 +"+allMatches.filter(function(m){return m.crossAgence;}).length+" cross-agences"}</span>
                )}
                {allMatches.filter(function(m){return m.isOffMarket;}).length>0 && (
                  <span style={{marginLeft:6,background:"#F5F3FF",color:"#7C3AED",borderRadius:20,padding:"2px 10px",fontWeight:800}}>{"🔒 +"+allMatches.filter(function(m){return m.isOffMarket;}).length+" off market"}</span>
                )}
              </div>
              {allMatches.map(function(match) {
                var r = match.recherche;
                var scoreColor = match.score>=80?"#059669":match.score>=60?"#D97706":"#6B7280";
                return (
                  <div key={r.id+"-"+match.bienRef} className="m-card" style={{borderLeft:"4px solid "+scoreColor,marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:4}}>
                          {r.nom+" → "+match.bienRef}
                        </div>
                        <div style={{fontSize:12,color:"var(--g500)",marginBottom:4}}>
                          {match.bienAdresse.split(",")[0]+" · "+match.bienPrixLabel}
                          {match.isLoc?" 🔑":" 🏠"}
                        </div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                          {match.isOffMarket && (
                            <span style={{fontSize:10,background:"#F5F3FF",color:"#7C3AED",borderRadius:7,padding:"2px 8px",fontWeight:800,border:"1px solid #DDD6FE"}}>{"🔒 Off market"+(match.bien.motivation?" · Motivation : "+match.bien.motivation:"")}</span>
                          )}
                          {match.crossAgence && (
                            <span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",borderRadius:7,padding:"2px 8px",fontWeight:800,border:"1px solid #FDE68A"}}>{"🌐 Autre agence"+(match.agentBien?" · "+match.agentBien.nom:"")}</span>
                          )}
                          {match.agentBien && !match.crossAgence && (
                            <span style={{fontSize:10,background:"#EFF6FF",color:"#2563EB",borderRadius:7,padding:"2px 8px",fontWeight:700}}>{"Agent : "+match.agentBien.nom}</span>
                          )}
                          {match.raisons.map(function(ra, ri) {
                            return <span key={ri} style={{fontSize:10,background:"var(--g50)",border:"1px solid var(--g200)",borderRadius:7,padding:"2px 7px",color:"var(--g700)"}}>{ra}</span>;
                          })}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0,marginLeft:12}}>
                        <div style={{fontWeight:900,fontSize:22,color:scoreColor,lineHeight:1}}>{match.score+"%"}</div>
                        <div style={{fontSize:10,color:"var(--g400)"}}>{"Match"}</div>
                        <button onClick={function(){notifierMatch(match);}} style={{background:"var(--navy)",border:"none",color:"#fff",borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"📨 Notifier"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showForm && <RechercheForm agents={agents} agenceId={agenceId} isManager={isManager} currentUser={ctx.currentUser} onSave={function(form){ setRecherches(function(prev){return [...prev,{...form,id:"rech-"+Date.now(),dateCreation:new Date().toISOString().slice(0,10)}];}); setShowForm(false); }} onCancel={function(){setShowForm(false);}}/>}
      {showDetail && <RechercheDetail rech={showDetail} mandats={mandats} locations={locations} offmarketBiens={offmarketBiens} agents={agents} isManager={isManager} notifierMatch={notifierMatch} onUpdate={function(patch){ setRecherches(function(prev){return prev.map(function(r){return r.id===showDetail.id?{...r,...patch}:r;});}); setShowDetail(function(prev){return{...prev,...patch};}); }} onDelete={function(){deleteRech(showDetail.id);}} onClose={function(){setShowDetail(null);}}/>}
    </div>
  );
}

// ─── FORMULAIRE ───────────────────────────────────────────────────────────────
function RechercheForm({ agents, agenceId, isManager, currentUser, onSave, onCancel }) {
  var [f, setF] = useState({
    nom:"", telephone:"", email:"", typeBien:"Appartement à vendre", confidentiel:false,
    secteurs:"", budgetMin:"", budgetMax:"", surfaceMin:"", surfaceMax:"",
    nbPieces:"", nbChambres:"", nbSDB:"", etage:"", orientation:"",
    avecJardin:false, avecGarage:false, avecTerrasse:false,
    avecAscenseur:false, avecCave:false, avecParking:false, avecPiscine:false,
    dpe:[], notes:"", statut:"active", agentId:currentUser.id, agenceId:agenceId,
  });
  function set(k,v){ setF(function(p){return{...p,[k]:v};}); }
  function toggleDpe(v){ set("dpe", f.dpe.includes(v) ? f.dpe.filter(function(d){return d!==v;}) : [...f.dpe,v]); }
  function toggleOpt(k){ set(k, !f[k]); }

  var tb = TYPES_BIEN.find(function(t){return t.id===f.typeBien;});
  var isLoc = tb && tb.mode==="location";

  function handleSave() {
    if (!f.nom.trim()) return;
    onSave({
      ...f,
      secteurs: f.secteurs.split(",").map(function(s){return s.trim();}).filter(Boolean),
      budgetMin: Number(f.budgetMin||0), budgetMax: Number(f.budgetMax||0),
      surfaceMin: Number(f.surfaceMin||0), surfaceMax: Number(f.surfaceMax||0),
      nbPieces: f.nbPieces?Number(f.nbPieces):null,
      nbChambres: f.nbChambres?Number(f.nbChambres):null,
      nbSDB: f.nbSDB?Number(f.nbSDB):null,
    });
  }

  return (
    <Modal title={"🔍 Nouvelle recherche"} onClose={onCancel}
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-secondary" onClick={onCancel}>{"Annuler"}</button><button className="btn btn-primary" style={{flex:1}} onClick={handleSave}>{"Enregistrer"}</button></div>}>
      <div className="form-grid">
        {/* Contact */}
        <div className="form-group form-full"><label className="form-label">{"Nom acheteur / locataire *"}</label><input className="form-input" value={f.nom} onChange={function(e){set("nom",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Téléphone"}</label><input className="form-input" value={f.telephone} onChange={function(e){set("telephone",e.target.value);}}/></div>
        <div className="form-group"><label className="form-label">{"Email"}</label><input className="form-input" type="email" value={f.email} onChange={function(e){set("email",e.target.value);}}/></div>

        {/* Type de bien */}
        <div className="form-group form-full">
          <label className="form-label">{"Type de bien recherché"}</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {TYPES_BIEN.map(function(t){
              var actif = f.typeBien===t.id;
              var isL = t.mode==="location";
              return (
                <button key={t.id} type="button" onClick={function(){set("typeBien",t.id);}} style={{padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?(isL?"#EA580C":"#2563EB"):"var(--g200)"),background:actif?(isL?"#FFF7ED":"#EFF6FF"):"#fff",color:actif?(isL?"#EA580C":"#2563EB"):"var(--g400)",fontWeight:700,fontSize:11,cursor:"pointer"}}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secteurs */}
        <div className="form-group form-full"><label className="form-label">{"Secteurs souhaités (séparés par des virgules)"}</label><input className="form-input" value={f.secteurs} onChange={function(e){set("secteurs",e.target.value);}} placeholder="Ex: Amiens Centre, Henriville, Longueau"/></div>

        {/* Budget */}
        <div className="form-group">
          <label className="form-label">{isLoc?"Loyer min (€/mois)":"Budget min (€)"}</label>
          <input className="form-input" type="number" value={f.budgetMin} onChange={function(e){set("budgetMin",e.target.value);}}/>
        </div>
        <div className="form-group">
          <label className="form-label">{isLoc?"Loyer max (€/mois)":"Budget max (€)"}</label>
          <input className="form-input" type="number" value={f.budgetMax} onChange={function(e){set("budgetMax",e.target.value);}}/>
        </div>

        {/* Composition */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:10,borderTop:"1px solid var(--g100)"}}>{"🛏️ Composition du bien"}</div>
        <div className="form-group">
          <label className="form-label">{"Nb de pièces (min)"}</label>
          <select className="form-select" value={f.nbPieces} onChange={function(e){set("nbPieces",e.target.value);}}>
            <option value="">{"— Indifférent"}</option>
            {NB_PIECES_OPTS.map(function(v){return <option key={v} value={v}>{v+" pièce"+(v==="1"?"":"s")}</option>;})}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Nb de chambres (min)"}</label>
          <select className="form-select" value={f.nbChambres} onChange={function(e){set("nbChambres",e.target.value);}}>
            <option value="">{"— Indifférent"}</option>
            {NB_CHAMBRES_OPTS.map(function(v){return <option key={v} value={v}>{v+" chambre"+(v==="1"?"":"s")}</option>;})}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Nb de SDB (min)"}</label>
          <select className="form-select" value={f.nbSDB} onChange={function(e){set("nbSDB",e.target.value);}}>
            <option value="">{"— Indifférent"}</option>
            <option value="1">{"1 SDB"}</option>
            <option value="2">{"2 SDB"}</option>
            <option value="3">{"3+ SDB"}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{"Surface min (m²)"}</label>
          <input className="form-input" type="number" value={f.surfaceMin} onChange={function(e){set("surfaceMin",e.target.value);}} placeholder="Ex: 60"/>
        </div>
        <div className="form-group">
          <label className="form-label">{"Surface max (m²)"}</label>
          <input className="form-input" type="number" value={f.surfaceMax} onChange={function(e){set("surfaceMax",e.target.value);}} placeholder="Ex: 100"/>
        </div>
        {!isLoc && (
          <div className="form-group">
            <label className="form-label">{"Étage souhaité"}</label>
            <select className="form-select" value={f.etage} onChange={function(e){set("etage",e.target.value);}}>
              <option value="">{"— Indifférent"}</option>
              {ETAGES.map(function(e){return <option key={e} value={e}>{e}</option>;})}
            </select>
          </div>
        )}

        {/* Options / équipements */}
        <div style={{gridColumn:"1/-1",fontWeight:700,color:"var(--navy)",fontSize:12,paddingTop:10,borderTop:"1px solid var(--g100)"}}>{"✨ Options souhaitées"}</div>
        <div style={{gridColumn:"1/-1",display:"flex",gap:8,flexWrap:"wrap"}}>
          {[
            ["avecJardin","🌿 Jardin"],["avecGarage","🚗 Garage"],["avecTerrasse","☀️ Terrasse/Balcon"],
            ["avecAscenseur","🛗 Ascenseur"],["avecCave","📦 Cave"],["avecParking","🅿️ Parking"],
            ["avecPiscine","🏊 Piscine"],
          ].map(function(opt){
            var actif = f[opt[0]];
            return (
              <button key={opt[0]} type="button" onClick={function(){toggleOpt(opt[0]);}} style={{padding:"6px 12px",borderRadius:20,border:"2px solid "+(actif?"var(--green)":"var(--g200)"),background:actif?"#F0FDF4":"#fff",color:actif?"var(--green)":"var(--g400)",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                {opt[1]}
              </button>
            );
          })}
        </div>

        {/* DPE */}
        {!isLoc && (
          <div className="form-group form-full">
            <label className="form-label">{"DPE acceptés (laisser vide = indifférent)"}</label>
            <div style={{display:"flex",gap:6}}>
              {DPE_OPTS.map(function(d){
                var actif = f.dpe.includes(d);
                var cols = {A:"#059669",B:"#22C55E",C:"#84CC16",D:"#EAB308",E:"#F97316",F:"#EF4444",G:"#991B1B"};
                return (
                  <button key={d} type="button" onClick={function(){toggleDpe(d);}} style={{width:34,height:34,borderRadius:8,border:"2px solid "+(actif?cols[d]:"var(--g200)"),background:actif?cols[d]+"22":"#fff",color:actif?cols[d]:"var(--g400)",fontWeight:900,fontSize:13,cursor:"pointer"}}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agent */}
        <div className="form-group">
          <label className="form-label">{"Agent en charge"}</label>
          <select className="form-select" value={f.agentId} onChange={function(e){set("agentId",e.target.value);}}>
            <option value={currentUser.id}>{"🙋 Moi-même ("+currentUser.nom+")"}</option>
            {isManager && agents.filter(function(a){return a.id!==currentUser.id;}).map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
          </select>
        </div>

        {/* Notes */}
        <div className="form-group form-full"><label className="form-label">{"Notes / critères complémentaires"}</label><textarea className="form-input" rows={3} value={f.notes} onChange={function(e){set("notes",e.target.value);}} style={{resize:"vertical",fontFamily:"var(--font)"}} placeholder="Ex: RDC refusé, lumineux, cuisine ouverte..."/></div>
        <div className="form-group form-full">
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 14px",background:f.confidentiel?"#FEF2F2":"var(--g50)",borderRadius:10,border:"2px solid "+(f.confidentiel?"#FECACA":"var(--g200)")}}>
            <input type="checkbox" checked={f.confidentiel||false} onChange={function(e){set("confidentiel",e.target.checked);}} style={{width:18,height:18,cursor:"pointer"}}/>
            <div>
              <div style={{fontWeight:800,color:f.confidentiel?"#DC2626":"var(--navy)",fontSize:13}}>{"🔒 Prospect confidentiel"}</div>
              <div style={{fontSize:11,color:"var(--g400)",marginTop:1}}>{"Nom, téléphone et email masqués pour les autres agents"}</div>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ─── DÉTAIL ───────────────────────────────────────────────────────────────────
function RechercheDetail({ rech, mandats, locations, offmarketBiens, agents, isManager, notifierMatch, onUpdate, onDelete, onClose }) {
  var tb    = TYPES_BIEN.find(function(t){return t.id===rech.typeBien;});
  var isLoc = tb && tb.mode==="location";
  var statutM = STATUTS_RECH.find(function(s){return s.id===rech.statut;}) || STATUTS_RECH[0];

  var matchesMandats = isLoc
    ? locations.map(function(l){ var m=scoreMatchLocation(rech,l); return m?{bien:l,match:m,bienRef:l.ref,bienAdresse:l.adresse,bienPrixLabel:l.loyer+"€/mois",isLoc:true,isOffMarket:false}:null; }).filter(Boolean)
    : mandats.map(function(m){ var ma=scoreMatchVente(rech,m); return ma?{bien:m,match:ma,bienRef:m.ref,bienAdresse:m.adresse,bienPrixLabel:m.prix.toLocaleString("fr-FR")+"€",isLoc:false,isOffMarket:false}:null; }).filter(Boolean);
  var matchesOffMkt = isLoc ? [] : offmarketBiens.map(function(om){ var ma=scoreMatchOffMarket(rech,om); return ma?{bien:om,match:ma,bienRef:om.ref,bienAdresse:om.adresse,bienPrixLabel:om.prix.toLocaleString("fr-FR")+"€",isLoc:false,isOffMarket:true}:null; }).filter(Boolean);
  var matches = [...matchesMandats, ...matchesOffMkt].sort(function(a,b){return b.match.score-a.match.score;});

  return (
    <Modal title={"🔍 "+rech.nom} onClose={onClose} wide
      footer={<div style={{display:"flex",gap:8,width:"100%"}}><button className="btn btn-sm" style={{background:"#FEF2F2",color:"var(--red)",border:"none"}} onClick={onDelete}>{"🗑 Supprimer"}</button><div style={{flex:1}}></div><button className="btn btn-secondary" onClick={onClose}>{"Fermer"}</button></div>}>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {/* Critères */}
        <div style={{background:"var(--g50)",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"📋 Critères"}</div>
          {[
            ["Type",rech.typeBien||"—"],
            [isLoc?"Loyer":"Budget", (rech.budgetMin||0).toLocaleString("fr-FR")+"€ — "+(rech.budgetMax||0).toLocaleString("fr-FR")+"€"+(isLoc?"/mois":"")],
            ["Surface", rech.surfaceMin?(rech.surfaceMin+"–"+(rech.surfaceMax||"?")+"m²"):"Non précisée"],
            ["Pièces",  rech.nbPieces?(rech.nbPieces+"P min"):"Indifférent"],
            ["Chambres",rech.nbChambres?(rech.nbChambres+" ch. min"):"Indifférent"],
            ["SDB",     rech.nbSDB?(rech.nbSDB+" SDB min"):"Indifférent"],
            ["Secteurs",(rech.secteurs||[]).join(", ")||"—"],
          ].map(function(pair){
            return <div key={pair[0]} style={{fontSize:12,marginBottom:4}}><span style={{fontWeight:600,color:"var(--g500)"}}>{pair[0]+" : "}</span><span style={{color:"var(--navy)",fontWeight:700}}>{pair[1]}</span></div>;
          })}
          {/* Options */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
            {rech.avecJardin    && <span style={{fontSize:10,background:"#F0FDF4",color:"#059669",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🌿 Jardin"}</span>}
            {rech.avecGarage    && <span style={{fontSize:10,background:"#EFF6FF",color:"#2563EB",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🚗 Garage"}</span>}
            {rech.avecTerrasse  && <span style={{fontSize:10,background:"#FFF7ED",color:"#EA580C",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"☀️ Terrasse"}</span>}
            {rech.avecAscenseur && <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🛗 Ascenseur"}</span>}
            {rech.avecCave      && <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"📦 Cave"}</span>}
            {rech.avecParking   && <span style={{fontSize:10,background:"var(--g100)",color:"var(--g500)",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🅿️ Parking"}</span>}
            {rech.avecPiscine   && <span style={{fontSize:10,background:"#EFF6FF",color:"#0EA5E9",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{"🏊 Piscine"}</span>}
          </div>
          {rech.notes && <div style={{fontSize:11,color:"var(--g700)",fontStyle:"italic",marginTop:6}}>{'"'+rech.notes+'"'}</div>}
        </div>
        {/* Statut */}
        <div>
          <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"📊 Statut"}</div>
          <div className="form-group">
            <label className="form-label">{"Statut recherche"}</label>
            <select className="form-select" value={rech.statut} onChange={function(e){onUpdate({statut:e.target.value});}}>
              {STATUTS_RECH.map(function(s){return <option key={s.id} value={s.id}>{s.label}</option>;})}
            </select>
          </div>
          {rech.telephone && <a href={"tel:"+rech.telephone.replace(/\s/g,"")} style={{fontSize:13,fontWeight:800,color:"#059669",marginTop:8,display:"block",textDecoration:"none"}}>{"📞 "+rech.telephone}</a>}
          {rech.email     && <div style={{fontSize:12,color:"var(--g500)",marginTop:4}}>{"✉️ "+rech.email}</div>}
          {isManager && (
            <div className="form-group" style={{marginTop:8}}>
              <label className="form-label">{"Transférer à un agent"}</label>
              <div style={{display:"flex",gap:6}}>
                <select className="form-select" value={rech.agentId||""} onChange={function(e){onUpdate({agentId:e.target.value||null});}}>
                  <option value="">{"— Choisir —"}</option>
                  {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
                </select>
              </div>
              <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{"Le transfert est immédiat et visible par l'agent."}</div>
            </div>
          )}
        </div>
      </div>

      {/* Biens correspondants */}
      <div>
        <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:8}}>{"🎯 Biens correspondants ("+matches.length+")"}</div>
        {matches.length===0 && <div style={{fontSize:12,color:"var(--g400)",fontStyle:"italic",padding:"16px",textAlign:"center"}}>{"Aucun bien actif ne correspond à ces critères."}</div>}
        {matches.map(function(item) {
          var scoreColor = item.match.score>=80?"#059669":item.match.score>=60?"#D97706":"#6B7280";
          return (
            <div key={item.bienRef} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 12px",background:"var(--g50)",borderRadius:10,marginBottom:8,border:"1px solid var(--g200)"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:2}}>{item.bienRef+" — "+item.bienAdresse}</div>
                <div style={{fontSize:11,color:"var(--g500)",marginBottom:4}}>{item.bienPrixLabel+(item.isOffMarket?" 🔒 Off market":item.isLoc?" 🔑":" 🏠")}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{item.match.raisons.map(function(ra,i){return <span key={i} style={{fontSize:10,background:"#fff",border:"1px solid var(--g200)",borderRadius:5,padding:"1px 6px"}}>{ra}</span>;})}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
                <div style={{fontWeight:900,fontSize:20,color:scoreColor,lineHeight:1}}>{item.match.score+"%"}</div>
                <div style={{fontSize:10,color:"var(--g400)"}}>{"Match"}</div>
                <button onClick={function(){notifierMatch({recherche:rech,bien:item.bien,bienRef:item.bienRef,bienAdresse:item.bienAdresse,bienPrix:item.bien.prix||item.bien.loyer,bienPrixLabel:item.bienPrixLabel,score:item.match.score,raisons:item.match.raisons,isLoc:item.isLoc});}} style={{background:"var(--navy)",border:"none",color:"#fff",borderRadius:7,padding:"4px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"📨 Notifier"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
