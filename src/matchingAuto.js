// ─── MATCHING AUTOMATIQUE ────────────────────────────────────────────────────
// Appelé à chaque création/modification de mandat ou recherche
// Envoie un message privé à l'agent si un match >= 60% est détecté

var SEUIL_AUTO = 60;
var SK_MSG = "orpi_data_messages_v1";

function scoreAuto(recherche, bien, isOm) {
  var pts = 0;
  var raisons = [];
  var budgetMax = recherche.budgetMax || 0;
  var prix = bien.prix || bien.loyer || 0;
  if (!prix || !budgetMax) return null;
  if (prix <= budgetMax * 1.05) { pts += 40; raisons.push("Budget OK"); }
  else if (prix <= budgetMax * 1.15) { pts += 20; raisons.push("Budget limite"); }
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

function envoyerNotifMatch(agentId, managerNom, bien, recherche, score, raisons, users, isOm) {
  try {
    var agent = users.find(function(u){ return u.id===agentId; });
    if (!agent) return;
    var msgs = JSON.parse(localStorage.getItem(SK_MSG)||"[]");
    var content = "🎯 Nouveau rapprochement détecté — Score "+score+"%\n\n"
      +"📋 Recherche : "+recherche.nom
      +" · Budget : "+(recherche.budgetMin||0).toLocaleString("fr-FR")+"–"+(recherche.budgetMax||0).toLocaleString("fr-FR")+"€\n\n"
      +(isOm?"🔒 Bien off market : ":"🏠 Mandat : ")+(bien.ref?bien.ref+" — ":"")+bien.adresse+"\n"
      +"Prix : "+(bien.prix||bien.loyer||0).toLocaleString("fr-FR")+"€"+(bien.loyer?"/mois":"")+"\n\n"
      +"✅ "+raisons.join(" · ")+"\n\n"
      +"👉 Consultez l'onglet Recherches pour voir le détail.";
    msgs.push({
      id:"auto-match-"+Date.now()+"-"+Math.random().toString(36).slice(2),
      channelId:"priv-match-"+agentId,  // channel spécial notifs auto
      senderId:"system",
      senderNom:"🎯 Matching automatique",
      senderAvatar:"🎯",
      content:content,
      ts:new Date().toISOString(),
      type:"auto_match",
      read:[],
      targetAgentId:agentId,
    });
    localStorage.setItem(SK_MSG, JSON.stringify(msgs));
  } catch(e) {}
}

// Appelé après saveMandat (nouveau bien → chercher les recherches compatibles)
export function checkMatchesNouveauMandat(mandat, recherches, offmarket, users, agenceId) {
  if (!mandat || !mandat.id) return;
  var notifies = new Set();
  (recherches||[]).filter(function(r){
    return r.statut==="active" && r.agentId !== mandat.agentId;
  }).forEach(function(r) {
    var tb = r.typeBien||"";
    var isLoc = tb.includes("louer");
    if (isLoc) return; // mandat = achat uniquement
    var s = scoreAuto(r, mandat, false);
    if (s && !notifies.has(r.agentId)) {
      notifies.add(r.agentId);
      envoyerNotifMatch(r.agentId, "", mandat, r, s.score, s.raisons, users, false);
    }
  });
}

// Appelé après saveRecherche (nouvelle recherche → chercher mandats et off market compatibles)
export function checkMatchesNouvelleRecherche(recherche, mandats, offmarket, users, agenceId) {
  if (!recherche || !recherche.id) return;
  var tb = recherche.typeBien||"";
  var isLoc = tb.includes("louer");
  var matches = [];
  if (!isLoc) {
    (mandats||[]).filter(function(m){ return m.statut==="mandat" && m.agentId !== recherche.agentId; }).forEach(function(m) {
      var s = scoreAuto(recherche, m, false);
      if (s) matches.push({ bien:m, score:s.score, raisons:s.raisons, isOm:false });
    });
    (offmarket||[]).filter(function(o){ return o.actif && o.agentId !== recherche.agentId; }).forEach(function(o) {
      var s = scoreAuto(recherche, o, true);
      if (s) matches.push({ bien:o, score:s.score, raisons:s.raisons, isOm:true });
    });
  }
  // Notifier l'agent de la recherche de tous ses matches
  if (matches.length > 0) {
    matches.sort(function(a,b){return b.score-a.score;}).slice(0,5).forEach(function(m) {
      envoyerNotifMatch(recherche.agentId, "", m.bien, recherche, m.score, m.raisons, users, m.isOm);
    });
  }
}
