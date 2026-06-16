import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import Login from "./components/Login";
import ManagerApp from "./components/ManagerApp";
import AgentApp from "./components/AgentApp";
import SuperAdminApp from "./components/SuperAdminApp";
import SetPassword from "./components/SetPassword";
import FirstPassword from "./components/FirstPassword";
import { supabaseConfigured, getClient, dbLoad, dbSave, dbSaveMerge, dbSubscribe } from "./supabase";
import { registerSW, demanderPermission, permissionActuelle } from "./notifications";
import "./styles.css";

export const AppContext = createContext(null);
export const useApp = function() { return useContext(AppContext); };

// ─── HELPERS DATE ─────────────────────────────────────────────────────────────
var _today = new Date();
var daysAgo   = function(d) { return new Date(_today - d * 86400000).toISOString().slice(0,10); };
var daysAhead = function(d) { return new Date(_today.getTime() + d * 86400000).toISOString().slice(0,10); };

// ─── STORAGE KEYS (localStorage fallback) ─────────────────────────────────────
var SK = {
  users:       "orpi_data_users",
  agences:     "orpi_data_agences",
  mandats:     "orpi_data_mandats",
  locations:   "orpi_data_locations",
  gestion:     "orpi_data_gestion",
  invitations: "orpi_data_invitations",
  objectifs:   "orpi_data_objectifs",
  prospection: "orpi_data_prospection",
  prospConfig: "orpi_data_prosp_config",
  tasks:       "orpi_data_tasks",
  recherches:  "orpi_data_recherches",
  journal:     "orpi_data_journal",
  resets:      "orpi_data_resets",
  offmarket:   "orpi_data_offmarket",
  kpiConfig:   "orpi_data_kpi_config",
  feedback:    "orpi_data_feedback",
  journal:     "orpi_data_journal",
  session:     "orpi_data_session",
  tresorerie:  "orpi_data_tresorerie",
  ventes:      "orpi_data_ventes",
  challenges:  "orpi_data_challenges",
};

