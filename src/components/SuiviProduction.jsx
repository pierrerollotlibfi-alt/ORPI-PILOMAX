import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, fmt, avatarColor } from "./Shared";

// ─── SUIVI DE PRODUCTION (alimenté par les mandats) ─────────────────────────
// La production remonte AUTOMATIQUEMENT des mandats selon leur statut
// (sous offre / compromis / cs levées / vendu). La commission d'un mandat est
// répartie entre l'agent principal et ses co-agents (parts égales).
// Le manager fixe seulement l'objectif (point mort).

var MOIS_NOMS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
var STATUTS_PROD = ["sous_offre", "compromis", "cs_levees", "vendu"];
var STATUT_LABEL = { sous_offre: "Sous offre", compromis: "Compromis", cs_levees: "CS levées", vendu: "Vendu" };
var STATUT_COULEUR = { sous_offre: "#F59E0B", compromis: "#3B82F6", cs_levees: "#8B5CF6", vendu: "#16A34A" };

function Carte({ label, valeur, sous, couleur }) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 140, background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: "14px 16px", borderTop: "3px solid " + (couleur || "var(--navy)") }}>
      <div style={{ fontSize: 11, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--g900)" }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: "var(--g400)", marginTop: 2 }}>{sous}</div>}
    </div>
  );
}

