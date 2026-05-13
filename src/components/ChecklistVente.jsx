import { useState, useMemo } from "react";

// ─── BASE DOCUMENTAIRE COMPLÈTE (source : Check-List ORPI Juin 2019 v7) ──────
var DOCS = [
  // ── PARTIES ──────────────────────────────────────────────────────────────────
  { id:"ci",        cat:"parties",   label:"Carte d'identité",                              commentaire:"Conserver une photocopie pour obligation Tracfin",           typeBiens:["all"], personnePhysique:true },
  { id:"livret",    cat:"parties",   label:"Livret de famille",                             commentaire:"Si le bien a été reçu par donation",                        typeBiens:["all"], personnePhysique:true },
  { id:"mariage",   cat:"parties",   label:"Contrat de mariage / Contrat de PACS",                                                                                   typeBiens:["all"], personnePhysique:true },
  { id:"tutelle",   cat:"parties",   label:"Jugement tutelle, curatelle ou sauvegarde de justice",                                                                   typeBiens:["all"], personnePhysique:true, optionnel:true },
  { id:"statuts",   cat:"parties",   label:"Copie des statuts à jour",                                                                                               typeBiens:["all"], personneMorale:true },
  { id:"kbis",      cat:"parties",   label:"Extrait Kbis datant de moins de 3 mois",                                                                                 typeBiens:["all"], personneMorale:true },
  { id:"repres",    cat:"parties",   label:"Copie CI du représentant social",                                                                                        typeBiens:["all"], personneMorale:true },
  { id:"pv_ag",     cat:"parties",   label:"PV de l'Assemblée des associés autorisant la vente",    commentaire:"Sauf si dirigeant a tout pouvoir ou tous associés signataires", typeBiens:["all"], personneMorale:true },

  // ── IMMEUBLE ─────────────────────────────────────────────────────────────────
  { id:"titre",     cat:"immeuble",  label:"Titre de propriété",                            commentaire:"De préférence la copie authentique de l'acquisition (notaire)", typeBiens:["all"] },
  { id:"cadastre",  cat:"immeuble",  label:"Plan cadastral",                                commentaire:"Disponible au cadastre",                                     typeBiens:["all"] },
  { id:"plan",      cat:"immeuble",  label:"Plan du bien",                                                                                                            typeBiens:["all"] },
  { id:"fonciere",  cat:"immeuble",  label:"Taxe foncière",                                                                                                           typeBiens:["all"] },
  { id:"factures",  cat:"immeuble",  label:"Dernières factures eau, gaz, électricité",      commentaire:"À titre purement informatif",                                typeBiens:["all"], optionnel:true },

  // ── ÉTAT LOCATIF ─────────────────────────────────────────────────────────────
  { id:"bail",      cat:"locatif",   label:"Copie du bail, état des lieux, caution",        commentaire:"Et tout élément utile pour s'assurer de la solvabilité",     typeBiens:["all"], siLoue:true },
  { id:"conge_b",   cat:"locatif",   label:"Copie congé bailleur + AR",                                                                                              typeBiens:["all"], siLoue:true },
  { id:"conge_l",   cat:"locatif",   label:"Copie congé locataire + AR",                                                                                             typeBiens:["all"], siLoue:true },

  // ── URBANISME ────────────────────────────────────────────────────────────────
  { id:"cu",        cat:"urbanisme", label:"Certificat d'urbanisme (info ou opérationnel)", commentaire:"Indispensable pour terrains à bâtir et biens à rénover",     typeBiens:["terrain","maison"] },
  { id:"bornage",   cat:"urbanisme", label:"Plan de bornage",                               commentaire:"Obligatoire en lotissement / ZAC / AFU",                     typeBiens:["terrain","maison"], optionnel:true },
  { id:"lotissement",cat:"urbanisme",label:"Règlement de lotissement / cahier des charges",                                                                           typeBiens:["terrain","maison"], optionnel:true },
  { id:"synd_ass",  cat:"urbanisme", label:"Statuts d'association syndicale",               commentaire:"Indispensable car peut contenir des servitudes",             typeBiens:["terrain","maison"], optionnel:true },

  // ── TRAVAUX ──────────────────────────────────────────────────────────────────
  { id:"permis",    cat:"travaux",   label:"Permis de construire / Déclaration de travaux",                                                                           typeBiens:["all"], siTravaux:true },
  { id:"ag_trav",   cat:"travaux",   label:"Autorisation de travaux en AG de copropriétaires",                                                                        typeBiens:["appartement","local_pro"], siTravaux:true },
  { id:"fact_trav", cat:"travaux",   label:"Factures des travaux",                                                                                                    typeBiens:["all"], siTravaux:true },
  { id:"assurance", cat:"travaux",   label:"Attestation assurance décennale / dommage-ouvrage",                                                                       typeBiens:["all"], siTravaux:true },
  { id:"dacct",     cat:"travaux",   label:"Déclaration d'achèvement + Certificat de conformité (DACCT)",                                                             typeBiens:["all"], siTravaux:true },
  { id:"contentieux",cat:"travaux",  label:"Documents relatifs aux contentieux / sinistres",                                                                          typeBiens:["all"], siTravaux:true, optionnel:true },

  // ── DIAGNOSTICS ──────────────────────────────────────────────────────────────
  { id:"carrez",    cat:"diagnostics",label:"Certificat de Mesurage loi Carrez",            commentaire:"Obligatoire copropriété. Diagnostiqueur Pro recommandé.",    typeBiens:["appartement","local_pro"], validite:"Illimitée sauf travaux" },
  { id:"amiante",   cat:"diagnostics",label:"Rapport Amiante",                              commentaire:"Permis de construire avant le 01/07/1997",                   typeBiens:["all"], conditionAge:"avant1997", validite:"3 ans (illimitée si aucune trace + après 2013)" },
  { id:"dpe",       cat:"diagnostics",label:"Diagnostic de performance énergétique (DPE)",  commentaire:"Immeuble bâtis avec système de chauffage",                   typeBiens:["all"], validite:"10 ans" },
  { id:"erp",       cat:"diagnostics",label:"État des Risques et Pollutions (ERP)",          commentaire:"Zone faisant l'objet d'un PRR ou zone de sismicité",         typeBiens:["all"], validite:"6 mois" },
  { id:"crep",      cat:"diagnostics",label:"Constat risque exposition plomb (CREP)",        commentaire:"Immeubles construits avant le 01/01/1949",                   typeBiens:["all"], conditionAge:"avant1949", validite:"1 an (illimitée si aucune trace)" },
  { id:"elec",      cat:"diagnostics",label:"État installation intérieure Électricité",      commentaire:"Installation réalisée depuis plus de 15 ans",                typeBiens:["all"], conditionAge:"15ansElec", validite:"3 ans (6 ans en location)" },
  { id:"gaz",       cat:"diagnostics",label:"État installation intérieure de Gaz",           commentaire:"Installation réalisée depuis plus de 15 ans",                typeBiens:["all"], conditionAge:"15ansGaz",  validite:"3 ans (6 ans en location)" },
  { id:"assainiss",  cat:"diagnostics",label:"État installation assainissement non collectif",commentaire:"À faire réaliser par le SPANC",                             typeBiens:["maison","terrain"], validite:"3 ans" },
  { id:"raccord",   cat:"diagnostics",label:"Certificat conformité raccordement réseau public",commentaire:"En fonction des zones du territoire",                      typeBiens:["all"], optionnel:true },
  { id:"termites",  cat:"diagnostics",label:"État parasitaire (Termites)",                   commentaire:"Zones délimitées par arrêté préfectoral",                    typeBiens:["all"], optionnel:true, validite:"6 mois" },
  { id:"merule",    cat:"diagnostics",label:"Informations sur le risque Mérule",             commentaire:"Zones répertoriées par arrêté préfectoral",                  typeBiens:["all"], optionnel:true },
  { id:"geotec",    cat:"diagnostics",label:"Étude géotechnique préalable du terrain",       commentaire:"Depuis le 01/01/2020 — zones argileuses",                   typeBiens:["terrain","maison"], optionnel:true },

  // ── COPROPRIÉTÉ ──────────────────────────────────────────────────────────────
  { id:"rc",        cat:"copropriete",label:"Règlement de copropriété (RC)",                commentaire:"Remis par le notaire lors de l'acquisition",                 typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"edd",       cat:"copropriete",label:"État descriptif de division (EDD) publié",                                                                               typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"modif_rc",  cat:"copropriete",label:"Modificatifs éventuels au RC et/ou EDD",                                                                                typeBiens:["appartement","local_pro"], copropriete:true, optionnel:true },
  { id:"fiche_synt",cat:"copropriete",label:"Fiche synthétique de la copropriété (art. 8-2 loi 65-557)",commentaire:"Applicable depuis 2019",                         typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"pv_3ans",   cat:"copropriete",label:"PV d'assemblée générale des 3 dernières années",commentaire:"Notifiés par le syndic après chaque AG",                   typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"appel_ch",  cat:"copropriete",label:"Dernier appel de charges de copropriété",      commentaire:"Adressé par le syndic trimestriellement",                    typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"budget",    cat:"copropriete",label:"Budget prévisionnel + charges hors budget (2 ans)",commentaire:"Décompte de charges joint à la convocation AG",         typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"dettes",    cat:"copropriete",label:"Sommes dues au syndicat par l'acquéreur",      commentaire:"Dernier appel de fonds du syndic",                           typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"impayes",   cat:"copropriete",label:"État global des impayés et dettes fournisseurs",commentaire:"Annexe 1 établie par le syndic (anonymisée)",               typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"fonds_trav",cat:"copropriete",label:"Fonds de travaux — montant et dernière cotisation",commentaire:"Sur dernier état individuel de répartition",             typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"carnet_ent",cat:"copropriete",label:"Carnet d'entretien",                           commentaire:"Établi et mis à jour par le syndic",                         typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"superf",    cat:"copropriete",label:"Attestation superficie partie privative (art. 46 loi 65-557)",commentaire:"Diagnostiqueur recommandé",                   typeBiens:["appartement","local_pro"], copropriete:true },
  { id:"dtg",       cat:"copropriete",label:"Diagnostic Technique Global (L.731-1 et L.731-2)",commentaire:"Applicable depuis le 1er janvier 2017",                  typeBiens:["appartement","local_pro"], copropriete:true, optionnel:true },
];