// ─── DONNÉES INITIALES ────────────────────────────────────────────────────────
// ─── COMPTES MANAGERS ─────────────────────────────────────────────────────────
// Les agents sont créés par le manager depuis l'interface (onglet Agents → Inviter)
var INIT_USERS = [
  { id:"manager-1", nom:"Pierre Rollot",  email:"p.rollot@orpi.com",  password:"ORPI2026", role:"superadmin", agenceId:"agence-1", actif:true, createdAt:daysAgo(365), avatar:"PR", premierAcces:false, invitationAcceptee:true },
  { id:"manager-2", nom:"Frédéric Carré", email:"f.carre@orpi.com",   password:"ORPI2026", role:"superadmin", agenceId:"agence-1", actif:true, createdAt:daysAgo(365), avatar:"FC", premierAcces:false, invitationAcceptee:true },
  { id:"agent-landry", nom:"Landry Boungo",  email:"l.boungo@orpi.com",  password:"ORPI2026", role:"agent",      agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"LB", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"BOL" },
  { id:"agent-laetitia", nom:"Laetitia Vat", email:"l.vat@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"LV", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"LVA" },
  { id:"agent-clement", nom:"Clément Leroy", email:"c.leroy@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"CL", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"LEC" },
  { id:"agent-nathalie", nom:"Nathalie Ducrocq", email:"n.ducrocq@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"ND", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"DUN" },
  { id:"agent-hugo", nom:"Hugo Sausse", email:"h.sausse@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"HS", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"SAH" },
  { id:"agent-isabelle", nom:"Isabelle Descombes", email:"i.descombes@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"ID", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"IDE" },
  { id:"agent-pascal", nom:"Pascal Hainselin", email:"p.hainselin@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"PH", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"HAP" },
  { id:"agent-cedric", nom:"Cédric Salle", email:"c.salle@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"CS", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"SAC" },
  { id:"agent-karine", nom:"Karine Flamand", email:"k.flamand@orpi.com", password:"ORPI2026", role:"agent", agenceId:"agence-1", actif:true, createdAt:daysAgo(180), avatar:"KF", premierAcces:false, invitationAcceptee:true, niveau:"junior", codeNego:"FLK" },

];
var INIT_AGENCES = [
  { id:"agence-1", nom:"ORPI Pro Amiens",   ville:"Amiens",   adresse:"15 Rue des Trois Cailloux, 80000 Amiens", telephone:"03 22 71 00 00", email:"contact@orpi-amiens.fr",   actif:true, createdAt:daysAgo(365), pointMort:273762, chargesDetail:[
    { cat:"Personnel", poste:"Salaires charges comprises", montant:113600 },
    { cat:"Charges externes", poste:"Energie", montant:2500 },
    { cat:"Charges externes", poste:"Petits equipements", montant:2800 },
    { cat:"Charges externes", poste:"Fournitures administratives", montant:1000 },
    { cat:"Charges externes", poste:"Location immobiliere", montant:21600 },
    { cat:"Charges externes", poste:"Location garage", montant:2000 },
    { cat:"Charges externes", poste:"Location portail Orpi", montant:6800 },
    { cat:"Charges externes", poste:"Charges locatives", montant:3040 },
    { cat:"Charges externes", poste:"Primes d'assurances", montant:2000 },
    { cat:"Charges externes", poste:"Sous-traitance FC", montant:24000 },
    { cat:"Charges externes", poste:"Honoraires comptables", montant:7200 },
    { cat:"Charges externes", poste:"Honoraires creation", montant:3000 },
    { cat:"Charges externes", poste:"Honoraires juridique", montant:1200 },
    { cat:"Charges externes", poste:"Honoraires social", montant:912 },
    { cat:"Charges externes", poste:"Publicites, relations publiques", montant:1000 },
    { cat:"Charges externes", poste:"Deplacements, missions, receptions", montant:8000 },
    { cat:"Charges externes", poste:"Indemnites kilometriques", montant:35000 },
    { cat:"Charges externes", poste:"Cadeaux clients", montant:2000 },
    { cat:"Charges externes", poste:"Telephone & Internet", montant:1300 },
    { cat:"Charges externes", poste:"Services bancaires", montant:1500 },
    { cat:"Charges externes", poste:"Cotisation Orpi", montant:26500 },
    { cat:"Charges externes", poste:"Divers", montant:2500 },
    { cat:"Taxes", poste:"Contribution Fonciere", montant:2000 },
    { cat:"Taxes", poste:"Droits d'enregistrement", montant:2310 },
  ] },
  { id:"agence-2", nom:"ORPI Pro Doullens",  ville:"Doullens",  adresse:"Place du Général de Gaulle, 80600 Doullens", telephone:"03 22 77 00 00", email:"contact@orpi-doullens.fr",  actif:true, createdAt:daysAgo(30) },
  { id:"agence-3", nom:"ORPI Pro Corbie",    ville:"Corbie",    adresse:"5 Rue de la République, 80800 Corbie", telephone:"03 22 48 00 00", email:"contact@orpi-corbie.fr",    actif:true, createdAt:daysAgo(15) },
];
var ADRESSE_MAP = {};

var INIT_MANDATS = [
  {
    "id": "SB-129-agence-1",
    "dpe": "E",
    "ref": "SB-129",
    "prix": 340000,
    "etage": "",
    "nbSDB": "",
    "notes": "",
    "photos": [],
    "source": "sweepbright",
    "statut": "sous_offre",
    "adresse": "62 Rue Debaussaux, 80000 Amiens",
    "agentId": "manager-1",
    "surface": "216",
    "visites": [],
    "agenceId": "agence-1",
    "avecCave": false,
    "coAgents": [],
    "nbPieces": "",
    "typeBien": "maison",
    "chauffage": "Fioul",
    "nbApparts": "",
    "avecGarage": true,
    "avecJardin": false,
    "commission": 15000,
    "dateMandat": "2026-05-20",
    "nbChambres": "",
    "typeMandat": "simple",
    "avecParking": false,
    "avecPiscine": false,
    "orientation": "",
    "avecTerrasse": false,
    "loyersAnnuel": "",
    "avecAscenseur": false,
    "dateCompromis": "",
    "dateSignature": "",
    "loyersMensuel": "",
    "dateExpiration": "",
    "tauxCommission": 4.41,
    "proprietaireNom": "THIERRY GRANDMOUGIN",
    "proprietaireTel": "",
    "chargesAnnuelles": "",
    "proprietaireMail": "",
    "adresseProvisoire": false,
    "anneeConstruction": "",
    "proprietairePrenom": "",
    "clausesSuspensivesLevees": false
  }
];
var INIT_LOCATIONS = [
  { id:"loc1", ref:"LOC-001", adresse:"5 Rue Delambre, Amiens",        loyer:750,  commission:750,  agentId:"agent-1", agenceId:"agence-1", dateSignature:daysAgo(10),  locataireNom:"Martin",  locatairePrenom:"Jean",   locataireTel:"06 12 34 56 78", locataireMail:"j.martin@email.fr",  locataireTrouve:true  },
  { id:"loc2", ref:"LOC-002", adresse:"12 Bd Jules Verne, Amiens",     loyer:920,  commission:920,  agentId:"agent-2", agenceId:"agence-1", dateSignature:daysAgo(25),  locataireNom:"Petit",   locatairePrenom:"Marie",  locataireTel:"06 23 45 67 89", locataireMail:"m.petit@email.fr",   locataireTrouve:true  },
  { id:"loc3", ref:"LOC-003", adresse:"8 Rue Saint-Leu, Amiens",       loyer:650,  commission:650,  agentId:"agent-3", agenceId:"agence-1", dateSignature:null,         locataireNom:"",        locatairePrenom:"",       locataireTel:"",               locataireMail:"",                   locataireTrouve:false },
  { id:"loc4", ref:"LOC-004", adresse:"33 Rue de Noyon, Amiens",       loyer:1100, commission:1100, agentId:"agent-1", agenceId:"agence-1", dateSignature:daysAgo(5),   locataireNom:"Durand",  locatairePrenom:"Pierre", locataireTel:"07 34 56 78 90", locataireMail:"p.durand@email.fr",  locataireTrouve:true  },
  { id:"loc5", ref:"LOC-005", adresse:"21 Av Faidherbe, Amiens",       loyer:880,  commission:880,  agentId:"agent-4", agenceId:"agence-1", dateSignature:null,         locataireNom:"",        locatairePrenom:"",       locataireTel:"",               locataireMail:"",                   locataireTrouve:false },
  { id:"loc6", ref:"LOC-006", adresse:"14 Rue Victor Hugo, Amiens",    loyer:590,  commission:590,  agentId:"agent-5", agenceId:"agence-1", dateSignature:daysAgo(40),  locataireNom:"Bernard", locatairePrenom:"Sophie", locataireTel:"06 45 67 89 01", locataireMail:"s.bernard@email.fr", locataireTrouve:true  },
];
var INIT_GESTION = []; // Les biens de gestion sont créés par les agents — pas de données test
var INIT_OFFMARKET = [
  { id:"om1", ref:"OFF-001", adresse:"17 Rue du Général Leclerc, Amiens",  typeLogement:"maison",      surface:145, nbPieces:6, prix:480000, motivation:"Fort", proprietaireNom:"Lefebvre",  proprietairePrenom:"Jacques", proprietaireTel:"06 11 22 33 44", proprietaireMail:"j.lefebvre@email.fr", agentId:"agent-1", agenceId:"agence-1", dateContact:daysAgo(12), notes:"Mutation professionnelle — vente souhaitée avant été. Bien en excellent état.", actif:true },
  { id:"om2", ref:"OFF-002", adresse:"4 Avenue d'Alsace, Amiens",           typeLogement:"appartement", surface:78,  nbPieces:3, prix:215000, motivation:"Moyen", proprietaireNom:"Lemaire",   proprietairePrenom:"Sylvie",  proprietaireTel:"07 22 33 44 55", proprietaireMail:"s.lemaire@email.fr",  agentId:"agent-2", agenceId:"agence-1", dateContact:daysAgo(5),  notes:"Héritière — pas pressée mais sensible au prix.", actif:true },
  { id:"om3", ref:"OFF-003", adresse:"28 Rue Delpech, Amiens",              typeLogement:"maison",      surface:112, nbPieces:5, prix:355000, motivation:"Fort", proprietaireNom:"Renard",    proprietairePrenom:"Éric",    proprietaireTel:"06 33 44 55 66", proprietaireMail:"e.renard@email.fr",   agentId:"agent-3", agenceId:"agence-1", dateContact:daysAgo(20), notes:"Divorce — très motivé. Disponible pour visite sous 48h.", actif:true },
];
var INIT_KPI_CONFIG = {
  txCommBon:       4.0,   // % — taux commission considéré "bon"
  txCommExcellent: 4.5,   // % — taux commission "excellent"
  txCommAlerte:    3.0,   // % — taux commission "alerte"
  txConvBon:       25,    // % — taux conversion mandat→vente "bon"
  txConvExcellent: 40,    // % — taux conversion "excellent"
  txConvAlerte:    15,    // % — taux conversion "alerte"
  ratioProspBon:   0.15,  // mandat/contact — ratio prospection "bon"
  ratioProspExcellent:0.3,// mandat/contact — ratio prospection "excellent"
  stockBon:        8,     // nb mandats actifs "bon"
  stockAlerte:     2,     // nb mandats actifs "alerte"
  exclExcellent:   60,    // % mandats exclusifs "excellent"
  exclBon:         40,    // % mandats exclusifs "bon"
  exclAlerte:      25,    // % mandats exclusifs "alerte"
  delaiExcellent:  60,    // jours délai moyen "excellent"
  delaiBon:        90,    // jours délai moyen "bon"
  delaiAlerte:     150,   // jours délai moyen "alerte"
  objAvancePts:    15,    // pts d'avance sur objectif = force
  objRetardPts:    20,    // pts de retard sur objectif = axe
  connexionsBon:   10,    // connexions/mois "bon"
  connexionsAlerte:3,     // connexions/mois "alerte"
  secteursMin:     4,     // nb secteurs minimum = force
  recherchesMin:   5,     // nb recherches acheteurs = force
};
// ─── VENTES (production réelle encaissée) ────────────────────────────────────
// Source unique du CA réalisé. Chaque vente : commission TTC, 1 ou 2 négociateurs,
// taux de reversement. Calcul automatique TTC -> HT -> part négo / part agence.
var TVA_TAUX = 0.20;

// Calcule les montants d'une vente. Retourne HT, part agence, et la part de CA
// attribuee a chaque negociateur (50/50 du TTC si binome, sinon 100%).
function calcVente(v) {
  var ttc = v.commissionTTC || 0;
  var ht = ttc / (1 + TVA_TAUX);
  var taux = (typeof v.tauxReverse === "number") ? v.tauxReverse : 0.5;
  // Part reversee au negociateur principal (agent commercial)
  var partNego = ht * taux;
  var partAgence = ht - partNego;
  // Repartition du CREDIT de production (CA TTC) entre les negociateurs
  var credits = {};
  if (v.agentId2) {
    credits[v.agentId] = ttc / 2;
    credits[v.agentId2] = (credits[v.agentId2] || 0) + ttc / 2;
  } else if (v.agentId) {
    credits[v.agentId] = ttc;
  }
  return { ttc: ttc, ht: ht, partNego: partNego, partAgence: partAgence, credits: credits };
}

var INIT_VENTES = [];

var INIT_OBJECTIFS = [
  { agentId:"agent-1", agenceId:"agence-1", annee:2026, montantHT:40000 },
  { agentId:"agent-2", agenceId:"agence-1", annee:2026, montantHT:25000 },
  { agentId:"agent-3", agenceId:"agence-1", annee:2026, montantHT:35000 },
  { agentId:"agent-4", agenceId:"agence-1", annee:2026, montantHT:20000 },
  { agentId:"agent-5", agenceId:"agence-1", annee:2026, montantHT:38000 },
];

// ─── STORAGE LOCAL (fallback quand Supabase non configuré) ───────────────────
function lsave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function lload(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
}
// ─── BACKUP MANDATS (protection anti-perte de donnees - CDC 6.1) ─────────────
function backupMandats(mandats) {
  try {
    if (!Array.isArray(mandats) || mandats.length === 0) return;
    var payload = { ts: new Date().toISOString(), count: mandats.length, data: mandats };
    localStorage.setItem("orpi_mandats_backup", JSON.stringify(payload));
  } catch(e) {}
}
function restoreMandatsBackup() {
  try {
    var raw = localStorage.getItem("orpi_mandats_backup");
    if (!raw) return null;
    var payload = JSON.parse(raw);
    if (payload && Array.isArray(payload.data)) return payload;
  } catch(e) {}
  return null;
}
function loadOrInit(key, legacyKeys, init) {
  var v = lload(key, null);
  // Fusion spéciale pour les users : on s'assure que tous les INIT_USERS existent
  if (v !== null && key === SK.users && Array.isArray(init)) {
    var merged = v.slice();
    var changed = false;
    init.forEach(function(initUser) {
      var idx = merged.findIndex(function(u){ return u.id===initUser.id || u.email.toLowerCase()===initUser.email.toLowerCase(); });
      if (idx === -1) {
        merged.push(initUser);
        changed = true;
      } else {
        // Toujours forcer le rôle et le password des INIT_USERS (managers/superadmin garantis)
        var needsUpdate = false;
        var patch = {};
        if (!merged[idx].password) { patch.password = initUser.password; needsUpdate = true; }
        if (initUser.role === "superadmin" && merged[idx].role !== "superadmin") { patch.role = "superadmin"; needsUpdate = true; }
        if (needsUpdate) { merged[idx] = {...merged[idx], ...patch}; changed = true; }
      }
    });
    if (changed) { lsave(key, merged); }
    return merged;
  }
  if (v !== null) return v;
  for (var i = 0; i < legacyKeys.length; i++) {
    var old = lload(legacyKeys[i], null);
    if (old !== null) { lsave(key, old); try { localStorage.removeItem(legacyKeys[i]); } catch(e) {} return old; }
  }
  lsave(key, init);
  return init;
}

// ─── SESSION (toujours localStorage — propre à chaque appareil) ──────────────
var SESSION_DAYS = 30;
function saveSession(userId) {
  try { localStorage.setItem(SK.session, JSON.stringify({ userId, exp: Date.now() + SESSION_DAYS * 86400000 })); } catch(e) {}
}
function loadSession(users) {
  try {
    var raw = localStorage.getItem(SK.session);
    if (!raw) return null;
    var s = JSON.parse(raw);
    if (!s || !s.exp || Date.now() > s.exp) { localStorage.removeItem(SK.session); return null; }
    return (users || []).find(function(u) { return u.id === s.userId && u.actif; }) || null;
  } catch(e) { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SK.session); } catch(e) {}
}

// ─── EXPORT / IMPORT ─────────────────────────────────────────────────────────
function exportAllData(data) {
  var blob = new Blob([JSON.stringify({version:"orpi_v3", exportedAt:new Date().toISOString(), ...data}, null, 2)], {type:"application/json"});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url; a.download = "SAUVEGARDE-ORPI-DECLIC-"+new Date().toISOString().slice(0,10)+".json";
  a.click(); URL.revokeObjectURL(url);
}
function importAllData(file, callbacks) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var d = JSON.parse(e.target.result);
      if (!d.version || !d.version.startsWith("orpi")) { callbacks.onError("❌ Fichier invalide"); return; }
      if (d.users)       { callbacks.setUsers(d.users); }
      if (d.mandats)     { callbacks.setMandatsRaw(d.mandats); }
      if (d.locations)   { callbacks.setLocsRaw(d.locations); }
      if (d.gestion)     { callbacks.setGestRaw(d.gestion); }
      if (d.objectifs)   { callbacks.setObjRaw(d.objectifs); }
      if (d.prospection) { callbacks.setProspRaw(d.prospection); }
      if (d.tasks)       { callbacks.setTasksRaw(d.tasks); }
      callbacks.onSuccess("✅ Import réussi — "+new Date(d.exportedAt).toLocaleDateString("fr-FR"));
    } catch(err) { callbacks.onError("❌ Erreur de lecture du fichier"); }
  };
  reader.readAsText(file);
}
function makeInvitationEmail(nom, agence, link) {
  return "Objet : Invitation à rejoindre " + (agence || "ORPI Pro Amiens") + "\n\nBonjour " + nom + ",\n\nVotre manager vous invite à rejoindre l'application de pilotage commercial.\n\nCréez votre compte ici :\n👉 " + link + "\n\nCe lien est personnel et à usage unique.\n\nCordialement,\nLa direction — " + (agence || "ORPI Pro Amiens");
}

// ─── APP ──────────────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ORPI ERROR:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        React.createElement('div', {style:{padding:20,background:"#FEF2F2",minHeight:"100vh",fontFamily:"monospace"}},
          React.createElement('h2', {style:{color:"#DC2626"}}, "Erreur de rendu"),
          React.createElement('pre', {style:{fontSize:12,color:"#7F1D1D",whiteSpace:"pre-wrap"}},
            this.state.error && this.state.error.toString()
          ),
          React.createElement('pre', {style:{fontSize:11,color:"#991B1B",whiteSpace:"pre-wrap"}},
            this.state.errorInfo && this.state.errorInfo.componentStack
          ),
          React.createElement('button', {
            onClick: function(){window.location.reload();},
            style:{marginTop:16,padding:"8px 16px",background:"#DC2626",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}
          }, "Recharger")
        )
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Restaurer le mode sombre
  (function(){
    try { if (localStorage.getItem("orpi_dark_mode")==="1") document.body.classList.add("dark-mode"); } catch(e) {}
  })();
  // Si un token d'invitation est dans l'URL, on n'affiche pas le loading
  var _hasInviteToken = (function(){ try { return !!new URLSearchParams(window.location.search).get("invite"); } catch(e){ return false; } })();
  var [loading, setLoading] = useState(supabaseConfigured && !_hasInviteToken);
  var [notifPerm, setNotifPerm] = useState(function(){ return permissionActuelle(); });
  var [syncMode, setSyncMode] = useState(supabaseConfigured ? "supabase" : "local");

  // Init depuis localStorage (toujours immédiat)
  var [users,       setUsersRaw]   = useState(function(){ return loadOrInit(SK.users,       ["orpi_data_users_v4","orpi_users_v4"],   INIT_USERS); });
  var [agences,     setAgencesRaw] = useState(function(){ return loadOrInit(SK.agences,     ["orpi_agences_v4"],                      INIT_AGENCES); });
  var [mandats,     setMandatsRaw] = useState(function(){ return loadOrInit(SK.mandats,     ["orpi_mandats_v4","orpi_mandats_v1"],    INIT_MANDATS); });
  var [locations,   setLocsRaw]    = useState(function(){ return loadOrInit(SK.locations,   ["orpi_locations_v4"],                    INIT_LOCATIONS); });
  var [gestion,     setGestRaw]    = useState(function(){ return loadOrInit(SK.gestion,     ["orpi_gestion_v4"],                      INIT_GESTION); });
  var [invitations, setInvRaw]     = useState(function(){ return loadOrInit(SK.invitations, ["orpi_invitations_v4"],                  []); });
  var [objectifs,   setObjRaw]     = useState(function(){ return loadOrInit(SK.objectifs,   ["orpi_objectifs_v4"],                    INIT_OBJECTIFS); });
  var [prospection, setProspRaw]   = useState(function(){ return loadOrInit(SK.prospection, [],                                       []); });
  var [prospConfig, setProspCfgRaw]= useState(function(){ return loadOrInit(SK.prospConfig, [],                                       {delaiRappelMois:2}); });
  var [tasks,       setTasksRaw]   = useState(function(){ return lload(SK.tasks, []); });
  var [recherches,  setRechercheRaw]= useState(function(){ return lload(SK.recherches, []); });
  var [journal,     setJournalRaw]   = useState(function(){ return lload(SK.journal, []); });
  var [resets,      setResetsRaw]    = useState(function(){ return lload(SK.resets, []); });
  var [offmarket,   setOffMktRaw]   = useState(function(){ return loadOrInit(SK.offmarket, [], INIT_OFFMARKET); });
  var [kpiConfig,   setKpiCfgRaw]   = useState(function(){ return loadOrInit(SK.kpiConfig,  [], INIT_KPI_CONFIG); });
  var [feedback,    setFeedbackRaw]  = useState(function(){ return lload(SK.feedback, []); });
  var [tresorerie,  setTresoRaw]     = useState(function(){ return loadOrInit(SK.tresorerie, [], {ecritures:[]}); });
  var [journal2,    setJournal2Raw]  = useState(function(){ return lload(SK.journal, []); });
  var [ventes,      setVentesRaw]    = useState(function(){ return loadOrInit(SK.ventes, [], INIT_VENTES); });
  var [challenges,  setChallengesRaw]= useState(function(){ return lload(SK.challenges, []); });

  var [currentUser, setCurrentUser] = useState(function() { return loadSession(lload(SK.users, INIT_USERS)); });
  var [page,        setPage]        = useState(function() {
    try {
      if (new URLSearchParams(window.location.search).get("invite")) return "setpassword";
    } catch(e) {}
    return loadSession(lload(SK.users, INIT_USERS)) ? "app" : "login";
  });
  // Lire le token + uid directement au démarrage
  var [invToken,    setInvToken]    = useState(function() {
    try { return new URLSearchParams(window.location.search).get("invite") || null; } catch(e) { return null; }
  });
  var [invUserId,   setInvUserId]   = useState(function() {
    try { return new URLSearchParams(window.location.search).get("uid") || null; } catch(e) { return null; }
  });
  var [invAgenceId, setInvAgenceId] = useState(function() {
    try { return new URLSearchParams(window.location.search).get("ag") || null; } catch(e) { return null; }
  });
  var [pendingUser, setPendingUser] = useState(null);
  var [saveMsg,     setSaveMsg]     = useState(null);

  // ─── CHARGEMENT INITIAL DEPUIS SUPABASE ──────────────────────────────────────
  useEffect(function() {
    if (!supabaseConfigured) { setLoading(false); return; }
    var collections = [
      { name:"users",       setter:setUsersRaw,    sk:SK.users,       init:INIT_USERS },
      { name:"agences",     setter:setAgencesRaw,  sk:SK.agences,     init:INIT_AGENCES },
      { name:"mandats",     setter:setMandatsRaw,  sk:SK.mandats,     init:INIT_MANDATS },
      { name:"locations",   setter:setLocsRaw,     sk:SK.locations,   init:INIT_LOCATIONS },
      { name:"gestion",     setter:setGestRaw,     sk:SK.gestion,     init:INIT_GESTION },
      { name:"invitations", setter:setInvRaw,      sk:SK.invitations, init:[] },
      { name:"objectifs",   setter:setObjRaw,      sk:SK.objectifs,   init:INIT_OBJECTIFS },
      { name:"prospection", setter:setProspRaw,    sk:SK.prospection, init:[] },
      { name:"tasks",       setter:setTasksRaw,    sk:SK.tasks,       init:[] },
      { name:"recherches", setter:setRechercheRaw, sk:SK.recherches,  init:[] },
      { name:"feedback",    setter:setFeedbackRaw,  sk:SK.feedback,    init:[] },
      { name:"kpiConfig",   setter:setKpiCfgRaw,    sk:SK.kpiConfig,   init:INIT_KPI_CONFIG },
      { name:"offmarket",   setter:setOffMktRaw,    sk:SK.offmarket,   init:INIT_OFFMARKET },
      { name:"journal",     setter:setJournalRaw,   sk:SK.journal,     init:[] },
      { name:"resets",      setter:setResetsRaw,    sk:SK.resets,      init:[] },
      { name:"prospConfig", setter:setProspCfgRaw,  sk:SK.prospConfig, init:{delaiRappelMois:2} },
      { name:"ventes",      setter:setVentesRaw,    sk:SK.ventes,      init:INIT_VENTES },
      { name:"challenges",  setter:setChallengesRaw,sk:SK.challenges,  init:[] },
    ];
    Promise.all(collections.map(function(c) {
      return dbLoad(c.name, null).then(function(v) {
        if (v !== null) {
          // Pour les users : toujours fusionner avec INIT_USERS (managers garantis)
          var data = v;
          if (c.name === "users" && Array.isArray(c.init)) {
            var merged = v.slice();
            var changed = false;
            c.init.forEach(function(iu) {
              var idx = merged.findIndex(function(u){ return u.id===iu.id || u.email.toLowerCase()===iu.email.toLowerCase(); });
              if (idx === -1) {
                // Compte absent → l'ajouter
                merged.push(iu);
                changed = true;
              } else if (merged[idx].role === "manager" && !merged[idx].password) {
                // Manager sans mot de passe → restaurer le mot de passe initial
                merged[idx] = {...merged[idx], password: iu.password};
                changed = true;
              }
            });
            if (changed) { dbSave("users", merged); }
            data = merged;
          }
          // Pour les collections avec INIT (mandats, etc.) : fusionner les items manquants
          if (c.name !== "users" && c.init && c.init.length > 0 && Array.isArray(data)) {
            var dataIds = new Set(data.map(function(x){return x.id;}));
            var manquants = c.init.filter(function(x){ return !dataIds.has(x.id); });
            if (manquants.length > 0 && c.name === "mandats") {
              // Détecter doublons potentiels avant fusion :
              // Un doublon = même prix ET même adresse (normalisée) entre un mandat existant et un INIT
              var normalise = function(s){ return (s||"").toLowerCase().replace(/[^a-z0-9]/g,"").trim(); };
              manquants = manquants.map(function(m) {
                var addrNorm = normalise(m.adresse);
                var doublon = data.find(function(ex){
                  return ex.statut !== "archive" &&
                    Math.abs((ex.prix||0) - (m.prix||0)) < 1000 &&
                    normalise(ex.adresse).includes(addrNorm.slice(0,8));
                });
                return doublon ? {...m, doublonSuspecte:true, doublonAvec:doublon.id} : m;
              });
              data = [...data, ...manquants];
              dbSave(c.name, data);
            } else if (manquants.length > 0) {
              data = [...data, ...manquants];
              dbSave(c.name, data);
            }
          }
          var safeData = (c.name !== "tresorerie" && c.name !== "prospConfig")
            ? (Array.isArray(data) ? data : null)
            : (data || c.init || {});
          if (safeData !== null) {
            // Dédupliquer les mandats par ref avant de setter
          var finalData = safeData;
          if (c.name === "mandats" && Array.isArray(safeData)) {
            var seenRefs = {};
            finalData = safeData.filter(function(m) {
              var key = m.ref || m.id;
              if (seenRefs[key]) return false;
              seenRefs[key] = true;
              return true;
            }).map(function(m) {
              // Appliquer les adresses enrichies depuis ADRESSE_MAP
              var enrich = ADRESSE_MAP[m.ref];
              if (enrich && (m.adresseProvisoire || !m.adresse || m.adresse.indexOf(', 80000 Amiens') > -1 && m.adresse.split(',')[0] === m.adresse.split(',')[0])) {
                return Object.assign({}, m, enrich, {adresseProvisoire: false});
              }
              return m;
            });
            if (finalData.length < safeData.length) {
              console.log("Deduplication mandats:", safeData.length, "->", finalData.length);
            }
          }
          c.setter(finalData);
          // Ne sauvegarder dans localStorage que si les données sont valides et non-vides
          if (Array.isArray(finalData) ? finalData.length > 0 : true) {
            lsave(c.sk, finalData);
            if (c.name === "mandats") backupMandats(finalData);
          }
          } else {
            // data invalide : garder le state existant (localStorage déjà chargé)
            console.warn("Supabase a renvoyé des données invalides pour", c.name, "- conservation du cache local");
            if (c.name === "mandats") {
              var backup = restoreMandatsBackup();
              if (backup && backup.data.length > 0) {
                console.warn("Restauration depuis backup local:", backup.count, "mandats du", backup.ts);
                c.setter(backup.data);
                lsave(c.sk, backup.data);
              }
            }
          }
        } else {
          // Supabase vide → initialiser avec les données init
          var local = c.init && c.init.length > 0 ? c.init : lload(c.sk, []);
          dbSave(c.name, local);
          data = local;
        }
      });
    })).then(function() {
      setLoading(false);
      // Recharger le currentUser avec les users fraîchement chargés
      setUsersRaw(function(u) {
        var sess = loadSession(u);
        if (sess) { setCurrentUser(sess); setPage("app"); }
        return u;
      });
    }).catch(function() { setLoading(false); });
  }, []);

  // ─── ABONNEMENTS TEMPS RÉEL ──────────────────────────────────────────────────
  useEffect(function() {
    if (!supabaseConfigured) return;
    var unsubs = [
      dbSubscribe("users",       function(v){ setUsersRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.users, v); }),
      dbSubscribe("mandats",     function(v){ setMandatsRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.mandats, v); }),
      dbSubscribe("tresorerie",  function(v){ setTresoRaw(v&&typeof v==="object"?v:{ecritures:[]});   lsave(SK.tresorerie, v); }),
      dbSubscribe("locations",   function(v){ setLocsRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.locations, v); }),
      dbSubscribe("gestion",     function(v){ setGestRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.gestion, v); }),
      dbSubscribe("invitations", function(v){ setInvRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.invitations, v); }),
      dbSubscribe("objectifs",   function(v){ setObjRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.objectifs, v); }),
      dbSubscribe("prospection", function(v){ setProspRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.prospection, v); }),
      dbSubscribe("tasks",       function(v){ setTasksRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.tasks, v); }),
      dbSubscribe("recherches",  function(v){ setRechercheRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.recherches, v); }),
      dbSubscribe("journal",      function(v){ setJournalRaw(Array.isArray(v)?v:prev=>prev);  lsave(SK.journal, v);     }),
      dbSubscribe("resets",       function(v){ setResetsRaw(Array.isArray(v)?v:prev=>prev);  lsave(SK.resets, v);      }),
    ];
    return function() { unsubs.forEach(function(u){ u && u(); }); };
  }, []);

  // ─── SETTERS (écrivent local + Supabase) ─────────────────────────────────────
  var setUsers       = useCallback(function(u){ var v=typeof u==="function"?u(users):u;       setUsersRaw(Array.isArray(v)?v:prev=>prev);    lsave(SK.users,v);       if(supabaseConfigured)dbSave("users",v);       },[users]);
  var setAgences     = useCallback(function(u){ var v=typeof u==="function"?u(agences):u;     setAgencesRaw(v);  lsave(SK.agences,v);     if(supabaseConfigured)dbSave("agences",v);     },[agences]);
  var setMandats     = useCallback(function(u){ var v=typeof u==="function"?u(mandats):u;     setMandatsRaw(Array.isArray(v)?v:prev=>prev);  lsave(SK.mandats,v);     if(supabaseConfigured)dbSaveMerge("mandats",v).then(function(merged){ if(Array.isArray(merged)){ setMandatsRaw(merged); lsave(SK.mandats,merged); } });     },[mandats]);
  var leads = useMemo(function(){
    return (tasks||[]).filter(function(t){ return t.type==="lead"||t.categorie==="lead"; });
  }, [tasks]);

  var setTresorerie  = useCallback(function(u){ var v=typeof u==="function"?u(tresorerie):u;  setTresoRaw(v&&typeof v==="object"?v:{ecritures:[]});    lsave(SK.tresorerie,v);  if(supabaseConfigured)dbSave("tresorerie",v);  },[tresorerie]);
  var setLocations   = useCallback(function(u){ var v=typeof u==="function"?u(locations):u;   setLocsRaw(Array.isArray(v)?v:prev=>prev);     lsave(SK.locations,v);   if(supabaseConfigured)dbSaveMerge("locations",v).then(function(m){ if(Array.isArray(m)){ setLocsRaw(m); lsave(SK.locations,m); } });   },[locations]);
  var setGestion     = useCallback(function(u){ var v=typeof u==="function"?u(gestion):u;     setGestRaw(Array.isArray(v)?v:prev=>prev);     lsave(SK.gestion,v);     if(supabaseConfigured)dbSaveMerge("gestion",v).then(function(m){ if(Array.isArray(m)){ setGestRaw(m); lsave(SK.gestion,m); } });     },[gestion]);
  var setInvitations = useCallback(function(u){ var v=typeof u==="function"?u(invitations):u; setInvRaw(Array.isArray(v)?v:prev=>prev);      lsave(SK.invitations,v); if(supabaseConfigured)dbSave("invitations",v); },[invitations]);
  var setObjectifs   = useCallback(function(u){ var v=typeof u==="function"?u(objectifs):u;   setObjRaw(Array.isArray(v)?v:prev=>prev);      lsave(SK.objectifs,v);   if(supabaseConfigured)dbSave("objectifs",v);   },[objectifs]);
  var setProspection = useCallback(function(u){ var v=typeof u==="function"?u(prospection):u; setProspRaw(Array.isArray(v)?v:prev=>prev);    lsave(SK.prospection,v); if(supabaseConfigured)dbSave("prospection",v); },[prospection]);
  var setProspConfig = useCallback(function(u){ var v=typeof u==="function"?u(prospConfig):u; setProspCfgRaw(v); lsave(SK.prospConfig,v); if(supabaseConfigured)dbSave("prospConfig",v); },[prospConfig]);
  var setTasks       = useCallback(function(u){ var v=typeof u==="function"?u(tasks):u;       setTasksRaw(Array.isArray(v)?v:prev=>prev);    lsave(SK.tasks,v);       if(supabaseConfigured)dbSave("tasks",v);       },[tasks]);
  var setRecherches  = useCallback(function(u){ var v=typeof u==="function"?u(recherches):u;  setRechercheRaw(Array.isArray(v)?v:prev=>prev);lsave(SK.recherches,v);if(supabaseConfigured)dbSave("recherches",v);},[recherches]);
  var setJournal     = useCallback(function(u){ var v=typeof u==="function"?u(journal):u;       setJournalRaw(Array.isArray(v)?v:prev=>prev);  lsave(SK.journal,v);   if(supabaseConfigured)dbSave("journal",v);     },[journal]);
  var setResets      = useCallback(function(u){ var v=typeof u==="function"?u(resets):u;        setResetsRaw(Array.isArray(v)?v:prev=>prev);   lsave(SK.resets,v);    if(supabaseConfigured)dbSave("resets",v);      },[resets]);
  var setOffMarket   = useCallback(function(u){ var v=typeof u==="function"?u(offmarket):u;    setOffMktRaw(v);   lsave(SK.offmarket,v); if(supabaseConfigured)dbSave("offmarket",v);  },[offmarket]);
  var setKpiConfig   = useCallback(function(u){ var v=typeof u==="function"?u(kpiConfig):u;    setKpiCfgRaw(v);   lsave(SK.kpiConfig,v); if(supabaseConfigured)dbSave("kpiConfig",v); },[kpiConfig]);
  var setFeedback    = useCallback(function(u){ var v=typeof u==="function"?u(feedback):u;     setFeedbackRaw(v);  lsave(SK.feedback,v);  if(supabaseConfigured)dbSave("feedback",v);  },[feedback]);
  var setVentes      = useCallback(function(u){ var v=typeof u==="function"?u(ventes):u;       setVentesRaw(Array.isArray(v)?v:prev=>prev);   lsave(SK.ventes,v);    if(supabaseConfigured)dbSave("ventes",v);      },[ventes]);
  var setChallenges  = useCallback(function(u){ var v=typeof u==="function"?u(challenges):u;   setChallengesRaw(Array.isArray(v)?v:prev=>prev); lsave(SK.challenges,v); if(supabaseConfigured)dbSave("challenges",v); },[challenges]);

  // ─── TOKEN INVITATION (useEffect conservé pour compatibilité) ───────────────
  useEffect(function() {
    try {
      var token = new URLSearchParams(window.location.search).get("invite");
      if (token && !invToken) { setInvToken(token); setPage("setpassword"); }
    } catch(e) {}
  }, []);

  // ─── SERVICE WORKER + NOTIFICATIONS ─────────────────────────────────────────
  useEffect(function() {
    registerSW();
  }, []);

  // ─── AUTH ─────────────────────────────────────────────────────────────────────
  function handleLogin(email, pwd) {
    var u = users.find(function(x) { return x.email.toLowerCase()===email.toLowerCase() && x.actif; });
    if (!u) return "Email ou mot de passe incorrect";
    if ((u.role==="manager"||u.role==="superadmin") && u.premierAcces && !u.password) { setPendingUser(u); setPage("firstpassword"); return null; }
    if (!u.password || u.password!==pwd) return "Email ou mot de passe incorrect";
    var now = new Date().toISOString();
    var uWithLogin = {...u, derniereConnexion: now};
    var newUsers = users.map(function(x){ return x.id===u.id ? uWithLogin : x; });
    setUsers(newUsers);
    if(supabaseConfigured) { try { dbSave("users", newUsers); } catch(e){} }
    saveSession(u.id); setCurrentUser(uWithLogin); setPage("app"); return null;
  }
  function handleLogout() { clearSession(); setCurrentUser(null); setPage("login"); }
  function handleFirstPassword(pwd) {
    var updated = {...pendingUser, password:pwd, premierAcces:false};
    setUsers(function(prev) { return prev.map(function(u) { return u.id===pendingUser.id ? updated : u; }); });
    var updatedWithLogin = {...updated, derniereConnexion: new Date().toISOString()};
    setUsers(function(prev){ return prev.map(function(u){ return u.id===updated.id ? updatedWithLogin : u; }); });
    saveSession(updatedWithLogin.id); setCurrentUser(updatedWithLogin); setPendingUser(null); setPage("app");
  }
  function inviterAgent(data, agenceId) {
    var agence  = agences.find(function(a) { return a.id===agenceId; });
    var exists = users.find(function(u){ return u.email.toLowerCase()===data.email.toLowerCase(); });
    // Si le compte existe et est actif → bloquer
    if (exists && exists.actif) return { success:false, error:"Un compte actif avec cet email existe déjà." };
    // Si le compte existe mais désactivé → le réactiver avec les nouvelles infos
    if (exists && !exists.actif) {
      var reactivated = {...exists, nom:data.nom, password:data.motDePasse, niveau:data.niveau||exists.niveau, actif:true, invitationAcceptee:true, premierAcces:false};
      setUsers(function(prev){ return prev.map(function(u){ return u.id===exists.id ? reactivated : u; }); });
      var appUrl2 = window.location.origin+window.location.pathname;
      var agence2 = agences.find(function(a){ return a.id===agenceId; });
      var msg2 = "Bonjour "+data.nom+","
        +"\n\nVotre compte ORPI Déclic Immo a été réactivé."
        +"\n\n👉 Application : "+appUrl2
        +"\n📧 Email : "+data.email
        +"\n🔑 Mot de passe : "+data.motDePasse
        +"\n\nCordialement,\nLa direction — "+(agence2?agence2.nom:"ORPI Pro Amiens");
      return { success:true, emailMessage:msg2, appUrl:appUrl2, motDePasse:data.motDePasse };
    }
    if (!data.motDePasse || data.motDePasse.length < 4) return { success:false, error:"Le mot de passe temporaire doit faire au moins 4 caractères." };
    var newUser = {
      id:"agent-"+Date.now(), nom:data.nom, email:data.email,
      password:data.motDePasse,
      role:"agent", niveau:data.niveau||"junior",
      agenceId:agenceId, actif:true, createdAt:new Date().toISOString().slice(0,10),
      avatar:data.nom.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase(),
      invitationAcceptee:true, premierAcces:false,
    };
    setUsers(function(prev) { return [...prev, newUser]; });
    var appUrl = window.location.origin+window.location.pathname;
    var emailMsg = "Bonjour "+data.nom
      +",\n\nVotre compte ORPI Déclic Immo a été créé."
      +"\n\n👉 Application : "+appUrl
      +"\n📧 Email : "+data.email
      +"\n🔑 Mot de passe : "+data.motDePasse
      +"\n\nConnectez-vous directement avec ces identifiants."
      +"\n\nCordialement,\nLa direction — "+(agence?agence.nom:"ORPI Pro Amiens");
    return { success:true, emailMessage:emailMsg, appUrl:appUrl, motDePasse:data.motDePasse };
  }
  // Changement de mot de passe (appelé depuis le profil agent)
  function changerMotDePasse(userId, newPwd) {
    setUsers(function(prev){ return prev.map(function(u){ return u.id===userId ? {...u, password:newPwd} : u; }); });
    // Mettre à jour currentUser en session si c'est lui qui change son mot de passe
    if (currentUser && currentUser.id === userId) {
      var updated = {...currentUser, password:newPwd};
      setCurrentUser(updated);
      saveSession(updated.id);
    }
  }

  // Demande de réinitialisation mot de passe (appelée par l'agent)
  function demanderResetMdp(userId) {
    var u = users.find(function(x){ return x.id===userId; });
    if (!u) return;
    var demande = { id:"reset-"+Date.now(), userId:userId, userNom:u.nom, userEmail:u.email, ts:new Date().toISOString(), traite:false };
    setResets(function(prev){ return [demande, ...prev.filter(function(r){ return r.userId!==userId || r.traite; })]; });
  }

  // Réinitialisation par le manager
  function resetMdpParManager(userId, newPwd) {
    var mdp = newPwd || "ORPI2026";
    setUsers(function(prev){ return prev.map(function(u){ return u.id===userId ? {...u, password:mdp, premierAcces:false} : u; }); });
    setResets(function(prev){ return prev.map(function(r){ return r.userId===userId ? {...r, traite:true} : r; }); });
  }

  function activerCompte(token, pwd) {
    // Cherche d'abord dans le state local
    var inv = invitations.find(function(i) { return i.token===token && !i.used; });
    if (!inv) return "Lien invalide ou expiré";
    setUsers(function(prev) { return prev.map(function(u) { return u.id===inv.userId ? {...u, password:pwd, invitationAcceptee:true, premierAcces:false} : u; }); });
    setInvitations(function(prev) { return prev.map(function(i) { return i.token===token ? {...i, used:true} : i; }); });
    return null;
  }
  // Version async : fonctionne avec ou sans Supabase
  // Utilise uid du lien pour retrouver l'utilisateur sans dépendre du localStorage du manager
  async function activerCompteAsync(token, pwd, uidFromUrl, agFromUrl) {
    // 1. Charger les users (Supabase > localStorage > INIT)
    var currentUsers;
    if (supabaseConfigured) {
      currentUsers = await dbLoad("users", null);
    }
    if (!currentUsers || currentUsers.length === 0) {
      currentUsers = lload(SK.users, INIT_USERS);
    }

    // 2. Retrouver l'utilisateur — via uid du lien (fiable) ou via invitation
    var targetUser = null;
    if (uidFromUrl) {
      targetUser = currentUsers.find(function(u) { return u.id===uidFromUrl; });
    }

    // Si l'utilisateur n'existe pas encore (localStorage vierge sur cet appareil),
    // on le crée à partir des infos du lien
    if (!targetUser && uidFromUrl && agFromUrl) {
      var nomFromUrl = "";
      try { nomFromUrl = decodeURIComponent(new URLSearchParams(window.location.search).get("nom")||""); } catch(e){}
      targetUser = {
        id: uidFromUrl,
        nom: nomFromUrl,
        email: "",
        password: null,
        role: "agent",
        niveau: "junior",
        agenceId: agFromUrl,
        actif: true,
        createdAt: new Date().toISOString().slice(0,10),
        avatar: nomFromUrl.split(" ").map(function(n){return n[0]||"";}).join("").slice(0,2).toUpperCase()||"AG",
        invitationAcceptee: false,
        premierAcces: true,
      };
      currentUsers = [...currentUsers, targetUser];
    }

    if (!targetUser) {
      // Dernier recours : chercher via les invitations
      var currentInvs = supabaseConfigured ? (await dbLoad("invitations", null) || lload(SK.invitations, [])) : lload(SK.invitations, []);
      var inv = currentInvs.find(function(i){ return i.token===token && !i.used; });
      if (!inv) return "Lien invalide ou expiré. Demandez un nouveau lien à votre manager.";
      targetUser = currentUsers.find(function(u){ return u.id===inv.userId; });
      if (!targetUser) return "Compte introuvable. Contactez votre manager.";
    }

    // 3. Activer le compte
    var updatedUsers = currentUsers.map(function(u) {
      return u.id===targetUser.id
        ? {...u, password:pwd, invitationAcceptee:true, premierAcces:false}
        : u;
    });

    // 4. Sauvegarder partout
    setUsersRaw(updatedUsers);
    lsave(SK.users, updatedUsers);
    if (supabaseConfigured) await dbSave("users", updatedUsers);

    // 5. Marquer invitation utilisée si on l'a en local
    var localInvs = lload(SK.invitations, []);
    var updatedInvs = localInvs.map(function(i){ return i.token===token ? {...i, used:true} : i; });
    lsave(SK.invitations, updatedInvs);
    if (supabaseConfigured) {
      var sbInvs = await dbLoad("invitations", []) || [];
      var updSbInvs = sbInvs.map(function(i){ return i.token===token ? {...i, used:true} : i; });
      await dbSave("invitations", updSbInvs);
      setInvRaw(updSbInvs);
    }

    return null;
  }
  // ─── JOURNAL D'ACTIVITÉ ──────────────────────────────────────────────────────
  function addJournal(action) {
    // action = { type, description, cible, cibleId }
    var entry = {
      id:       "j-"+Date.now(),
      ts:       new Date().toISOString(),
      userId:   currentUser ? currentUser.id   : "?",
      userNom:  currentUser ? currentUser.nom  : "?",
      userRole: currentUser ? currentUser.role : "?",
      type:        action.type        || "modification",
      description: action.description || "",
      cible:       action.cible       || "",
      cibleId:     action.cibleId     || "",
    };
    setJournal(function(prev){
      // Garder les 500 dernières entrées max
      var next = [entry, ...prev].slice(0, 500);
      return next;
    });
  }

  function handleExport() {
    exportAllData({ users, agences, mandats, locations, gestion, objectifs, prospection, tasks });
    setSaveMsg("✅ Sauvegarde exportée !");
    setTimeout(function() { setSaveMsg(null); }, 3000);
  }
  function handleImport(file) {
    importAllData(file, {
      setUsers, setMandatsRaw, setLocsRaw, setGestRaw, setObjRaw, setProspRaw, setTasksRaw,
      onSuccess: function(msg) { setSaveMsg(msg); setTimeout(function() { setSaveMsg(null); }, 4000); },
      onError:   function(msg) { setSaveMsg(msg); setTimeout(function() { setSaveMsg(null); }, 5000); },
    });
  }

  // ─── ÉCRAN CHARGEMENT ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:16,background:"#F0F4F8"}}>
      <div style={{width:48,height:48,border:"4px solid #E63946",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}></div>
      <div style={{fontWeight:700,color:"#1D3557",fontSize:15}}>{"Chargement des données partagées…"}</div>
      <div style={{fontSize:12,color:"#94A3B8"}}>{"Synchronisation Supabase en cours"}</div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  var ctx = {
    currentUser, users, agences, mandats, locations, gestion, invitations, objectifs, prospection, prospConfig, tasks, recherches, journal, offmarket, kpiConfig, feedback, tresorerie, leads, ventes, calcVente, challenges,
    setUsers, setAgences, setMandats, setLocations, setGestion, setInvitations, setObjectifs, setProspection, setProspConfig, setTasks, setRecherches, setJournal, addJournal, setOffMarket, setKpiConfig, setFeedback, setTresorerie, setVentes, setChallenges,
    handleLogout, inviterAgent, changerMotDePasse, demanderResetMdp, resetMdpParManager, handleExport, handleImport, saveMsg,
    resets, setResets, invUserId, invAgenceId, activerCompte, activerCompteAsync,
    syncMode,
    notifPerm, demanderPermission: async function(){ var r = await demanderPermission(); setNotifPerm(r); return r; },
    syncMode,
  };

  if (page==="setpassword") return (
    <AppContext.Provider value={ctx}>
      <SetPassword token={invToken} onSuccess={function() { setPage("login"); window.history.replaceState({}, "", window.location.pathname); }}/>
    </AppContext.Provider>
  );
  if (page==="firstpassword" && pendingUser) return (
    <AppContext.Provider value={ctx}>
      <FirstPassword user={pendingUser} onSuccess={handleFirstPassword} onCancel={function(){setPage("login");}}/>
    </AppContext.Provider>
  );
  if (page==="login" || !currentUser) return (
    <AppContext.Provider value={ctx}>
      <Login onLogin={handleLogin}/>
    </AppContext.Provider>
  );
  return (
    <ErrorBoundary>
    <AppContext.Provider value={ctx}>
      {currentUser.role==="superadmin" && <SuperAdminApp/>}
      {(currentUser.role==="manager" || currentUser.role==="admin") && <ManagerApp/>}
      {currentUser.role==="agent"   && <AgentApp/>}
    </AppContext.Provider>
    </ErrorBoundary>
  );
}
