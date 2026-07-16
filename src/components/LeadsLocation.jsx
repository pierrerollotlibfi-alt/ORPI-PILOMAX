import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal } from "./Shared";

// ─── GESTION DES DEMANDES DE LOCATION (cote equipe) ─────────────────────────
// Affiche les recherches de location soumises via le formulaire public (QR code).

var STATUTS = [
  { v: "nouveau",    label: "Nouveau",     couleur: "#E63946", bg: "#FEF2F2" },
  { v: "contacte",   label: "Contacte",    couleur: "#F59E0B", bg: "#FFFBEB" },
  { v: "en_cours",   label: "En cours",    couleur: "#3B82F6", bg: "#EFF6FF" },
  { v: "traite",     label: "Traite",      couleur: "#16A34A", bg: "#F0FDF4" },
  { v: "sans_suite", label: "Sans suite",  couleur: "#94A3B8", bg: "#F1F5F9" },
];

function statutInfo(v) {
  return STATUTS.find(function(s){ return s.v === v; }) || STATUTS[0];
}

export default function LeadsLocation() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var demandes = (ctx.recherchesLoc || []).filter(function(d){ return d.agenceId === agenceId; });

  var [filtre, setFiltre] = useState("");
  var [detail, setDetail] = useState(null);

  var listeFiltree = useMemo(function(){
    var arr = demandes.slice().sort(function(a,b){ return (b.date||"").localeCompare(a.date||""); });
    if (filtre) arr = arr.filter(function(d){ return (d.statut||"nouveau") === filtre; });
    return arr;
  }, [demandes, filtre]);

  var compteurs = useMemo(function(){
    var c = {};
    STATUTS.forEach(function(s){ c[s.v] = 0; });
    demandes.forEach(function(d){ var s = d.statut||"nouveau"; c[s] = (c[s]||0)+1; });
    return c;
  }, [demandes]);

  function changerStatut(id, statut) {
    ctx.setRecherchesLoc(function(prev){
      return (prev||[]).map(function(d){ return d.id===id ? Object.assign({}, d, { statut: statut }) : d; });
    });
    if (detail && detail.id === id) setDetail(Object.assign({}, detail, { statut: statut }));
  }

  function supprimer(id) {
    if (!window.confirm("Supprimer cette demande ?")) return;
    ctx.setRecherchesLoc(function(prev){ return (prev||[]).filter(function(d){ return d.id!==id; }); });
    setDetail(null);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try { var d = new Date(iso); return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"}); }
    catch(e) { return iso.slice(0,10); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <h2 style={{ fontSize:20, fontWeight:700, color:"var(--g900)", margin:0 }}>{"\uD83C\uDFE0 Recherches de location"}</h2>
        <p style={{ fontSize:13, color:"var(--g500)", margin:"4px 0 0" }}>
          {"Demandes recues via le formulaire public (QR code en agence) \u00B7 " + demandes.length + " au total"}
        </p>
      </div>

      {/* Filtres par statut */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <button onClick={function(){ setFiltre(""); }}
          style={{ padding:"7px 12px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
            border: filtre==="" ? "2px solid var(--navy)" : "1px solid var(--g300)",
            background: filtre==="" ? "var(--navy)" : "#fff", color: filtre==="" ? "#fff" : "var(--g600)" }}>
          {"Toutes (" + demandes.length + ")"}
        </button>
        {STATUTS.map(function(s){
          return (
            <button key={s.v} onClick={function(){ setFiltre(s.v); }}
              style={{ padding:"7px 12px", borderRadius:20, fontSize:13, fontWeight:600, cursor:"pointer",
                border: filtre===s.v ? "2px solid "+s.couleur : "1px solid var(--g300)",
                background: filtre===s.v ? s.couleur : "#fff", color: filtre===s.v ? "#fff" : "var(--g600)" }}>
              {s.label + " (" + (compteurs[s.v]||0) + ")"}
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {listeFiltree.length === 0 && (
        <div style={{ background:"#fff", border:"1px dashed var(--g300)", borderRadius:12, padding:30, textAlign:"center", color:"var(--g400)" }}>
          <div style={{ fontSize:34, marginBottom:8 }}>{"\uD83D\uDCED"}</div>
          <div style={{ fontWeight:700, color:"var(--g600)" }}>{"Aucune demande" + (filtre ? " dans ce statut" : "")}</div>
          {!filtre && <div style={{ fontSize:12, marginTop:4 }}>{"Les recherches soumises via le QR code apparaitront ici."}</div>}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {listeFiltree.map(function(d){
          var si = statutInfo(d.statut||"nouveau");
          return (
            <div key={d.id} onClick={function(){ setDetail(d); }}
              style={{ background:"#fff", border:"1px solid var(--g200)", borderLeft:"4px solid "+si.couleur, borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:"var(--g800)" }}>
                  {d.prenom + " " + d.nom}
                  <span style={{ fontWeight:400, color:"var(--g500)", fontSize:13 }}>
                    {d.typeBien ? "  \u00B7  " + d.typeBien : ""}{d.budget ? "  \u00B7  " + d.budget + " \u20AC/mois" : ""}
                  </span>
                </div>
                <div style={{ fontSize:12, color:"var(--g500)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {(d.secteur ? d.secteur + "  \u00B7  " : "") + (d.situation||"") + (d.tel ? "  \u00B7  " + d.tel : "")}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, background:si.bg, color:si.couleur }}>{si.label}</span>
                <span style={{ fontSize:11, color:"var(--g400)" }}>{fmtDate(d.date).split(" ")[0]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail */}
      {detail && (
        <Modal title={"\uD83C\uDFE0 " + detail.prenom + " " + detail.nom} onClose={function(){ setDetail(null); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Statut */}
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--g600)", marginBottom:6 }}>{"Statut du suivi"}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {STATUTS.map(function(s){
                  var actif = (detail.statut||"nouveau") === s.v;
                  return (
                    <button key={s.v} onClick={function(){ changerStatut(detail.id, s.v); }}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                        border: actif ? "2px solid "+s.couleur : "1px solid var(--g300)",
                        background: actif ? s.couleur : "#fff", color: actif ? "#fff" : "var(--g600)" }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Bloc titre="Contact">
              <Ligne label="Telephone" val={detail.tel} lien={detail.tel ? "tel:"+detail.tel : null} />
              <Ligne label="Email" val={detail.email} lien={detail.email ? "mailto:"+detail.email : null} />
              <Ligne label="Recu le" val={fmtDate(detail.date)} />
            </Bloc>

            <Bloc titre="Situation">
              <Ligne label="Date d'emmenagement" val={detail.dateButoir ? detail.dateButoir.split("-").reverse().join("/") : ""} />
              <Ligne label="Situation pro" val={detail.situation} />
              <Ligne label="Profession" val={detail.profession} />
              <Ligne label="Employeur" val={detail.employeur} />
              <Ligne label="Revenus nets/mois" val={detail.revenus ? detail.revenus + " \u20AC" : ""} />
            </Bloc>

            <Bloc titre="Bien recherche">
              <Ligne label="Type" val={detail.typeBien} />
              <Ligne label="Meuble" val={detail.meubleNonMeuble === "meuble" ? "Meuble" : detail.meubleNonMeuble === "non_meuble" ? "Non meuble" : "Peu importe"} />
              <Ligne label="Secteur" val={detail.secteur} />
              <Ligne label="Budget max" val={detail.budget ? detail.budget + " \u20AC/mois" : ""} />
              <Ligne label="Precisions" val={detail.specifications} />
            </Bloc>

            <button onClick={function(){ supprimer(detail.id); }}
              style={{ padding:"10px", background:"#fff", color:"var(--red)", border:"1px solid #FECACA", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {"\uD83D\uDDD1\uFE0F Supprimer cette demande"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Bloc({ titre, children }) {
  return (
    <div style={{ background:"var(--g50,#F8FAFC)", border:"1px solid var(--g200)", borderRadius:10, padding:12 }}>
      <div style={{ fontSize:11, fontWeight:800, color:"var(--red)", textTransform:"uppercase", letterSpacing:0.4, marginBottom:8 }}>{titre}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>{children}</div>
    </div>
  );
}

function Ligne({ label, val, lien }) {
  if (!val) return null;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", gap:12, fontSize:13 }}>
      <span style={{ color:"var(--g500)", flexShrink:0 }}>{label}</span>
      {lien
        ? <a href={lien} style={{ color:"var(--navy)", fontWeight:600, textAlign:"right", wordBreak:"break-word" }}>{val}</a>
        : <span style={{ color:"var(--g800)", fontWeight:600, textAlign:"right", wordBreak:"break-word" }}>{val}</span>}
    </div>
  );
}
