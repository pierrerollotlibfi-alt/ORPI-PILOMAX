import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../App";
import { Modal, fmt, fmtDate, avatarColor } from "./Shared";

var NOW = new Date();
var MOIS_NOM = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function diffDays(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function inMois(d, moisStr) {
  if (!d) return false;
  return d.slice(0,7) === moisStr;
}
function getMois(offset) {
  var d = new Date(NOW.getFullYear(), NOW.getMonth()+offset, 1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
}

// ─── MINI CARTE DES MANDATS AGENT ────────────────────────────────────────────
var COORDS_AMIENS = {
  "saint-leu":[49.8967,2.2991],"belfort":[49.8912,2.2887],"noyon":[49.8978,2.3102],
  "gambetta":[49.8944,2.3021],"gresset":[49.8921,2.3045],"longueau":[49.8756,2.3156],
  "rue de paris":[49.8901,2.3078],"victor hugo":[49.8934,2.2998],"delambre":[49.8889,2.3067],
  "rivery":[49.8823,2.3234],"jacobins":[49.8951,2.3012],"vulfran":[49.8962,2.3034],
  "port":[49.9012,2.2956],"faidherbe":[49.8956,2.3089],"foch":[49.8923,2.2978],
  "jules verne":[49.8867,2.2845],"delpech":[49.8934,2.3067],"alsace":[49.8912,2.3001],
  "leclerc":[49.8889,2.2912],"acacias":[49.8756,2.3156],"lilas":[49.8823,2.3234],
  "warmé":[49.8962,2.3034],"amiens":[49.8941,2.2955],
};
function coordsFromAdresse(adresse) {
  if (!adresse) return null;
  var low = adresse.toLowerCase();
  for (var key in COORDS_AMIENS) {
    if (low.includes(key)) {
      var c = COORDS_AMIENS[key];
      return [c[0]+(Math.random()-.5)*.003, c[1]+(Math.random()-.5)*.005];
    }
  }
  return [49.8941+(Math.random()-.5)*.02, 2.2955+(Math.random()-.5)*.03];
}

function CarteMandatsAgent({ mandats, agentId }) {
  var mapRef = useRef(null);
  var mapObj = useRef(null);
  var [ready, setReady] = useState(false);
  var agentMandats = mandats.filter(function(m){ return m.agentId===agentId; });

  useEffect(function() {
    if (!mapRef.current || mapObj.current) return;
    function init() {
      if (!window.L || !mapRef.current) return;
      var L = window.L;
      var map = L.map(mapRef.current, {zoomControl:false}).setView([49.894,2.296],12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM",maxZoom:18}).addTo(map);
      var statColors = {mandat:"#1D3557",compromis:"#2196F3",vendu:"#4CAF50"};
      agentMandats.forEach(function(m) {
        var c = coordsFromAdresse(m.adresse);
        var col = statColors[m.statut]||"#94A3B8";
        var icon = L.divIcon({
          className:"",
          html:'<div style="width:22px;height:22px;border-radius:11px;background:'+col+';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:10px;">'+(m.statut==="vendu"?"✅":m.statut==="compromis"?"🤝":"🏠")+'</div>',
          iconSize:[22,22],iconAnchor:[11,11]
        });
        L.marker(c,{icon}).addTo(map).bindTooltip(m.ref+"<br>"+m.adresse.split(",")[0]+"<br>"+m.prix.toLocaleString("fr-FR")+"€",{direction:"top"});
      });
      mapObj.current = map;
      setReady(true);
    }
    if (window.L) { init(); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      var l=document.createElement("link");l.rel="stylesheet";l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(l);
    }
    var s=document.createElement("script");s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";s.onload=init;document.head.appendChild(s);
  },[]);

  return (
    <div style={{borderRadius:10,overflow:"hidden",border:"1px solid var(--g200)",position:"relative",height:220}}>
      <div ref={mapRef} style={{width:"100%",height:220}}/>
      {!ready && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#F0F4F8",fontSize:12,color:"var(--g400)"}}>{"Chargement carte…"}</div>}
      <div style={{position:"absolute",bottom:6,left:6,zIndex:999,display:"flex",gap:4,flexWrap:"wrap"}}>
        {[["#1D3557","🏠 Mandat"],["#2196F3","🤝 Compromis"],["#4CAF50","✅ Vendu"]].map(function(l){
          return <span key={l[0]} style={{background:"rgba(255,255,255,.9)",borderLeft:"3px solid "+l[0],borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:700}}>{l[1]}</span>;
        })}
      </div>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function FicheKPIAgent({ agent, onClose }) {
  var ctx        = useApp();
  var agenceId   = ctx.currentUser.agenceId;
  var allMandats = ctx.mandats || [];
  var locations  = ctx.locations || [];
  var prospection= ctx.prospection || [];
  var recherches = ctx.recherches || [];
  var users      = ctx.users || [];
  var objectifs  = ctx.objectifs || [];
  var kpiConfig  = ctx.kpiConfig || {};
  var setKpiConfig = ctx.setKpiConfig;

  var myMandats  = allMandats.filter(function(m){ return m.agentId===agent.id; });
  var vendus     = myMandats.filter(function(m){ return m.statut==="vendu"; });
  var compromis  = myMandats.filter(function(m){ return m.statut==="compromis"; });
  var actifs     = myMandats.filter(function(m){ return m.statut==="mandat"; });
  var myLocs     = locations.filter(function(l){ return l.agentId===agent.id; });
  var myProspec  = prospection.filter(function(p){ return p.agentId===agent.id; });
  var myRecherches = recherches.filter(function(r){ return r.agentId===agent.id; });

  var [tabFiche, setTabFiche] = useState("kpi");

  // Seuils configurables (avec fallback sur valeurs par défaut)
  var K = {
    txCommBon:        kpiConfig.txCommBon        != null ? Number(kpiConfig.txCommBon)        : 4.0,
    txCommExcellent:  kpiConfig.txCommExcellent  != null ? Number(kpiConfig.txCommExcellent)  : 4.5,
    txCommAlerte:     kpiConfig.txCommAlerte     != null ? Number(kpiConfig.txCommAlerte)     : 3.0,
    txConvBon:        kpiConfig.txConvBon        != null ? Number(kpiConfig.txConvBon)        : 25,
    txConvExcellent:  kpiConfig.txConvExcellent  != null ? Number(kpiConfig.txConvExcellent)  : 40,
    txConvAlerte:     kpiConfig.txConvAlerte     != null ? Number(kpiConfig.txConvAlerte)     : 15,
    ratioProspBon:    kpiConfig.ratioProspBon    != null ? Number(kpiConfig.ratioProspBon)    : 0.15,
    ratioProspExcellent:kpiConfig.ratioProspExcellent!=null?Number(kpiConfig.ratioProspExcellent):0.3,
    stockBon:         kpiConfig.stockBon         != null ? Number(kpiConfig.stockBon)         : 8,
    stockAlerte:      kpiConfig.stockAlerte      != null ? Number(kpiConfig.stockAlerte)      : 2,
    exclExcellent:    kpiConfig.exclExcellent    != null ? Number(kpiConfig.exclExcellent)    : 60,
    exclBon:          kpiConfig.exclBon          != null ? Number(kpiConfig.exclBon)          : 40,
    exclAlerte:       kpiConfig.exclAlerte       != null ? Number(kpiConfig.exclAlerte)       : 25,
    delaiExcellent:   kpiConfig.delaiExcellent   != null ? Number(kpiConfig.delaiExcellent)   : 60,
    delaiBon:         kpiConfig.delaiBon         != null ? Number(kpiConfig.delaiBon)         : 90,
    delaiAlerte:      kpiConfig.delaiAlerte      != null ? Number(kpiConfig.delaiAlerte)      : 150,
    objAvancePts:     kpiConfig.objAvancePts     != null ? Number(kpiConfig.objAvancePts)     : 15,
    objRetardPts:     kpiConfig.objRetardPts     != null ? Number(kpiConfig.objRetardPts)     : 20,
    connexionsBon:    kpiConfig.connexionsBon    != null ? Number(kpiConfig.connexionsBon)    : 10,
    connexionsAlerte: kpiConfig.connexionsAlerte != null ? Number(kpiConfig.connexionsAlerte) : 3,
    secteursMin:      kpiConfig.secteursMin      != null ? Number(kpiConfig.secteursMin)      : 4,
    recherchesMin:    kpiConfig.recherchesMin    != null ? Number(kpiConfig.recherchesMin)    : 5,
  };

  // ─── OBJECTIF ANNUEL ───────────────────────────────────────────────────────
  var objAnnuel = objectifs.find(function(o){ return o.agentId===agent.id && o.annee===NOW.getFullYear(); });
  var objectifAnnuel = objAnnuel ? objAnnuel.montantHT : 0;

  // ─── CA AGENCE GLOBAL (tous vendus de l'agence cette année) ───────────────
  var anneeCourante = NOW.getFullYear();
  var mandatsAgence = allMandats.filter(function(m){ return m.agenceId===agenceId && m.statut==="vendu"; });
  var caAgenceAnnuel= mandatsAgence.reduce(function(s,m){ return s+(m.commission||0); },0);

  // ─── PART NETTE AGENT ──────────────────────────────────────────────────────
  // Pour chaque vente : si co-agent avec sortie, la part sortie va au co-agent
  // La règle : 50% si seul, 25% si co-agent (selon votre règle métier)
  // Mais on suit plutôt les % définis sur chaque mandat
  function partNette(m) {
    var comm = m.commission || 0;
    if (!comm) return 0;
    var coAgents = m.coAgents || [];
    if (coAgents.length === 0) {
      // Seul : 50% des honoraires HT reviennent à l'agent
      return Math.round(comm * 0.5);
    }
    // Avec co-agent : calculer la part qui reste à l'agent après déduction des parts co-agents
    var totalPctSortie = coAgents.reduce(function(s,ca){ return s+(ca.pctSortie||0); },0);
    // L'agent garde (100% - somme des % sortie co-agents) × 50% de la commission
    var partAgent = comm * (1 - totalPctSortie/100) * 0.5;
    return Math.round(partAgent);
  }

  // Ventes où l'agent est l'agent principal
  var partNetteVentes = vendus.reduce(function(s,m){ return s+partNette(m); },0);

  // Ventes où l'agent est co-agent (% sortie)
  var ventesCOAgent = allMandats.filter(function(m){
    return m.statut==="vendu" && (m.coAgents||[]).find(function(ca){ return ca.agentId===agent.id; });
  });
  var partNetteCOAgent = ventesCOAgent.reduce(function(s,m){
    var ca = (m.coAgents||[]).find(function(ca){ return ca.agentId===agent.id; });
    if (!ca) return s;
    return s + Math.round((m.commission||0) * (ca.pctSortie||0) / 100);
  }, 0);

  var partNetteTotale = partNetteVentes + partNetteCOAgent;

  // CA brut réalisé (commission totale des ventes agent principal)
  var caBrut = vendus.reduce(function(s,m){ return s+(m.commission||0); },0);

  // Part agence sur CA agent (CA brut - part nette agent)
  var partAgence = caBrut - partNetteVentes;

  // Progression objectif
  var progressObj = objectifAnnuel > 0 ? Math.min(100, Math.round(partNetteTotale/objectifAnnuel*100)) : 0;
  var resteObjectif = objectifAnnuel > 0 ? Math.max(0, objectifAnnuel - partNetteTotale) : 0;

  // Part de l'agent dans le CA agence total
  var partDansAgence = caAgenceAnnuel > 0 ? Math.round(caBrut/caAgenceAnnuel*100) : 0;

  // ─── MÉTRIQUES ───────────────────────────────────────────────────────────
  // Ancienneté
  var anciennete = agent.createdAt ? Math.round(diffDays(agent.createdAt, NOW.toISOString().slice(0,10))/30) : null;

  // Taux conversion mandat → compromis
  var txConversion = myMandats.length > 0 ? Math.round((compromis.length+vendus.length)/myMandats.length*100) : 0;

  // Taux commission moyen
  var vendusAvecPrix = vendus.filter(function(m){ return m.prix>0 && m.commission>0; });
  var txCommMoyen = vendusAvecPrix.length > 0
    ? (vendusAvecPrix.reduce(function(s,m){return s+(m.commission/m.prix*100);},0)/vendusAvecPrix.length).toFixed(2)
    : null;

  // Connexions ce mois (derniereConnexion dans le mois)
  var moisActuel = getMois(0);
  var connexionsMois = agent.connexions ? agent.connexions.filter(function(c){ return inMois(c,moisActuel); }).length : (agent.derniereConnexion && inMois(agent.derniereConnexion.slice(0,10),moisActuel) ? 1 : 0);

  // Secteurs géographiques (extraire villes/quartiers des adresses)
  var secteurs = {};
  myMandats.forEach(function(m) {
    var parts = (m.adresse||"").split(",");
    var ville = (parts[1]||parts[0]||"").trim().replace(/\d{5}\s*/,"").trim();
    if (ville) secteurs[ville] = (secteurs[ville]||0)+1;
  });
  var topSecteurs = Object.entries(secteurs).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

  // Types de biens privilégiés
  var typesBiens = {};
  myMandats.forEach(function(m){
    var t = m.typeBien||"non précisé";
    typesBiens[t] = (typesBiens[t]||0)+1;
  });
  var topTypes = Object.entries(typesBiens).sort(function(a,b){return b[1]-a[1];}).slice(0,6);

  // Évolution mensuelle (6 derniers mois)
  var evolution = [];
  for (var i=5; i>=0; i--) {
    var m2 = getMois(-i);
    var nbMandatsMois = myMandats.filter(function(m){ return inMois(m.dateMandat,m2); }).length;
    var nbVentesMois  = vendus.filter(function(m){ return inMois(m.dateSignature||m.dateCompromis,m2); }).length;
    var nbProspecMois = myProspec.filter(function(p){ return inMois(p.dateVisite||p.date,m2); }).length;
    evolution.push({ mois:m2, label:MOIS_NOM[parseInt(m2.split("-")[1])-1], nbMandats:nbMandatsMois, nbVentes:nbVentesMois, nbProspec:nbProspecMois });
  }

  // Ratio mandats vs prospection
  var ratioMandat = myProspec.length > 0 ? (myMandats.length/myProspec.length).toFixed(2) : "—";

  // Prix moyen de vente
  var prixMoyen = vendusAvecPrix.length > 0 ? Math.round(vendusAvecPrix.reduce(function(s,m){return s+m.prix;},0)/vendusAvecPrix.length) : null;

  // Délai moyen mandat → vente
  var delaiMoyen = vendus.filter(function(m){return m.dateMandat&&m.dateSignature;}).length > 0
    ? Math.round(vendus.filter(function(m){return m.dateMandat&&m.dateSignature;}).reduce(function(s,m){return s+diffDays(m.dateMandat,m.dateSignature);},0)/vendus.filter(function(m){return m.dateMandat&&m.dateSignature;}).length)
    : null;

  var col = avatarColor(agent.nom);


  // ─── MOTEUR D'ANALYSE FORCES / AXES DE PROGRESSION ───────────────────────
  var forces = [];
  var axes   = [];

  // 1. Taux de commission
  if (txCommMoyen !== null) {
    var tx = Number(txCommMoyen);
    if (tx >= K.txCommExcellent)  forces.push({ icon:"💎", titre:"Excellent défenseur des honoraires", detail:"Taux de commission moyen de "+tx+"% — objectif excellence : "+K.txCommExcellent+"%." });
    else if (tx >= K.txCommBon) forces.push({ icon:"📐", titre:"Bon taux de commission", detail:tx+"% en moyenne — objectif : "+K.txCommBon+"%." });
    else if (tx < K.txCommAlerte)  axes.push({ icon:"📐", titre:"Marge sur honoraires à améliorer", detail:"Taux moyen de "+tx+"% — seuil alerte fixé à "+K.txCommAlerte+"%." });
    else axes.push({ icon:"📐", titre:"Taux commission perfectible", detail:tx+"% moyen — objectif à atteindre : "+K.txCommBon+"%." });
  }

  // 2. Taux de conversion
  var totalMandats = myMandats.length;
  if (totalMandats >= 3) {
    if (txConversion >= K.txConvExcellent) forces.push({ icon:"🎯", titre:"Excellent taux de transformation", detail:txConversion+"% des mandats aboutissent à une vente ou compromis (seuil excellence : "+K.txConvExcellent+"%)." });
    else if (txConversion >= K.txConvBon) forces.push({ icon:"🎯", titre:"Bon taux de transformation", detail:txConversion+"% de conversion (objectif : "+K.txConvBon+"%)." });
    else if (txConversion < K.txConvAlerte) axes.push({ icon:"🎯", titre:"Taux de transformation à améliorer", detail:txConversion+"% — seuil alerte : "+K.txConvAlerte+"%. Revoir la qualification et la stratégie de prix." });
    else axes.push({ icon:"🎯", titre:"Transformation à développer", detail:txConversion+"% — objectif à atteindre : "+K.txConvBon+"%." });
  }

  // 3. Ratio prospection → mandats
  if (myProspec.length >= 5) {
    var ratio = myMandats.length / myProspec.length;
    if (ratio >= K.ratioProspExcellent) forces.push({ icon:"🚶", titre:"Prospection très efficace", detail:"1 mandat tous les "+Math.round(1/ratio)+" contacts — objectif excellence : "+K.ratioProspExcellent+"." });
    else if (ratio >= K.ratioProspBon) forces.push({ icon:"🚶", titre:"Bonne efficacité prospection", detail:"Ratio "+ratio.toFixed(2)+" mandat/contact (objectif : "+K.ratioProspBon+")." });
    else axes.push({ icon:"🚶", titre:"Rendement prospection à optimiser", detail:"Ratio de "+ratio.toFixed(2)+" — objectif : "+K.ratioProspBon+" mandat/contact." });
  } else if (myProspec.length < 3 && totalMandats > 0) {
    axes.push({ icon:"🚶", titre:"Prospection à intensifier", detail:"Peu d'actions de prospection enregistrées — risque de pénurie de stock à venir." });
  }

  // 4. Stock actif
  if (actifs.length >= K.stockBon) forces.push({ icon:"📦", titre:"Portefeuille bien garni", detail:actifs.length+" mandats actifs (objectif : "+K.stockBon+"+)." });
  else if (actifs.length <= K.stockAlerte && totalMandats > 0) axes.push({ icon:"📦", titre:"Stock à reconstituer", detail:"Seulement "+actifs.length+" mandat(s) — seuil alerte : "+K.stockAlerte+"." });

  // 5. Exclusivité
  var nbExcl = myMandats.filter(function(m){return m.typeMandat==="exclusif";}).length;
  var txExcl = totalMandats > 0 ? Math.round(nbExcl/totalMandats*100) : 0;
  if (txExcl >= K.exclExcellent) forces.push({ icon:"⭐", titre:"Fort taux d'exclusivité", detail:txExcl+"% exclusifs (objectif excellence : "+K.exclExcellent+"%)." });
  else if (txExcl >= K.exclBon) forces.push({ icon:"⭐", titre:"Bon taux d'exclusivité", detail:txExcl+"% de mandats exclusifs (objectif : "+K.exclBon+"%)." });
  else if (txExcl < K.exclAlerte && totalMandats >= 3) axes.push({ icon:"⭐", titre:"Développer les mandats exclusifs", detail:txExcl+"% seulement — objectif minimum : "+K.exclAlerte+"% d'exclusifs." });

  // 6. Délai moyen
  if (delaiMoyen !== null) {
    if (delaiMoyen <= K.delaiExcellent) forces.push({ icon:"⚡", titre:"Vendeur rapide", detail:"Délai moyen de "+delaiMoyen+" jours (seuil excellence : "+K.delaiExcellent+"j)." });
    else if (delaiMoyen <= K.delaiBon) forces.push({ icon:"⏱", titre:"Délai de vente maîtrisé", detail:delaiMoyen+" jours en moyenne (objectif : "+K.delaiBon+"j max)." });
    else if (delaiMoyen > K.delaiAlerte) axes.push({ icon:"⏱", titre:"Délai de vente long", detail:delaiMoyen+" jours — seuil alerte : "+K.delaiAlerte+"j. Revoir stratégie prix et visibilité." });
  }

  // 7. Progression objectif
  if (objectifAnnuel > 0) {
    var moisEcoule = NOW.getMonth() + 1;
    var progressAttendu = Math.round(moisEcoule / 12 * 100);
    if (progressObj >= progressAttendu + K.objAvancePts) forces.push({ icon:"🏆", titre:"En avance sur l'objectif", detail:progressObj+"% réalisé à "+moisEcoule+" mois — "+(progressObj-progressAttendu)+" pts d'avance (seuil : +"+K.objAvancePts+"pts)." });
    else if (progressObj < progressAttendu - K.objRetardPts) axes.push({ icon:"🏆", titre:"Retard sur l'objectif annuel", detail:progressObj+"% réalisé vs "+progressAttendu+"% attendu — "+fmt(resteObjectif)+" restants (alerte : -"+K.objRetardPts+"pts)." });
  }

  // 8. Connexions app
  if (connexionsMois >= K.connexionsBon) forces.push({ icon:"📱", titre:"Utilisation exemplaire de l'app", detail:"Connexions ce mois : "+connexionsMois+" (objectif : "+K.connexionsBon+"+)." });
  else if (connexionsMois < K.connexionsAlerte) axes.push({ icon:"📱", titre:"Adoption digitale à encourager", detail:connexionsMois+" connexion(s) ce mois — seuil alerte : "+K.connexionsAlerte+"." });

  // 9. Diversification géographique
  var nbSecteurs = topSecteurs.length;
  if (nbSecteurs >= K.secteursMin) forces.push({ icon:"🗺️", titre:"Bonne couverture géographique", detail:nbSecteurs+" secteurs couverts (objectif : "+K.secteursMin+"+)." });
  else if (nbSecteurs === 1 && totalMandats >= 5) axes.push({ icon:"🗺️", titre:"Concentration géographique", detail:"1 seul secteur — objectif : couvrir au moins "+K.secteursMin+" secteurs." });

  // 10. Recherches acheteurs
  if (myRecherches.length >= K.recherchesMin) forces.push({ icon:"🔍", titre:"Bon suivi des acquéreurs", detail:myRecherches.length+" recherches acheteurs (objectif : "+K.recherchesMin+"+)." });
  else if (myRecherches.length === 0 && totalMandats >= 3) axes.push({ icon:"🔍", titre:"Acquéreurs à mieux qualifier", detail:"Aucune recherche — objectif : au moins "+K.recherchesMin+" acquéreurs qualifiés." });

  return (
    <Modal title={"📊 Fiche KPI — "+agent.nom} onClose={onClose} wide footer={
      <button className="btn btn-secondary" onClick={onClose}>{"Fermer"}</button>
    }>
      {/* Header agent */}
      <div style={{background:"linear-gradient(135deg,"+col+","+col+"bb)",borderRadius:12,padding:"16px 18px",marginBottom:16,color:"#fff",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:52,height:52,borderRadius:26,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20,flexShrink:0}}>{agent.avatar}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:17}}>{agent.nom}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:2}}>{agent.email}</div>
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            <span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{agent.niveau==="senior"?"🏆 Senior":"🌱 Junior"}</span>
            {anciennete && <span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{"⏱ "+anciennete+" mois d'ancienneté"}</span>}
            <span style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{agent.actif?"✅ Actif":"❌ Inactif"}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"var(--g100)",borderRadius:10,padding:4,marginBottom:14}}>
        {[["kpi","📊 KPIs"],["evolution","📈 Évolution"],["carte","🗺️ Carte"],["types","🏠 Types"],["mandats","📋 Mandats"]].map(function(t){
          return <button key={t[0]} onClick={function(){setTabFiche(t[0]);}} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"none",background:tabFiche===t[0]?"#fff":"transparent",color:tabFiche===t[0]?"var(--navy)":"var(--g400)",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"var(--font)",boxShadow:tabFiche===t[0]?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{t[1]}</button>;
        })}
      </div>

      {/* ─── ONGLET KPIs ─── */}
      {tabFiche==="kpi" && (
        <div>
          {/* ─── BARRE OBJECTIF ANNUEL ─── */}
          {objectifAnnuel > 0 && (
            <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"16px 18px",marginBottom:14,color:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>{"🎯 Objectif annuel "+anneeCourante}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>{"Progression sur part nette agent"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:28,fontWeight:900,color:progressObj>=100?"#6EE7B7":progressObj>=70?"#FCD34D":"#fff",lineHeight:1}}>{progressObj+"%"}</div>
                </div>
              </div>
              <div style={{height:12,background:"rgba(255,255,255,0.15)",borderRadius:6,overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",width:progressObj+"%",background:progressObj>=100?"#6EE7B7":progressObj>=70?"#FCD34D":"#60A5FA",borderRadius:6,transition:"width 0.5s"}}></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{"Objectif"}</div>
                  <div style={{fontWeight:900,fontSize:14,color:"#fff"}}>{fmt(objectifAnnuel)}</div>
                </div>
                <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{"Réalisé (net)"}</div>
                  <div style={{fontWeight:900,fontSize:14,color:"#6EE7B7"}}>{fmt(partNetteTotale)}</div>
                </div>
                <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{"Reste à faire"}</div>
                  <div style={{fontWeight:900,fontSize:14,color:resteObjectif===0?"#6EE7B7":"#FCD34D"}}>{resteObjectif===0?"✅ Atteint !":fmt(resteObjectif)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── CA ET PARTS ─── */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"💰 CA et répartition"}</span>
            </div>
            <div style={{padding:"14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div style={{background:"var(--g50)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:3}}>{"CA brut généré (commissions)"}</div>
                  <div style={{fontSize:20,fontWeight:900,color:"var(--navy)"}}>{fmt(caBrut)}</div>
                  <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{vendus.length+" vente"+(vendus.length>1?"s":"")}</div>
                </div>
                <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,marginBottom:3}}>{"Part nette agent"}</div>
                  <div style={{fontSize:20,fontWeight:900,color:"var(--green)"}}>{fmt(partNetteTotale)}</div>
                  <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{partNetteCOAgent>0?"dont "+fmt(partNetteCOAgent)+" en co-agent":vendus.length>0?"50% des commissions":""}</div>
                </div>
              </div>
              {/* Barre répartition */}
              {caBrut > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--g500)",marginBottom:4}}>
                    <span>{"Agent : "+fmt(partNetteVentes)}</span>
                    <span>{"Agence : "+fmt(partAgence)}</span>
                  </div>
                  <div style={{height:10,background:"var(--g100)",borderRadius:5,overflow:"hidden",display:"flex"}}>
                    <div style={{height:"100%",width:Math.round(partNetteVentes/caBrut*100)+"%",background:"var(--green)",borderRadius:"5px 0 0 5px"}}></div>
                    <div style={{height:"100%",flex:1,background:"var(--navy)"}}></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--g400)",marginTop:3}}>
                    <span>{Math.round(partNetteVentes/caBrut*100)+"% agent"}</span>
                    <span>{Math.round(partAgence/caBrut*100)+"% agence"}</span>
                  </div>
                </div>
              )}
              {/* Part dans CA agence */}
              <div style={{background:"#EFF6FF",borderRadius:9,padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:12,color:"#1D4ED8",fontWeight:600}}>{"Part dans le CA agence "+anneeCourante}</div>
                <div style={{fontWeight:900,fontSize:16,color:"#2563EB"}}>{partDansAgence+"%"}</div>
              </div>
              {partNetteCOAgent > 0 && (
                <div style={{background:"#F5F3FF",borderRadius:9,padding:"9px 12px",marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,color:"#7C3AED",fontWeight:600}}>{"🤝 En tant que co-agent"}</div>
                  <div style={{fontWeight:900,fontSize:14,color:"#7C3AED"}}>{fmt(partNetteCOAgent)}</div>
                </div>
              )}
            </div>
          </div>

          {/* KPIs activité */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {icon:"📋",label:"Mandats actifs",val:actifs.length,color:"var(--navy)"},
              {icon:"🤝",label:"Compromis",val:compromis.length,color:"var(--amber)"},
              {icon:"✅",label:"Ventes actées",val:vendus.length,color:"var(--green)"},
              {icon:"🏠",label:"Locations",val:myLocs.filter(function(l){return l.locataireTrouve;}).length,color:"var(--blue)"},
              {icon:"🚶",label:"Actions prospec.",val:myProspec.length,color:"var(--purple)"},
              {icon:"🔍",label:"Recherches enreg.",val:myRecherches.length,color:"var(--navy)"},
            ].map(function(k){
              return (
                <div key={k.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+k.color,padding:"12px 14px"}}>
                  <div style={{fontSize:10,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>{k.icon+" "+k.label}</div>
                  <div style={{fontSize:22,fontWeight:900,color:k.color,marginTop:4,lineHeight:1}}>{k.val}</div>
                </div>
              );
            })}
          </div>

          {/* Métriques qualitatives */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"⚡ Indicateurs de performance"}</span>
            </div>
            <div style={{padding:"14px"}}>
              {[
                {label:"Taux conversion mandat → vente/compromis",val:txConversion+"%",color:txConversion>=30?"var(--green)":txConversion>=15?"var(--amber)":"var(--red)",icon:"🎯"},
                {label:"Taux commission moyen / prix de vente",val:txCommMoyen?txCommMoyen+"%":"—",color:txCommMoyen?(Number(txCommMoyen)>=4?"var(--green)":Number(txCommMoyen)>=3?"var(--amber)":"var(--red)"):"var(--g400)",icon:"📐"},
                {label:"Ratio mandats pris / actions prospection",val:ratioMandat+" mandat/prospec",color:"var(--blue)",icon:"🔄"},
                {label:"Délai moyen mandat → acte définitif",val:delaiMoyen?delaiMoyen+" jours":"—",color:"var(--navy)",icon:"⏱"},
                {label:"Prix moyen de vente",val:prixMoyen?fmt(prixMoyen):"—",color:"var(--green)",icon:"💰"},
                {label:"Connexions à l'app ce mois",val:connexionsMois,color:connexionsMois>=10?"var(--green)":connexionsMois>=3?"var(--amber)":"var(--red)",icon:"📱"},
                {label:"Dernière connexion",val:agent.derniereConnexion?fmtDate(agent.derniereConnexion.slice(0,10)):"Jamais",color:"var(--navy)",icon:"🕐"},
              ].map(function(r){
                return (
                  <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--g50)"}}>
                    <div style={{fontSize:12,color:"var(--g600)"}}>{r.icon+" "+r.label}</div>
                    <div style={{fontWeight:900,fontSize:13,color:r.color,flexShrink:0,marginLeft:10}}>{r.val}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Forces et axes de progression */}
          {(forces.length > 0 || axes.length > 0) && (
            <div style={{marginBottom:14}}>
              {forces.length > 0 && (
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #A7F3D0",overflow:"hidden",marginBottom:10}}>
                  <div style={{background:"linear-gradient(90deg,#059669,#10B981)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{"💪"}</span>
                    <span style={{fontWeight:800,color:"#fff",fontSize:13}}>{"Points forts ("+forces.length+")"}</span>
                  </div>
                  <div style={{padding:"4px 0"}}>
                    {forces.map(function(f,i){
                      return (
                        <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",borderBottom:i<forces.length-1?"1px solid #F0FDF4":"none"}}>
                          <span style={{fontSize:20,flexShrink:0}}>{f.icon}</span>
                          <div>
                            <div style={{fontWeight:700,color:"#065F46",fontSize:13}}>{f.titre}</div>
                            <div style={{fontSize:11,color:"#047857",marginTop:2}}>{f.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {axes.length > 0 && (
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #FED7AA",overflow:"hidden"}}>
                  <div style={{background:"linear-gradient(90deg,#EA580C,#F97316)",padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:16}}>{"🎯"}</span>
                    <span style={{fontWeight:800,color:"#fff",fontSize:13}}>{"Axes de progression ("+axes.length+")"}</span>
                  </div>
                  <div style={{padding:"4px 0"}}>
                    {axes.map(function(a,i){
                      return (
                        <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",borderBottom:i<axes.length-1?"1px solid #FFF7ED":"none"}}>
                          <span style={{fontSize:20,flexShrink:0}}>{a.icon}</span>
                          <div>
                            <div style={{fontWeight:700,color:"#9A3412",fontSize:13}}>{a.titre}</div>
                            <div style={{fontSize:11,color:"#C2410C",marginTop:2}}>{a.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secteurs géographiques */}
          {topSecteurs.length > 0 && (
            <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
              <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
                <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📍 Secteurs géographiques privilégiés"}</span>
              </div>
              <div style={{padding:"10px 14px"}}>
                {topSecteurs.map(function(s,i){
                  var pct = myMandats.length>0?Math.round(s[1]/myMandats.length*100):0;
                  return (
                    <div key={s[0]} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--navy)"}}>{s[0]}</span>
                        <span style={{fontSize:12,fontWeight:800,color:col}}>{s[1]+" bien"+(s[1]>1?"s":"")+" · "+pct+"%"}</span>
                      </div>
                      <div style={{height:6,background:"var(--g100)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:pct+"%",background:col,borderRadius:3}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ONGLET ÉVOLUTION ─── */}
      {tabFiche==="evolution" && (
        <div>
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📈 Activité mensuelle (6 mois)"}</span>
            </div>
            <div style={{padding:"14px"}}>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:100,marginBottom:8}}>
                {evolution.map(function(e,i){
                  var maxV = Math.max(...evolution.map(function(x){return Math.max(x.nbMandats,x.nbVentes,x.nbProspec);}),1);
                  var isCurrent = i===evolution.length-1;
                  return (
                    <div key={e.mois} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:80}}>
                        <div style={{flex:1,background:isCurrent?"var(--navy)":"var(--g200)",borderRadius:"3px 3px 0 0",height:Math.max(4,e.nbMandats/maxV*80)+"px",minHeight:4}}></div>
                        <div style={{flex:1,background:isCurrent?"var(--green)":"#A7F3D0",borderRadius:"3px 3px 0 0",height:Math.max(4,e.nbVentes/maxV*80)+"px",minHeight:4}}></div>
                        <div style={{flex:1,background:isCurrent?"var(--purple)":"#DDD6FE",borderRadius:"3px 3px 0 0",height:Math.max(4,e.nbProspec/maxV*80)+"px",minHeight:4}}></div>
                      </div>
                      <div style={{fontSize:9,color:isCurrent?"var(--navy)":"var(--g400)",fontWeight:isCurrent?800:600}}>{e.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8}}>
                {[["var(--navy)","📋 Mandats pris"],["var(--green)","✅ Ventes"],["var(--purple)","🚶 Prospec."]].map(function(l){
                  return <span key={l[1]} style={{fontSize:10,display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:l[0],display:"inline-block"}}></span>{l[1]}</span>;
                })}
              </div>
            </div>
          </div>

          {/* Tableau mensuel détaillé */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📋 Détail mensuel"}</span>
            </div>
            {[...evolution].reverse().map(function(e){
              var caVentes = myMandats.filter(function(m){ return m.statut==="vendu" && inMois(m.dateSignature||m.dateCompromis,e.mois); }).reduce(function(s,m){return s+(m.commission||0);},0);
              return (
                <div key={e.mois} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 80px",gap:8,padding:"10px 14px",borderBottom:"1px solid var(--g50)",alignItems:"center"}}>
                  <div style={{fontWeight:700,fontSize:12,color:"var(--navy)"}}>{e.label+" "+e.mois.split("-")[0]}</div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:14,color:"var(--navy)"}}>{e.nbMandats}</div>
                    <div style={{fontSize:9,color:"var(--g400)"}}>{"Mandats"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:14,color:"var(--green)"}}>{e.nbVentes}</div>
                    <div style={{fontSize:9,color:"var(--g400)"}}>{"Ventes"}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:14,color:"var(--purple)"}}>{e.nbProspec}</div>
                    <div style={{fontSize:9,color:"var(--g400)"}}>{"Prospec."}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,fontSize:12,color:"var(--green)"}}>{caVentes>0?fmt(caVentes):"—"}</div>
                    <div style={{fontSize:9,color:"var(--g400)"}}>{"CA"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── ONGLET CARTE ─── */}
      {tabFiche==="carte" && (
        <div>
          <div style={{marginBottom:10,fontSize:12,color:"var(--g500)"}}>{"Tous les mandats de "+agent.nom+" positionnés sur la carte"}</div>
          <CarteMandatsAgent mandats={allMandats} agentId={agent.id}/>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {topSecteurs.map(function(s){
              return <span key={s[0]} style={{background:"var(--g50)",border:"1px solid var(--g200)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:"var(--navy)"}}>{"📍 "+s[0]+" ("+s[1]+")"}</span>;
            })}
          </div>
        </div>
      )}

      {/* ─── ONGLET TYPES DE BIENS ─── */}
      {tabFiche==="types" && (
        <div>
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"🏠 Types de biens privilégiés"}</span>
            </div>
            <div style={{padding:"14px"}}>
              {topTypes.length===0 && <div style={{textAlign:"center",color:"var(--g400)",padding:"20px",fontSize:12}}>{"Aucun mandat enregistré"}</div>}
              {topTypes.map(function(t,i){
                var pct = myMandats.length>0?Math.round(t[1]/myMandats.length*100):0;
                var icons = {appartement:"🏢",maison:"🏠",terrain:"🌿",immeuble:"🏗️",garage:"🚗",local_pro_location:"🏬",local_pro_vente:"🏪"};
                var cols = ["var(--red)","var(--blue)","var(--green)","var(--amber)","var(--purple)","var(--navy)"];
                return (
                  <div key={t[0]} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--navy)"}}>{(icons[t[0]]||"📦")+" "+(t[0].charAt(0).toUpperCase()+t[0].slice(1).replace(/_/g," "))}</span>
                      <span style={{fontSize:13,fontWeight:900,color:cols[i]}}>{t[1]+" · "+pct+"%"}</span>
                    </div>
                    <div style={{height:8,background:"var(--g100)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:pct+"%",background:cols[i],borderRadius:4}}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Répartition exclusif/simple */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px"}}>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:12}}>{"⭐ Répartition exclusif / simple"}</div>
            {(function(){
              var excl = myMandats.filter(function(m){return m.typeMandat==="exclusif";}).length;
              var simp = myMandats.filter(function(m){return m.typeMandat==="simple";}).length;
              var total = excl+simp;
              if (total===0) return <div style={{color:"var(--g400)",fontSize:12}}>{"Aucun mandat"}</div>;
              var pctExcl = Math.round(excl/total*100);
              return (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:700}}>{"⭐ Exclusif : "+excl}</span>
                    <span style={{fontSize:13,fontWeight:700}}>{"Simple : "+simp}</span>
                  </div>
                  <div style={{height:12,background:"var(--g100)",borderRadius:6,overflow:"hidden",display:"flex"}}>
                    <div style={{height:"100%",width:pctExcl+"%",background:"var(--amber)",borderRadius:"6px 0 0 6px"}}></div>
                    <div style={{height:"100%",flex:1,background:"var(--g300)"}}></div>
                  </div>
                  <div style={{fontSize:11,color:"var(--g400)",marginTop:4,textAlign:"center"}}>{pctExcl+"% d'exclusifs"}</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── ONGLET MANDATS ─── */}
      {tabFiche==="mandats" && (
        <div>
          {myMandats.length===0 && <div style={{textAlign:"center",padding:"30px",color:"var(--g400)",fontSize:13}}>{"Aucun mandat"}</div>}
          {myMandats.map(function(m){
            var statCol = m.statut==="vendu"?"var(--green)":m.statut==="compromis"?"var(--amber)":"var(--navy)";
            // Co-agents sur ce mandat
            var coAgents = (m.coAgents||[]).map(function(ca){ return users.find(function(u){return u.id===ca.agentId;}); }).filter(Boolean);
            return (
              <div key={m.id} style={{background:"#fff",borderRadius:10,border:"1px solid var(--g200)",borderLeft:"4px solid "+statCol,padding:"10px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{m.ref}</div>
                    <div style={{fontSize:12,color:"var(--g500)",marginTop:1}}>{m.adresse}</div>
                    {coAgents.length>0 && <div style={{fontSize:11,color:"var(--purple)",marginTop:2}}>{"🤝 Co-agent : "+coAgents.map(function(u){return u.nom;}).join(", ")}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:900,color:statCol,fontSize:13}}>{fmt(m.prix)}</div>
                    <div style={{fontSize:10,color:"var(--g400)",marginTop:1}}>{m.statut.charAt(0).toUpperCase()+m.statut.slice(1)}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,background:"var(--g50)",borderRadius:20,padding:"1px 8px",fontWeight:700}}>{m.typeMandat==="exclusif"?"⭐ Exclusif":"Simple"}</span>
                  {m.typeBien && <span style={{fontSize:10,background:"var(--g50)",borderRadius:20,padding:"1px 8px",fontWeight:700,textTransform:"capitalize"}}>{m.typeBien}</span>}
                  {m.commission && <span style={{fontSize:10,background:"#F0FDF4",color:"var(--green)",borderRadius:20,padding:"1px 8px",fontWeight:700}}>{fmt(m.commission)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
