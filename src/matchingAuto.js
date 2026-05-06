// ─── MATCHING AUTOMATIQUE ────────────────────────────────────────────────────
// Déclenché à chaque création de mandat ou recherche
// Notifie : agent bien, agent recherche ET managers

var SEUIL_AUTO = 55;
var SK_MSG = "orpi_data_messages_v1";

function scoreAuto(recherche, bien, isOm) {
  var pts = 0;
  var raisons = [];
  var budgetMax = recherche.budgetMax || 0;
  var budgetMin = recherche.budgetMin || 0;
  var prix = bien.prix || bien.loyer || 0;
  if (!prix || !budgetMax) return null;
  if (prix >= budgetMin * 0.85 && prix <= budgetMax * 1.1) { pts += 40; raisons.push("Budget OK"); }
  else if (prix <= budgetMax * 1.2) { pts += 20; raisons.push("Budget limite"); }
  else return null;
  var adr = (bien.adresse||"").toLowerCase();
  if ((recherche.secteurs||[]).some(function(s){ return adr.includes(s.toLowerCase()); })) {
    pts += 25; raisons.push("Secteur compatible");
  }
  if (bien.surface && recherche.surfaceMin && bien.surface >= recherche.surfaceMin*0.9) {
    pts += 10; raisons.push("Surface OK ("+bien.surface+"m²)");
  }
  if (recherche.nbPieces && bien.nbPieces && Number(bien.nbPieces) >= Number(recherche.nbPieces)) {
    pts += 10; raisons.push("Nb pièces OK");
  }
  if (isOm && bien.motivation==="Fort")  { pts += 15; raisons.push("Vendeur très motivé"); }
  if (!isOm && bien.typeMandat==="exclusif") { pts += 5; raisons.push("Exclusif"); }
  return pts >= SEUIL_AUTO ? { score:Math.min(pts,100), raisons } : null;
}

// ─── Envoyer une notif privée à un agent spécifique ──────────────────────────
function envoyerNotifAgent(agentId, contenu, users) {
  try {
    var agent = users.find(function(u){ return u.id===agentId; });
    if (!agent) return;
    var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
    msgs.push({
      id: "auto-match-"+Date.now()+"-"+Math.random().toString(36).slice(2),
      channelId: "priv-match-"+agentId,
      senderId: "system",
      senderNom: "🎯 Matching automatique",
      senderAvatar: "🎯",
      content: contenu,
      ts: new Date().toISOString(),
      type: "auto_match",
      read: [],
      targetAgentId: agentId,
    });
    localStorage.setItem(SK_MSG, JSON.stringify(msgs));
  } catch(e) {}
}

// ─── Envoyer une notif aux managers de l'agence ──────────────────────────────
function envoyerNotifManagers(agenceId, contenu, users) {
  try {
    var managers = (users||[]).filter(function(u){
      return u.agenceId===agenceId && u.actif &&
             (u.role==="manager" || u.role==="superadmin");
    });
    var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
    managers.forEach(function(mgr) {
      msgs.push({
        id: "match-mgr-"+Date.now()+"-"+mgr.id,
        channelId: "priv-match-"+mgr.id,
        senderId: "system",
        senderNom: "🎯 Matching automatique",
        senderAvatar: "🎯",
        content: contenu,
        ts: new Date().toISOString(),
        type: "auto_match",
        read: [],
        targetAgentId: mgr.id,
      });
    });
    localStorage.setItem(SK_MSG, JSON.stringify(msgs));
  } catch(e) {}
}

