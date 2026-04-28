// ─── GESTIONNAIRE DE NOTIFICATIONS ORPI ───────────────────────────────────────
// Utilise les notifications locales du navigateur (pas de serveur push requis)
// Fonctionne sur mobile iOS 16.4+ (PWA) et Android Chrome

var SW_KEY = "orpi_notif_sw_registered";
var PERM_KEY = "orpi_notif_permission";

// ─── ENREGISTREMENT DU SERVICE WORKER ────────────────────────────────────────
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    var reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch(e) {
    console.warn("SW registration failed:", e);
    return false;
  }
}

// ─── DEMANDE DE PERMISSION ────────────────────────────────────────────────────
export async function demanderPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied")  return "denied";
  var result = await Notification.requestPermission();
  return result;
}

export function permissionActuelle() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ─── ENVOI D'UNE NOTIFICATION LOCALE ─────────────────────────────────────────
export async function notifier(titre, corps, options) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  var opts = options || {};

  // Via service worker si disponible (meilleur support mobile)
  if ("serviceWorker" in navigator) {
    try {
      var reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titre, {
        body:    corps,
        icon:    "/logo192.png",
        badge:   "/logo192.png",
        tag:     opts.tag    || "orpi-"+Date.now(),
        vibrate: [200, 100, 200],
        data:    opts.data   || {},
        requireInteraction: false,
      });
      return;
    } catch(e) {}
  }
  // Fallback notification directe
  new Notification(titre, { body: corps, icon: "/logo192.png", tag: opts.tag });
}

// ─── NOTIFICATIONS MÉTIER ─────────────────────────────────────────────────────

// Nouveau mandat enregistré (pour tous les agents de l'agence)
export function notifNouveauMandat(mandat, agentNom) {
  return notifier(
    "🏠 Nouveau mandat dans l'agence",
    (agentNom ? agentNom + " a enregistré : " : "") + mandat.adresse + " — " + (mandat.prix||0).toLocaleString("fr-FR") + "€",
    { tag: "mandat-new-"+mandat.id }
  );
}

// Baisse de prix (pour tous les agents)
export function notifBaissePrix(mandat, ancienPrix, nouveauPrix) {
  var diff = ancienPrix - nouveauPrix;
  return notifier(
    "📉 Baisse de prix — " + mandat.ref,
    mandat.adresse + "\n" + ancienPrix.toLocaleString("fr-FR") + "€ → " + nouveauPrix.toLocaleString("fr-FR") + "€  (−" + diff.toLocaleString("fr-FR") + "€)",
    { tag: "prix-"+mandat.id }
  );
}

// Lead attribué (notification personnelle agent)
export function notifLeadAttribue(lead) {
  return notifier(
    "📥 Nouveau lead pour vous",
    (lead.prenom||"") + " " + (lead.nom||"") + " — " + (lead.typeBien||"") + " — " + (lead.budget||"budget ?"),
    { tag: "lead-"+lead.id }
  );
}

// Tâche confiée (notification personnelle agent)
export function notifTacheConfiee(tache) {
  return notifier(
    "✅ Nouvelle tâche assignée",
    tache.titre + (tache.echeance ? " — Échéance : " + new Date(tache.echeance).toLocaleDateString("fr-FR") : ""),
    { tag: "tache-"+tache.id }
  );
}

// Nouveau compromis / offre reçue (pour managers)
export function notifNouveauCompromis(mandat, agentNom) {
  return notifier(
    "🎉 Offre reçue !",
    (agentNom ? agentNom + " — " : "") + mandat.ref + " · " + mandat.adresse + " — " + (mandat.prix||0).toLocaleString("fr-FR") + "€",
    { tag: "compromis-"+mandat.id }
  );
}

// Lead traité (pour managers)
export function notifLeadTraite(lead, agentNom) {
  return notifier(
    "📋 Lead traité",
    (agentNom ? agentNom + " a traité : " : "") + (lead.prenom||"") + " " + (lead.nom||""),
    { tag: "lead-traite-"+lead.id }
  );
}

// Tâche terminée (pour managers)
export function notifTacheTerminee(tache, agentNom) {
  return notifier(
    "✅ Tâche terminée",
    (agentNom ? agentNom + " : " : "") + tache.titre,
    { tag: "tache-done-"+tache.id }
  );
}
