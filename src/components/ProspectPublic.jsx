import { useState } from "react";
import { dbAppendPublic } from "../supabase";

// ─── FORMULAIRE PUBLIC : PROSPECT PRE-OUVERTURE (QR code vitrine / flyers) ───
// Accessible sans login via ?prospect=1 (option &secteur=corbie|doullens|amiens).
// Alimente la collection "prospects", segmentee par secteur.

var ROUGE = "#E2001A";
var NAVY = "#1D3557";

var SECTEURS = [
  { v: "corbie",   label: "Corbie et environs" },
  { v: "doullens", label: "Doullens et environs" },
  { v: "amiens",   label: "Amiens et environs" },
  { v: "autre",    label: "Autre secteur" },
];
var PROJETS = [
  { v: "acheter",   label: "Acheter un bien",            icon: "\uD83C\uDFE1" },
  { v: "vendre",    label: "Vendre un bien",             icon: "\uD83D\uDCB0" },
  { v: "estimer",   label: "Faire estimer mon bien",     icon: "\uD83D\uDCCF" },
  { v: "louer",     label: "Chercher une location",      icon: "\uD83D\uDD11" },
  { v: "bailleur",  label: "Mettre mon bien en location",icon: "\uD83C\uDFE2" },
  { v: "gestion",   label: "Confier la gestion locative",icon: "\uD83D\uDCCB" },
];

function getParam(name) {
  try { return new URLSearchParams(window.location.search).get(name) || ""; } catch(e){ return ""; }
}

