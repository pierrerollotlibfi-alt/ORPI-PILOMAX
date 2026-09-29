import { useState } from "react";
import { dbAppendPublic } from "../supabase";

// ─── FORMULAIRE PUBLIC : RECHERCHE DE LOCATION (accès QR code, sans login) ───
// Un prospect scanne le QR en agence, remplit sa recherche, ça arrive dans
// la collection "recherchesLocation" cote equipe.

var ROUGE = "#E63946";
var NAVY = "#1D3557";

var SITUATIONS = ["CDI", "CDD", "Interim", "Fonction publique", "Independant / Profession liberale", "Etudiant", "Retraite", "Autre"];
var TYPES_BIEN = ["Studio", "T1", "T2", "T3", "T4", "T5+", "Maison", "Autre"];
var CAUTIONS = [
  { v: "parents", label: "Caution des parents / d'un proche" },
  { v: "visale",  label: "Garantie Visale (Action Logement)" },
  { v: "sans",    label: "Sans caution" },
];
var CONTRATS_GARANT = ["CDI", "CDD", "Fonction publique", "Independant / Profession liberale", "Retraite", "Autre"];
var LIENS_GARANT = ["Parents", "Grands-parents", "Frere / Soeur", "Autre membre de la famille", "Proche / Ami"];

