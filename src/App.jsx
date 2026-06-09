import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
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
  { id:"agence-1", nom:"ORPI Pro Amiens",   ville:"Amiens",   adresse:"15 Rue des Trois Cailloux, 80000 Amiens", telephone:"03 22 71 00 00", email:"contact@orpi-amiens.fr",   actif:true, createdAt:daysAgo(365) },
  { id:"agence-2", nom:"ORPI Pro Doullens",  ville:"Doullens",  adresse:"Place du Général de Gaulle, 80600 Doullens", telephone:"03 22 77 00 00", email:"contact@orpi-doullens.fr",  actif:true, createdAt:daysAgo(30) },
  { id:"agence-3", nom:"ORPI Pro Corbie",    ville:"Corbie",    adresse:"5 Rue de la République, 80800 Corbie", telephone:"03 22 48 00 00", email:"contact@orpi-corbie.fr",    actif:true, createdAt:daysAgo(15) },
];
var ADRESSE_MAP = {"SB-138": {"adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles", "proprietaireNom": "JULIEN ROCHE CHEVALIER"}, "SB-137": {"adresse": "18 Rue Gresset, 80000 Amiens", "proprietaireNom": "Yann capart"}, "SB-136": {"adresse": "2 Rue Delambre, 80000 Amiens", "proprietaireNom": "Romuald Jimenez"}, "SB-135": {"adresse": "211 Rue Jules Barni, 80000 Amiens", "proprietaireNom": "Lauriane Dudzik"}, "SB-134": {"adresse": "20 Rue Gustave Flaubert, 80080 Amiens", "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD"}, "SB-133": {"adresse": "1 Rue Gresset, 80000 Amiens", "proprietaireNom": "BUQUET JEAN FRANCOIS"}, "SB-132": {"adresse": "262 rue jules ferry amiens, 80000 Amiens", "proprietaireNom": "ali abdesmed"}, "SB-131": {"adresse": "35 Avenue du Royaume-Uni, 80090 Amiens", "proprietaireNom": "Florence HERBET"}, "SB-130": {"adresse": "35 Avenue du Royaume-Uni, 80090 Amiens", "proprietaireNom": "Florence HERBET"}, "SB-129": {"adresse": "62 Rue Debaussaux, 80000 Amiens", "proprietaireNom": "THIERRY GRANDMOUGIN"}, "SB-128": {"adresse": "9 Rue de la Hotoie, 80000 Amiens", "proprietaireNom": "Oumar Ndoye"}, "SB-127": {"adresse": "96 Rue Dupont Bacqueville, 80000 Amiens", "proprietaireNom": "Thibaut MARIE"}, "SB-126": {"adresse": "3 allée sablée, 80000 amiens", "proprietaireNom": "aline VERJOT"}, "SB-125": {"adresse": "18 Rue Gresset, 80000 Amiens", "proprietaireNom": "andre Andrieu"}, "SB-124": {"adresse": "4 Boulevard des Fédérés, 80000 Amiens", "proprietaireNom": "Thomas Didier"}, "SB-123": {"adresse": "2 Rue Duthoit, 80000 Amiens", "proprietaireNom": "SCI Jubert portejoie"}, "SB-122": {"adresse": "47 Rue des 3 Cailloux, 80000 Amiens", "proprietaireNom": "marie lepetit"}, "SB-121": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-120": {"adresse": "21 rue Francois Villon, 80000 Amiens", "proprietaireNom": "Sophie Drujon"}, "SB-119": {"adresse": "5 8 rue de l'Amiral Courejolles, 80000 Amiens", "proprietaireNom": "Mme CAULET"}, "SB-118": {"adresse": "96 Rue Dupont Bacqueville, 80000 Amiens", "proprietaireNom": "Thibaut MARIE"}, "SB-117": {"adresse": "9 du bellay, 80000 amiens", "proprietaireNom": "virginie macrez"}, "SB-116": {"adresse": "105 Chaussée Saint-Pierre, 80080 Amiens", "proprietaireNom": "pascal fradcourt"}, "SB-115": {"adresse": "324 route de paris, 80000 Amiens", "proprietaireNom": "Medhi BEL BARAKA"}, "SB-114": {"adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles", "proprietaireNom": "JULIEN ROCHE CHEVALIER"}, "SB-113": {"adresse": "161 Rue du Faubourg de Hem, 80000 Amiens", "proprietaireNom": "Cecile PEYROT"}, "SB-112": {"adresse": "161 Rue du Faubourg de Hem, 80000 Amiens", "proprietaireNom": "Cecile PEYROT"}, "SB-111": {"adresse": "5 allée sablée, 80000 Amiens", "proprietaireNom": "aline VERJOT"}, "SB-110": {"adresse": "97 Rue Laurendeau, 80000 Amiens", "proprietaireNom": "Stéphane et Marie FRATY"}, "SB-109": {"adresse": "9 Rue Philippe de Girard, 80000 Amiens", "proprietaireNom": "Eric Dambreville"}, "SB-108": {"adresse": "52 Rue du Don, 80000 Amiens", "proprietaireNom": "Maxence WIESE"}, "SB-107": {"adresse": "357 Rue de Cagny, 80090 Amiens", "proprietaireNom": "Maximilien Dore"}, "SB-106": {"adresse": "27 Rue Lamartine, 80000 Amiens", "proprietaireNom": "Clovis Cuadrado"}, "SB-105": {"adresse": "11 Rue des Francs Mûriers, 80000 Amiens", "proprietaireNom": "SCI NOTRE DAME SOINNE"}, "SB-104": {"adresse": "357 Rue de Cagny, 80090 Amiens", "proprietaireNom": "Maximilien Dore"}, "SB-103": {"adresse": "61 Allée des Tisserands, 80000 Amiens", "proprietaireNom": "Martine Joly"}, "SB-102": {"adresse": "11 Allée de la Tête d'Or, 80000 AMIENS", "proprietaireNom": "Fréderic et Alexandra PICARD"}, "SB-101": {"adresse": "60 Rue Jean Racine, 80090 Amiens", "proprietaireNom": "Florence HERBET"}, "SB-100": {"adresse": "161 Rue du Faubourg de Hem, 80000 Amiens", "proprietaireNom": "Cecile PEYROT"}, "SB-99": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-98": {"adresse": "1 Rue du Cloître de la Barge, 80000 Amiens", "proprietaireNom": "SCI DADS Souply"}, "SB-97": {"adresse": "12 Avenue Jean Jaurès, 80480 Salouël", "proprietaireNom": "LEGOUEZ Mme / Willy LEGOUEZ"}, "SB-96": {"adresse": "734 Route Nationale, 80260 Poulainville", "proprietaireNom": "pascal fradcourt"}, "SB-95": {"adresse": "18 Rue Gresset, 80000 Amiens", "proprietaireNom": "Yann capart"}, "SB-94": {"adresse": "3 allée sablée, 80000 amiens", "proprietaireNom": "aline VERJOT"}, "SB-93": {"adresse": "19 Rés le Pré Joly, 80680 Hébecourt", "proprietaireNom": "Michel Brotte"}, "SB-92": {"adresse": "12 Avenue Jean Jaurès, 80480 Salouël", "proprietaireNom": "LEGOUEZ Mme / Willy LEGOUEZ"}, "SB-91": {"adresse": "20 Rue Gustave Flaubert, 80080 Amiens", "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD"}, "SB-90": {"adresse": "133 Rue Vulfran Warmé, 80000 Amiens", "proprietaireNom": "Yohann RICHET"}, "SB-89": {"adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens", "proprietaireNom": "Patricia DELAVISSE"}, "SB-88": {"adresse": "40 Rue Milton, 80000 Amiens", "proprietaireNom": "M CHRIS"}, "SB-87": {"adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens", "proprietaireNom": "Patricia DELAVISSE"}, "SB-86": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-85": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-84": {"adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens", "proprietaireNom": "Orlando Xavier"}, "SB-83": {"adresse": "161 Rue du Faubourg de Hem, 80000 Amiens", "proprietaireNom": "Cecile PEYROT"}, "SB-82": {"adresse": "77 Rue Lapostolle, 80000 Amiens", "proprietaireNom": "Régis Synek"}, "SB-81": {"adresse": "324 route de paris, 80000 Amiens", "proprietaireNom": "Medhi BEL BARAKA"}, "SB-80": {"adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles", "proprietaireNom": "JULIEN ROCHE CHEVALIER"}, "SB-79": {"adresse": "18 rue des Trémieres, 80440 Glisy", "proprietaireNom": "Fabien Milhaud"}, "SB-78": {"adresse": "19 Rés le Pré Joly, 80680 Hébecourt", "proprietaireNom": "Michel Brotte"}, "SB-77": {"adresse": "33 Rue Pierre Lefebvre, 80560 Mailly-Maillet", "proprietaireNom": "Erwan PERES"}, "SB-75": {"adresse": "12 Rue René Coty, 80080 Amiens", "proprietaireNom": "Seyho Yaldiz"}, "SB-74": {"adresse": "47 Rue des 3 Cailloux, 80000 Amiens", "proprietaireNom": "marie lepetit"}, "SB-73": {"adresse": "61 Allée des Tisserands, 80000 Amiens", "proprietaireNom": "Martine Joly"}, "SB-72": {"adresse": "27 Rue Lamartine, 80000 Amiens", "proprietaireNom": "Clovis Cuadrado"}, "SB-71": {"adresse": "19 Rés le Pré Joly, 80680 Hébecourt", "proprietaireNom": "Michel Brotte"}, "SB-70": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-69": {"adresse": "133 Rue Vulfran Warmé, 80000 Amiens", "proprietaireNom": "Yohann RICHET"}, "SB-68": {"adresse": "11 Rue Antoine de Saint-Exupéry, 80480 Salouël", "proprietaireNom": "mentim sci"}, "SB-67": {"adresse": "16 Rue Debray, 80000 Amiens", "proprietaireNom": "VANDANGE"}, "SB-66": {"adresse": "47 Rue d'Amiens, 80800 Daours", "proprietaireNom": "Armelle LEJAY épouse MOLLIENS"}, "SB-65": {"adresse": "22 rue de raincheval, 80560 marieux", "proprietaireNom": "Samuel Parmentier"}, "SB-63": {"adresse": "9 Rue de la Hotoie, 80000 Amiens", "proprietaireNom": "Oumar Ndoye"}, "SB-62": {"adresse": "2 rue des vergeaux, 80000 amiens", "proprietaireNom": "andre Andrieu"}, "SB-61": {"adresse": "10 Dartagnan amiens, 80000 Amiens", "proprietaireNom": "Mme Mangin"}, "SB-60": {"adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens", "proprietaireNom": "Orlando Xavier"}, "SB-59": {"adresse": "4 Rue Philippe de Girard, 80000 Amiens", "proprietaireNom": "Monsieur Rousseau"}, "SB-58": {"adresse": "37 grande rue, 80560 authie", "proprietaireNom": "lefebvre rose marie"}, "SB-57": {"adresse": "21 rue Francois Villon, 80000 Amiens", "proprietaireNom": "Sophie Drujon"}, "SB-56": {"adresse": "14 rue de montreuil, 80800 lamotte warfusee", "proprietaireNom": "Claudette Mukamutesi"}, "SB-55": {"adresse": "3 Rue Buffon, 80000 Amiens", "proprietaireNom": "Victor Trinel"}, "SB-54": {"adresse": "3 allée sablée, 80000 amiens", "proprietaireNom": "aline VERJOT"}, "SB-53": {"adresse": "39 Rue du Docteur Lenoel, 80080 Amiens", "proprietaireNom": "Brigitte POUILLOT CARTON"}, "SB-52": {"adresse": "5 allée sablée, 80000 Amiens", "proprietaireNom": "aline VERJOT"}, "SB-51": {"adresse": "5 allée sablée, 80000 Amiens", "proprietaireNom": "aline VERJOT"}, "SB-50": {"adresse": "5 Rue Louis Baledent, 80090 Amiens", "proprietaireNom": "Natalie Simone frossard"}, "SB-48": {"adresse": "19 Rés le Pré Joly, 80680 Hébecourt", "proprietaireNom": "Michel Brotte"}, "SB-47": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-45": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-44": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-42": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-41": {"adresse": "37 Rue Jean Racine, 80090 Amiens", "proprietaireNom": "Aude HERLIN"}, "SB-40": {"adresse": "21 rue Francois Villon, 80000 Amiens", "proprietaireNom": "Sophie Drujon"}, "SB-39": {"adresse": "18 Rue Gresset, 80000 Amiens", "proprietaireNom": "andre Andrieu"}, "SB-38": {"adresse": "211 Rue Jules Barni, 80000 Amiens", "proprietaireNom": "Lauriane Dudzik"}, "SB-37": {"adresse": "20 Rue Gustave Flaubert, 80080 Amiens", "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD"}, "SB-36": {"adresse": "5 Rue Louis Baledent, 80090 amiens", "proprietaireNom": "Natalie Simone frossard"}, "SB-35": {"adresse": "61 Allée des Tisserands, 80000 Amiens", "proprietaireNom": "Martine Joly"}, "SB-34": {"adresse": "60 Rue Jean Racine bat E, 80090 Amiens", "proprietaireNom": "Gaetan Mathieu"}, "SB-33": {"adresse": "27 Rue Lamartine, 80000 Amiens", "proprietaireNom": "Clovis Cuadrado"}, "SB-32": {"adresse": "72 Rue Camille Desmoulins, 80000 Amiens", "proprietaireNom": "Martine POUCHAIN"}, "SB-31": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-30": {"adresse": "18 Rue Gresset, 80000 Amiens", "proprietaireNom": "andre Andrieu"}, "SB-28": {"adresse": "72 Rue Camille Desmoulins, 80000 Amiens", "proprietaireNom": "Martine POUCHAIN"}, "SB-27": {"adresse": "1 Chemin de longueau, 80480 pont de metz", "proprietaireNom": "MICHEL LENORMAND"}, "SB-26": {"adresse": "16 Rue Debray, 80000 Amiens", "proprietaireNom": "VANDANGE"}, "SB-25": {"adresse": "8 Rue Basse des Tanneurs, 80000 Amiens", "proprietaireNom": "SAS 2D2M"}, "SB-24": {"adresse": "3 allée sablée, 80000 amiens", "proprietaireNom": "aline VERJOT"}, "SB-23": {"adresse": "4 Boulevard des Fédérés, 80000 Amiens", "proprietaireNom": "Thomas Didier"}, "SB-22": {"adresse": "6 Rue Charles Dubois, 80000 Amiens", "proprietaireNom": "Romain Gaudefroy"}, "SB-21": {"adresse": "40 Rue du Pinceau, 80000 Amiens", "proprietaireNom": "Heiva Chappey"}, "SB-20": {"adresse": "78 Rue Saint-Léger, 80080 Amiens", "proprietaireNom": "karine messager"}, "SB-19": {"adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens", "proprietaireNom": "Orlando Xavier"}, "SB-18": {"adresse": "61 Allée des Tisserands, 80000 Amiens", "proprietaireNom": "Martine Joly"}, "SB-17": {"adresse": "14 Rue des Vergeaux, 80000 Amiens", "proprietaireNom": "Johanna JAKUBOWICZ"}, "SB-16": {"adresse": "11 Résidence du Bel-Air, 80800 Villers-Bretonneux", "proprietaireNom": "Sylviane Deliens"}, "SB-15": {"adresse": "21 rue Francois Villon, 80000 Amiens", "proprietaireNom": "Sophie Drujon"}, "SB-14": {"adresse": "4 Boulevard des Fédérés, 80000 Amiens", "proprietaireNom": "Thomas Didier"}, "SB-13": {"adresse": "161 Rue du Faubourg de Hem, 80000 Amiens", "proprietaireNom": "Cecile PEYROT"}, "SB-12": {"adresse": "9 du bellay, 80000 Amiens", "proprietaireNom": "virginie macrez"}, "SB-11": {"adresse": "7 Rue de Flagard, 80260 Vaux-en-Amiénois", "proprietaireNom": "KATIA GODARD"}, "SB-10": {"adresse": "3 Boulevard d'Alsace-Lorraine, 80000 Amiens", "proprietaireNom": "Mohamed EL HANNOUTI"}, "SB-9": {"adresse": "40 Rue du Pinceau, 80000 Amiens", "proprietaireNom": "Heiva Chappey"}, "SB-8": {"adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens", "proprietaireNom": "Patricia DELAVISSE"}, "SB-7": {"adresse": "1 Rue Gresset, 80000 Amiens", "proprietaireNom": "BUQUET JEAN FRANCOIS"}, "SB-6": {"adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens", "proprietaireNom": "Orlando Xavier"}, "SB-5": {"adresse": "13 Rue Duroyer, 80000 Amiens", "proprietaireNom": "Sebastien Lombart"}, "SB-4": {"adresse": "5 Rue Louis Baledent, 80090 amiens", "proprietaireNom": "Natalie Simone frossard"}};

var INIT_MANDATS = [
  {
    "id": "SB-138-agence-1",
    "ref": "SB-138",
    "prix": 210000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-27",
    "typeMandat": "exclusif",
    "tauxCommission": 4.76,
    "proprietaireNom": "JULIEN ROCHE CHEVALIER",
    "adresseProvisoire": false
  },
  {
    "id": "SB-137-agence-1",
    "ref": "SB-137",
    "prix": 550000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 Rue Gresset, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-05-27",
    "typeMandat": "exclusif",
    "tauxCommission": 3.64,
    "proprietaireNom": "Yann capart",
    "adresseProvisoire": false
  },
  {
    "id": "SB-136-agence-1",
    "ref": "SB-136",
    "prix": 550000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "2 Rue Delambre, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 20000,
    "dateMandat": "2026-05-26",
    "typeMandat": "simple",
    "tauxCommission": 3.64,
    "proprietaireNom": "Romuald Jimenez",
    "adresseProvisoire": false
  },
  {
    "id": "SB-135-agence-1",
    "ref": "SB-135",
    "prix": 265000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "211 Rue Jules Barni, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13000,
    "dateMandat": "2026-05-26",
    "typeMandat": "simple",
    "tauxCommission": 4.91,
    "proprietaireNom": "Lauriane Dudzik",
    "adresseProvisoire": false
  },
  {
    "id": "SB-134-agence-1",
    "ref": "SB-134",
    "prix": 175000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "20 Rue Gustave Flaubert, 80080 Amiens",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-22",
    "typeMandat": "exclusif",
    "tauxCommission": 5.71,
    "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD",
    "adresseProvisoire": false
  },
  {
    "id": "SB-133-agence-1",
    "ref": "SB-133",
    "prix": 430000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Rue Gresset, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 25000,
    "dateMandat": "2026-05-22",
    "typeMandat": "exclusif",
    "tauxCommission": 5.81,
    "proprietaireNom": "BUQUET JEAN FRANCOIS",
    "adresseProvisoire": false
  },
  {
    "id": "SB-132-agence-1",
    "ref": "SB-132",
    "prix": 238000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "262 rue jules ferry amiens, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12000,
    "dateMandat": "2026-05-21",
    "typeMandat": "simple",
    "tauxCommission": 5.04,
    "proprietaireNom": "ali abdesmed",
    "adresseProvisoire": false
  },
  {
    "id": "SB-131-agence-1",
    "ref": "SB-131",
    "prix": 120500,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "35 Avenue du Royaume-Uni, 80090 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8400,
    "dateMandat": "2026-05-21",
    "typeMandat": "simple",
    "tauxCommission": 6.97,
    "proprietaireNom": "Florence HERBET",
    "adresseProvisoire": false
  },
  {
    "id": "SB-130-agence-1",
    "ref": "SB-130",
    "prix": 135100,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "35 Avenue du Royaume-Uni, 80090 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 9400,
    "dateMandat": "2026-05-21",
    "typeMandat": "simple",
    "tauxCommission": 6.96,
    "proprietaireNom": "Florence HERBET",
    "adresseProvisoire": false
  },
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
  },
  {
    "id": "SB-128-agence-1",
    "ref": "SB-128",
    "prix": 130000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "9 Rue de la Hotoie, 80000 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-05-19",
    "typeMandat": "simple",
    "tauxCommission": 5.38,
    "proprietaireNom": "Oumar Ndoye",
    "adresseProvisoire": false
  },
  {
    "id": "SB-127-agence-1",
    "ref": "SB-127",
    "prix": 110000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "96 Rue Dupont Bacqueville, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-19",
    "typeMandat": "simple",
    "tauxCommission": 9.09,
    "proprietaireNom": "Thibaut MARIE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-126-agence-1",
    "ref": "SB-126",
    "prix": 95000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 allée sablée, 80000 amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7500,
    "dateMandat": "2026-05-19",
    "typeMandat": "simple",
    "tauxCommission": 7.89,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-125-agence-1",
    "ref": "SB-125",
    "prix": 400000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 Rue Gresset, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 24000,
    "dateMandat": "2026-05-19",
    "typeMandat": "exclusif",
    "tauxCommission": 6,
    "proprietaireNom": "andre Andrieu",
    "adresseProvisoire": false
  },
  {
    "id": "SB-124-agence-1",
    "ref": "SB-124",
    "prix": 1426190,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "4 Boulevard des Fédérés, 80000 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 123809,
    "dateMandat": "2026-05-18",
    "typeMandat": "simple",
    "tauxCommission": 8.68,
    "proprietaireNom": "Thomas Didier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-123-agence-1",
    "ref": "SB-123",
    "prix": 1200000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "2 Rue Duthoit, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 70000,
    "dateMandat": "2026-05-14",
    "typeMandat": "exclusif",
    "tauxCommission": 5.83,
    "proprietaireNom": "SCI Jubert portejoie",
    "adresseProvisoire": false
  },
  {
    "id": "SB-122-agence-1",
    "ref": "SB-122",
    "prix": 100000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "47 Rue des 3 Cailloux, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-13",
    "typeMandat": "simple",
    "tauxCommission": 10,
    "proprietaireNom": "marie lepetit",
    "adresseProvisoire": false
  },
  {
    "id": "SB-121-agence-1",
    "ref": "SB-121",
    "prix": 78000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 7000,
    "dateMandat": "2026-05-13",
    "typeMandat": "simple",
    "tauxCommission": 8.97,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-120-agence-1",
    "ref": "SB-120",
    "prix": 323500,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 rue Francois Villon, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 16500,
    "dateMandat": "2026-05-13",
    "typeMandat": "simple",
    "tauxCommission": 5.1,
    "proprietaireNom": "Sophie Drujon",
    "adresseProvisoire": false
  },
  {
    "id": "SB-119-agence-1",
    "ref": "SB-119",
    "prix": 225800,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 8 rue de l'Amiral Courejolles, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13200,
    "dateMandat": "2026-05-11",
    "typeMandat": "exclusif",
    "tauxCommission": 5.85,
    "proprietaireNom": "Mme CAULET",
    "adresseProvisoire": false
  },
  {
    "id": "SB-118-agence-1",
    "ref": "SB-118",
    "prix": 110000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "96 Rue Dupont Bacqueville, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 9240,
    "dateMandat": "2026-05-11",
    "typeMandat": "exclusif",
    "tauxCommission": 8.4,
    "proprietaireNom": "Thibaut MARIE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-117-agence-1",
    "ref": "SB-117",
    "prix": 115000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "9 du bellay, 80000 amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "terrain",
    "commission": 10000,
    "dateMandat": "2026-05-11",
    "typeMandat": "simple",
    "tauxCommission": 8.7,
    "proprietaireNom": "virginie macrez",
    "adresseProvisoire": false
  },
  {
    "id": "SB-116-agence-1",
    "ref": "SB-116",
    "prix": 965000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "105 Chaussée Saint-Pierre, 80080 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 35000,
    "dateMandat": "2026-05-07",
    "typeMandat": "exclusif",
    "tauxCommission": 3.63,
    "proprietaireNom": "pascal fradcourt",
    "adresseProvisoire": false
  },
  {
    "id": "SB-115-agence-1",
    "ref": "SB-115",
    "prix": 220000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "324 route de paris, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13200,
    "dateMandat": "2026-05-07",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "Medhi BEL BARAKA",
    "adresseProvisoire": false
  },
  {
    "id": "SB-114-agence-1",
    "ref": "SB-114",
    "prix": 228000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 11000,
    "dateMandat": "2026-05-06",
    "typeMandat": "simple",
    "tauxCommission": 4.82,
    "proprietaireNom": "JULIEN ROCHE CHEVALIER",
    "adresseProvisoire": false
  },
  {
    "id": "SB-113-agence-1",
    "ref": "SB-113",
    "prix": 380000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "161 Rue du Faubourg de Hem, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-05-05",
    "typeMandat": "exclusif",
    "tauxCommission": 5.26,
    "proprietaireNom": "Cecile PEYROT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-112-agence-1",
    "ref": "SB-112",
    "prix": 362000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "161 Rue du Faubourg de Hem, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 18000,
    "dateMandat": "2026-05-05",
    "typeMandat": "exclusif",
    "tauxCommission": 4.97,
    "proprietaireNom": "Cecile PEYROT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-111-agence-1",
    "ref": "SB-111",
    "prix": 76000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 allée sablée, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8000,
    "dateMandat": "2026-05-05",
    "typeMandat": "simple",
    "tauxCommission": 10.53,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-110-agence-1",
    "ref": "SB-110",
    "prix": 61000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "97 Rue Laurendeau, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 5000,
    "dateMandat": "2026-05-05",
    "typeMandat": "exclusif",
    "tauxCommission": 8.2,
    "proprietaireNom": "Stéphane et Marie FRATY",
    "adresseProvisoire": false
  },
  {
    "id": "SB-109-agence-1",
    "ref": "SB-109",
    "prix": 130000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "9 Rue Philippe de Girard, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8700,
    "dateMandat": "2026-05-05",
    "typeMandat": "simple",
    "tauxCommission": 6.69,
    "proprietaireNom": "Eric Dambreville",
    "adresseProvisoire": false
  },
  {
    "id": "SB-108-agence-1",
    "ref": "SB-108",
    "prix": 90000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "52 Rue du Don, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-05-05",
    "typeMandat": "exclusif",
    "tauxCommission": 7.78,
    "proprietaireNom": "Maxence WIESE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-107-agence-1",
    "ref": "SB-107",
    "prix": 240000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "357 Rue de Cagny, 80090 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 9900,
    "dateMandat": "2026-05-05",
    "typeMandat": "simple",
    "tauxCommission": 4.12,
    "proprietaireNom": "Maximilien Dore",
    "adresseProvisoire": false
  },
  {
    "id": "SB-106-agence-1",
    "ref": "SB-106",
    "prix": 140000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "27 Rue Lamartine, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 9000,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 6.43,
    "proprietaireNom": "Clovis Cuadrado",
    "adresseProvisoire": false
  },
  {
    "id": "SB-105-agence-1",
    "ref": "SB-105",
    "prix": 16100,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "11 Rue des Francs Mûriers, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_location",
    "commission": 12600,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 78.26,
    "proprietaireNom": "SCI NOTRE DAME SOINNE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-104-agence-1",
    "ref": "SB-104",
    "prix": 239000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "357 Rue de Cagny, 80090 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-04",
    "typeMandat": "exclusif",
    "tauxCommission": 4.18,
    "proprietaireNom": "Maximilien Dore",
    "adresseProvisoire": false
  },
  {
    "id": "SB-103-agence-1",
    "ref": "SB-103",
    "prix": 145000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "61 Allée des Tisserands, 80000 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 4.83,
    "proprietaireNom": "Martine Joly",
    "adresseProvisoire": false
  },
  {
    "id": "SB-102-agence-1",
    "ref": "SB-102",
    "prix": 115000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "11 Allée de la Tête d'Or, 80000 AMIENS",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 10000,
    "dateMandat": "2026-05-04",
    "typeMandat": "exclusif",
    "tauxCommission": 8.7,
    "proprietaireNom": "Fréderic et Alexandra PICARD",
    "adresseProvisoire": false
  },
  {
    "id": "SB-101-agence-1",
    "ref": "SB-101",
    "prix": 140000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "60 Rue Jean Racine, 80090 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-05-04",
    "typeMandat": "exclusif",
    "tauxCommission": 7.14,
    "proprietaireNom": "Florence HERBET",
    "adresseProvisoire": false
  },
  {
    "id": "SB-100-agence-1",
    "ref": "SB-100",
    "prix": 375000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "161 Rue du Faubourg de Hem, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 15000,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 4,
    "proprietaireNom": "Cecile PEYROT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-99-agence-1",
    "ref": "SB-99",
    "prix": 655000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 3.05,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-98-agence-1",
    "ref": "SB-98",
    "prix": 640000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Rue du Cloître de la Barge, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 25000,
    "dateMandat": "2026-05-04",
    "typeMandat": "simple",
    "tauxCommission": 3.91,
    "proprietaireNom": "SCI DADS Souply",
    "adresseProvisoire": false
  },
  {
    "id": "SB-97-agence-1",
    "ref": "SB-97",
    "prix": 235849,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "12 Avenue Jean Jaurès, 80480 Salouël",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 14150,
    "dateMandat": "2026-04-29",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "LEGOUEZ Mme / Willy LEGOUEZ",
    "adresseProvisoire": false
  },
  {
    "id": "SB-96-agence-1",
    "ref": "SB-96",
    "prix": 400000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "734 Route Nationale, 80260 Poulainville",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-04-29",
    "typeMandat": "simple",
    "tauxCommission": 5,
    "proprietaireNom": "pascal fradcourt",
    "adresseProvisoire": false
  },
  {
    "id": "SB-95-agence-1",
    "ref": "SB-95",
    "prix": 570000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 Rue Gresset, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 30000,
    "dateMandat": "2026-04-29",
    "typeMandat": "simple",
    "tauxCommission": 5.26,
    "proprietaireNom": "Yann capart",
    "adresseProvisoire": false
  },
  {
    "id": "SB-94-agence-1",
    "ref": "SB-94",
    "prix": 95000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 allée sablée, 80000 amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 6000,
    "dateMandat": "2026-04-29",
    "typeMandat": "simple",
    "tauxCommission": 6.32,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-93-agence-1",
    "ref": "SB-93",
    "prix": 400000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "19 Rés le Pré Joly, 80680 Hébecourt",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 15000,
    "dateMandat": "2026-04-28",
    "typeMandat": "simple",
    "tauxCommission": 3.75,
    "proprietaireNom": "Michel Brotte",
    "adresseProvisoire": false
  },
  {
    "id": "SB-92-agence-1",
    "ref": "SB-92",
    "prix": 1260000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "12 Avenue Jean Jaurès, 80480 Salouël",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 35000,
    "dateMandat": "2026-04-28",
    "typeMandat": "simple",
    "tauxCommission": 2.78,
    "proprietaireNom": "LEGOUEZ Mme / Willy LEGOUEZ",
    "adresseProvisoire": false
  },
  {
    "id": "SB-91-agence-1",
    "ref": "SB-91",
    "prix": 181000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "20 Rue Gustave Flaubert, 80080 Amiens",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 9000,
    "dateMandat": "2026-04-28",
    "typeMandat": "exclusif",
    "tauxCommission": 4.97,
    "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD",
    "adresseProvisoire": false
  },
  {
    "id": "SB-90-agence-1",
    "ref": "SB-90",
    "prix": 308000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "133 Rue Vulfran Warmé, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12000,
    "dateMandat": "2026-04-28",
    "typeMandat": "exclusif",
    "tauxCommission": 3.9,
    "proprietaireNom": "Yohann RICHET",
    "adresseProvisoire": false
  },
  {
    "id": "SB-89-agence-1",
    "ref": "SB-89",
    "prix": 300000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 15000,
    "dateMandat": "2026-04-27",
    "typeMandat": "exclusif",
    "tauxCommission": 5,
    "proprietaireNom": "Patricia DELAVISSE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-88-agence-1",
    "ref": "SB-88",
    "prix": 235000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "40 Rue Milton, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13500,
    "dateMandat": "2026-04-27",
    "typeMandat": "exclusif",
    "tauxCommission": 5.74,
    "proprietaireNom": "M CHRIS",
    "adresseProvisoire": false
  },
  {
    "id": "SB-87-agence-1",
    "ref": "SB-87",
    "prix": 185000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 11100,
    "dateMandat": "2026-04-27",
    "typeMandat": "exclusif",
    "tauxCommission": 6,
    "proprietaireNom": "Patricia DELAVISSE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-86-agence-1",
    "ref": "SB-86",
    "prix": 999,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 594,
    "dateMandat": "2026-04-26",
    "typeMandat": "simple",
    "tauxCommission": 59.46,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-85-agence-1",
    "ref": "SB-85",
    "prix": 984,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 594,
    "dateMandat": "2026-04-26",
    "typeMandat": "simple",
    "tauxCommission": 60.37,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-84-agence-1",
    "ref": "SB-84",
    "prix": 1894,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 814,
    "dateMandat": "2026-04-25",
    "typeMandat": "simple",
    "tauxCommission": 42.98,
    "proprietaireNom": "Orlando Xavier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-83-agence-1",
    "ref": "SB-83",
    "prix": 380000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "161 Rue du Faubourg de Hem, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 19000,
    "dateMandat": "2026-04-24",
    "typeMandat": "exclusif",
    "tauxCommission": 5,
    "proprietaireNom": "Cecile PEYROT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-82-agence-1",
    "ref": "SB-82",
    "prix": 248000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "77 Rue Lapostolle, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 9000,
    "dateMandat": "2026-04-24",
    "typeMandat": "simple",
    "tauxCommission": 3.63,
    "proprietaireNom": "Régis Synek",
    "adresseProvisoire": false
  },
  {
    "id": "SB-81-agence-1",
    "ref": "SB-81",
    "prix": 205741,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "324 route de paris, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 9258,
    "dateMandat": "2026-04-24",
    "typeMandat": "simple",
    "tauxCommission": 4.5,
    "proprietaireNom": "Medhi BEL BARAKA",
    "adresseProvisoire": false
  },
  {
    "id": "SB-80-agence-1",
    "ref": "SB-80",
    "prix": 220000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 Rue de la Prairie, 80115 Pont-Noyelles",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13200,
    "dateMandat": "2026-04-24",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "JULIEN ROCHE CHEVALIER",
    "adresseProvisoire": false
  },
  {
    "id": "SB-79-agence-1",
    "ref": "SB-79",
    "prix": 690000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 rue des Trémieres, 80440 Glisy",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 30000,
    "dateMandat": "2026-04-22",
    "typeMandat": "exclusif",
    "tauxCommission": 4.35,
    "proprietaireNom": "Fabien Milhaud",
    "adresseProvisoire": false
  },
  {
    "id": "SB-78-agence-1",
    "ref": "SB-78",
    "prix": 402426,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "19 Rés le Pré Joly, 80680 Hébecourt",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 35573,
    "dateMandat": "2026-04-22",
    "typeMandat": "exclusif",
    "tauxCommission": 8.84,
    "proprietaireNom": "Michel Brotte",
    "adresseProvisoire": false
  },
  {
    "id": "SB-77-agence-1",
    "ref": "SB-77",
    "prix": 45000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "33 Rue Pierre Lefebvre, 80560 Mailly-Maillet",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "terrain",
    "commission": 4900,
    "dateMandat": "2026-04-22",
    "typeMandat": "exclusif",
    "tauxCommission": 10.89,
    "proprietaireNom": "Erwan PERES",
    "adresseProvisoire": false
  },
  {
    "id": "SB-75-agence-1",
    "ref": "SB-75",
    "prix": 175000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "12 Rue René Coty, 80080 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 10000,
    "dateMandat": "2026-04-21",
    "typeMandat": "simple",
    "tauxCommission": 5.71,
    "proprietaireNom": "Seyho Yaldiz",
    "adresseProvisoire": false
  },
  {
    "id": "SB-74-agence-1",
    "ref": "SB-74",
    "prix": 230000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "47 Rue des 3 Cailloux, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 13000,
    "dateMandat": "2026-04-20",
    "typeMandat": "exclusif",
    "tauxCommission": 5.65,
    "proprietaireNom": "marie lepetit",
    "adresseProvisoire": false
  },
  {
    "id": "SB-73-agence-1",
    "ref": "SB-73",
    "prix": 149000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "61 Allée des Tisserands, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 10000,
    "dateMandat": "2026-04-20",
    "typeMandat": "exclusif",
    "tauxCommission": 6.71,
    "proprietaireNom": "Martine Joly",
    "adresseProvisoire": false
  },
  {
    "id": "SB-72-agence-1",
    "ref": "SB-72",
    "prix": 135000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "27 Rue Lamartine, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-04-19",
    "typeMandat": "simple",
    "tauxCommission": 5.19,
    "proprietaireNom": "Clovis Cuadrado",
    "adresseProvisoire": false
  },
  {
    "id": "SB-71-agence-1",
    "ref": "SB-71",
    "prix": 2236,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "19 Rés le Pré Joly, 80680 Hébecourt",
    "agentId": "agent-karine",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 1386,
    "dateMandat": "2026-04-17",
    "typeMandat": "simple",
    "tauxCommission": 61.99,
    "proprietaireNom": "Michel Brotte",
    "adresseProvisoire": false
  },
  {
    "id": "SB-70-agence-1",
    "ref": "SB-70",
    "prix": 2102,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "agent-karine",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 1452,
    "dateMandat": "2026-04-16",
    "typeMandat": "simple",
    "tauxCommission": 69.08,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-69-agence-1",
    "ref": "SB-69",
    "prix": 310000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "133 Rue Vulfran Warmé, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12000,
    "dateMandat": "2026-04-16",
    "typeMandat": "simple",
    "tauxCommission": 3.87,
    "proprietaireNom": "Yohann RICHET",
    "adresseProvisoire": false
  },
  {
    "id": "SB-68-agence-1",
    "ref": "SB-68",
    "prix": 89000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "11 Rue Antoine de Saint-Exupéry, 80480 Salouël",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 7000,
    "dateMandat": "2026-04-16",
    "typeMandat": "exclusif",
    "tauxCommission": 7.87,
    "proprietaireNom": "mentim sci",
    "adresseProvisoire": false
  },
  {
    "id": "SB-67-agence-1",
    "ref": "SB-67",
    "prix": 1309000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "16 Rue Debray, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 40000,
    "dateMandat": "2026-04-14",
    "typeMandat": "simple",
    "tauxCommission": 3.06,
    "proprietaireNom": "VANDANGE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-66-agence-1",
    "ref": "SB-66",
    "prix": 280000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "47 Rue d'Amiens, 80800 Daours",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12000,
    "dateMandat": "2026-04-14",
    "typeMandat": "simple",
    "tauxCommission": 4.29,
    "proprietaireNom": "Armelle LEJAY épouse MOLLIENS",
    "adresseProvisoire": false
  },
  {
    "id": "SB-65-agence-1",
    "ref": "SB-65",
    "prix": 50000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "22 rue de raincheval, 80560 marieux",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "terrain",
    "commission": 6000,
    "dateMandat": "2026-04-14",
    "typeMandat": "exclusif",
    "tauxCommission": 12,
    "proprietaireNom": "Samuel Parmentier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-63-agence-1",
    "ref": "SB-63",
    "prix": 137735,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "9 Rue de la Hotoie, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 8264,
    "dateMandat": "2026-04-13",
    "typeMandat": "exclusif",
    "tauxCommission": 6,
    "proprietaireNom": "Oumar Ndoye",
    "adresseProvisoire": false
  },
  {
    "id": "SB-62-agence-1",
    "ref": "SB-62",
    "prix": 360000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "2 rue des vergeaux, 80000 amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 18000,
    "dateMandat": "2026-04-13",
    "typeMandat": "simple",
    "tauxCommission": 5,
    "proprietaireNom": "andre Andrieu",
    "adresseProvisoire": false
  },
  {
    "id": "SB-61-agence-1",
    "ref": "SB-61",
    "prix": 120000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "10 Dartagnan amiens, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8000,
    "dateMandat": "2026-04-13",
    "typeMandat": "exclusif",
    "tauxCommission": 6.67,
    "proprietaireNom": "Mme Mangin",
    "adresseProvisoire": false
  },
  {
    "id": "SB-60-agence-1",
    "ref": "SB-60",
    "prix": 235000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-04-12",
    "typeMandat": "simple",
    "tauxCommission": 4.26,
    "proprietaireNom": "Orlando Xavier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-59-agence-1",
    "ref": "SB-59",
    "prix": 120000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "4 Rue Philippe de Girard, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-04-12",
    "typeMandat": "exclusif",
    "tauxCommission": 5.83,
    "proprietaireNom": "Monsieur Rousseau",
    "adresseProvisoire": false
  },
  {
    "id": "SB-58-agence-1",
    "ref": "SB-58",
    "prix": 115000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "37 grande rue, 80560 authie",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 6000,
    "dateMandat": "2026-04-12",
    "typeMandat": "simple",
    "tauxCommission": 5.22,
    "proprietaireNom": "lefebvre rose marie",
    "adresseProvisoire": false
  },
  {
    "id": "SB-57-agence-1",
    "ref": "SB-57",
    "prix": 305000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 rue Francois Villon, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 19000,
    "dateMandat": "2026-04-12",
    "typeMandat": "exclusif",
    "tauxCommission": 6.23,
    "proprietaireNom": "Sophie Drujon",
    "adresseProvisoire": false
  },
  {
    "id": "SB-56-agence-1",
    "ref": "SB-56",
    "prix": 209000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "14 rue de montreuil, 80800 lamotte warfusee",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-04-11",
    "typeMandat": "simple",
    "tauxCommission": 4.78,
    "proprietaireNom": "Claudette Mukamutesi",
    "adresseProvisoire": false
  },
  {
    "id": "SB-55-agence-1",
    "ref": "SB-55",
    "prix": 270000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 Rue Buffon, 80000 Amiens",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13500,
    "dateMandat": "2026-04-11",
    "typeMandat": "exclusif",
    "tauxCommission": 5,
    "proprietaireNom": "Victor Trinel",
    "adresseProvisoire": false
  },
  {
    "id": "SB-54-agence-1",
    "ref": "SB-54",
    "prix": 100500,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 allée sablée, 80000 amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 9000,
    "dateMandat": "2026-04-10",
    "typeMandat": "exclusif",
    "tauxCommission": 8.96,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-53-agence-1",
    "ref": "SB-53",
    "prix": 250000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "39 Rue du Docteur Lenoel, 80080 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 12500,
    "dateMandat": "2026-04-10",
    "typeMandat": "simple",
    "tauxCommission": 5,
    "proprietaireNom": "Brigitte POUILLOT CARTON",
    "adresseProvisoire": false
  },
  {
    "id": "SB-52-agence-1",
    "ref": "SB-52",
    "prix": 90000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 allée sablée, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8000,
    "dateMandat": "2026-04-10",
    "typeMandat": "simple",
    "tauxCommission": 8.89,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-51-agence-1",
    "ref": "SB-51",
    "prix": 78000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 allée sablée, 80000 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 7000,
    "dateMandat": "2026-04-10",
    "typeMandat": "simple",
    "tauxCommission": 8.97,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-50-agence-1",
    "ref": "SB-50",
    "prix": 170000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 Rue Louis Baledent, 80090 Amiens",
    "agentId": "agent-nathalie",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-04-10",
    "typeMandat": "exclusif",
    "tauxCommission": 5.88,
    "proprietaireNom": "Natalie Simone frossard",
    "adresseProvisoire": false
  },
  {
    "id": "SB-48-agence-1",
    "ref": "SB-48",
    "prix": 385000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "19 Rés le Pré Joly, 80680 Hébecourt",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 15000,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 3.9,
    "proprietaireNom": "Michel Brotte",
    "adresseProvisoire": false
  },
  {
    "id": "SB-47-agence-1",
    "ref": "SB-47",
    "prix": 810,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 320,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 39.51,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-46-agence-1",
    "ref": "SB-46",
    "prix": 1070,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "Amiens, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 480,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 44.86,
    "proprietaireNom": "LUTZ",
    "adresseProvisoire": false
  },
  {
    "id": "SB-45-agence-1",
    "ref": "SB-45",
    "prix": 2810,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 1360,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 48.4,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-44-agence-1",
    "ref": "SB-44",
    "prix": 1012,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 462,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 45.65,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-42-agence-1",
    "ref": "SB-42",
    "prix": 1124,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 604,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 53.74,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-41-agence-1",
    "ref": "SB-41",
    "prix": 599000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "37 Rue Jean Racine, 80090 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 21000,
    "dateMandat": "2026-04-09",
    "typeMandat": "simple",
    "tauxCommission": 3.51,
    "proprietaireNom": "Aude HERLIN",
    "adresseProvisoire": false
  },
  {
    "id": "SB-40-agence-1",
    "ref": "SB-40",
    "prix": 335000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 rue Francois Villon, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 15000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 4.48,
    "proprietaireNom": "Sophie Drujon",
    "adresseProvisoire": false
  },
  {
    "id": "SB-39-agence-1",
    "ref": "SB-39",
    "prix": 4450,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 Rue Gresset, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_location",
    "commission": 3500,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 78.65,
    "proprietaireNom": "andre Andrieu",
    "adresseProvisoire": false
  },
  {
    "id": "SB-38-agence-1",
    "ref": "SB-38",
    "prix": 275000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "211 Rue Jules Barni, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 16500,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "Lauriane Dudzik",
    "adresseProvisoire": false
  },
  {
    "id": "SB-37-agence-1",
    "ref": "SB-37",
    "prix": 180000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "20 Rue Gustave Flaubert, 80080 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10800,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "JAN SYLVAIN FRANCK DROUAUD",
    "adresseProvisoire": false
  },
  {
    "id": "SB-36-agence-1",
    "ref": "SB-36",
    "prix": 170000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 Rue Louis Baledent, 80090 amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 9000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 5.29,
    "proprietaireNom": "Natalie Simone frossard",
    "adresseProvisoire": false
  },
  {
    "id": "SB-35-agence-1",
    "ref": "SB-35",
    "prix": 150000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "61 Allée des Tisserands, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7500,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 5,
    "proprietaireNom": "Martine Joly",
    "adresseProvisoire": false
  },
  {
    "id": "SB-34-agence-1",
    "ref": "SB-34",
    "prix": 14000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "60 Rue Jean Racine bat E, 80090 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "garage",
    "commission": 2500,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 17.86,
    "proprietaireNom": "Gaetan Mathieu",
    "adresseProvisoire": false
  },
  {
    "id": "SB-33-agence-1",
    "ref": "SB-33",
    "prix": 700,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "27 Rue Lamartine, 80000 Amiens",
    "agentId": "agent-karine",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 1100,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 157.14,
    "proprietaireNom": "Clovis Cuadrado",
    "adresseProvisoire": false
  },
  {
    "id": "SB-32-agence-1",
    "ref": "SB-32",
    "prix": 265000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "72 Rue Camille Desmoulins, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 15000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 5.66,
    "proprietaireNom": "Martine POUCHAIN",
    "adresseProvisoire": false
  },
  {
    "id": "SB-31-agence-1",
    "ref": "SB-31",
    "prix": 80000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 6000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 7.5,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-30-agence-1",
    "ref": "SB-30",
    "prix": 10865,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "18 Rue Gresset, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_location",
    "commission": 8640,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 79.52,
    "proprietaireNom": "andre Andrieu",
    "adresseProvisoire": false
  },
  {
    "id": "SB-28-agence-1",
    "ref": "SB-28",
    "prix": 265000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "72 Rue Camille Desmoulins, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 14000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 5.28,
    "proprietaireNom": "Martine POUCHAIN",
    "adresseProvisoire": false
  },
  {
    "id": "SB-27-agence-1",
    "ref": "SB-27",
    "prix": 80000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Chemin de longueau, 80480 pont de metz",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8000,
    "dateMandat": "2026-04-08",
    "typeMandat": "simple",
    "tauxCommission": 10,
    "proprietaireNom": "MICHEL LENORMAND",
    "adresseProvisoire": false
  },
  {
    "id": "SB-26-agence-1",
    "ref": "SB-26",
    "prix": 1309000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "16 Rue Debray, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 40000,
    "dateMandat": "2026-04-07",
    "typeMandat": "simple",
    "tauxCommission": 3.06,
    "proprietaireNom": "VANDANGE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-25-agence-1",
    "ref": "SB-25",
    "prix": 350000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "8 Rue Basse des Tanneurs, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "local_pro_vente",
    "commission": 20000,
    "dateMandat": "2026-04-07",
    "typeMandat": "simple",
    "tauxCommission": 5.71,
    "proprietaireNom": "SAS 2D2M",
    "adresseProvisoire": false
  },
  {
    "id": "SB-24-agence-1",
    "ref": "SB-24",
    "prix": 100000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 allée sablée, 80000 amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 7000,
    "dateMandat": "2026-04-07",
    "typeMandat": "simple",
    "tauxCommission": 7,
    "proprietaireNom": "aline VERJOT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-23-agence-1",
    "ref": "SB-23",
    "prix": 3172,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "4 Boulevard des Fédérés, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 2222,
    "dateMandat": "2026-04-06",
    "typeMandat": "simple",
    "tauxCommission": 70.05,
    "proprietaireNom": "Thomas Didier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-22-agence-1",
    "ref": "SB-22",
    "prix": 670000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "6 Rue Charles Dubois, 80000 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 2.99,
    "proprietaireNom": "Romain Gaudefroy",
    "adresseProvisoire": false
  },
  {
    "id": "SB-21-agence-1",
    "ref": "SB-21",
    "prix": 286000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "40 Rue du Pinceau, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 14000,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 4.9,
    "proprietaireNom": "Heiva Chappey",
    "adresseProvisoire": false
  },
  {
    "id": "SB-20-agence-1",
    "ref": "SB-20",
    "prix": 450000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "78 Rue Saint-Léger, 80080 Amiens",
    "agentId": "agent-cedric",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 20000,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 4.44,
    "proprietaireNom": "karine messager",
    "adresseProvisoire": false
  },
  {
    "id": "SB-19-agence-1",
    "ref": "SB-19",
    "prix": 235000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 4.26,
    "proprietaireNom": "Orlando Xavier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-18-agence-1",
    "ref": "SB-18",
    "prix": 856,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "61 Allée des Tisserands, 80000 Amiens",
    "agentId": "agent-karine",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 416,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 48.6,
    "proprietaireNom": "Martine Joly",
    "adresseProvisoire": false
  },
  {
    "id": "SB-17-agence-1",
    "ref": "SB-17",
    "prix": 259500,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "14 Rue des Vergeaux, 80000 Amiens",
    "agentId": "agent-clement",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 12500,
    "dateMandat": "2026-04-03",
    "typeMandat": "simple",
    "tauxCommission": 4.82,
    "proprietaireNom": "Johanna JAKUBOWICZ",
    "adresseProvisoire": false
  },
  {
    "id": "SB-16-agence-1",
    "ref": "SB-16",
    "prix": 210000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "11 Résidence du Bel-Air, 80800 Villers-Bretonneux",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-04-02",
    "typeMandat": "simple",
    "tauxCommission": 4.76,
    "proprietaireNom": "Sylviane Deliens",
    "adresseProvisoire": false
  },
  {
    "id": "SB-15-agence-1",
    "ref": "SB-15",
    "prix": 255000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "21 rue Francois Villon, 80000 Amiens",
    "agentId": "manager-2",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 13500,
    "dateMandat": "2026-04-02",
    "typeMandat": "simple",
    "tauxCommission": 5.29,
    "proprietaireNom": "Sophie Drujon",
    "adresseProvisoire": false
  },
  {
    "id": "SB-14-agence-1",
    "ref": "SB-14",
    "prix": 366000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "4 Boulevard des Fédérés, 80000 Amiens",
    "agentId": "agent-laetitia",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 16000,
    "dateMandat": "2026-04-02",
    "typeMandat": "simple",
    "tauxCommission": 4.37,
    "proprietaireNom": "Thomas Didier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-13-agence-1",
    "ref": "SB-13",
    "prix": 360000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "161 Rue du Faubourg de Hem, 80000 Amiens",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 14000,
    "dateMandat": "2026-04-02",
    "typeMandat": "simple",
    "tauxCommission": 3.89,
    "proprietaireNom": "Cecile PEYROT",
    "adresseProvisoire": false
  },
  {
    "id": "SB-12-agence-1",
    "ref": "SB-12",
    "prix": 115000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "9 du bellay, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 6900,
    "dateMandat": "2026-04-01",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "virginie macrez",
    "adresseProvisoire": false
  },
  {
    "id": "SB-11-agence-1",
    "ref": "SB-11",
    "prix": 197000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "7 Rue de Flagard, 80260 Vaux-en-Amiénois",
    "agentId": "agent-pascal",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12600,
    "dateMandat": "2026-04-01",
    "typeMandat": "simple",
    "tauxCommission": 6.4,
    "proprietaireNom": "KATIA GODARD",
    "adresseProvisoire": false
  },
  {
    "id": "SB-10-agence-1",
    "ref": "SB-10",
    "prix": 30000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "3 Boulevard d'Alsace-Lorraine, 80000 Amiens",
    "agentId": "manager-1",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "fonds_commerce",
    "commission": 9000,
    "dateMandat": "2026-04-01",
    "typeMandat": "exclusif",
    "tauxCommission": 30,
    "proprietaireNom": "Mohamed EL HANNOUTI",
    "adresseProvisoire": false
  },
  {
    "id": "SB-9-agence-1",
    "ref": "SB-9",
    "prix": 270000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "40 Rue du Pinceau, 80000 Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 12000,
    "dateMandat": "2026-04-01",
    "typeMandat": "simple",
    "tauxCommission": 4.44,
    "proprietaireNom": "Heiva Chappey",
    "adresseProvisoire": false
  },
  {
    "id": "SB-8-agence-1",
    "ref": "SB-8",
    "prix": 200000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "15 B Avenue Victor Hugo, 80470 Dreuil-lès-Amiens",
    "agentId": "agent-hugo",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 10000,
    "dateMandat": "2026-04-01",
    "typeMandat": "simple",
    "tauxCommission": 5,
    "proprietaireNom": "Patricia DELAVISSE",
    "adresseProvisoire": false
  },
  {
    "id": "SB-7-agence-1",
    "ref": "SB-7",
    "prix": 405000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "1 Rue Gresset, 80000 Amiens",
    "agentId": "agent-isabelle",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 20000,
    "dateMandat": "2026-04-01",
    "typeMandat": "exclusif",
    "tauxCommission": 4.94,
    "proprietaireNom": "BUQUET JEAN FRANCOIS",
    "adresseProvisoire": false
  },
  {
    "id": "SB-6-agence-1",
    "ref": "SB-6",
    "prix": 230000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "80 Rue Claudius Antoine Serrassaint, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 10000,
    "dateMandat": "2026-03-31",
    "typeMandat": "exclusif",
    "tauxCommission": 4.35,
    "proprietaireNom": "Orlando Xavier",
    "adresseProvisoire": false
  },
  {
    "id": "SB-5-agence-1",
    "ref": "SB-5",
    "prix": 105000,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "13 Rue Duroyer, 80000 Amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "appartement",
    "commission": 8400,
    "dateMandat": "2026-03-31",
    "typeMandat": "simple",
    "tauxCommission": 8,
    "proprietaireNom": "Sebastien Lombart",
    "adresseProvisoire": false
  },
  {
    "id": "SB-4-agence-1",
    "ref": "SB-4",
    "prix": 165094,
    "source": "sweepbright",
    "statut": "mandat",
    "adresse": "5 Rue Louis Baledent, 80090 amiens",
    "agentId": "agent-landry",
    "visites": [],
    "agenceId": "agence-1",
    "coAgents": [],
    "typeBien": "maison",
    "commission": 9905,
    "dateMandat": "2026-03-31",
    "typeMandat": "simple",
    "tauxCommission": 6,
    "proprietaireNom": "Natalie Simone frossard",
    "adresseProvisoire": false
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

var INIT_VENTES = [
  {
    "id": "V-2026-001",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 3,
    "date": "2026-03-15",
    "agentId": "agent-landry",
    "agentId2": null,
    "bien": "Rue Lemerchier",
    "mandatRef": "117",
    "commissionTTC": 10000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-002",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 3,
    "date": "2026-03-15",
    "agentId": "agent-landry",
    "agentId2": null,
    "bien": "Rue Georges G.",
    "mandatRef": "5",
    "commissionTTC": 6000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-003",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 3,
    "date": "2026-03-15",
    "agentId": "agent-nathalie",
    "agentId2": null,
    "bien": "",
    "mandatRef": "887",
    "commissionTTC": 7000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-004",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 3,
    "date": "2026-03-15",
    "agentId": "agent-cedric",
    "agentId2": null,
    "bien": "",
    "mandatRef": "NC",
    "commissionTTC": 4000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-005",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 4,
    "date": "2026-04-15",
    "agentId": "agent-nathalie",
    "agentId2": null,
    "bien": "",
    "mandatRef": "74",
    "commissionTTC": 7000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-006",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 4,
    "date": "2026-04-15",
    "agentId": "agent-isabelle",
    "agentId2": null,
    "bien": "Vente 1",
    "mandatRef": "32",
    "commissionTTC": 7000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-007",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 4,
    "date": "2026-04-15",
    "agentId": "agent-isabelle",
    "agentId2": null,
    "bien": "Vente 2",
    "mandatRef": "NC",
    "commissionTTC": 15000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-008",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-landry",
    "agentId2": null,
    "bien": "",
    "mandatRef": "26",
    "commissionTTC": 10000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-009",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-landry",
    "agentId2": null,
    "bien": "",
    "mandatRef": "63",
    "commissionTTC": 8000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-010",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-nathalie",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "109",
    "commissionTTC": 7500,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-011",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-nathalie",
    "agentId2": null,
    "bien": "",
    "mandatRef": "77",
    "commissionTTC": 4900,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-012",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-clement",
    "agentId2": null,
    "bien": "",
    "mandatRef": "37",
    "commissionTTC": 10000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-013",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-clement",
    "agentId2": null,
    "bien": "",
    "mandatRef": "NC",
    "commissionTTC": 3500,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-014",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-clement",
    "agentId2": null,
    "bien": "",
    "mandatRef": "87",
    "commissionTTC": 9000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-015",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-clement",
    "agentId2": null,
    "bien": "",
    "mandatRef": "80",
    "commissionTTC": 10000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-016",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-cedric",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 10000,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-017",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-cedric",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 18000,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-018",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-cedric",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 20000,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-019",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-cedric",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 13000,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-020",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-cedric",
    "agentId2": "manager-2",
    "bien": "",
    "mandatRef": "NC",
    "commissionTTC": 15000,
    "tauxReverse": 0.25,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-021",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "manager-1",
    "agentId2": null,
    "bien": "",
    "mandatRef": "93",
    "commissionTTC": 15000,
    "tauxReverse": 0.0,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-022",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 5,
    "date": "2026-05-15",
    "agentId": "agent-isabelle",
    "agentId2": null,
    "bien": "",
    "mandatRef": "915",
    "commissionTTC": 13000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-023",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "agent-clement",
    "agentId2": null,
    "bien": "",
    "mandatRef": "17",
    "commissionTTC": 10000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-024",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "manager-1",
    "agentId2": null,
    "bien": "",
    "mandatRef": "129",
    "commissionTTC": 15000,
    "tauxReverse": 0.0,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-025",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "manager-1",
    "agentId2": null,
    "bien": "",
    "mandatRef": "131",
    "commissionTTC": 8400,
    "tauxReverse": 0.0,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-026",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "manager-2",
    "agentId2": "agent-laetitia",
    "bien": "",
    "mandatRef": "53",
    "commissionTTC": 12500,
    "tauxReverse": 0.0,
    "statut": "acte",
    "binome": true
  },
  {
    "id": "V-2026-027",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "agent-laetitia",
    "agentId2": null,
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 14000,
    "tauxReverse": 0.0,
    "statut": "acte",
    "binome": false
  },
  {
    "id": "V-2026-028",
    "agenceId": "agence-1",
    "annee": 2026,
    "mois": 6,
    "date": "2026-06-15",
    "agentId": "agent-isabelle",
    "agentId2": null,
    "bien": "",
    "mandatRef": "",
    "commissionTTC": 20000,
    "tauxReverse": 0.5,
    "statut": "acte",
    "binome": false
  }
];

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
  var setMandats     = useCallback(function(u){ var v=typeof u==="function"?u(mandats):u;     setMandatsRaw(Array.isArray(v)?v:prev=>prev);  lsave(SK.mandats,v);     if(supabaseConfigured)dbSave("mandats",v);     },[mandats]);
  var leads = useMemo(function(){
    return (tasks||[]).filter(function(t){ return t.type==="lead"||t.categorie==="lead"; });
  }, [tasks]);

  var setTresorerie  = useCallback(function(u){ var v=typeof u==="function"?u(tresorerie):u;  setTresoRaw(v&&typeof v==="object"?v:{ecritures:[]});    lsave(SK.tresorerie,v);  if(supabaseConfigured)dbSave("tresorerie",v);  },[tresorerie]);
  var setLocations   = useCallback(function(u){ var v=typeof u==="function"?u(locations):u;   setLocsRaw(Array.isArray(v)?v:prev=>prev);     lsave(SK.locations,v);   if(supabaseConfigured)dbSave("locations",v);   },[locations]);
  var setGestion     = useCallback(function(u){ var v=typeof u==="function"?u(gestion):u;     setGestRaw(Array.isArray(v)?v:prev=>prev);     lsave(SK.gestion,v);     if(supabaseConfigured)dbSave("gestion",v);     },[gestion]);
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
      {currentUser.role==="manager" && <ManagerApp/>}
      {currentUser.role==="agent"   && <AgentApp/>}
    </AppContext.Provider>
    </ErrorBoundary>
  );
}
