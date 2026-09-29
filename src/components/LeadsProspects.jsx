import { useState, useMemo } from "react";
import { useApp } from "../App";
import { Modal } from "./Shared";

// ─── GESTION DES PROSPECTS PRE-OUVERTURE (cote equipe) ──────────────────────
// Prospects captes via le QR code vitrine/flyers, segmentes par secteur.

var SECTEUR_LABEL = { corbie:"Corbie", doullens:"Doullens", amiens:"Amiens", autre:"Autre" };
var SECTEUR_COULEUR = { corbie:"#059669", doullens:"#7C3AED", amiens:"#E2001A", autre:"#64748B" };
var PROJET_LABEL = {
  acheter:"Acheter", vendre:"Vendre", estimer:"Estimation",
  louer:"Cherche location", bailleur:"Met en location", gestion:"Gestion locative",
};
var DELAI_LABEL = { immediat:"Dès que possible", "3mois":"Sous 3 mois", "6mois":"Sous 6 mois", "1an":"Dans l'année", renseigne:"Se renseigne" };
var STATUTS = [
  { v:"nouveau",    label:"Nouveau",    c:"#E2001A", bg:"#FEF2F2" },
  { v:"contacte",   label:"Contacté",   c:"#F59E0B", bg:"#FFFBEB" },
  { v:"rdv",        label:"RDV pris",   c:"#3B82F6", bg:"#EFF6FF" },
  { v:"converti",   label:"Converti",   c:"#16A34A", bg:"#F0FDF4" },
  { v:"sans_suite", label:"Sans suite", c:"#94A3B8", bg:"#F1F5F9" },
];
function statutInfo(v){ return STATUTS.find(function(s){return s.v===v;}) || STATUTS[0]; }