export default function SuiviProduction() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var role = ctx.currentUser.role;
  var isManager = role === "manager" || role === "superadmin" || role === "admin";

  var mandats = (ctx.mandats || []).filter(function(m){ return m.agenceId === agenceId; });

  var anneeVue = 2026;
  var [showObjectif, setShowObjectif] = useState(false);

  var agence = (ctx.agences || []).find(function(a){ return a.id === agenceId; }) || {};
  var pointMort = agence.pointMort || 292037;

  var NOMS_SECOURS = {
    "manager-1": "Pierre Rollot", "superadmin-1": "Pierre Rollot",
    "manager-2": "Frédéric Carré", "agent-landry": "Landry Boungo",
    "agent-laetitia": "Laetitia Vat", "agent-clement": "Clément Leroy",
    "agent-nathalie": "Nathalie Ducrocq", "agent-hugo": "Hugo Sausse",
    "agent-isabelle": "Isabelle Descombes", "agent-pascal": "Pascal Hainselin",
    "agent-cedric": "Cédric Salle", "agent-karine": "Karine Flamand",
  };
  function nomAgent(id) {
    if (!id) return "Agence";
    var a = (ctx.users || []).find(function(x){ return x.id === id; });
    if (a) return a.prenom ? (a.prenom + " " + a.nom) : a.nom;
    if (NOMS_SECOURS[id]) return NOMS_SECOURS[id];
    return "Agence";
  }

  function dateProd(m) {
    if (m.statut === "vendu") return m.dateSignature || m.dateCompromis || m.dateMandat;
    if (m.statut === "compromis" || m.statut === "cs_levees") return m.dateCompromis || m.dateMandat;
    return m.dateMandat;
  }
  function anneeDe(d) { if (!d) return null; var y = parseInt(String(d).slice(0,4)); return isNaN(y)?null:y; }
  function moisDe(d) { if (!d) return 0; var mo = parseInt(String(d).slice(5,7)); return isNaN(mo)?0:mo; }

  function agentsDuMandat(m) {
    var ids = [m.agentId];
    (m.coAgents || []).forEach(function(ca){
      var id = ca && ca.agentId ? ca.agentId : ca;
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
    return ids.filter(Boolean);
  }

  var mandatsProd = useMemo(function(){
    return mandats.filter(function(m){
      return STATUTS_PROD.indexOf(m.statut) !== -1 && anneeDe(dateProd(m)) === anneeVue;
    });
  }, [mandats]);

  var agg = useMemo(function(){
    var parStatut = {}; var parMois = MOIS_NOMS.map(function(){ return 0; }); var parAgent = {};
    STATUTS_PROD.forEach(function(s){ parStatut[s] = 0; });
    mandatsProd.forEach(function(m){
      var comm = m.commission || 0;
      parStatut[m.statut] = (parStatut[m.statut] || 0) + comm;
      var mi = moisDe(dateProd(m)) - 1;
      if (mi >= 0 && mi < 12) parMois[mi] += comm;
      var ids = agentsDuMandat(m);
      var part = ids.length > 0 ? comm / ids.length : comm;
      ids.forEach(function(id){
        if (!parAgent[id]) parAgent[id] = { comm: 0, nb: 0 };
        parAgent[id].comm += part;
        parAgent[id].nb += (ids.length > 1 ? 0.5 : 1);
      });
    });
    return { parStatut: parStatut, parMois: parMois, parAgent: parAgent };
  }, [mandatsProd]);

  var realiseVendu = agg.parStatut["vendu"] || 0;
  var enCours = (agg.parStatut["sous_offre"]||0) + (agg.parStatut["compromis"]||0) + (agg.parStatut["cs_levees"]||0);
  var tauxAtteinte = Math.min(100, Math.round((realiseVendu / pointMort) * 100));
  var resteACouvrir = Math.max(0, pointMort - realiseVendu);
  var maxMensuel = Math.max.apply(null, agg.parMois.concat([1]));
  var negoListe = Object.keys(agg.parAgent).map(function(id){
    return { id: id, nom: nomAgent(id), comm: agg.parAgent[id].comm, nb: agg.parAgent[id].nb };
  }).sort(function(a, b){ return b.comm - a.comm; });
  var maxNego = Math.max.apply(null, negoListe.map(function(x){ return x.comm; }).concat([1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--g900)", margin: 0 }}>{"\uD83D\uDCC8 Suivi de production " + anneeVue}</h2>
          <p style={{ fontSize: 13, color: "var(--g500)", margin: "4px 0 0" }}>{"Alimenté automatiquement par les mandats \u00B7 " + mandatsProd.length + " bien(s) en sous offre / compromis / vendu."}</p>
        </div>
        {isManager && <button className="btn btn-secondary btn-sm" onClick={function(){ setShowObjectif(true); }}>{"\u2699\uFE0F Objectif / point mort"}</button>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Carte label="Commissions vendues" valeur={fmt(realiseVendu)} sous="actes signés" couleur="#16A34A" />
        <Carte label="En cours (offre+compromis)" valeur={fmt(enCours)} sous="pipeline" couleur="#3B82F6" />
        <Carte label="Point mort annuel" valeur={fmt(pointMort)} sous={"Objectif mensuel : " + fmt(Math.round(pointMort/12))} couleur="#64748B" />
        <Carte label="Reste à couvrir" valeur={fmt(resteACouvrir)} sous={resteACouvrir===0 ? "Point mort atteint !" : "avant équilibre"} couleur={resteACouvrir===0 ? "#16A34A" : "#F59E0B"} />
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)" }}>{"Couverture du point mort (commissions vendues)"}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: tauxAtteinte >= 100 ? "#16A34A" : "var(--red)" }}>{tauxAtteinte + " %"}</span>
        </div>
        <div style={{ height: 22, background: "var(--g100)", borderRadius: 11, overflow: "hidden" }}>
          <div style={{ height: "100%", width: tauxAtteinte + "%", background: tauxAtteinte >= 100 ? "#16A34A" : "linear-gradient(90deg,#E8001D,#FF6B6B)", borderRadius: 11, transition: "width .4s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--g400)", marginTop: 4 }}>
          <span>{fmt(realiseVendu)}</span><span>{fmt(pointMort)}</span>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 12 }}>{"Pipeline par statut (commissions)"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {STATUTS_PROD.map(function(s){
            var montant = agg.parStatut[s] || 0;
            var nb = mandatsProd.filter(function(m){ return m.statut === s; }).length;
            var maxStat = Math.max.apply(null, STATUTS_PROD.map(function(x){ return agg.parStatut[x]||0; }).concat([1]));
            var pct = Math.round((montant / maxStat) * 100);
            return (
              <div key={s}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span style={{ fontWeight:600, color: STATUT_COULEUR[s] }}>{STATUT_LABEL[s] + " (" + nb + ")"}</span>
                  <span style={{ color:"var(--g600)" }}>{fmt(montant)}</span>
                </div>
                <div style={{ height:8, background:"var(--g100)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", background:STATUT_COULEUR[s], borderRadius:4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Commissions par mois"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
          {agg.parMois.map(function (montant, i) {
            var h = Math.round((montant / maxMensuel) * 130);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: "var(--g500)", height: 12 }}>{montant > 0 ? Math.round(montant/1000)+"k" : ""}</div>
                <div style={{ width: "100%", maxWidth: 34, height: Math.max(2, h), background: montant > 0 ? "var(--red)" : "var(--g200)", borderRadius: "4px 4px 0 0" }} />
                <div style={{ fontSize: 10, color: "var(--g500)" }}>{MOIS_NOMS[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Production par agent (co-agents partagés)"}</div>
        {negoListe.length === 0 && <div style={{fontSize:13,color:"var(--g400)",textAlign:"center",padding:16}}>{"Aucun mandat en production pour " + anneeVue}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {negoListe.map(function (n, i) {
            var pct = Math.round((n.comm / maxNego) * 100);
            var ini = n.nom.split(" ").map(function(x){return x[0];}).join("").slice(0,2).toUpperCase();
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: avatarColor(n.nom), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: "var(--g800)" }}>{n.nom}</span>
                    <span style={{ color: "var(--g600)" }}>{fmt(Math.round(n.comm)) + " \u00B7 " + (n.nb % 1 === 0 ? n.nb : n.nb.toFixed(1)) + " bien" + (n.nb > 1 ? "s" : "")}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--g100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: avatarColor(n.nom), borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--g400)", textAlign: "center" }}>
        {"La production se met à jour automatiquement quand un agent change le statut d'un mandat."}
      </div>

      {showObjectif && <ObjectifForm pointMort={pointMort} agence={agence} onClose={function(){ setShowObjectif(false); }} />}
    </div>
  );
}

function ObjectifForm({ pointMort, agence, onClose }) {
  var ctx = useApp();
  var [charges, setCharges] = useState(function(){
    return (agence.chargesDetail && agence.chargesDetail.length)
      ? agence.chargesDetail.map(function(c){ return Object.assign({}, c); })
      : [{ cat:"Charges externes", poste:"", montant:0 }];
  });

  var totalCharges = charges.reduce(function(s, c){ return s + (parseFloat(c.montant) || 0); }, 0);

  function majMontant(i, val){
    setCharges(function(prev){
      var n = prev.slice(); n[i] = Object.assign({}, n[i], { montant: val }); return n;
    });
  }
  function majPoste(i, val){
    setCharges(function(prev){
      var n = prev.slice(); n[i] = Object.assign({}, n[i], { poste: val }); return n;
    });
  }
  function supprimer(i){
    setCharges(function(prev){ return prev.filter(function(_, idx){ return idx !== i; }); });
  }
  function ajouter(cat){
    setCharges(function(prev){ return prev.concat([{ cat: cat, poste: "", montant: 0 }]); });
  }

  function enregistrer(){
    var pm = Math.round(totalCharges);
    ctx.setAgences(function(prev){
      return (prev || []).map(function(a){
        return a.id === agence.id ? Object.assign({}, a, { pointMort: pm, chargesDetail: charges }) : a;
      });
    });
    onClose();
  }

  var CATS = ["Personnel", "Charges externes", "Taxes", "Frais financiers"];
  var COULEUR_CAT = { "Personnel":"#E8001D", "Charges externes":"#1D3557", "Taxes":"#F59E0B", "Frais financiers":"#8B5CF6" };

  var champ = { padding:"6px 8px", borderRadius:6, border:"1px solid var(--g300)", fontSize:13, boxSizing:"border-box" };

  return (
    <Modal title={"\u2699\uFE0F Point mort \u2014 détail des charges"} onClose={onClose} wide>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <p style={{ fontSize:13, color:"var(--g500)", margin:0 }}>
          {"Le point mort est la somme de vos charges annuelles à couvrir par les commissions. Modifiez les postes ; le total se recalcule automatiquement."}
        </p>

        {/* Total en évidence */}
        <div style={{ background:"linear-gradient(135deg,var(--navy),#1a3a5c)", borderRadius:12, padding:"14px 18px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, opacity:0.85 }}>{"Point mort annuel"}</span>
          <span style={{ fontSize:26, fontWeight:900 }}>{fmt(Math.round(totalCharges))}</span>
        </div>
        <div style={{ fontSize:12, color:"var(--g500)", textAlign:"right", marginTop:-8 }}>
          {"soit " + fmt(Math.round(totalCharges/12)) + " / mois"}
        </div>

        {/* Postes groupés par catégorie */}
        {CATS.map(function(cat){
          var postes = charges.map(function(c, i){ return { c: c, i: i }; }).filter(function(x){ return x.c.cat === cat; });
          var sousTotal = postes.reduce(function(s, x){ return s + (parseFloat(x.c.montant)||0); }, 0);
          if (postes.length === 0) {
            return (
              <div key={cat} style={{ borderTop:"2px solid "+COULEUR_CAT[cat], paddingTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:700, fontSize:13, color:COULEUR_CAT[cat] }}>{cat}</span>
                  <button className="btn btn-secondary btn-sm" onClick={function(){ ajouter(cat); }}>{"+ Ajouter"}</button>
                </div>
              </div>
            );
          }
          return (
            <div key={cat} style={{ borderTop:"2px solid "+COULEUR_CAT[cat], paddingTop:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontWeight:700, fontSize:13, color:COULEUR_CAT[cat] }}>{cat}</span>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--g700)" }}>{fmt(sousTotal)}</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {postes.map(function(x){
                  return (
                    <div key={x.i} style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input style={Object.assign({flex:"1 1 auto", minWidth:0}, champ)} value={x.c.poste}
                        onChange={function(e){ majPoste(x.i, e.target.value); }} placeholder="Poste de charge" />
                      <input style={Object.assign({flex:"0 0 100px", textAlign:"right"}, champ)} type="number" value={x.c.montant}
                        onChange={function(e){ majMontant(x.i, e.target.value); }} />
                      <span style={{ fontSize:12, color:"var(--g400)" }}>{"\u20AC"}</span>
                      <span onClick={function(){ supprimer(x.i); }} style={{ cursor:"pointer", color:"var(--g400)", fontSize:14, padding:"0 4px" }}>{"\u00D7"}</span>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop:6 }} onClick={function(){ ajouter(cat); }}>{"+ Ajouter un poste"}</button>
            </div>
          );
        })}

        <button className="btn btn-primary" onClick={enregistrer} style={{ marginTop:6 }}>
          {"\uD83D\uDCBE Enregistrer le point mort (" + fmt(Math.round(totalCharges)) + ")"}
        </button>
      </div>
    </Modal>
  );
}
