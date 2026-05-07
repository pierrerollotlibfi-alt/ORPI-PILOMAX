import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Login from "./components/Login";
import ManagerApp from "./components/ManagerApp";
import AgentApp from "./components/AgentApp";
import SuperAdminApp from "./components/SuperAdminApp";
import SetPassword from "./components/SetPassword";
import FirstPassword from "./components/FirstPassword";
import { supabaseConfigured, getClient, dbLoad, dbSave, dbSubscribe } from "./supabase";
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
  { id:"agence-1", nom:"ORPI Pro Amiens",   ville:"Amiens",   adresse:"15 Rue des Trois Cailloux, 80000 Amiens", telephone:"03 22 71 00 00", email:"contact@orpi-amiens.fr",   actif:true, createdAt:daysAgo(365) },
  { id:"agence-2", nom:"ORPI Pro Doullens",  ville:"Doullens",  adresse:"Place du Général de Gaulle, 80600 Doullens", telephone:"03 22 77 00 00", email:"contact@orpi-doullens.fr",  actif:true, createdAt:daysAgo(30) },
  { id:"agence-3", nom:"ORPI Pro Corbie",    ville:"Corbie",    adresse:"5 Rue de la République, 80800 Corbie", telephone:"03 22 48 00 00", email:"contact@orpi-corbie.fr",    actif:true, createdAt:daysAgo(15) },
];
var INIT_MANDATS = [
  {
    "id": "SB-116-agence-1",
    "ref": "SB-116",
    "adresse": "Amiens",
    "proprietaireNom": "FRADCOURT",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 965000,
    "commission": 35000,
    "tauxCommission": 3.63,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-07",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-115-agence-1",
    "ref": "SB-115",
    "adresse": "Amiens",
    "proprietaireNom": "M",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 220000,
    "commission": 13200,
    "tauxCommission": 6.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-07",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-114-agence-1",
    "ref": "SB-114",
    "adresse": "Amiens",
    "proprietaireNom": "ZARIOUHI",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 228000,
    "commission": 11000,
    "tauxCommission": 4.82,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-06",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-113-agence-1",
    "ref": "SB-113",
    "adresse": "Poulainville",
    "proprietaireNom": "FRADCOURT",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 380000,
    "commission": 20000,
    "tauxCommission": 5.26,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-112-agence-1",
    "ref": "SB-112",
    "adresse": "Poulainville",
    "proprietaireNom": "FRADCOURT",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 362000,
    "commission": 18000,
    "tauxCommission": 4.97,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-111-agence-1",
    "ref": "SB-111",
    "adresse": "Amiens",
    "proprietaireNom": "VERJOT",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 76000,
    "commission": 8000,
    "tauxCommission": 10.53,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-110-agence-1",
    "ref": "SB-110",
    "adresse": "Amiens",
    "proprietaireNom": "FRATY",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 61000,
    "commission": 5000,
    "tauxCommission": 8.2,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-109-agence-1",
    "ref": "SB-109",
    "adresse": "Amiens",
    "proprietaireNom": "MORALI",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 130000,
    "commission": 8700,
    "tauxCommission": 6.69,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-108-agence-1",
    "ref": "SB-108",
    "adresse": "Amiens",
    "proprietaireNom": "WIESE",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 90000,
    "commission": 7000,
    "tauxCommission": 7.78,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-107-agence-1",
    "ref": "SB-107",
    "adresse": "Flesselles",
    "proprietaireNom": "MARTIN",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 240000,
    "commission": 9900,
    "tauxCommission": 4.12,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-05",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-106-agence-1",
    "ref": "SB-106",
    "adresse": "Rivery",
    "proprietaireNom": "VAUCHER",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 140000,
    "commission": 9000,
    "tauxCommission": 6.43,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-105-agence-1",
    "ref": "SB-105",
    "adresse": "Rivery",
    "proprietaireNom": "GATET",
    "typeBien": "local_pro_location",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 16100,
    "commission": 12600,
    "tauxCommission": 78.26,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-104-agence-1",
    "ref": "SB-104",
    "adresse": "Amiens",
    "proprietaireNom": "POUILLOT CARTON",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 239000,
    "commission": 10000,
    "tauxCommission": 4.18,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-103-agence-1",
    "ref": "SB-103",
    "adresse": "Amiens",
    "proprietaireNom": "JOLY",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 145000,
    "commission": 7000,
    "tauxCommission": 4.83,
    "agentId": "agent-cedric",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-102-agence-1",
    "ref": "SB-102",
    "adresse": "Amiens",
    "proprietaireNom": "BROTTE",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 115000,
    "commission": 10000,
    "tauxCommission": 8.7,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-101-agence-1",
    "ref": "SB-101",
    "adresse": "Candas",
    "proprietaireNom": "BECLIN",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 140000,
    "commission": 10000,
    "tauxCommission": 7.14,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-100-agence-1",
    "ref": "SB-100",
    "adresse": "Rainneville",
    "proprietaireNom": "PRIME DEVELOPPEMENT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 375000,
    "commission": 15000,
    "tauxCommission": 4.0,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-99-agence-1",
    "ref": "SB-99",
    "adresse": "Amiens",
    "proprietaireNom": "RIFFLART",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 655000,
    "commission": 20000,
    "tauxCommission": 3.05,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-98-agence-1",
    "ref": "SB-98",
    "adresse": "Amiens",
    "proprietaireNom": "WADLOW",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 640000,
    "commission": 25000,
    "tauxCommission": 3.91,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-05-04",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-97-agence-1",
    "ref": "SB-97",
    "adresse": "Salouël",
    "proprietaireNom": "LEGOUEZ",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 235849,
    "commission": 14150,
    "tauxCommission": 6.0,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-29",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-96-agence-1",
    "ref": "SB-96",
    "adresse": "Glisy",
    "proprietaireNom": "JEAN FRANCOIS",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 400000,
    "commission": 20000,
    "tauxCommission": 5.0,
    "agentId": "agent-cedric",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-29",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-95-agence-1",
    "ref": "SB-95",
    "adresse": "Amiens",
    "proprietaireNom": "CARRE",
    "typeBien": "local_pro_vente",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 570000,
    "commission": 30000,
    "tauxCommission": 5.26,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-29",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-94-agence-1",
    "ref": "SB-94",
    "adresse": "Amiens",
    "proprietaireNom": "LOMBART",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 95000,
    "commission": 6000,
    "tauxCommission": 6.32,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-29",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-93-agence-1",
    "ref": "SB-93",
    "adresse": "Amiens",
    "proprietaireNom": "MAURICIO",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 400000,
    "commission": 15000,
    "tauxCommission": 3.75,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-28",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-92-agence-1",
    "ref": "SB-92",
    "adresse": "Amiens",
    "proprietaireNom": "MME",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1260000,
    "commission": 35000,
    "tauxCommission": 2.78,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-28",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-91-agence-1",
    "ref": "SB-91",
    "adresse": "Amiens",
    "proprietaireNom": "HASSAN",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 181000,
    "commission": 9000,
    "tauxCommission": 4.97,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-28",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-90-agence-1",
    "ref": "SB-90",
    "adresse": "Amiens",
    "proprietaireNom": "RICHET",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 308000,
    "commission": 12000,
    "tauxCommission": 3.9,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-28",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-89-agence-1",
    "ref": "SB-89",
    "adresse": "Amiens",
    "proprietaireNom": "PATRICK",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 300000,
    "commission": 15000,
    "tauxCommission": 5.0,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-27",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-88-agence-1",
    "ref": "SB-88",
    "adresse": "Oresmaux",
    "proprietaireNom": "DESMAREST",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 235000,
    "commission": 13500,
    "tauxCommission": 5.74,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-27",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-87-agence-1",
    "ref": "SB-87",
    "adresse": "Dreuil-Lès-Amiens",
    "proprietaireNom": "DELAVISSE",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 185000,
    "commission": 11100,
    "tauxCommission": 6.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-27",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-86-agence-1",
    "ref": "SB-86",
    "adresse": "Amiens",
    "proprietaireNom": "CARRE",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 999,
    "commission": 594,
    "tauxCommission": 59.46,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-26",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-85-agence-1",
    "ref": "SB-85",
    "adresse": "Amiens",
    "proprietaireNom": "CARRE",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 984,
    "commission": 594,
    "tauxCommission": 60.37,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-26",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-84-agence-1",
    "ref": "SB-84",
    "adresse": "Amiens",
    "proprietaireNom": "XAVIER",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1894,
    "commission": 814,
    "tauxCommission": 42.98,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-25",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-83-agence-1",
    "ref": "SB-83",
    "adresse": "Hébecourt",
    "proprietaireNom": "BROTTE",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 380000,
    "commission": 19000,
    "tauxCommission": 5.0,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-24",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-82-agence-1",
    "ref": "SB-82",
    "adresse": "Amiens",
    "proprietaireNom": "SYNEK",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 248000,
    "commission": 9000,
    "tauxCommission": 3.63,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-24",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-81-agence-1",
    "ref": "SB-81",
    "adresse": "Amiens",
    "proprietaireNom": "BEL BARAKA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 205741,
    "commission": 9258,
    "tauxCommission": 4.5,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-24",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-80-agence-1",
    "ref": "SB-80",
    "adresse": "Amiens",
    "proprietaireNom": "CAULET",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 220000,
    "commission": 13200,
    "tauxCommission": 6.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-24",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-79-agence-1",
    "ref": "SB-79",
    "adresse": "Glisy",
    "proprietaireNom": "MILHAUD",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 690000,
    "commission": 30000,
    "tauxCommission": 4.35,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-22",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-78-agence-1",
    "ref": "SB-78",
    "adresse": "Amiens",
    "proprietaireNom": "MESSAGER",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 402426,
    "commission": 35573,
    "tauxCommission": 8.84,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-22",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-77-agence-1",
    "ref": "SB-77",
    "adresse": "Bayonvillers",
    "proprietaireNom": "MASCRE",
    "typeBien": "terrain",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 45000,
    "commission": 4900,
    "tauxCommission": 10.89,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-22",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-76-agence-1",
    "ref": "SB-76",
    "adresse": "Amiens",
    "proprietaireNom": "DEBOUT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 490000,
    "commission": 20000,
    "tauxCommission": 4.08,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-21",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-75-agence-1",
    "ref": "SB-75",
    "adresse": "Amiens",
    "proprietaireNom": "ABDELLATIF",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 175000,
    "commission": 10000,
    "tauxCommission": 5.71,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-21",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-74-agence-1",
    "ref": "SB-74",
    "adresse": "Amiens",
    "proprietaireNom": "LEPETIT",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 230000,
    "commission": 13000,
    "tauxCommission": 5.65,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-20",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-73-agence-1",
    "ref": "SB-73",
    "adresse": "Amiens",
    "proprietaireNom": "VANDEWEGHE",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 149000,
    "commission": 10000,
    "tauxCommission": 6.71,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-20",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-72-agence-1",
    "ref": "SB-72",
    "adresse": "Amiens",
    "proprietaireNom": "CUADRADO",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 135000,
    "commission": 7000,
    "tauxCommission": 5.19,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-19",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-71-agence-1",
    "ref": "SB-71",
    "adresse": "Amiens",
    "proprietaireNom": "BLOC",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 2236,
    "commission": 1386,
    "tauxCommission": 61.99,
    "agentId": "agent-karine",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-17",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-70-agence-1",
    "ref": "SB-70",
    "adresse": "Amiens",
    "proprietaireNom": "EL GANA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 2102,
    "commission": 1452,
    "tauxCommission": 69.08,
    "agentId": "agent-karine",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-16",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-69-agence-1",
    "ref": "SB-69",
    "adresse": "Amiens",
    "proprietaireNom": "THIBAUT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 310000,
    "commission": 12000,
    "tauxCommission": 3.87,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-16",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-68-agence-1",
    "ref": "SB-68",
    "adresse": "Amiens",
    "proprietaireNom": "SPICHER",
    "typeBien": "local_pro_vente",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 89000,
    "commission": 7000,
    "tauxCommission": 7.87,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-16",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-67-agence-1",
    "ref": "SB-67",
    "adresse": "Amiens",
    "proprietaireNom": "BENZERIGA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1309000,
    "commission": 40000,
    "tauxCommission": 3.06,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-14",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-66-agence-1",
    "ref": "SB-66",
    "adresse": "Amiens",
    "proprietaireNom": "LES LICORNES BLANCHES",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 280000,
    "commission": 12000,
    "tauxCommission": 4.29,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-14",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-65-agence-1",
    "ref": "SB-65",
    "adresse": "Marieux",
    "proprietaireNom": "PARMENTIER",
    "typeBien": "terrain",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 50000,
    "commission": 6000,
    "tauxCommission": 12.0,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-14",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-63-agence-1",
    "ref": "SB-63",
    "adresse": "Amiens",
    "proprietaireNom": "HELENE-GAMA",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 137735,
    "commission": 8264,
    "tauxCommission": 6.0,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-13",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-62-agence-1",
    "ref": "SB-62",
    "adresse": "Amiens",
    "proprietaireNom": "SUEUR",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 360000,
    "commission": 18000,
    "tauxCommission": 5.0,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-13",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-61-agence-1",
    "ref": "SB-61",
    "adresse": "Amiens",
    "proprietaireNom": "MANGIN",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 120000,
    "commission": 8000,
    "tauxCommission": 6.67,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-13",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-60-agence-1",
    "ref": "SB-60",
    "adresse": "Amiens",
    "proprietaireNom": "DORE",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 235000,
    "commission": 10000,
    "tauxCommission": 4.26,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-12",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-59-agence-1",
    "ref": "SB-59",
    "adresse": "Amiens",
    "proprietaireNom": "DAMBREVILLE",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 120000,
    "commission": 7000,
    "tauxCommission": 5.83,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-12",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-58-agence-1",
    "ref": "SB-58",
    "adresse": "Amiens",
    "proprietaireNom": "ROUSSEAU",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 115000,
    "commission": 6000,
    "tauxCommission": 5.22,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-12",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-57-agence-1",
    "ref": "SB-57",
    "adresse": "Amiens",
    "proprietaireNom": "DRUJON",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 305000,
    "commission": 19000,
    "tauxCommission": 6.23,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-12",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-56-agence-1",
    "ref": "SB-56",
    "adresse": "Boves",
    "proprietaireNom": "SMAGACZ",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 209000,
    "commission": 10000,
    "tauxCommission": 4.78,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-11",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-55-agence-1",
    "ref": "SB-55",
    "adresse": "Daours",
    "proprietaireNom": "LEJAY ÉPOUSE MOLLIENS",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 270000,
    "commission": 13500,
    "tauxCommission": 5.0,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-11",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-54-agence-1",
    "ref": "SB-54",
    "adresse": "Amiens",
    "proprietaireNom": "DELORMEL",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 100500,
    "commission": 9000,
    "tauxCommission": 8.96,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-53-agence-1",
    "ref": "SB-53",
    "adresse": "Amiens",
    "proprietaireNom": "POTTIER",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 250000,
    "commission": 12500,
    "tauxCommission": 5.0,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-52-agence-1",
    "ref": "SB-52",
    "adresse": "Amiens",
    "proprietaireNom": "VERJOT",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 90000,
    "commission": 8000,
    "tauxCommission": 8.89,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-51-agence-1",
    "ref": "SB-51",
    "adresse": "Saint-Christ-Briost",
    "proprietaireNom": "LIN",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 78000,
    "commission": 7000,
    "tauxCommission": 8.97,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-50-agence-1",
    "ref": "SB-50",
    "adresse": "Amiens",
    "proprietaireNom": "FROSSARD",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 170000,
    "commission": 10000,
    "tauxCommission": 5.88,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-49-agence-1",
    "ref": "SB-49",
    "adresse": "Amiens",
    "proprietaireNom": "DUBOIS",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 314000,
    "commission": 12000,
    "tauxCommission": 3.82,
    "agentId": "agent-nathalie",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-10",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-48-agence-1",
    "ref": "SB-48",
    "adresse": "Saint-Fuscien",
    "proprietaireNom": "BEKHOUCHE",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 385000,
    "commission": 15000,
    "tauxCommission": 3.9,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-47-agence-1",
    "ref": "SB-47",
    "adresse": "Amiens",
    "proprietaireNom": "DO NASCIMENTO GUEDES",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 810,
    "commission": 320,
    "tauxCommission": 39.51,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-46-agence-1",
    "ref": "SB-46",
    "adresse": "Amiens",
    "proprietaireNom": "LUTZ",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1070,
    "commission": 480,
    "tauxCommission": 44.86,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-45-agence-1",
    "ref": "SB-45",
    "adresse": "Amiens",
    "proprietaireNom": "FINET",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 2810,
    "commission": 1360,
    "tauxCommission": 48.4,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-44-agence-1",
    "ref": "SB-44",
    "adresse": "Amiens",
    "proprietaireNom": "GODEFROY",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1012,
    "commission": 462,
    "tauxCommission": 45.65,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-42-agence-1",
    "ref": "SB-42",
    "adresse": "Amiens",
    "proprietaireNom": "DO NASCIMENTO GUEDES",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1124,
    "commission": 604,
    "tauxCommission": 53.74,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-41-agence-1",
    "ref": "SB-41",
    "adresse": "Amiens",
    "proprietaireNom": "HERLIN",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 599000,
    "commission": 21000,
    "tauxCommission": 3.51,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-09",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-40-agence-1",
    "ref": "SB-40",
    "adresse": "Amiens",
    "proprietaireNom": "ANDRIEU",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 335000,
    "commission": 15000,
    "tauxCommission": 4.48,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-39-agence-1",
    "ref": "SB-39",
    "adresse": "Amiens",
    "proprietaireNom": "PRIME DEVELOPPEMENT",
    "typeBien": "local_pro_location",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 4450,
    "commission": 3500,
    "tauxCommission": 78.65,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-38-agence-1",
    "ref": "SB-38",
    "adresse": "Amiens",
    "proprietaireNom": "VAQUEZ",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 275000,
    "commission": 16500,
    "tauxCommission": 6.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-37-agence-1",
    "ref": "SB-37",
    "adresse": "Dreuil-Lès-Amiens",
    "proprietaireNom": "SCHOREISZ",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 180000,
    "commission": 10800,
    "tauxCommission": 6.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-36-agence-1",
    "ref": "SB-36",
    "adresse": "Amiens",
    "proprietaireNom": "RIGOLLE",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 170000,
    "commission": 9000,
    "tauxCommission": 5.29,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-35-agence-1",
    "ref": "SB-35",
    "adresse": "Amiens",
    "proprietaireNom": "BERTON-DESMET",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 150000,
    "commission": 7500,
    "tauxCommission": 5.0,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-34-agence-1",
    "ref": "SB-34",
    "adresse": "Amiens",
    "proprietaireNom": "SOINNE",
    "typeBien": "garage",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 14000,
    "commission": 2500,
    "tauxCommission": 17.86,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-33-agence-1",
    "ref": "SB-33",
    "adresse": "Amiens",
    "proprietaireNom": "SOUPLY",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 700,
    "commission": 1100,
    "tauxCommission": 157.14,
    "agentId": "agent-karine",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-32-agence-1",
    "ref": "SB-32",
    "adresse": "Amiens",
    "proprietaireNom": "LÉCOT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 265000,
    "commission": 15000,
    "tauxCommission": 5.66,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-31-agence-1",
    "ref": "SB-31",
    "adresse": "Amiens",
    "proprietaireNom": "EL GANA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 80000,
    "commission": 6000,
    "tauxCommission": 7.5,
    "agentId": "agent-cedric",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-30-agence-1",
    "ref": "SB-30",
    "adresse": "Amiens",
    "proprietaireNom": "FRANCIS",
    "typeBien": "local_pro_location",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 10865,
    "commission": 8640,
    "tauxCommission": 79.52,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-28-agence-1",
    "ref": "SB-28",
    "adresse": "Herissart",
    "proprietaireNom": "MOREL",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 265000,
    "commission": 14000,
    "tauxCommission": 5.28,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-27-agence-1",
    "ref": "SB-27",
    "adresse": "Amiens",
    "proprietaireNom": "EL KORCHI",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 80000,
    "commission": 8000,
    "tauxCommission": 10.0,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-08",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-26-agence-1",
    "ref": "SB-26",
    "adresse": "Amiens",
    "proprietaireNom": "BENZERIGA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 1309000,
    "commission": 40000,
    "tauxCommission": 3.06,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-07",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-25-agence-1",
    "ref": "SB-25",
    "adresse": "Amiens",
    "proprietaireNom": "2D2M",
    "typeBien": "local_pro_vente",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 350000,
    "commission": 20000,
    "tauxCommission": 5.71,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-07",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-24-agence-1",
    "ref": "SB-24",
    "adresse": "Amiens",
    "proprietaireNom": "PETIGNY",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 100000,
    "commission": 7000,
    "tauxCommission": 7.0,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-07",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-23-agence-1",
    "ref": "SB-23",
    "adresse": "Amiens",
    "proprietaireNom": "LETIERCE",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 3172,
    "commission": 2222,
    "tauxCommission": 70.05,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-06",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-22-agence-1",
    "ref": "SB-22",
    "adresse": "Amiens",
    "proprietaireNom": "GAUDEFROY",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 670000,
    "commission": 20000,
    "tauxCommission": 2.99,
    "agentId": "agent-cedric",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-21-agence-1",
    "ref": "SB-21",
    "adresse": "Rainneville",
    "proprietaireNom": "PRIME DEVELOPPEMENT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 286000,
    "commission": 14000,
    "tauxCommission": 4.9,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-20-agence-1",
    "ref": "SB-20",
    "adresse": "Amiens",
    "proprietaireNom": "EL GANA",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 450000,
    "commission": 20000,
    "tauxCommission": 4.44,
    "agentId": "agent-cedric",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-19-agence-1",
    "ref": "SB-19",
    "adresse": "Amiens",
    "proprietaireNom": "NOÉMIE",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 235000,
    "commission": 10000,
    "tauxCommission": 4.26,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-18-agence-1",
    "ref": "SB-18",
    "adresse": "Amiens",
    "proprietaireNom": "ANDRÉ",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 856,
    "commission": 416,
    "tauxCommission": 48.6,
    "agentId": "agent-karine",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-17-agence-1",
    "ref": "SB-17",
    "adresse": "Amiens",
    "proprietaireNom": "JAKUBOWICZ",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 259500,
    "commission": 12500,
    "tauxCommission": 4.82,
    "agentId": "agent-clement",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-03",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-16-agence-1",
    "ref": "SB-16",
    "adresse": "Villers Bretonneux",
    "proprietaireNom": "DELIENS",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 210000,
    "commission": 10000,
    "tauxCommission": 4.76,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-02",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-15-agence-1",
    "ref": "SB-15",
    "adresse": "Herissart",
    "proprietaireNom": "SOPHIE MOREL",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 255000,
    "commission": 13500,
    "tauxCommission": 5.29,
    "agentId": "manager-2",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-02",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-14-agence-1",
    "ref": "SB-14",
    "adresse": "Amiens",
    "proprietaireNom": "DAVID",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 366000,
    "commission": 16000,
    "tauxCommission": 4.37,
    "agentId": "agent-laetitia",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-02",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-13-agence-1",
    "ref": "SB-13",
    "adresse": "Amiens",
    "proprietaireNom": "RENOULT",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 360000,
    "commission": 14000,
    "tauxCommission": 3.89,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-02",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-12-agence-1",
    "ref": "SB-12",
    "adresse": "Amiens",
    "proprietaireNom": "VIRGINIE MACREZ",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 115000,
    "commission": 6900,
    "tauxCommission": 6.0,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-11-agence-1",
    "ref": "SB-11",
    "adresse": "Vaux-En-Amiénois",
    "proprietaireNom": "GODARD",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 197000,
    "commission": 12600,
    "tauxCommission": 6.4,
    "agentId": "agent-pascal",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-10-agence-1",
    "ref": "SB-10",
    "adresse": "Amiens",
    "proprietaireNom": "CACHELEUX",
    "typeBien": "fonds_commerce",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 30000,
    "commission": 9000,
    "tauxCommission": 30.0,
    "agentId": "manager-1",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-9-agence-1",
    "ref": "SB-9",
    "adresse": "Amiens",
    "proprietaireNom": "HEIVA CHAPPEY",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 270000,
    "commission": 12000,
    "tauxCommission": 4.44,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-8-agence-1",
    "ref": "SB-8",
    "adresse": "Amiens",
    "proprietaireNom": "PRACHE",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 200000,
    "commission": 10000,
    "tauxCommission": 5.0,
    "agentId": "agent-hugo",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-7-agence-1",
    "ref": "SB-7",
    "adresse": "Amiens",
    "proprietaireNom": "GENTEUR",
    "typeBien": "appartement",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 405000,
    "commission": 20000,
    "tauxCommission": 4.94,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-04-01",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-6-agence-1",
    "ref": "SB-6",
    "adresse": "Amiens",
    "proprietaireNom": "XAVIER",
    "typeBien": "maison",
    "typeMandat": "exclusif",
    "statut": "mandat",
    "prix": 230000,
    "commission": 10000,
    "tauxCommission": 4.35,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-03-31",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-5-agence-1",
    "ref": "SB-5",
    "adresse": "Amiens",
    "proprietaireNom": "VALZAN",
    "typeBien": "appartement",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 105000,
    "commission": 8400,
    "tauxCommission": 8.0,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-03-31",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-4-agence-1",
    "ref": "SB-4",
    "adresse": "Amiens",
    "proprietaireNom": "LEJALLE",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 165094,
    "commission": 9905,
    "tauxCommission": 6.0,
    "agentId": "agent-landry",
    "agenceId": "agence-1",
    "dateMandat": "2026-03-31",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
  },
  {
    "id": "SB-3-agence-1",
    "ref": "SB-3",
    "adresse": "Amiens",
    "proprietaireNom": "DE COLNET",
    "typeBien": "maison",
    "typeMandat": "simple",
    "statut": "mandat",
    "prix": 580000,
    "commission": 18000,
    "tauxCommission": 3.1,
    "agentId": "agent-isabelle",
    "agenceId": "agence-1",
    "dateMandat": "2026-03-31",
    "source": "sweepbright",
    "coAgents": [],
    "visites": []
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
  var [journal2,    setJournal2Raw]  = useState(function(){ return lload(SK.journal, []); });

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
          c.setter(data);
          lsave(c.sk, data);
        } else {
          var local = lload(c.sk, c.init);
          dbSave(c.name, local);
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
      dbSubscribe("users",       function(v){ setUsersRaw(v); lsave(SK.users, v); }),
      dbSubscribe("mandats",     function(v){ setMandatsRaw(v); lsave(SK.mandats, v); }),
      dbSubscribe("locations",   function(v){ setLocsRaw(v); lsave(SK.locations, v); }),
      dbSubscribe("gestion",     function(v){ setGestRaw(v); lsave(SK.gestion, v); }),
      dbSubscribe("invitations", function(v){ setInvRaw(v); lsave(SK.invitations, v); }),
      dbSubscribe("objectifs",   function(v){ setObjRaw(v); lsave(SK.objectifs, v); }),
      dbSubscribe("prospection", function(v){ setProspRaw(v); lsave(SK.prospection, v); }),
      dbSubscribe("tasks",       function(v){ setTasksRaw(v); lsave(SK.tasks, v); }),
      dbSubscribe("recherches",  function(v){ setRechercheRaw(v); lsave(SK.recherches, v); }),
      dbSubscribe("journal",      function(v){ setJournalRaw(v);  lsave(SK.journal, v);     }),
      dbSubscribe("resets",       function(v){ setResetsRaw(v);  lsave(SK.resets, v);      }),
    ];
    return function() { unsubs.forEach(function(u){ u && u(); }); };
  }, []);

  // ─── SETTERS (écrivent local + Supabase) ─────────────────────────────────────
  var setUsers       = useCallback(function(u){ var v=typeof u==="function"?u(users):u;       setUsersRaw(v);    lsave(SK.users,v);       if(supabaseConfigured)dbSave("users",v);       },[users]);
  var setAgences     = useCallback(function(u){ var v=typeof u==="function"?u(agences):u;     setAgencesRaw(v);  lsave(SK.agences,v);     if(supabaseConfigured)dbSave("agences",v);     },[agences]);
  var setMandats     = useCallback(function(u){ var v=typeof u==="function"?u(mandats):u;     setMandatsRaw(v);  lsave(SK.mandats,v);     if(supabaseConfigured)dbSave("mandats",v);     },[mandats]);
  var setLocations   = useCallback(function(u){ var v=typeof u==="function"?u(locations):u;   setLocsRaw(v);     lsave(SK.locations,v);   if(supabaseConfigured)dbSave("locations",v);   },[locations]);
  var setGestion     = useCallback(function(u){ var v=typeof u==="function"?u(gestion):u;     setGestRaw(v);     lsave(SK.gestion,v);     if(supabaseConfigured)dbSave("gestion",v);     },[gestion]);
  var setInvitations = useCallback(function(u){ var v=typeof u==="function"?u(invitations):u; setInvRaw(v);      lsave(SK.invitations,v); if(supabaseConfigured)dbSave("invitations",v); },[invitations]);
  var setObjectifs   = useCallback(function(u){ var v=typeof u==="function"?u(objectifs):u;   setObjRaw(v);      lsave(SK.objectifs,v);   if(supabaseConfigured)dbSave("objectifs",v);   },[objectifs]);
  var setProspection = useCallback(function(u){ var v=typeof u==="function"?u(prospection):u; setProspRaw(v);    lsave(SK.prospection,v); if(supabaseConfigured)dbSave("prospection",v); },[prospection]);
  var setProspConfig = useCallback(function(u){ var v=typeof u==="function"?u(prospConfig):u; setProspCfgRaw(v); lsave(SK.prospConfig,v); if(supabaseConfigured)dbSave("prospConfig",v); },[prospConfig]);
  var setTasks       = useCallback(function(u){ var v=typeof u==="function"?u(tasks):u;       setTasksRaw(v);    lsave(SK.tasks,v);       if(supabaseConfigured)dbSave("tasks",v);       },[tasks]);
  var setRecherches  = useCallback(function(u){ var v=typeof u==="function"?u(recherches):u;  setRechercheRaw(v);lsave(SK.recherches,v);if(supabaseConfigured)dbSave("recherches",v);},[recherches]);
  var setJournal     = useCallback(function(u){ var v=typeof u==="function"?u(journal):u;       setJournalRaw(v);  lsave(SK.journal,v);   if(supabaseConfigured)dbSave("journal",v);     },[journal]);
  var setResets      = useCallback(function(u){ var v=typeof u==="function"?u(resets):u;        setResetsRaw(v);   lsave(SK.resets,v);    if(supabaseConfigured)dbSave("resets",v);      },[resets]);
  var setOffMarket   = useCallback(function(u){ var v=typeof u==="function"?u(offmarket):u;    setOffMktRaw(v);   lsave(SK.offmarket,v); if(supabaseConfigured)dbSave("offmarket",v);  },[offmarket]);
  var setKpiConfig   = useCallback(function(u){ var v=typeof u==="function"?u(kpiConfig):u;    setKpiCfgRaw(v);   lsave(SK.kpiConfig,v); if(supabaseConfigured)dbSave("kpiConfig",v); },[kpiConfig]);
  var setFeedback    = useCallback(function(u){ var v=typeof u==="function"?u(feedback):u;     setFeedbackRaw(v);  lsave(SK.feedback,v);  if(supabaseConfigured)dbSave("feedback",v);  },[feedback]);

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
    setUsers(function(prev){ return prev.map(function(u){ return u.id===userId ? {...u, password:newPwd} : u; }); });
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
    currentUser, users, agences, mandats, locations, gestion, invitations, objectifs, prospection, prospConfig, tasks, recherches, journal, offmarket, kpiConfig, feedback,
    setUsers, setAgences, setMandats, setLocations, setGestion, setInvitations, setObjectifs, setProspection, setProspConfig, setTasks, setRecherches, setJournal, addJournal, setOffMarket, setKpiConfig, setFeedback,
    handleLogout, inviterAgent, changerMotDePasse, demanderResetMdp, resetMdpParManager, handleExport, handleImport, saveMsg,
    resets, setResets,
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
    <AppContext.Provider value={ctx}>
      {currentUser.role==="superadmin" && <SuperAdminApp/>}
      {currentUser.role==="manager" && <ManagerApp/>}
      {currentUser.role==="agent"   && <AgentApp/>}
    </AppContext.Provider>
  );
}