export default function ProspectPublic() {
  var secteurUrl = getParam("secteur").toLowerCase();
  var secteurVerrouille = SECTEURS.some(function(s){ return s.v === secteurUrl; });

  var [f, setF] = useState({
    secteur: secteurVerrouille ? secteurUrl : "",
    commune: "", projet: "",
    prenom: "", nom: "", tel: "", email: "",
    typeBien: "", budget: "", delai: "", message: "",
    consentement: false,
  });
  var [envoye, setEnvoye] = useState(false);
  var [erreur, setErreur] = useState("");
  var [enCours, setEnCours] = useState(false);

  function up(k, v){ setF(function(p){ var n = Object.assign({}, p); n[k] = v; return n; }); }

  function valider() {
    if (!f.secteur) return "Merci d'indiquer le secteur qui vous interesse.";
    if (!f.projet) return "Merci d'indiquer votre projet.";
    if (!f.prenom.trim()) return "Merci d'indiquer votre prenom.";
    if (!f.nom.trim()) return "Merci d'indiquer votre nom.";
    if (!f.tel.trim() && !f.email.trim()) return "Merci de laisser un telephone ou un email.";
    if (!f.consentement) return "Merci d'accepter d'etre recontacte.";
    return "";
  }

  async function envoyer() {
    var err = valider();
    if (err) { setErreur(err); return; }
    setErreur(""); setEnCours(true);
    var prospect = {
      id: "PR-" + Date.now(),
      agenceId: "agence-1",
      date: new Date().toISOString(),
      statut: "nouveau",
      secteur: f.secteur, commune: f.commune.trim(), projet: f.projet,
      prenom: f.prenom.trim(), nom: f.nom.trim(), tel: f.tel.trim(), email: f.email.trim(),
      typeBien: f.typeBien.trim(), budget: f.budget, delai: f.delai, message: f.message.trim(),
      origine: "qr-pre-ouverture",
    };
    try { await dbAppendPublic("prospects", prospect); setEnvoye(true); }
    catch(e){ setErreur("Une erreur est survenue. Merci de reessayer."); }
    finally { setEnCours(false); }
  }

  var wrap = { minHeight:"100vh", background:"#F1F5F9", display:"flex", justifyContent:"center" };
  var card = { width:"100%", maxWidth:520, background:"#fff", minHeight:"100vh", boxSizing:"border-box" };
  var champ = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #CBD5E1", fontSize:16, boxSizing:"border-box", marginTop:6, fontFamily:"inherit" };
  var lab = { fontSize:13, fontWeight:700, color:NAVY, marginTop:16, display:"block" };
  var section = { fontSize:12, fontWeight:800, color:ROUGE, textTransform:"uppercase", letterSpacing:0.5, marginTop:24, marginBottom:4, borderBottom:"2px solid "+ROUGE, paddingBottom:4 };

  var secteurLabel = (SECTEURS.find(function(s){return s.v===f.secteur;})||{}).label || "";

  if (envoye) {
    return (
      <div style={wrap}>
        <div style={Object.assign({}, card, { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 26px", textAlign:"center" })}>
          <div style={{ fontSize:64 }}>{"\uD83C\uDF89"}</div>
          <h1 style={{ color:NAVY, fontSize:26, margin:"18px 0 10px", fontWeight:800 }}>{"Merci " + f.prenom + " !"}</h1>
          <p style={{ color:"#334155", fontSize:17, lineHeight:1.55, maxWidth:380, fontWeight:600 }}>
            {"Votre demande est bien enregistree."}
          </p>
          <p style={{ color:"#475569", fontSize:16, lineHeight:1.55, maxWidth:380, marginTop:12 }}>
            {"Notre equipe vous contactera des l'ouverture de l'agence" + (secteurLabel ? " de " + secteurLabel.split(" ")[0] : "") + " pour vous accompagner dans votre projet."}
          </p>
          <div style={{ marginTop:24, padding:"14px 20px", background:ROUGE, color:"#fff", borderRadius:12, fontSize:15, fontWeight:700 }}>
            {"ORPI \u00B7 bient\u00f4t pres de chez vous"}
          </div>
          <div style={{ marginTop:10, fontSize:13, color:"#94A3B8" }}>{"Vous pouvez fermer cette page."}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background:ROUGE, color:"#fff", padding:"26px 24px 22px" }}>
          <div style={{ fontSize:28, fontWeight:900 }}>{"Orpi"}</div>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginTop:6, opacity:0.9 }}>{"Bient\u00f4t pr\u00e8s de chez vous"}</div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:"12px 0 4px" }}>{"Un projet immobilier ?"}</h1>
          <p style={{ fontSize:14, opacity:0.92, margin:0, lineHeight:1.4 }}>
            {"Laissez-nous vos coordonnees : nous vous accompagnerons des l'ouverture de votre agence."}
          </p>
        </div>

        <div style={{ padding:"0 24px 28px" }}>
          <div style={section}>{"Votre secteur"}</div>
          {secteurVerrouille ? (
            <div style={{ marginTop:8, padding:"12px 14px", background:"#F1F5F9", borderRadius:10, fontSize:15, fontWeight:700, color:NAVY }}>
              {"\uD83D\uDCCD " + secteurLabel}
            </div>
          ) : (
            <select style={champ} value={f.secteur} onChange={function(e){ up("secteur", e.target.value); }}>
              <option value="">{"-- Choisir votre secteur --"}</option>
              {SECTEURS.map(function(s){ return <option key={s.v} value={s.v}>{s.label}</option>; })}
            </select>
          )}
          <label style={lab}>{"Votre commune (optionnel)"}</label>
          <input style={champ} value={f.commune} onChange={function(e){ up("commune", e.target.value); }} placeholder="Ex : Corbie, Villers-Bocage..." />

          <div style={section}>{"Votre projet"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
            {PROJETS.map(function(p){
              var actif = f.projet === p.v;
              return (
                <button key={p.v} type="button" onClick={function(){ up("projet", p.v); }}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"12px 6px", borderRadius:12, cursor:"pointer",
                    border: actif ? "2px solid "+ROUGE : "1px solid #CBD5E1", background: actif ? "#FEF2F2" : "#fff", textAlign:"center" }}>
                  <span style={{ fontSize:22 }}>{p.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: actif ? ROUGE : NAVY, lineHeight:1.2 }}>{p.label}</span>
                </button>
              );
            })}
          </div>

          <div style={section}>{"Vos coordonnees"}</div>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={lab}>{"Prenom *"}</label>
              <input style={champ} value={f.prenom} onChange={function(e){ up("prenom", e.target.value); }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={lab}>{"Nom *"}</label>
              <input style={champ} value={f.nom} onChange={function(e){ up("nom", e.target.value); }} />
            </div>
          </div>
          <label style={lab}>{"Telephone"}</label>
          <input style={champ} type="tel" value={f.tel} onChange={function(e){ up("tel", e.target.value); }} placeholder="06 12 34 56 78" />
          <label style={lab}>{"Email"}</label>
          <input style={champ} type="email" value={f.email} onChange={function(e){ up("email", e.target.value); }} placeholder="vous@email.com" />

          <div style={section}>{"En savoir plus (optionnel)"}</div>
          <label style={lab}>{"Type de bien concerne"}</label>
          <input style={champ} value={f.typeBien} onChange={function(e){ up("typeBien", e.target.value); }} placeholder="Maison, appartement, terrain..." />
          <label style={lab}>{"Delai de votre projet"}</label>
          <select style={champ} value={f.delai} onChange={function(e){ up("delai", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            <option value="immediat">{"Des que possible"}</option>
            <option value="3mois">{"Dans les 3 mois"}</option>
            <option value="6mois">{"Dans les 6 mois"}</option>
            <option value="1an">{"Dans l'annee"}</option>
            <option value="renseigne">{"Je me renseigne"}</option>
          </select>
          <label style={lab}>{"Votre message"}</label>
          <textarea style={Object.assign({}, champ, { minHeight:70, resize:"vertical" })} value={f.message} onChange={function(e){ up("message", e.target.value); }} placeholder="Precisez votre projet si vous le souhaitez" />

          <label style={{ display:"flex", gap:10, alignItems:"flex-start", marginTop:20, fontSize:13, color:"#475569", lineHeight:1.4, cursor:"pointer" }}>
            <input type="checkbox" checked={f.consentement} onChange={function(e){ up("consentement", e.target.checked); }} style={{ marginTop:2, width:18, height:18, flexShrink:0 }} />
            <span>{"J'accepte d'etre recontacte par ORPI au sujet de mon projet immobilier. Mes donnees sont utilisees uniquement dans ce but et je peux en demander la suppression a tout moment."}</span>
          </label>

          {erreur && (
            <div style={{ marginTop:14, padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, color:"#B91C1C", fontSize:14 }}>{erreur}</div>
          )}

          <button onClick={envoyer} disabled={enCours}
            style={{ width:"100%", marginTop:20, padding:"16px", background:ROUGE, color:"#fff", border:"none", borderRadius:12, fontSize:17, fontWeight:800, cursor:"pointer", opacity:enCours?0.6:1 }}>
            {enCours ? "Envoi en cours..." : "Je m'inscris"}
          </button>
          <p style={{ fontSize:11, color:"#94A3B8", textAlign:"center", marginTop:12 }}>{"* Champs obligatoires \u00B7 ORPI"}</p>
        </div>
      </div>
    </div>
  );
}