var CATEGORIES = {
  parties:     { label:"👤 Documents relatifs aux parties",     color:"#1D3557" },
  immeuble:    { label:"🏠 Documents relatifs à l'immeuble",   color:"#2196F3" },
  locatif:     { label:"🔑 État locatif des biens",            color:"#F59E0B" },
  urbanisme:   { label:"🏗️ Urbanisme et servitudes",          color:"#059669" },
  travaux:     { label:"🔨 Travaux sur les biens",             color:"#DC2626" },
  diagnostics: { label:"🔬 Diagnostics immobiliers",           color:"#7C3AED" },
  copropriete: { label:"🏢 Vente de lot de copropriété",       color:"#0891B2" },
};

var TYPES_BIEN = [
  { id:"appartement",  label:"🏢 Appartement",            cats:["copropriete"] },
  { id:"maison",       label:"🏠 Maison individuelle",    cats:[] },
  { id:"terrain",      label:"🌿 Terrain",                cats:[] },
  { id:"local_pro",    label:"🏪 Local pro / Commerce",   cats:["copropriete"] },
  { id:"immeuble",     label:"🏗️ Immeuble de rapport",   cats:[] },
];

export default function ChecklistVente() {
  var [typeBien,      setTypeBien]      = useState("");
  var [isLoue,        setIsLoue]        = useState(false);
  var [hasTravaux,    setHasTravaux]    = useState(false);
  var [isCopro,       setIsCopro]       = useState(false);
  var [isPersonMorale,setIsPersonMorale]= useState(false);
  var [checked,       setChecked]       = useState({});
  var [showOptionnels,setShowOptionnels]= useState(false);
  var [nomProprietaire,setNomProprietaire]= useState("");
  var [adresseBien,    setAdresseBien]    = useState("");
  var [prenomAgent,    setPrenomAgent]    = useState("");
  var [emailAgent,     setEmailAgent]     = useState("");
  var [mailCopie,      setMailCopie]      = useState(false);

  function genererMail() {
    var tb = TYPES_BIEN.find(function(t){ return t.id===typeBien; });
    var typLabel = tb ? tb.label.replace(/^[^ ]+ /,"") : "bien";
    var nom = nomProprietaire || "Monsieur / Madame";
    var adr = adresseBien || "votre bien";
    var agent = prenomAgent || "Votre conseiller ORPI";
    var email = emailAgent || "";
    var manquants = docs.filter(function(d){return !checked[d.id];});

    var lignesDoc = [];
    Object.keys(CATEGORIES).forEach(function(catId){
      var items = manquants.filter(function(d){return d.cat===catId;});
      if(items.length===0) return;
      lignesDoc.push("
" + CATEGORIES[catId].label.replace(/^[^ ]+ /,"").toUpperCase() + " :");
      items.forEach(function(d){ lignesDoc.push("  • " + d.label); });
    });

    return "Objet : Documents nécessaires à la vente de votre bien

"
      + "Madame, Monsieur " + (nomProprietaire || "") + ",

"
      + "Je me permets de vous contacter dans le cadre de la vente de votre "
      + typLabel + " situé" + (adresseBien?" au "+adresseBien:"") + ".

"
      + "Afin de constituer votre dossier de vente et de vous accompagner dans les meilleures conditions, "
      + "nous avons besoin des documents suivants :
"
      + lignesDoc.join("
")
      + "

Plus nous aurons ces documents en amont, plus nous pourrons vous proposer rapidement des acheteurs sérieux "
      + "et sécuriser votre transaction.

"
      + "N'hésitez pas à me contacter pour toute question ou pour convenir d'un rendez-vous.

"
      + "Bien cordialement,

"
      + agent + "
"
      + "ORPI Déclic Immo Amiens
"
      + (email ? email + "
" : "");
  }

  function toggle(id) { setChecked(function(p){ return {...p,[id]:!p[id]}; }); }
  function resetAll()  { setChecked({}); }

  var docs = useMemo(function(){
    if (!typeBien) return [];
    var tb = TYPES_BIEN.find(function(t){ return t.id===typeBien; });
    var autoCopro = tb && tb.cats.includes("copropriete");

    return DOCS.filter(function(d) {
      // Filtre type bien
      if (!d.typeBiens.includes("all") && !d.typeBiens.includes(typeBien)) return false;
      // Filtre personne
      if (d.personnePhysique && isPersonMorale) return false;
      if (d.personneMorale   && !isPersonMorale) return false;
      // Filtre loué
      if (d.siLoue && !isLoue) return false;
      // Filtre travaux
      if (d.siTravaux && !hasTravaux) return false;
      // Filtre copropriété
      if (d.copropriete && !isCopro && !autoCopro) return false;
      // Masquer optionnels
      if (d.optionnel && !showOptionnels) return false;
      return true;
    });
  }, [typeBien, isLoue, hasTravaux, isCopro, isPersonMorale, showOptionnels]);

  var byCategorie = useMemo(function(){
    var map = {};
    docs.forEach(function(d){
      if (!map[d.cat]) map[d.cat] = [];
      map[d.cat].push(d);
    });
    return map;
  }, [docs]);

  var nbTotal   = docs.length;
  var nbChecked = docs.filter(function(d){ return checked[d.id]; }).length;
  var pct       = nbTotal > 0 ? Math.round(nbChecked/nbTotal*100) : 0;

  return (
    <div>
      {/* En-tête */}
      <div style={{background:"linear-gradient(135deg,#1D3557,#E63946)",borderRadius:14,padding:"16px 18px",marginBottom:14,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:15,marginBottom:2}}>{"📋 Check-List Dossier de Vente"}</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>{"Source : ORPI France — Juin 2019 (v7)"}</div>
      </div>

      {/* Paramètres */}
      <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"16px",marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:13,marginBottom:14}}>{"⚙️ Paramètres du bien"}</div>

        {/* Type de bien */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:6}}>{"TYPE DE BIEN *"}</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
            {TYPES_BIEN.map(function(t){
              var actif = typeBien===t.id;
              return(
                <button key={t.id} onClick={function(){setTypeBien(t.id); setIsCopro(t.cats.includes("copropriete")); setChecked({});}}
                  style={{padding:"9px 10px",borderRadius:10,border:"2px solid "+(actif?"var(--navy)":"var(--g200)"),background:actif?"var(--navy)":"#fff",color:actif?"#fff":"var(--g600)",fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"var(--font)"}}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Options */}
        {typeBien && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {state:isPersonMorale, set:setIsPersonMorale, label:"🏢 Vendeur = personne morale (société)",   sub:"Ajoute les documents Kbis, statuts, PV AG"},
              {state:isLoue,         set:setIsLoue,         label:"🔑 Bien occupé / loué",                   sub:"Ajoute les documents bail, congés"},
              {state:hasTravaux,     set:setHasTravaux,     label:"🔨 Travaux réalisés",                     sub:"Ajoute permis, factures, assurances"},
              {state:isCopro,        set:setIsCopro,        label:"🏢 Copropriété",                          sub:"Ajoute RC, EDD, PV AG, charges"},
              {state:showOptionnels, set:setShowOptionnels, label:"📎 Afficher les documents optionnels",    sub:"Documents recommandés selon situation"},
            ].map(function(opt){
              return(
                <label key={opt.label} style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"8px 12px",background:opt.state?"#EFF6FF":"var(--g50)",borderRadius:10,border:"1px solid "+(opt.state?"var(--blue)":"var(--g200)")}}>
                  <input type="checkbox" checked={opt.state} onChange={function(){opt.set(function(p){return !p;});setChecked({});}} style={{width:18,height:18,flexShrink:0,marginTop:1}}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:12,color:opt.state?"var(--blue)":"var(--g600)"}}>{opt.label}</div>
                    <div style={{fontSize:10,color:"var(--g400)",marginTop:1}}>{opt.sub}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Checklist */}
      {typeBien && nbTotal>0 && (
        <div>
          {/* Barre progression */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{nbChecked+" / "+nbTotal+" documents"}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontWeight:900,fontSize:16,color:pct===100?"var(--green)":pct>=60?"var(--amber)":"var(--navy)"}}>{pct+"%"}</span>
                <button onClick={resetAll} style={{fontSize:10,color:"var(--red)",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>{"Tout décocher"}</button>
              </div>
            </div>
            <div style={{height:8,background:"var(--g100)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:pct+"%",background:pct===100?"var(--green)":pct>=60?"var(--amber)":"var(--navy)",borderRadius:4,transition:"width 0.4s"}}/>
            </div>
          </div>

          {/* Documents par catégorie */}
          {Object.keys(CATEGORIES).map(function(catId){
            var items = byCategorie[catId];
            if (!items || items.length===0) return null;
            var cat = CATEGORIES[catId];
            var nbCat = items.length;
            var ckCat = items.filter(function(d){return checked[d.id];}).length;
            return(
              <div key={catId} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:10}}>
                <div style={{background:cat.color+"11",borderLeft:"4px solid "+cat.color,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:800,color:cat.color,fontSize:13}}>{cat.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:ckCat===nbCat?"var(--green)":"var(--g400)"}}>{ckCat+"/"+nbCat}</span>
                </div>
                {items.map(function(doc){
                  var ok = !!checked[doc.id];
                  return(
                    <div key={doc.id} onClick={function(){toggle(doc.id);}}
                      style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",borderBottom:"1px solid var(--g50)",cursor:"pointer",background:ok?"#F0FDF4":"#fff",transition:"background 0.15s"}}>
                      <div style={{width:22,height:22,borderRadius:11,border:"2px solid "+(ok?cat.color:"var(--g300)"),background:ok?cat.color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                        {ok&&<span style={{color:"#fff",fontSize:13,fontWeight:900,lineHeight:1}}>{"✓"}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:ok?700:500,color:ok?"var(--navy)":"var(--g600)",fontSize:13,textDecoration:ok?"line-through":"none"}}>{doc.label}</div>
                        {doc.commentaire&&<div style={{fontSize:10,color:"var(--g400)",marginTop:2,fontStyle:"italic"}}>{doc.commentaire}</div>}
                        {doc.validite&&<div style={{fontSize:10,color:"var(--blue)",marginTop:2,fontWeight:600}}>{"⏱ Validité : "+doc.validite}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}


          {/* ─── MAIL AUTOMATIQUE ─── */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:10}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📧 Email à envoyer au propriétaire"}</span>
              {mailCopie && <span style={{fontSize:11,color:"var(--green)",fontWeight:700}}>{"✅ Copié !"}</span>}
            </div>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"NOM DU PROPRIÉTAIRE"}</label>
                  <input className="form-input" value={nomProprietaire} onChange={function(e){setNomProprietaire(e.target.value);}} placeholder="M. / Mme Dupont"/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"ADRESSE DU BIEN"}</label>
                  <input className="form-input" value={adresseBien} onChange={function(e){setAdresseBien(e.target.value);}} placeholder="40 Rue Victor Hugo, Amiens"/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"VOTRE PRÉNOM"}</label>
                  <input className="form-input" value={prenomAgent} onChange={function(e){setPrenomAgent(e.target.value);}} placeholder="Pierre"/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"VOTRE EMAIL DE CONTACT"}</label>
                  <input className="form-input" value={emailAgent} onChange={function(e){setEmailAgent(e.target.value);}} placeholder="p.rollot@orpi.com"/>
                </div>
              </div>

              {/* Aperçu du mail */}
              <div style={{background:"#F8FAFC",borderRadius:10,border:"1px solid var(--g200)",padding:"14px",marginBottom:12,fontSize:12,lineHeight:1.7,color:"var(--g600)",fontFamily:"Georgia,serif",whiteSpace:"pre-wrap"}}>
                {genererMail()}
              </div>

              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={function(){
                  navigator.clipboard.writeText(genererMail()).then(function(){
                    setMailCopie(true); setTimeout(function(){setMailCopie(false);},3000);
                  });
                }}>{"📋 Copier le mail"}</button>
                <a href={"mailto:?subject="+encodeURIComponent("Documents nécessaires à la vente de votre bien")+"&body="+encodeURIComponent(genererMail())}
                  style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"var(--g50)",border:"2px solid var(--g200)",borderRadius:10,padding:"8px 14px",fontWeight:700,fontSize:13,color:"var(--navy)",textDecoration:"none"}}>
                  {"✉️ Ouvrir dans Mail"}
                </a>
              </div>
            </div>
          </div>

          {/* Bouton export */}
          <button onClick={function(){
            var lines = ["CHECK-LIST DOSSIER DE VENTE ORPI\n"];
            lines.push("Type de bien : "+(TYPES_BIEN.find(function(t){return t.id===typeBien;})||{}).label);
            lines.push("Date : "+new Date().toLocaleDateString("fr-FR")+"\n");
            Object.keys(CATEGORIES).forEach(function(catId){
              var items = byCategorie[catId]; if(!items||items.length===0) return;
              lines.push("\n"+CATEGORIES[catId].label.toUpperCase());
              items.forEach(function(d){ lines.push((checked[d.id]?"[✓] ":"[ ] ")+d.label+(d.commentaire?" — "+d.commentaire:"")); });
            });
            var blob = new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
            var a = document.createElement("a"); a.href=URL.createObjectURL(blob);
            a.download="checklist-vente-orpi-"+typeBien+".txt"; a.click();
          }}
            className="btn btn-secondary" style={{width:"100%",justifyContent:"center",marginTop:8,marginBottom:16}}>
            {"⬇️ Exporter la check-list"}
          </button>
        </div>
      )}

      {!typeBien && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--g400)"}}>
          <div style={{fontSize:48,marginBottom:12}}>{"📋"}</div>
          <div style={{fontWeight:700,fontSize:15,color:"var(--navy)"}}>{"Sélectionnez un type de bien"}</div>
          <div style={{fontSize:12,marginTop:6}}>{"La check-list s'adapte automatiquement selon le bien, son état et son mode d'occupation"}</div>
        </div>
      )}
    </div>
  );
}