export default function LeadsProspects() {
  var ctx = useApp();
  var agenceId = ctx.currentUser.agenceId;
  var prospects = (ctx.prospects || []).filter(function(p){ return p.agenceId === agenceId; });

  var [fSecteur, setFSecteur] = useState("");
  var [fProjet, setFProjet] = useState("");
  var [fStatut, setFStatut] = useState("");
  var [recherche, setRecherche] = useState("");
  var [detail, setDetail] = useState(null);

  var liste = useMemo(function(){
    var arr = prospects.slice().sort(function(a,b){ return (b.date||"").localeCompare(a.date||""); });
    if (fSecteur) arr = arr.filter(function(p){ return p.secteur===fSecteur; });
    if (fProjet) arr = arr.filter(function(p){ return p.projet===fProjet; });
    if (fStatut) arr = arr.filter(function(p){ return (p.statut||"nouveau")===fStatut; });
    if (recherche.trim()) {
      var q = recherche.trim().toLowerCase();
      arr = arr.filter(function(p){ return ((p.prenom||"")+" "+(p.nom||"")+" "+(p.commune||"")+" "+(p.tel||"")+" "+(p.email||"")).toLowerCase().indexOf(q)!==-1; });
    }
    return arr;
  }, [prospects, fSecteur, fProjet, fStatut, recherche]);

  // Compteurs par secteur
  var parSecteur = useMemo(function(){
    var c = { corbie:0, doullens:0, amiens:0, autre:0 };
    prospects.forEach(function(p){ if(c[p.secteur]!==undefined) c[p.secteur]++; });
    return c;
  }, [prospects]);
  var nouveaux = prospects.filter(function(p){ return (p.statut||"nouveau")==="nouveau"; }).length;

  function changerStatut(id, statut){
    ctx.setProspects(function(prev){ return (prev||[]).map(function(p){ return p.id===id?Object.assign({},p,{statut:statut}):p; }); });
    if (detail && detail.id===id) setDetail(Object.assign({}, detail, {statut:statut}));
  }
  function supprimer(id){
    if(!window.confirm("Supprimer ce prospect ?")) return;
    ctx.setProspects(function(prev){ return (prev||[]).filter(function(p){ return p.id!==id; }); });
    setDetail(null);
  }
  function fmtDate(iso){ if(!iso) return ""; try{ var d=new Date(iso); return d.toLocaleDateString("fr-FR"); }catch(e){ return iso.slice(0,10); } }

  var selStyle = { padding:"8px 10px", borderRadius:8, border:"1px solid var(--g300)", fontSize:13, boxSizing:"border-box", width:"100%" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <h2 style={{ fontSize:20, fontWeight:700, color:"var(--g900)", margin:0 }}>{"\uD83C\uDFAF Prospects pré-ouverture"}</h2>
        <p style={{ fontSize:13, color:"var(--g500)", margin:"4px 0 0" }}>
          {"Captés via le QR code vitrine / flyers \u00B7 " + prospects.length + " prospect(s)" + (nouveaux>0 ? " \u00B7 " + nouveaux + " nouveau(x)" : "")}
        </p>
      </div>

      {/* Cartes par secteur */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:10 }}>
        {["corbie","doullens","amiens","autre"].map(function(sec){
          return (
            <div key={sec} onClick={function(){ setFSecteur(fSecteur===sec?"":sec); }}
              style={{ background:"#fff", border: fSecteur===sec?"2px solid "+SECTEUR_COULEUR[sec]:"1px solid var(--g200)", borderTop:"3px solid "+SECTEUR_COULEUR[sec], borderRadius:12, padding:"12px 14px", cursor:"pointer" }}>
              <div style={{ fontSize:11, color:"var(--g500)", textTransform:"uppercase", letterSpacing:0.4 }}>{SECTEUR_LABEL[sec]}</div>
              <div style={{ fontSize:26, fontWeight:800, color:SECTEUR_COULEUR[sec] }}>{parSecteur[sec]}</div>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div style={{ background:"#fff", border:"1px solid var(--g200)", borderRadius:12, padding:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
          <select style={selStyle} value={fSecteur} onChange={function(e){ setFSecteur(e.target.value); }}>
            <option value="">{"Tous les secteurs"}</option>
            {Object.keys(SECTEUR_LABEL).map(function(s){ return <option key={s} value={s}>{SECTEUR_LABEL[s]}</option>; })}
          </select>
          <select style={selStyle} value={fProjet} onChange={function(e){ setFProjet(e.target.value); }}>
            <option value="">{"Tous les projets"}</option>
            {Object.keys(PROJET_LABEL).map(function(p){ return <option key={p} value={p}>{PROJET_LABEL[p]}</option>; })}
          </select>
          <select style={selStyle} value={fStatut} onChange={function(e){ setFStatut(e.target.value); }}>
            <option value="">{"Tous les statuts"}</option>
            {STATUTS.map(function(s){ return <option key={s.v} value={s.v}>{s.label}</option>; })}
          </select>
        </div>
        <input value={recherche} onChange={function(e){ setRecherche(e.target.value); }}
          placeholder={"\uD83D\uDD0D Rechercher un nom, commune, téléphone..."}
          style={{ width:"100%", marginTop:10, padding:"9px 12px", borderRadius:8, border:"1px solid var(--g300)", fontSize:13, boxSizing:"border-box" }} />
        <div style={{ fontSize:12, color:"var(--g500)", marginTop:8 }}>{liste.length + " prospect(s) affiché(s)"}</div>
      </div>

      {/* Liste */}
      {liste.length===0 && (
        <div style={{ background:"#fff", border:"1px dashed var(--g300)", borderRadius:12, padding:30, textAlign:"center", color:"var(--g400)" }}>
          <div style={{ fontSize:34, marginBottom:8 }}>{"\uD83C\uDFAF"}</div>
          <div style={{ fontWeight:700, color:"var(--g600)" }}>{"Aucun prospect" + (fSecteur||fProjet||fStatut||recherche ? " pour ces filtres" : "")}</div>
          <div style={{ fontSize:12, marginTop:4 }}>{"Les inscriptions via le QR code apparaîtront ici."}</div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {liste.map(function(p){
          var si = statutInfo(p.statut||"nouveau");
          var secCol = SECTEUR_COULEUR[p.secteur] || "#64748B";
          return (
            <div key={p.id} onClick={function(){ setDetail(p); }}
              style={{ background:"#fff", border:"1px solid var(--g200)", borderLeft:"4px solid "+secCol, borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:"var(--g800)" }}>
                  {p.prenom + " " + p.nom}
                  <span style={{ fontWeight:400, color:"var(--g500)", fontSize:13 }}>{p.projet ? "  \u00B7  " + (PROJET_LABEL[p.projet]||p.projet) : ""}</span>
                </div>
                <div style={{ fontSize:12, color:"var(--g500)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  <span style={{ color:secCol, fontWeight:700 }}>{SECTEUR_LABEL[p.secteur]||"?"}</span>
                  {p.commune ? " \u00B7 " + p.commune : ""}{p.tel ? " \u00B7 " + p.tel : ""}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, background:si.bg, color:si.c }}>{si.label}</span>
                <span style={{ fontSize:11, color:"var(--g400)" }}>{fmtDate(p.date)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail */}
      {detail && (
        <Modal title={"\uD83C\uDFAF " + detail.prenom + " " + detail.nom} onClose={function(){ setDetail(null); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--g600)", marginBottom:6 }}>{"Statut du suivi"}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {STATUTS.map(function(s){
                  var actif = (detail.statut||"nouveau")===s.v;
                  return (
                    <button key={s.v} onClick={function(){ changerStatut(detail.id, s.v); }}
                      style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                        border: actif?"2px solid "+s.c:"1px solid var(--g300)", background: actif?s.c:"#fff", color: actif?"#fff":"var(--g600)" }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Bloc titre="Contact">
              <Ligne label="Téléphone" val={detail.tel} lien={detail.tel?"tel:"+detail.tel:null} />
              <Ligne label="Email" val={detail.email} lien={detail.email?"mailto:"+detail.email:null} />
              <Ligne label="Reçu le" val={fmtDate(detail.date)} />
            </Bloc>

            <Bloc titre="Projet">
              <Ligne label="Secteur" val={SECTEUR_LABEL[detail.secteur]} />
              <Ligne label="Commune" val={detail.commune} />
              <Ligne label="Projet" val={PROJET_LABEL[detail.projet]||detail.projet} />
              <Ligne label="Type de bien" val={detail.typeBien} />
              <Ligne label="Budget" val={detail.budget?detail.budget+" \u20AC":""} />
              <Ligne label="Délai" val={DELAI_LABEL[detail.delai]||detail.delai} />
              <Ligne label="Message" val={detail.message} />
            </Bloc>

            <button onClick={function(){ supprimer(detail.id); }}
              style={{ padding:"10px", background:"#fff", color:"var(--red)", border:"1px solid #FECACA", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
              {"\uD83D\uDDD1\uFE0F Supprimer ce prospect"}
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
