import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal, fmt, avatarColor } from "./Shared";

// ─── SUIVI DE PRODUCTION (CA réalisé encaissé) ──────────────────────────────
// Source unique du CA réalisé. Lit la collection "ventes" en temps réel.
// Saisie : commission TTC, 1 ou 2 négociateurs, taux de reversement, mois.
// Calcul auto TTC -> HT -> part agence / part négo + couverture point mort.

var MOIS_NOMS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
var MOIS_LONG = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function Carte({ label, valeur, sous, couleur }) {
  return (
    <div style={{
      flex: "1 1 150px", minWidth: 140, background: "#fff",
      border: "1px solid var(--g200)", borderRadius: 12, padding: "14px 16px",
      borderTop: "3px solid " + (couleur || "var(--navy)"),
    }}>
      <div style={{ fontSize: 11, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--g900)" }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: "var(--g400)", marginTop: 2 }}>{sous}</div>}
    </div>
  );
}

export default function SuiviProduction() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var calcVente = ctx.calcVente;
  var ventes = (ctx.ventes || []).filter(function(v){ return v.agenceId === agenceId; });
  var agents = (ctx.users || []).filter(function(u){
    return u.agenceId === agenceId &&
      (u.role === "agent" || u.role === "manager" || u.role === "superadmin" || u.role === "admin");
  });

  var annee = new Date().getFullYear();
  var [anneeVue, setAnneeVue] = useState(2026);
  var [showForm, setShowForm] = useState(false);
  var [editVente, setEditVente] = useState(null);

  // Point mort : stocké sur l'agence (champ pointMort), défaut 292037
  var agence = (ctx.agences || []).find(function(a){ return a.id === agenceId; }) || {};
  var pointMort = agence.pointMort || 292037;

  function nomAgent(id) {
    var a = agents.find(function(x){ return x.id === id; });
    if (a) return a.prenom + " " + a.nom;
    if (id === "manager-1") return "Agence";
    return "?";
  }

  var ventesAnnee = useMemo(function(){
    return ventes.filter(function(v){ return (v.annee || 2026) === anneeVue; });
  }, [ventes, anneeVue]);

  // Agrégats globaux
  var agg = useMemo(function(){
    var ttc = 0, ht = 0, partAgence = 0, partNego = 0;
    var parMois = MOIS_NOMS.map(function(){ return { ttc:0, partAgence:0 }; });
    var parNego = {};
    ventesAnnee.forEach(function(v){
      var c = calcVente(v);
      ttc += c.ttc; ht += c.ht; partAgence += c.partAgence; partNego += c.partNego;
      var mi = (v.mois || 1) - 1;
      if (parMois[mi]) { parMois[mi].ttc += c.ttc; parMois[mi].partAgence += c.partAgence; }
      Object.keys(c.credits).forEach(function(aid){
        if (!parNego[aid]) parNego[aid] = { ttc:0, nb:0 };
        parNego[aid].ttc += c.credits[aid];
        parNego[aid].nb += (v.agentId2 ? 0.5 : 1);
      });
    });
    // cumul
    var cumul = 0;
    var parMoisCumul = parMois.map(function(m){ cumul += m.partAgence; return cumul; });
    return { ttc:ttc, ht:ht, partAgence:partAgence, partNego:partNego, parMois:parMois, parMoisCumul:parMoisCumul, parNego:parNego };
  }, [ventesAnnee, calcVente]);

  var tauxAtteinte = Math.min(100, Math.round((agg.partAgence / pointMort) * 100));
  var resteACouvrir = Math.max(0, pointMort - agg.partAgence);
  var maxMensuel = Math.max.apply(null, agg.parMois.map(function(x){return x.partAgence;}).concat([1]));
  var negoListe = Object.keys(agg.parNego).map(function(aid){
    return { id:aid, nom:nomAgent(aid), ttc:agg.parNego[aid].ttc, nb:agg.parNego[aid].nb };
  }).sort(function(a,b){ return b.ttc - a.ttc; });
  var maxNego = Math.max.apply(null, negoListe.map(function(x){return x.ttc;}).concat([1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--g900)", margin: 0 }}>
            {"\uD83D\uDCC8 Suivi de production " + anneeVue}
          </h2>
          <p style={{ fontSize: 13, color: "var(--g500)", margin: "4px 0 0" }}>
            {"CA réalisé encaissé \u00B7 " + ventesAnnee.length + " vente(s) \u00B7 couverture du point mort agence."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={function(){ setEditVente(null); setShowForm(true); }}>
          {"\u2795 Nouvelle vente"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Carte label="Production TTC" valeur={fmt(agg.ttc)} sous={"HT : " + fmt(agg.ht)} couleur="var(--navy)" />
        <Carte label="Part agence HT" valeur={fmt(agg.partAgence)} sous={"Part négos : " + fmt(agg.partNego)} couleur="var(--red)" />
        <Carte label="Point mort annuel" valeur={fmt(pointMort)} sous={"Objectif mensuel : " + fmt(Math.round(pointMort/12))} couleur="#64748B" />
        <Carte label="Reste à couvrir" valeur={fmt(resteACouvrir)} sous={resteACouvrir===0 ? "Point mort atteint !" : "avant équilibre"} couleur={resteACouvrir===0 ? "#16A34A" : "#F59E0B"} />
      </div>

      {/* Jauge */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)" }}>{"Couverture du point mort"}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: tauxAtteinte >= 100 ? "#16A34A" : "var(--red)" }}>{tauxAtteinte + " %"}</span>
        </div>
        <div style={{ height: 22, background: "var(--g100)", borderRadius: 11, overflow: "hidden" }}>
          <div style={{ height: "100%", width: tauxAtteinte + "%", background: tauxAtteinte >= 100 ? "#16A34A" : "linear-gradient(90deg,#E8001D,#FF6B6B)", borderRadius: 11, transition: "width .4s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--g400)", marginTop: 4 }}>
          <span>{fmt(agg.partAgence)}</span><span>{fmt(pointMort)}</span>
        </div>
      </div>

      {/* Part agence HT par mois */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Part agence HT par mois"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
          {agg.parMois.map(function (mo, i) {
            var h = Math.round((mo.partAgence / maxMensuel) * 130);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: "var(--g500)", height: 12 }}>{mo.partAgence > 0 ? Math.round(mo.partAgence/1000)+"k" : ""}</div>
                <div style={{ width: "100%", maxWidth: 34, height: Math.max(2, h), background: mo.partAgence > 0 ? "var(--red)" : "var(--g200)", borderRadius: "4px 4px 0 0" }} />
                <div style={{ fontSize: 10, color: "var(--g500)" }}>{MOIS_NOMS[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production par négociateur */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Production par négociateur (CA TTC réparti)"}</div>
        {negoListe.length === 0 && <div style={{fontSize:13,color:"var(--g400)",textAlign:"center",padding:16}}>{"Aucune vente saisie pour " + anneeVue}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {negoListe.map(function (n, i) {
            var pct = Math.round((n.ttc / maxNego) * 100);
            var ini = n.nom.split(" ").map(function(x){return x[0];}).join("").slice(0,2).toUpperCase();
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: avatarColor(n.nom), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: "var(--g800)" }}>{n.nom}</span>
                    <span style={{ color: "var(--g600)" }}>{fmt(n.ttc) + " \u00B7 " + (n.nb % 1 === 0 ? n.nb : n.nb.toFixed(1)) + " vente" + (n.nb > 1 ? "s" : "")}</span>
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

      {/* Liste des ventes */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 12 }}>{"Détail des ventes"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:"40vh", overflowY:"auto" }}>
          {ventesAnnee.slice().sort(function(a,b){ return (b.mois||0)-(a.mois||0); }).map(function(v){
            var c = calcVente(v);
            return (
              <div key={v.id} onClick={function(){ setEditVente(v); setShowForm(true); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, border:"1px solid var(--g200)", cursor:"pointer" }}>
                <div style={{ flex:"0 0 38px", fontSize:11, color:"var(--g500)", fontWeight:600 }}>{MOIS_NOMS[(v.mois||1)-1]}</div>
                <div style={{ flex:"1 1 auto", minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--g800)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {nomAgent(v.agentId) + (v.agentId2 ? " + " + nomAgent(v.agentId2) : "")}
                  </div>
                  <div style={{ fontSize:11, color:"var(--g500)" }}>{(v.bien || v.mandatRef || "Vente") + (v.binome || v.agentId2 ? " \u00B7 binôme" : "")}</div>
                </div>
                <div style={{ flex:"0 0 auto", textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--g900)" }}>{fmt(c.ttc)}</div>
                  <div style={{ fontSize:10, color:"var(--g400)" }}>{"agence " + fmt(c.partAgence)}</div>
                </div>
              </div>
            );
          })}
          {ventesAnnee.length === 0 && <div style={{fontSize:13,color:"var(--g400)",textAlign:"center",padding:16}}>{"Aucune vente. Cliquez sur \u00AB Nouvelle vente \u00BB."}</div>}
        </div>
      </div>

      {showForm && <VenteForm vente={editVente} agents={agents} onClose={function(){ setShowForm(false); }} />}
    </div>
  );
}

// ─── FORMULAIRE DE SAISIE D'UNE VENTE ───────────────────────────────────────
function VenteForm({ vente, agents, onClose }) {
  var ctx = useApp();
  var calcVente = ctx.calcVente;
  var isEdit = !!vente;

  var [f, setF] = useState(function(){
    return vente ? Object.assign({}, vente) : {
      mois: new Date().getMonth() + 1,
      annee: 2026,
      agentId: agents[0] ? agents[0].id : "",
      agentId2: "",
      bien: "",
      mandatRef: "",
      commissionTTC: "",
      tauxReverse: 0.5,
      statut: "acte",
    };
  });

  function up(k, val){ setF(function(prev){ var n = Object.assign({}, prev); n[k] = val; return n; }); }

  var preview = calcVente({
    commissionTTC: parseFloat(f.commissionTTC) || 0,
    tauxReverse: parseFloat(f.tauxReverse),
    agentId: f.agentId, agentId2: f.agentId2 || null,
  });

  function enregistrer(){
    var ttc = parseFloat(f.commissionTTC) || 0;
    if (ttc <= 0) return;
    var v = {
      id: vente ? vente.id : "V-" + Date.now(),
      agenceId: ctx.currentUser.agenceId,
      annee: parseInt(f.annee) || 2026,
      mois: parseInt(f.mois) || 1,
      date: f.annee + "-" + String(f.mois).padStart(2,"0") + "-15",
      agentId: f.agentId,
      agentId2: f.agentId2 || null,
      bien: f.bien || "",
      mandatRef: f.mandatRef || "",
      commissionTTC: ttc,
      tauxReverse: parseFloat(f.tauxReverse),
      statut: f.statut || "acte",
      binome: !!f.agentId2,
    };
    ctx.setVentes(function(prev){
      var arr = (prev || []).slice();
      var idx = arr.findIndex(function(x){ return x.id === v.id; });
      if (idx >= 0) arr[idx] = v; else arr.push(v);
      return arr;
    });
    if (ctx.addJournal) {
      ctx.addJournal({ type: isEdit ? "modification" : "creation", description: (isEdit?"Vente modifiée":"Vente saisie") + " " + fmt(ttc), cible: "vente" });
    }
    onClose();
  }

  function supprimer(){
    if (!vente) return;
    ctx.setVentes(function(prev){ return (prev||[]).filter(function(x){ return x.id !== vente.id; }); });
    onClose();
  }

  var champStyle = { width:"100%", padding:"9px 10px", borderRadius:8, border:"1px solid var(--g300)", fontSize:14, boxSizing:"border-box" };
  var labelStyle = { fontSize:12, fontWeight:600, color:"var(--g600)", marginBottom:4, display:"block" };

  return (
    <Modal title={isEdit ? "\u270F\uFE0F Modifier la vente" : "\u2795 Nouvelle vente"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>{"Mois"}</label>
            <select style={champStyle} value={f.mois} onChange={function(e){ up("mois", e.target.value); }}>
              {MOIS_LONG.map(function(m,i){ return <option key={i} value={i+1}>{m}</option>; })}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>{"Année"}</label>
            <input style={champStyle} type="number" value={f.annee} onChange={function(e){ up("annee", e.target.value); }} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{"Négociateur principal"}</label>
          <select style={champStyle} value={f.agentId} onChange={function(e){ up("agentId", e.target.value); }}>
            {agents.map(function(a){ return <option key={a.id} value={a.id}>{a.prenom + " " + a.nom}</option>; })}
          </select>
        </div>

        <div>
          <label style={labelStyle}>{"Co-négociateur (binôme) \u2014 optionnel"}</label>
          <select style={champStyle} value={f.agentId2 || ""} onChange={function(e){ up("agentId2", e.target.value); }}>
            <option value="">{"\u2014 Aucun (vente seul) \u2014"}</option>
            {agents.filter(function(a){ return a.id !== f.agentId; }).map(function(a){ return <option key={a.id} value={a.id}>{a.prenom + " " + a.nom}</option>; })}
          </select>
          {f.agentId2 && <div style={{fontSize:11,color:"var(--g500)",marginTop:4}}>{"Le CA TTC sera partagé 50/50 entre les deux négociateurs."}</div>}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>{"Commission TTC (€)"}</label>
            <input style={champStyle} type="number" value={f.commissionTTC} onChange={function(e){ up("commissionTTC", e.target.value); }} placeholder="10000" />
          </div>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>{"Taux reversé au négo"}</label>
            <select style={champStyle} value={f.tauxReverse} onChange={function(e){ up("tauxReverse", e.target.value); }}>
              <option value="0.5">{"50 % (agent commercial seul)"}</option>
              <option value="0.25">{"25 % (binôme / salarié)"}</option>
              <option value="0">{"0 % (100 % agence)"}</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{"Bien / référence (optionnel)"}</label>
          <input style={champStyle} value={f.bien} onChange={function(e){ up("bien", e.target.value); }} placeholder="Rue Lemerchier / SB-12" />
        </div>

        {/* Aperçu calcul */}
        <div style={{ background:"var(--g50,#F8FAFC)", border:"1px solid var(--g200)", borderRadius:10, padding:12, fontSize:13 }}>
          <div style={{ fontWeight:600, color:"var(--g700)", marginBottom:6 }}>{"Calcul automatique"}</div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{color:"var(--g500)"}}>{"Commission HT (TVA 20 %)"}</span><span style={{fontWeight:600}}>{fmt(Math.round(preview.ht))}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{color:"var(--g500)"}}>{"Part négociateur"}</span><span style={{fontWeight:600}}>{fmt(Math.round(preview.partNego))}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{color:"var(--g500)"}}>{"Part agence (point mort)"}</span><span style={{fontWeight:700,color:"var(--red)"}}>{fmt(Math.round(preview.partAgence))}</span></div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginTop:4 }}>
          {isEdit
            ? <button className="btn btn-secondary" onClick={supprimer} style={{color:"var(--red)"}}>{"\uD83D\uDDD1\uFE0F Supprimer"}</button>
            : <span/>}
          <button className="btn btn-primary" onClick={enregistrer} disabled={!(parseFloat(f.commissionTTC) > 0)}>
            {isEdit ? "\uD83D\uDCBE Enregistrer" : "\u2795 Ajouter la vente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
