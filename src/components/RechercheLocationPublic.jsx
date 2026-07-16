import { useState } from "react";
import { dbAppendPublic } from "../supabase";

// ─── FORMULAIRE PUBLIC : RECHERCHE DE LOCATION (accès QR code, sans login) ───
// Un prospect scanne le QR en agence, remplit sa recherche, ça arrive dans
// la collection "recherchesLocation" cote equipe.

var ROUGE = "#E63946";
var NAVY = "#1D3557";

var SITUATIONS = ["CDI", "CDD", "Interim", "Fonction publique", "Independant / Profession liberale", "Etudiant", "Retraite", "Autre"];
var TYPES_BIEN = ["Studio", "T1", "T2", "T3", "T4", "T5+", "Maison", "Autre"];

export default function RechercheLocationPublic() {
  var [f, setF] = useState({
    nom: "", prenom: "", tel: "", email: "",
    dateButoir: "", revenus: "", situation: "", profession: "", employeur: "",
    typeBien: "", secteur: "", budget: "", meubleNonMeuble: "", specifications: "",
    consentement: false,
  });
  var [envoye, setEnvoye] = useState(false);
  var [erreur, setErreur] = useState("");
  var [envoiEnCours, setEnvoiEnCours] = useState(false);

  function up(k, v) { setF(function(prev){ var n = Object.assign({}, prev); n[k] = v; return n; }); }

  function valider() {
    if (!f.nom.trim() || !f.prenom.trim()) return "Merci d'indiquer votre nom et prenom.";
    if (!f.tel.trim() && !f.email.trim()) return "Merci de laisser un telephone ou un email pour vous recontacter.";
    if (!f.typeBien) return "Merci d'indiquer le type de bien recherche.";
    if (!f.consentement) return "Merci d'accepter que vos donnees soient utilisees pour votre recherche.";
    return "";
  }

  async function envoyer() {
    var err = valider();
    if (err) { setErreur(err); return; }
    setErreur(""); setEnvoiEnCours(true);
    var demande = {
      id: "RL-" + Date.now(),
      agenceId: "agence-1",
      date: new Date().toISOString(),
      statut: "nouveau",
      nom: f.nom.trim(), prenom: f.prenom.trim(),
      tel: f.tel.trim(), email: f.email.trim(),
      dateButoir: f.dateButoir, revenus: f.revenus,
      situation: f.situation, profession: f.profession.trim(), employeur: f.employeur.trim(),
      typeBien: f.typeBien, secteur: f.secteur.trim(), budget: f.budget,
      meubleNonMeuble: f.meubleNonMeuble, specifications: f.specifications.trim(),
    };
    try {
      await dbAppendPublic("recherchesLocation", demande);
      setEnvoye(true);
    } catch (e) {
      setErreur("Une erreur est survenue. Merci de reessayer ou de vous adresser a l'accueil.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  var wrap = { minHeight:"100vh", background:"#F1F5F9", display:"flex", justifyContent:"center", padding:"0 0 40px" };
  var card = { width:"100%", maxWidth:520, background:"#fff", minHeight:"100vh", boxSizing:"border-box" };
  var champ = { width:"100%", padding:"12px 14px", borderRadius:10, border:"1px solid #CBD5E1", fontSize:16, boxSizing:"border-box", marginTop:6, fontFamily:"inherit" };
  var lab = { fontSize:13, fontWeight:700, color:NAVY, marginTop:16, display:"block" };
  var section = { fontSize:12, fontWeight:800, color:ROUGE, textTransform:"uppercase", letterSpacing:0.5, marginTop:24, marginBottom:4, borderBottom:"2px solid "+ROUGE, paddingBottom:4 };

  if (envoye) {
    return (
      <div style={wrap}>
        <div style={Object.assign({}, card, { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:30, textAlign:"center" })}>
          <div style={{ fontSize:60 }}>{"\u2705"}</div>
          <h1 style={{ color:NAVY, fontSize:24, margin:"16px 0 8px" }}>{"Merci " + f.prenom + " !"}</h1>
          <p style={{ color:"#475569", fontSize:16, lineHeight:1.5, maxWidth:360 }}>
            {"Votre recherche a bien ete enregistree. Un conseiller de l'agence vous recontactera des qu'un bien correspondant sera disponible."}
          </p>
          <div style={{ marginTop:24, padding:"14px 20px", background:"#F1F5F9", borderRadius:12, fontSize:14, color:NAVY }}>
            {"ORPI Amiens \u00B7 18 rue Gresset"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {/* En-tete */}
        <div style={{ background:ROUGE, color:"#fff", padding:"26px 24px 22px" }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:1 }}>{"Orpi"}</div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:"10px 0 4px" }}>{"Votre recherche de location"}</h1>
          <p style={{ fontSize:14, opacity:0.9, margin:0, lineHeight:1.4 }}>
            {"Remplissez ce formulaire, nous vous recontactons des qu'un bien correspond a vos criteres."}
          </p>
        </div>

        <div style={{ padding:"0 24px 24px" }}>
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

          <div style={section}>{"Votre situation"}</div>
          <label style={lab}>{"Date d'emmenagement souhaitee"}</label>
          <input style={champ} type="date" value={f.dateButoir} onChange={function(e){ up("dateButoir", e.target.value); }} />
          <label style={lab}>{"Situation professionnelle"}</label>
          <select style={champ} value={f.situation} onChange={function(e){ up("situation", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            {SITUATIONS.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
          </select>
          <label style={lab}>{"Profession"}</label>
          <input style={champ} value={f.profession} onChange={function(e){ up("profession", e.target.value); }} />
          <label style={lab}>{"Employeur"}</label>
          <input style={champ} value={f.employeur} onChange={function(e){ up("employeur", e.target.value); }} />
          <label style={lab}>{"Revenus mensuels nets du foyer (\u20AC)"}</label>
          <input style={champ} type="number" value={f.revenus} onChange={function(e){ up("revenus", e.target.value); }} placeholder="Ex : 2500" />

          <div style={section}>{"Le bien recherche"}</div>
          <label style={lab}>{"Type de bien *"}</label>
          <select style={champ} value={f.typeBien} onChange={function(e){ up("typeBien", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            {TYPES_BIEN.map(function(t){ return <option key={t} value={t}>{t}</option>; })}
          </select>
          <label style={lab}>{"Meuble ou non meuble ?"}</label>
          <select style={champ} value={f.meubleNonMeuble} onChange={function(e){ up("meubleNonMeuble", e.target.value); }}>
            <option value="">{"Peu importe"}</option>
            <option value="meuble">{"Meuble"}</option>
            <option value="non_meuble">{"Non meuble"}</option>
          </select>
          <label style={lab}>{"Secteur / quartier souhaite"}</label>
          <input style={champ} value={f.secteur} onChange={function(e){ up("secteur", e.target.value); }} placeholder="Ex : Amiens centre, St Leu..." />
          <label style={lab}>{"Budget mensuel max (charges comprises, \u20AC)"}</label>
          <input style={champ} type="number" value={f.budget} onChange={function(e){ up("budget", e.target.value); }} placeholder="Ex : 700" />
          <label style={lab}>{"Precisions (nombre de personnes, animaux, garage...)"}</label>
          <textarea style={Object.assign({}, champ, { minHeight:80, resize:"vertical" })} value={f.specifications} onChange={function(e){ up("specifications", e.target.value); }} />

          {/* Consentement RGPD */}
          <label style={{ display:"flex", gap:10, alignItems:"flex-start", marginTop:20, fontSize:13, color:"#475569", lineHeight:1.4, cursor:"pointer" }}>
            <input type="checkbox" checked={f.consentement} onChange={function(e){ up("consentement", e.target.checked); }} style={{ marginTop:2, width:18, height:18, flexShrink:0 }} />
            <span>{"J'accepte que l'agence ORPI Amiens conserve et utilise ces informations dans le seul but de traiter ma recherche de location. Je peux demander leur suppression a tout moment."}</span>
          </label>

          {erreur && (
            <div style={{ marginTop:14, padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, color:"#B91C1C", fontSize:14 }}>
              {erreur}
            </div>
          )}

          <button onClick={envoyer} disabled={envoiEnCours}
            style={{ width:"100%", marginTop:20, padding:"16px", background:ROUGE, color:"#fff", border:"none", borderRadius:12, fontSize:17, fontWeight:800, cursor:"pointer", opacity:envoiEnCours?0.6:1 }}>
            {envoiEnCours ? "Envoi en cours..." : "Envoyer ma recherche"}
          </button>
          <p style={{ fontSize:11, color:"#94A3B8", textAlign:"center", marginTop:12 }}>
            {"* Champs obligatoires \u00B7 ORPI Amiens, 18 rue Gresset, 80000 Amiens"}
          </p>
        </div>
      </div>
    </div>
  );
}