export default function RechercheLocationPublic() {
  var [f, setF] = useState({
    nom: "", prenom: "", tel: "", email: "",
    dateButoir: "", revenus: "", situation: "", profession: "", employeur: "",
    typeBien: "", secteur: "", budget: "", meubleNonMeuble: "", specifications: "",
    caution: "", cautionDetail: "",
    garantOui: "", garantNom: "", garantLien: "", garantProfession: "",
    garantEmployeur: "", garantContrat: "", garantRevenus: "",
    consentement: false,
  });
  var [envoye, setEnvoye] = useState(false);
  var [erreur, setErreur] = useState("");
  var [envoiEnCours, setEnvoiEnCours] = useState(false);

  function up(k, v) { setF(function(prev){ var n = Object.assign({}, prev); n[k] = v; return n; }); }

  function valider() {
    if (!f.prenom.trim()) return "Merci d'indiquer votre prenom.";
    if (!f.nom.trim()) return "Merci d'indiquer votre nom.";
    if (!f.tel.trim()) return "Merci d'indiquer votre telephone.";
    if (!f.email.trim()) return "Merci d'indiquer votre email.";
    if (!f.dateButoir) return "Merci d'indiquer votre date d'emmenagement souhaitee.";
    if (!f.situation) return "Merci d'indiquer votre situation professionnelle.";
    if (f.situation === "Etudiant") {
      if (!f.garantOui) return "Merci d'indiquer si vous disposez d'un garant.";
      if (f.garantOui === "oui") {
        if (!f.garantNom.trim()) return "Merci d'indiquer le nom et prenom de votre garant.";
        if (!f.garantLien) return "Merci d'indiquer votre lien avec le garant.";
        if (!f.garantProfession.trim()) return "Merci d'indiquer la profession de votre garant.";
        if (!f.garantEmployeur.trim()) return "Merci d'indiquer l'employeur de votre garant.";
        if (!f.garantContrat) return "Merci d'indiquer le type de contrat de votre garant.";
        if (!f.garantRevenus) return "Merci d'indiquer les revenus mensuels nets de votre garant.";
      }
    }
    if (!f.profession.trim()) return "Merci d'indiquer votre profession.";
    if (!f.employeur.trim()) return "Merci d'indiquer votre employeur.";
    if (!f.revenus) return "Merci d'indiquer vos revenus mensuels nets.";
    if (!f.typeBien) return "Merci d'indiquer le type de bien recherche.";
    if (!f.meubleNonMeuble) return "Merci de preciser meuble ou non meuble.";
    if (!f.secteur.trim()) return "Merci d'indiquer le secteur souhaite.";
    if (!f.budget) return "Merci d'indiquer votre budget mensuel maximum.";
    if (!f.specifications.trim()) return "Merci d'apporter quelques precisions sur votre recherche.";
    if (!f.caution) return "Merci d'indiquer votre type de caution / garantie.";
    if (f.caution === "parents" && f.situation !== "Etudiant" && !f.cautionDetail.trim()) return "Merci d'indiquer qui se porte caution et sa situation.";
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
      caution: f.caution, cautionDetail: f.cautionDetail.trim(),
      garantOui: f.garantOui, garantNom: f.garantNom.trim(), garantLien: f.garantLien,
      garantProfession: f.garantProfession.trim(), garantEmployeur: f.garantEmployeur.trim(),
      garantContrat: f.garantContrat, garantRevenus: f.garantRevenus,
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
        <div style={Object.assign({}, card, { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 26px", textAlign:"center" })}>
          <div style={{ fontSize:64 }}>{"\u2705"}</div>
          <h1 style={{ color:NAVY, fontSize:26, margin:"18px 0 10px", fontWeight:800 }}>
            {"Merci " + f.prenom + " !"}
          </h1>
          <p style={{ color:"#334155", fontSize:17, lineHeight:1.55, maxWidth:380, fontWeight:600 }}>
            {"Votre dossier a bien ete pris en charge par notre equipe."}
          </p>
          <p style={{ color:"#475569", fontSize:16, lineHeight:1.55, maxWidth:380, marginTop:12 }}>
            {"Nous etudions votre recherche avec attention et nous vous contacterons des qu'un bien correspondra a vos criteres."}
          </p>

          <div style={{ marginTop:26, padding:"16px 20px", background:"#F1F5F9", borderRadius:14, maxWidth:380, width:"100%" }}>
            <div style={{ fontSize:12, fontWeight:800, color:ROUGE, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
              {"Votre recherche"}
            </div>
            <div style={{ fontSize:14, color:NAVY, lineHeight:1.6 }}>
              {f.typeBien + (f.meubleNonMeuble === "meuble" ? " meuble" : f.meubleNonMeuble === "non_meuble" ? " non meuble" : "")}
              {f.secteur ? " \u00B7 " + f.secteur : ""}
              {f.budget ? " \u00B7 " + f.budget + " \u20AC/mois max" : ""}
            </div>
          </div>

          <div style={{ marginTop:22, fontSize:14, color:"#64748B", lineHeight:1.5 }}>
            {"Une question en attendant ?"}
          </div>
          <div style={{ marginTop:6, padding:"12px 20px", background:ROUGE, color:"#fff", borderRadius:12, fontSize:15, fontWeight:700 }}>
            {"ORPI Amiens \u00B7 18 rue Gresset"}
          </div>
          <div style={{ marginTop:10, fontSize:13, color:"#94A3B8" }}>
            {"Vous pouvez fermer cette page."}
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
          <label style={lab}>{"Telephone *"}</label>
          <input style={champ} type="tel" value={f.tel} onChange={function(e){ up("tel", e.target.value); }} placeholder="06 12 34 56 78" />
          <label style={lab}>{"Email *"}</label>
          <input style={champ} type="email" value={f.email} onChange={function(e){ up("email", e.target.value); }} placeholder="vous@email.com" />

          <div style={section}>{"Votre situation"}</div>
          <label style={lab}>{"Date d'emmenagement souhaitee *"}</label>
          <input style={champ} type="date" value={f.dateButoir} onChange={function(e){ up("dateButoir", e.target.value); }} />
          <label style={lab}>{"Situation professionnelle *"}</label>
          <select style={champ} value={f.situation} onChange={function(e){ up("situation", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            {SITUATIONS.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
          </select>

          {f.situation === "Etudiant" && (
            <div style={{ marginTop:14, padding:"16px", background:"#F8FAFC", border:"2px solid "+NAVY, borderRadius:14 }}>
              <div style={{ fontSize:13, fontWeight:800, color:NAVY, marginBottom:4 }}>{"\uD83C\uDF93 Dossier etudiant \u2014 votre garant"}</div>
              <div style={{ fontSize:13, color:"#64748B", lineHeight:1.4, marginBottom:6 }}>
                {"Pour un dossier etudiant, les informations du garant sont indispensables a l'etude de votre candidature."}
              </div>

              <label style={lab}>{"Disposez-vous d'un garant ? *"}</label>
              <select style={champ} value={f.garantOui} onChange={function(e){ up("garantOui", e.target.value); }}>
                <option value="">{"-- Choisir --"}</option>
                <option value="oui">{"Oui, j'ai un garant"}</option>
                <option value="non">{"Non, je n'ai pas de garant"}</option>
              </select>

              {f.garantOui === "oui" && (
                <div>
                  <label style={lab}>{"Nom et prenom du garant *"}</label>
                  <input style={champ} value={f.garantNom} onChange={function(e){ up("garantNom", e.target.value); }} />

                  <label style={lab}>{"Lien avec le garant *"}</label>
                  <select style={champ} value={f.garantLien} onChange={function(e){ up("garantLien", e.target.value); }}>
                    <option value="">{"-- Choisir --"}</option>
                    {LIENS_GARANT.map(function(l){ return <option key={l} value={l}>{l}</option>; })}
                  </select>

                  <label style={lab}>{"Profession du garant *"}</label>
                  <input style={champ} value={f.garantProfession} onChange={function(e){ up("garantProfession", e.target.value); }} />

                  <label style={lab}>{"Employeur du garant *"}</label>
                  <input style={champ} value={f.garantEmployeur} onChange={function(e){ up("garantEmployeur", e.target.value); }} />

                  <label style={lab}>{"Type de contrat du garant *"}</label>
                  <select style={champ} value={f.garantContrat} onChange={function(e){ up("garantContrat", e.target.value); }}>
                    <option value="">{"-- Choisir --"}</option>
                    {CONTRATS_GARANT.map(function(ct){ return <option key={ct} value={ct}>{ct}</option>; })}
                  </select>

                  <label style={lab}>{"Revenus mensuels nets du garant (\u20AC) *"}</label>
                  <input style={champ} type="number" value={f.garantRevenus} onChange={function(e){ up("garantRevenus", e.target.value); }} placeholder="Ex : 3000" />
                </div>
              )}

              {f.garantOui === "non" && (
                <div style={{ marginTop:10, padding:"10px 12px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, fontSize:13, color:"#1E40AF", lineHeight:1.4 }}>
                  {"Sans garant, la garantie Visale (gratuite, Action Logement) est souvent la solution adaptee aux etudiants. Nous pourrons vous accompagner dans la demarche."}
                </div>
              )}
            </div>
          )}
          <label style={lab}>{"Profession *"}</label>
          <input style={champ} value={f.profession} onChange={function(e){ up("profession", e.target.value); }} />
          <label style={lab}>{"Employeur *"}</label>
          <input style={champ} value={f.employeur} onChange={function(e){ up("employeur", e.target.value); }} />
          <label style={lab}>{"Revenus mensuels nets du foyer (\u20AC) *"}</label>
          <input style={champ} type="number" value={f.revenus} onChange={function(e){ up("revenus", e.target.value); }} placeholder="Ex : 2500" />

          <div style={section}>{"Le bien recherche"}</div>
          <label style={lab}>{"Type de bien *"}</label>
          <select style={champ} value={f.typeBien} onChange={function(e){ up("typeBien", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            {TYPES_BIEN.map(function(t){ return <option key={t} value={t}>{t}</option>; })}
          </select>
          <label style={lab}>{"Meuble ou non meuble ? *"}</label>
          <select style={champ} value={f.meubleNonMeuble} onChange={function(e){ up("meubleNonMeuble", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            <option value="meuble">{"Meuble"}</option>
            <option value="non_meuble">{"Non meuble"}</option>
          </select>
          <label style={lab}>{"Secteur / quartier souhaite *"}</label>
          <input style={champ} value={f.secteur} onChange={function(e){ up("secteur", e.target.value); }} placeholder="Ex : Amiens centre, St Leu..." />
          <label style={lab}>{"Budget mensuel max (charges comprises, \u20AC) *"}</label>
          <input style={champ} type="number" value={f.budget} onChange={function(e){ up("budget", e.target.value); }} placeholder="Ex : 700" />
          <label style={lab}>{"Precisions (nombre de personnes, animaux, garage...) *"}</label>
          <textarea style={Object.assign({}, champ, { minHeight:80, resize:"vertical" })} value={f.specifications} onChange={function(e){ up("specifications", e.target.value); }} />

          <div style={section}>{"Garantie / caution"}</div>
          <label style={lab}>{"Quelle garantie pouvez-vous presenter ? *"}</label>
          <select style={champ} value={f.caution} onChange={function(e){ up("caution", e.target.value); }}>
            <option value="">{"-- Choisir --"}</option>
            {CAUTIONS.map(function(c){ return <option key={c.v} value={c.v}>{c.label}</option>; })}
          </select>
          {f.caution === "parents" && f.situation !== "Etudiant" && (
            <div>
              <label style={lab}>{"Qui se porte caution et quelle est sa situation ? *"}</label>
              <input style={champ} value={f.cautionDetail} onChange={function(e){ up("cautionDetail", e.target.value); }}
                placeholder="Ex : mes parents, tous deux salaries en CDI" />
            </div>
          )}
          {f.caution === "visale" && (
            <div style={{ marginTop:8, padding:"10px 12px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, fontSize:13, color:"#1E40AF", lineHeight:1.4 }}>
              {"Visale est une garantie gratuite proposee par Action Logement. Si vous n'avez pas encore votre visa, nous pourrons vous accompagner dans la demande."}
            </div>
          )}
          {f.caution === "sans" && (
            <div style={{ marginTop:8, padding:"10px 12px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, fontSize:13, color:"#92400E", lineHeight:1.4 }}>
              {"Pas d'inquietude : selon vos revenus, certains biens restent accessibles. Nous pourrons aussi vous orienter vers la garantie Visale."}
            </div>
          )}

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
            {"Tous les champs sont obligatoires \u00B7 ORPI Amiens, 18 rue Gresset, 80000 Amiens"}
          </p>
        </div>
      </div>
    </div>
  );
}