// ─── Construire les messages ──────────────────────────────────────────────────
function msgPourAgentRecherche(recherche, bien, score, raisons, agentBienNom, isOm) {
  return "🎯 Rapprochement détecté — Score "+score+"%\n\n"
    +"📋 Votre recherche : "+recherche.nom
    +"\n   Budget : "+(recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(recherche.budgetMax||0).toLocaleString("fr-FR")+"€\n\n"
    +(isOm?"🔒 Bien off market : ":"🏠 Mandat en stock : ")+(bien.ref?bien.ref+" — ":"")+bien.adresse
    +"\n   Prix : "+(bien.prix||bien.loyer||0).toLocaleString("fr-FR")+"€"+(bien.loyer?"/mois":"")
    +"\n   Géré par : "+agentBienNom+"\n\n"
    +"✅ "+raisons.join(" · ")+"\n\n"
    +"👉 Consultez l'onglet Recherches → Rapprochements pour voir le détail.";
}

function msgPourAgentBien(recherche, bien, score, raisons, agentRechNom, isOm) {
  return "🎯 Un acheteur correspond à votre bien — Score "+score+"%\n\n"
    +(isOm?"🔒 Votre bien off market : ":"🏠 Votre mandat : ")+(bien.ref?bien.ref+" — ":"")+bien.adresse
    +"\n   Prix : "+(bien.prix||bien.loyer||0).toLocaleString("fr-FR")+"€"+(bien.loyer?"/mois":"")+"\n\n"
    +"📋 Recherche correspondante : "+recherche.nom
    +"\n   Budget : "+(recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(recherche.budgetMax||0).toLocaleString("fr-FR")+"€"
    +"\n   Gérée par : "+agentRechNom+"\n\n"
    +"✅ "+raisons.join(" · ")+"\n\n"
    +"👉 Prenez contact avec "+agentRechNom+" pour organiser une visite ensemble !";
}

function msgPourManager(recherche, bien, score, raisons, agentRechNom, agentBienNom, isOm) {
  return "🎯 Rapprochement automatique — Score "+score+"%\n\n"
    +"📋 Recherche : "+recherche.nom+" ("+agentRechNom+")"
    +"\n   Budget : "+(recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(recherche.budgetMax||0).toLocaleString("fr-FR")+"€\n\n"
    +(isOm?"🔒 Off market : ":"🏠 Mandat : ")+(bien.ref?bien.ref+" — ":"")+bien.adresse+" ("+agentBienNom+")"
    +"\n   Prix : "+(bien.prix||bien.loyer||0).toLocaleString("fr-FR")+"€"+(bien.loyer?"/mois":"")+"\n\n"
    +"✅ "+raisons.join(" · ")+"\n\n"
    +"👉 Les deux agents ont été notifiés automatiquement.";
}

// ─── Traiter un match et envoyer les 3 notifications ─────────────────────────
function traiterMatch(recherche, bien, score, raisons, users, agenceId, isOm) {
  var agentRech = users.find(function(u){ return u.id===recherche.agentId; });
  var agentBien = users.find(function(u){ return u.id===bien.agentId; });
  var agentRechNom = agentRech ? agentRech.nom : "Agent inconnu";
  var agentBienNom = agentBien ? agentBien.nom : "Agent inconnu";
  var memeAgent = recherche.agentId === bien.agentId;

  // 1. Notifier l'agent de la RECHERCHE
  envoyerNotifAgent(
    recherche.agentId,
    msgPourAgentRecherche(recherche, bien, score, raisons, agentBienNom, isOm),
    users
  );

  // 2. Notifier l'agent du BIEN (si différent)
  if (!memeAgent && bien.agentId) {
    envoyerNotifAgent(
      bien.agentId,
      msgPourAgentBien(recherche, bien, score, raisons, agentRechNom, isOm),
      users
    );
  }

  // 3. Notifier les MANAGERS
  envoyerNotifManagers(
    agenceId,
    msgPourManager(recherche, bien, score, raisons, agentRechNom, agentBienNom, isOm),
    users
  );
}

// ─── Appelé après saveMandat ──────────────────────────────────────────────────
export function checkMatchesNouveauMandat(mandat, recherches, offmarket, users, agenceId) {
  if (!mandat || !mandat.id) return;
  var dejaNotifies = new Set(); // éviter les doublons sur le même trio agent-recherche
  (recherches||[]).filter(function(r){
    return r.statut==="active";
  }).forEach(function(r) {
    var isLoc = (r.typeBien||"").toLowerCase().includes("louer");
    if (isLoc) return; // mandat de vente ne matche pas une recherche location
    var s = scoreAuto(r, mandat, false);
    var key = r.agentId+"-"+mandat.id;
    if (s && !dejaNotifies.has(key)) {
      dejaNotifies.add(key);
      traiterMatch(r, mandat, s.score, s.raisons, users, agenceId, false);
    }
  });
}

// ─── Appelé après saveRecherche ───────────────────────────────────────────────
export function checkMatchesNouvelleRecherche(recherche, mandats, offmarket, users, agenceId) {
  if (!recherche || !recherche.id) return;
  var isLoc = (recherche.typeBien||"").toLowerCase().includes("louer");
  var dejaNotifies = new Set();

  if (!isLoc) {
    // Ventes : chercher dans mandats actifs
    (mandats||[]).filter(function(m){ return m.statut==="mandat"; }).forEach(function(m) {
      var s = scoreAuto(recherche, m, false);
      var key = m.agentId+"-"+m.id;
      if (s && !dejaNotifies.has(key)) {
        dejaNotifies.add(key);
        traiterMatch(recherche, m, s.score, s.raisons, users, agenceId, false);
      }
    });
    // Off market
    (offmarket||[]).filter(function(o){ return o.actif; }).forEach(function(o) {
      var s = scoreAuto(recherche, o, true);
      var key = o.agentId+"-"+o.id;
      if (s && !dejaNotifies.has(key)) {
        dejaNotifies.add(key);
        traiterMatch(recherche, o, s.score, s.raisons, users, agenceId, true);
      }
    });
  }
}
