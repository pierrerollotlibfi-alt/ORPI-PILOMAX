import { useState, useMemo } from "react";
import { fmt } from "./Shared";

// ─── CALCUL CRÉDIT ────────────────────────────────────────────────────────────
function calcCredit(montant, taux, dureeAns, dureeMois) {
  var capital = Number(montant) || 0;
  var n = (Number(dureeAns)||0)*12 + (Number(dureeMois)||0);
  var t = (Number(taux)||0) / 100 / 12;
  if (capital<=0 || n<=0) return null;
  var mensualite, coutTotal, coutCredit;
  if (t === 0) {
    mensualite = capital / n;
    coutTotal  = capital;
    coutCredit = 0;
  } else {
    mensualite = capital * (t * Math.pow(1+t,n)) / (Math.pow(1+t,n)-1);
    coutTotal  = mensualite * n;
    coutCredit = coutTotal - capital;
  }
  // Tableau d'amortissement (12 premières lignes + 12 dernières)
  var tableau = [];
  var restant = capital;
  for (var i=1; i<=n; i++) {
    var interet  = restant * t;
    var principal= mensualite - interet;
    restant -= principal;
    tableau.push({ mois:i, mensualite, interet, principal, restant:Math.max(0,restant) });
  }
  return { mensualite, coutTotal, coutCredit, n, tableau, capital };
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function Outils() {
  var [outil, setOutil] = useState("credit");

  return (
    <div>
      {/* Sélecteur outil */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[
          {id:"credit",   label:"🏦 Calculette crédit"},
          {id:"frais",    label:"📋 Frais de notaire"},
          {id:"rendement",  label:"📈 Rendement locatif"},
          {id:"agence",      label:"🏷️ Frais d'agence"},
          {id:"investisseur", label:"💎 Rentabilité investisseur"},
        ].map(function(o){
          var actif = outil===o.id;
          return (
            <button key={o.id} onClick={function(){setOutil(o.id);}} style={{padding:"8px 16px",borderRadius:20,border:"2px solid "+(actif?"var(--navy)":"var(--g200)"),background:actif?"var(--navy)":"#fff",color:actif?"#fff":"var(--g500)",fontWeight:700,fontSize:13,cursor:"pointer"}}>
              {o.label}
            </button>
          );
        })}
      </div>

      {outil==="credit"     && <CalculetteCredit/>}
      {outil==="frais"      && <FraisNotaire/>}
      {outil==="rendement"  && <RendementLocatif/>}
      {outil==="agence"     && <FraisAgence/>}
      {outil==="investisseur"&& <RentabiliteInvestisseur/>}
    </div>
  );
}

// ─── CALCULETTE CRÉDIT ────────────────────────────────────────────────────────
function CalculetteCredit() {
  var [montant,    setMontant]    = useState("200000");
  var [taux,       setTaux]       = useState("3.80");
  var [dureeAns,   setDureeAns]   = useState("20");
  var [dureeMois,  setDureeMois]  = useState("0");
  var [assurance,  setAssurance]  = useState("0.10");
  var [showTableau,setShowTableau]= useState(false);

  var result = useMemo(function(){
    return calcCredit(montant, taux, dureeAns, dureeMois);
  }, [montant, taux, dureeAns, dureeMois]);

  var mensAssurance = result ? (Number(montant)||0) * (Number(assurance)||0) / 100 / 12 : 0;
  var mensTotal     = result ? result.mensualite + mensAssurance : 0;

  // Couleur selon taux endettement estimé (mensualité / revenus inconnus → afficher seulement)
  function fmt2(v) { return Math.round(v).toLocaleString("fr-FR"); }

  return (
    <div>
      {/* Formulaire */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:18,marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"🏦 Calculette de crédit immobilier"}</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {/* Montant */}
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"MONTANT EMPRUNTÉ (€)"}</label>
            <div style={{position:"relative"}}>
              <input
                type="number"
                value={montant}
                onChange={function(e){setMontant(e.target.value);}}
                style={{width:"100%",padding:"12px 40px 12px 14px",border:"2px solid var(--g200)",borderRadius:10,fontSize:18,fontWeight:800,color:"var(--navy)",outline:"none"}}
              />
              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"var(--g400)",fontWeight:700}}>{"€"}</span>
            </div>
            {/* Slider montant */}
            <input type="range" min="10000" max="2000000" step="5000" value={montant} onChange={function(e){setMontant(e.target.value);}} style={{width:"100%",marginTop:6,accentColor:"var(--navy)"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--g400)"}}>
              <span>{"10 000 €"}</span><span>{"2 000 000 €"}</span>
            </div>
          </div>

          {/* Taux */}
          <div>
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"TAUX D'INTÉRÊT (%)"}</label>
            <div style={{position:"relative"}}>
              <input type="number" step="0.01" value={taux} onChange={function(e){setTaux(e.target.value);}} style={{width:"100%",padding:"10px 36px 10px 12px",border:"2px solid var(--g200)",borderRadius:10,fontSize:16,fontWeight:700,outline:"none"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"var(--g400)"}}>{"% / an"}</span>
            </div>
            <input type="range" min="0.5" max="8" step="0.05" value={taux} onChange={function(e){setTaux(e.target.value);}} style={{width:"100%",marginTop:6,accentColor:"var(--amber)"}}/>
          </div>

          {/* Assurance */}
          <div>
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{"ASSURANCE (% du capital)"}</label>
            <div style={{position:"relative"}}>
              <input type="number" step="0.01" value={assurance} onChange={function(e){setAssurance(e.target.value);}} style={{width:"100%",padding:"10px 36px 10px 12px",border:"2px solid var(--g200)",borderRadius:10,fontSize:16,fontWeight:700,outline:"none"}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"var(--g400)"}}>{"% / an"}</span>
            </div>
          </div>

          {/* Durée */}
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:8}}>{"DURÉE DU CRÉDIT"}</label>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  {[5,10,15,20,25].map(function(y){
                    return (
                      <button key={y} onClick={function(){setDureeAns(String(y));setDureeMois("0");}} style={{flex:1,padding:"6px 4px",borderRadius:8,border:"2px solid "+(Number(dureeAns)===y&&Number(dureeMois)===0?"var(--navy)":"var(--g200)"),background:Number(dureeAns)===y&&Number(dureeMois)===0?"var(--navy)":"#fff",color:Number(dureeAns)===y&&Number(dureeMois)===0?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                        {y+"ans"}
                      </button>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <input type="number" min="0" max="50" value={dureeAns} onChange={function(e){setDureeAns(e.target.value);}} style={{width:"100%",padding:"8px 10px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    <div style={{fontSize:10,color:"var(--g400)",textAlign:"center",marginTop:2}}>{"années"}</div>
                  </div>
                  <span style={{fontSize:18,color:"var(--g300)"}}>{"+"}</span>
                  <div style={{flex:1}}>
                    <input type="number" min="0" max="11" value={dureeMois} onChange={function(e){setDureeMois(e.target.value);}} style={{width:"100%",padding:"8px 10px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    <div style={{fontSize:10,color:"var(--g400)",textAlign:"center",marginTop:2}}>{"mois"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Résultat */}
      {result && (
        <div>
          {/* Mensualité principale */}
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"20px",marginBottom:14,color:"#fff"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{"MENSUALITÉ HORS ASSURANCE"}</div>
            <div style={{fontSize:42,fontWeight:900,lineHeight:1,marginBottom:4}}>{fmt2(result.mensualite)+" €"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.65)"}}>{"pendant "+result.n+" mois ("+(dureeAns!=="0"?dureeAns+"ans":"")+(dureeMois!=="0"?" "+dureeMois+"mois":"")+")"}</div>

            {mensAssurance > 0 && (
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.15)"}}>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:2}}>{"+ Assurance : "+fmt2(mensAssurance)+"€/mois"}</div>
                <div style={{fontSize:20,fontWeight:800,color:"#6EE7B7"}}>{"= Total : "+fmt2(mensTotal)+" €/mois"}</div>
              </div>
            )}
          </div>

          {/* Décomposition */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {label:"Capital emprunté",  val:fmt2(result.capital)+"€",         color:"var(--navy)",  icon:"🏠"},
              {label:"Coût des intérêts", val:fmt2(result.coutCredit)+"€",       color:"var(--red)",   icon:"📈"},
              {label:"Coût total",        val:fmt2(result.coutTotal)+"€",        color:"var(--purple)", icon:"💰"},
            ].map(function(k){
              return (
                <div key={k.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+k.color,padding:"12px"}}>
                  <div style={{fontSize:9,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.icon+" "+k.label}</div>
                  <div style={{fontSize:16,fontWeight:900,color:k.color}}>{k.val}</div>
                </div>
              );
            })}
          </div>

          {/* Barre capital vs intérêts */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",padding:"14px",marginBottom:14}}>
            <div style={{fontSize:12,color:"var(--g500)",fontWeight:600,marginBottom:8}}>{"Répartition capital / intérêts"}</div>
            {(function(){
              var pctCapital = Math.round(result.capital/result.coutTotal*100);
              var pctInterets = 100-pctCapital;
              return (
                <div>
                  <div style={{height:16,background:"var(--g100)",borderRadius:8,overflow:"hidden",display:"flex",marginBottom:8}}>
                    <div style={{height:"100%",width:pctCapital+"%",background:"var(--navy)",borderRadius:"8px 0 0 8px",transition:"width 0.5s"}}></div>
                    <div style={{height:"100%",flex:1,background:"var(--red)"}}></div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                    <span style={{color:"var(--navy)",fontWeight:700}}>{"🏠 Capital : "+pctCapital+"%"}</span>
                    <span style={{color:"var(--red)",fontWeight:700}}>{"📈 Intérêts : "+pctInterets+"%"}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Taux d'endettement simulé */}
          <div style={{background:"#EFF6FF",borderRadius:12,border:"1px solid #BFDBFE",padding:"14px",marginBottom:14}}>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:13,marginBottom:10}}>{"💡 Taux d'endettement simulé"}</div>
            <div style={{fontSize:12,color:"var(--g500)",marginBottom:8}}>{"Entrez les revenus nets mensuels du foyer pour estimer le taux d'endettement"}</div>
            <RevenusEstimation mensualite={mensTotal}/>
          </div>

          {/* Tableau d'amortissement */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"📊 Tableau d'amortissement"}</span>
              <button onClick={function(){setShowTableau(function(p){return !p;});}} style={{background:"var(--navy)",color:"#fff",border:"none",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {showTableau?"Masquer":"Voir le tableau"}
              </button>
            </div>
            {showTableau && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{background:"var(--g50)"}}>
                      {["Mois","Mensualité","Intérêts","Capital","Restant dû"].map(function(h){
                        return <th key={h} style={{padding:"8px 10px",fontWeight:700,color:"var(--g500)",textAlign:"right",whiteSpace:"nowrap"}}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(function(){
                      var t = result.tableau;
                      var rows = [];
                      // Afficher les 12 premiers + "..." + 12 derniers si > 36 mois
                      var display = t.length <= 36 ? t : [...t.slice(0,12), null, ...t.slice(-12)];
                      display.forEach(function(row, i){
                        if (!row) {
                          rows.push(<tr key="dots"><td colSpan={5} style={{textAlign:"center",padding:"8px",color:"var(--g400)",fontStyle:"italic"}}>{"⋮ "+( t.length-24)+" mois omis"}</td></tr>);
                          return;
                        }
                        var isFirst12 = row.mois<=12;
                        rows.push(
                          <tr key={row.mois} style={{borderBottom:"1px solid var(--g50)",background:row.mois%2===0?"#FAFAFA":"#fff"}}>
                            <td style={{padding:"7px 10px",fontWeight:700,color:"var(--navy)"}}>{row.mois}</td>
                            <td style={{padding:"7px 10px",textAlign:"right"}}>{fmt2(row.mensualite)+"€"}</td>
                            <td style={{padding:"7px 10px",textAlign:"right",color:"var(--red)"}}>{fmt2(row.interet)+"€"}</td>
                            <td style={{padding:"7px 10px",textAlign:"right",color:"var(--green)"}}>{fmt2(row.principal)+"€"}</td>
                            <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700}}>{fmt2(row.restant)+"€"}</td>
                          </tr>
                        );
                      });
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenusEstimation({ mensualite }) {
  var [revenus, setRevenus] = useState("4000");
  var taux = revenus > 0 ? Math.round(mensualite / Number(revenus) * 100) : 0;
  var color = taux <= 33 ? "var(--green)" : taux <= 40 ? "var(--amber)" : "var(--red)";
  var label = taux <= 33 ? "✅ Finançable (< 33%)" : taux <= 40 ? "⚠️ Limite haute" : "❌ Dépasse 40%";
  return (
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <div style={{position:"relative",flex:1}}>
        <input type="number" value={revenus} onChange={function(e){setRevenus(e.target.value);}} style={{width:"100%",padding:"8px 36px 8px 12px",border:"2px solid #BFDBFE",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}} placeholder="Revenus nets/mois"/>
        <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"var(--g400)"}}>{"€"}</span>
      </div>
      <div style={{background:color+"22",border:"1px solid "+color,borderRadius:10,padding:"8px 14px",textAlign:"center",flexShrink:0}}>
        <div style={{fontSize:20,fontWeight:900,color:color,lineHeight:1}}>{taux+"%"}</div>
        <div style={{fontSize:10,color:color,fontWeight:700,marginTop:2}}>{label}</div>
      </div>
    </div>
  );
}

// ─── FRAIS DE NOTAIRE ─────────────────────────────────────────────────────────
function FraisNotaire() {
  var [prix,       setPrix]       = useState("250000");
  var [neuf,       setNeuf]       = useState(false);
  var [apportFrais,setApportFrais]= useState(false);

  var result = useMemo(function(){
    var p = Number(prix)||0;
    if (p<=0) return null;
    var tauxFrais = neuf ? 0.028 : 0.082; // ~2.8% neuf, ~8.2% ancien
    var frais = Math.round(p * tauxFrais);
    var emoluments = Math.round(p * (neuf?0.008:0.008));
    var taxeDept   = neuf ? 0 : Math.round(p * 0.045);
    var taxeCom    = neuf ? 0 : Math.round(p * 0.012);
    var contrib    = Math.round(p * 0.001);
    var honoraires = Math.round(800);
    var totalAcquis= p + frais;
    return { p, frais, emoluments, taxeDept, taxeCom, contrib, honoraires, tauxFrais, totalAcquis };
  }, [prix, neuf]);

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:18,marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"📋 Estimation frais de notaire"}</div>

        <div className="form-group" style={{marginBottom:12}}>
          <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:6}}>{"PRIX DU BIEN (€)"}</label>
          <input type="number" value={prix} onChange={function(e){setPrix(e.target.value);}} style={{width:"100%",padding:"10px 14px",border:"2px solid var(--g200)",borderRadius:10,fontSize:16,fontWeight:700,outline:"none"}}/>
          <input type="range" min="50000" max="2000000" step="5000" value={prix} onChange={function(e){setPrix(e.target.value);}} style={{width:"100%",marginTop:6,accentColor:"var(--navy)"}}/>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={function(){setNeuf(false);}} style={{flex:1,padding:"10px",borderRadius:10,border:"2px solid "+(!neuf?"var(--navy)":"var(--g200)"),background:!neuf?"var(--navy)":"#fff",color:!neuf?"#fff":"var(--g500)",fontWeight:700,fontSize:13,cursor:"pointer"}}>{"🏚️ Ancien"}</button>
          <button onClick={function(){setNeuf(true);}} style={{flex:1,padding:"10px",borderRadius:10,border:"2px solid "+(neuf?"var(--green)":"var(--g200)"),background:neuf?"var(--green)":"#fff",color:neuf?"#fff":"var(--g500)",fontWeight:700,fontSize:13,cursor:"pointer"}}>{"🏗️ Neuf (VEFA)"}</button>
        </div>
      </div>

      {result && (
        <div>
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"18px",marginBottom:14,color:"#fff"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{"FRAIS DE NOTAIRE ESTIMÉS"}</div>
            <div style={{fontSize:36,fontWeight:900,lineHeight:1,marginBottom:4}}>{result.frais.toLocaleString("fr-FR")+"€"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.65)"}}>{"soit ~"+Math.round(result.tauxFrais*100)+"% du prix d'achat"}</div>
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.15)",fontSize:13,color:"#6EE7B7",fontWeight:800}}>{"Budget total acquisition : "+result.totalAcquis.toLocaleString("fr-FR")+"€"}</div>
          </div>

          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Détail des frais"}</span>
            </div>
            {[
              ["Émoluments notaire",  result.emoluments, "var(--navy)"],
              ...(!neuf?[
                ["Taxe départementale (4.5%)", result.taxeDept,   "var(--red)"],
                ["Taxe communale (1.2%)",       result.taxeCom,    "var(--amber)"],
              ]:[]),
              ["Contribution sécurité immobilière", result.contrib, "var(--g400)"],
              ["Honoraires et débours",    result.honoraires, "var(--g400)"],
            ].map(function(row){
              return (
                <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <span style={{fontSize:13,color:"var(--g600)"}}>{row[0]}</span>
                  <span style={{fontWeight:700,color:row[2],fontSize:13}}>{row[1].toLocaleString("fr-FR")+"€"}</span>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:10,fontSize:11,color:"var(--g400)",fontStyle:"italic",textAlign:"center"}}>{"⚠️ Estimation indicative — les frais réels peuvent varier selon la nature du bien et la commune."}</div>
        </div>
      )}
    </div>
  );
}

// ─── RENDEMENT LOCATIF ────────────────────────────────────────────────────────
function RendementLocatif() {
  var [prixAchat,   setPrixAchat]   = useState("200000");
  var [loyer,       setLoyer]       = useState("900");
  var [charges,     setCharges]     = useState("200");
  var [taxeFonciere,setTaxeFonciere]= useState("1200");
  var [fraisGestion,setFraisGestion]= useState("8");

  var result = useMemo(function(){
    var pa  = Number(prixAchat)||0;
    var l   = Number(loyer)||0;
    var c   = Number(charges)||0;
    var tf  = Number(taxeFonciere)||0;
    var fg  = Number(fraisGestion)||0;
    if (pa<=0||l<=0) return null;
    var revAnnuel    = l*12;
    var fraisAnnuels = (l*12*(fg/100)) + tf + c*12;
    var revNet       = revAnnuel - fraisAnnuels;
    var rendBrut     = revAnnuel/pa*100;
    var rendNet      = revNet/pa*100;
    return { revAnnuel, fraisAnnuels, revNet, rendBrut:Math.round(rendBrut*100)/100, rendNet:Math.round(rendNet*100)/100 };
  }, [prixAchat, loyer, charges, taxeFonciere, fraisGestion]);

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:18,marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"📈 Calcul de rendement locatif"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {label:"Prix d'achat (€)",    val:prixAchat,    set:setPrixAchat,    ph:"200000"},
            {label:"Loyer mensuel (€)",   val:loyer,        set:setLoyer,        ph:"900"},
            {label:"Charges copro/mois",  val:charges,      set:setCharges,      ph:"200"},
            {label:"Taxe foncière/an",    val:taxeFonciere, set:setTaxeFonciere, ph:"1200"},
            {label:"Frais de gestion (%)",val:fraisGestion, set:setFraisGestion, ph:"8"},
          ].map(function(f){
            return (
              <div key={f.label} style={{gridColumn:f.label==="Prix d'achat (€)"?"1/-1":"auto"}}>
                <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:4}}>{f.label.toUpperCase()}</label>
                <input type="number" value={f.val} onChange={function(e){f.set(e.target.value);}} placeholder={f.ph} style={{width:"100%",padding:"8px 12px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
              </div>
            );
          })}
        </div>
      </div>

      {result && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{"RENDEMENT BRUT"}</div>
              <div style={{fontSize:36,fontWeight:900,color:"#60A5FA"}}>{result.rendBrut+"%"}</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#059669,#10b981)",borderRadius:14,padding:"16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{"RENDEMENT NET"}</div>
              <div style={{fontSize:36,fontWeight:900}}>{result.rendNet+"%"}</div>
            </div>
          </div>
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden"}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Détail annuel"}</span>
            </div>
            {[
              ["Revenus bruts",  result.revAnnuel.toLocaleString("fr-FR")+"€",  "var(--green)"],
              ["Charges totales",result.fraisAnnuels.toLocaleString("fr-FR")+"€","var(--red)"],
              ["Revenus nets",   result.revNet.toLocaleString("fr-FR")+"€",     "var(--navy)"],
            ].map(function(row){
              return (
                <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <span style={{fontSize:13,color:"var(--g600)"}}>{row[0]}</span>
                  <span style={{fontWeight:700,color:row[2],fontSize:13}}>{row[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FRAIS D'AGENCE ───────────────────────────────────────────────────────────
function FraisAgence() {
  var [mode,       setMode]       = useState("fai");   // fai | netVendeur
  var [prix,       setPrix]       = useState("250000");
  var [taux,       setTaux]       = useState("5");
  var [forfait,    setForfait]    = useState("");
  var [typeTaux,   setTypeTaux]   = useState("pct");   // pct | forfait

  var result = useMemo(function(){
    var p = Number(prix)||0;
    if (p<=0) return null;
    var hono = typeTaux==="forfait"
      ? (Number(forfait)||0)
      : Math.round(p*(Number(taux)||0)/100);
    if (hono<=0) return null;

    if (mode==="fai") {
      // Prix FAI connu → calculer net vendeur
      var netVendeur = p - hono;
      var pctReel    = Math.round(hono/netVendeur*100*100)/100;
      return { prixFAI:p, netVendeur, hono, pctSurFAI:Math.round(hono/p*100*100)/100, pctSurNV:pctReel, honoHT:Math.round(hono/1.2), tva:Math.round(hono/1.2*0.2) };
    } else {
      // Net vendeur connu → calculer prix FAI
      var prixFAI2 = p + hono;
      var pctFAI   = Math.round(hono/prixFAI2*100*100)/100;
      return { prixFAI:prixFAI2, netVendeur:p, hono, pctSurFAI:pctFAI, pctSurNV:Math.round(hono/p*100*100)/100, honoHT:Math.round(hono/1.2), tva:Math.round(hono/1.2*0.2) };
    }
  }, [prix, taux, forfait, typeTaux, mode]);

  function fmt2(v){ return Math.round(v).toLocaleString("fr-FR"); }

  // Barème indicatif ORPI
  var bareme = [
    {de:0,     a:100000,  taux:8},
    {de:100000,a:200000,  taux:6},
    {de:200000,a:400000,  taux:5},
    {de:400000,a:800000,  taux:4},
    {de:800000, a:null,   taux:3},
  ];
  var tauxSuggere = bareme.find(function(b){ var p2=Number(prix)||0; return p2>=b.de && (b.a===null||p2<b.a); });

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:18,marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"🏷️ Calculette frais d'agence"}</div>

        {/* Mode */}
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={function(){setMode("fai");}} style={{flex:1,padding:"9px",borderRadius:10,border:"2px solid "+(mode==="fai"?"var(--navy)":"var(--g200)"),background:mode==="fai"?"var(--navy)":"#fff",color:mode==="fai"?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"Je connais le prix FAI"}</button>
          <button onClick={function(){setMode("netVendeur");}} style={{flex:1,padding:"9px",borderRadius:10,border:"2px solid "+(mode==="netVendeur"?"var(--navy)":"var(--g200)"),background:mode==="netVendeur"?"var(--navy)":"#fff",color:mode==="netVendeur"?"#fff":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"Je connais le net vendeur"}</button>
        </div>

        {/* Prix */}
        <div className="form-group" style={{marginBottom:12}}>
          <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:6}}>{mode==="fai"?"PRIX FAI (€)":"NET VENDEUR (€)"}</label>
          <input type="number" value={prix} onChange={function(e){setPrix(e.target.value);}} style={{width:"100%",padding:"10px 14px",border:"2px solid var(--g200)",borderRadius:10,fontSize:17,fontWeight:800,outline:"none"}}/>
          <input type="range" min="50000" max="2000000" step="5000" value={prix} onChange={function(e){setPrix(e.target.value);}} style={{width:"100%",marginTop:6,accentColor:"var(--navy)"}}/>
        </div>

        {/* Type honoraires */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={function(){setTypeTaux("pct");}} style={{flex:1,padding:"7px",borderRadius:8,border:"2px solid "+(typeTaux==="pct"?"var(--blue)":"var(--g200)"),background:typeTaux==="pct"?"#EFF6FF":"#fff",color:typeTaux==="pct"?"var(--blue)":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"% du prix"}</button>
          <button onClick={function(){setTypeTaux("forfait");}} style={{flex:1,padding:"7px",borderRadius:8,border:"2px solid "+(typeTaux==="forfait"?"var(--blue)":"var(--g200)"),background:typeTaux==="forfait"?"#EFF6FF":"#fff",color:typeTaux==="forfait"?"var(--blue)":"var(--g500)",fontWeight:700,fontSize:12,cursor:"pointer"}}>{"Forfait fixe"}</button>
        </div>

        {typeTaux==="pct" && (
          <div className="form-group" style={{marginBottom:12}}>
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:6}}>{"TAUX D'HONORAIRES (%)"}</label>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              {[3,4,5,6,7,8].map(function(t){
                return <button key={t} onClick={function(){setTaux(String(t));}} style={{flex:1,padding:"6px 0",borderRadius:8,border:"2px solid "+(Number(taux)===t?"var(--blue)":"var(--g200)"),background:Number(taux)===t?"#EFF6FF":"#fff",color:Number(taux)===t?"var(--blue)":"var(--g500)",fontWeight:800,fontSize:12,cursor:"pointer"}}>{t+"%"}</button>;
              })}
            </div>
            <input type="number" step="0.1" value={taux} onChange={function(e){setTaux(e.target.value);}} style={{width:"100%",padding:"8px 12px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
            {tauxSuggere && <div style={{fontSize:11,color:"var(--g400)",marginTop:4}}>{"💡 Barème indicatif pour cette tranche : "+tauxSuggere.taux+"%"}</div>}
          </div>
        )}

        {typeTaux==="forfait" && (
          <div className="form-group">
            <label style={{fontSize:11,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:6}}>{"HONORAIRES FORFAITAIRES (€)"}</label>
            <input type="number" value={forfait} onChange={function(e){setForfait(e.target.value);}} placeholder="Ex: 12000" style={{width:"100%",padding:"8px 12px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
          </div>
        )}
      </div>

      {result && (
        <div>
          {/* Résultat principal */}
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"18px",marginBottom:14,color:"#fff"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{"PRIX FAI"}</div>
                <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>{fmt2(result.prixFAI)+"€"}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{"NET VENDEUR"}</div>
                <div style={{fontSize:26,fontWeight:900,color:"#6EE7B7"}}>{fmt2(result.netVendeur)+"€"}</div>
              </div>
            </div>
          </div>

          {/* Détail honoraires */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Détail des honoraires"}</span>
            </div>
            {[
              ["Honoraires TTC",          fmt2(result.hono)+"€",          "var(--navy)"],
              ["dont TVA 20%",            fmt2(result.tva)+"€",            "var(--g400)"],
              ["Honoraires HT",           fmt2(result.honoHT)+"€",         "var(--blue)"],
              ["% sur prix FAI",          result.pctSurFAI+"%",            "var(--purple)"],
              ["% sur net vendeur",       result.pctSurNV+"%",             "var(--amber)"],
            ].map(function(row){
              return (
                <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <span style={{fontSize:13,color:"var(--g600)"}}>{row[0]}</span>
                  <span style={{fontWeight:700,color:row[2],fontSize:13}}>{row[1]}</span>
                </div>
              );
            })}
          </div>

          {/* Barème complet */}
          <div style={{background:"var(--g50)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontWeight:700,color:"var(--navy)",fontSize:12,marginBottom:8}}>{"📊 Barème indicatif"}</div>
            {bareme.map(function(b){
              var honoB = Math.round(Number(prix||0)*b.taux/100);
              var actif = tauxSuggere && tauxSuggere.taux===b.taux;
              return (
                <div key={b.de} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid var(--g100)",background:actif?"transparent":"transparent"}}>
                  <span style={{fontSize:12,color:"var(--g500)"}}>{b.de.toLocaleString("fr-FR")+"€"+(b.a?" → "+b.a.toLocaleString("fr-FR")+"€":" et +")}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontWeight:actif?900:600,color:actif?"var(--blue)":"var(--g400)",fontSize:12}}>{b.taux+"%"}</span>
                    <button onClick={function(){setTaux(String(b.taux));setTypeTaux("pct");}} style={{background:actif?"var(--blue)":"var(--g200)",color:actif?"#fff":"var(--g500)",border:"none",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"Appliquer"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RENTABILITÉ INVESTISSEUR ─────────────────────────────────────────────────
function RentabiliteInvestisseur() {
  var [prixAchat,    setPrixAchat]    = useState("200000");
  var [fraisNotaire, setFraisNotaire] = useState("16000");
  var [travaux,      setTravaux]      = useState("0");
  var [apport,       setApport]       = useState("40000");
  var [loyer,        setLoyer]        = useState("900");
  var [charges,      setCharges]      = useState("150");
  var [taxeFonciere, setTaxeFonciere] = useState("1200");
  var [fraisGestion, setFraisGestion] = useState("8");
  var [vacance,      setVacance]      = useState("1");   // mois/an
  var [tauxCredit,   setTauxCredit]   = useState("3.80");
  var [dureeCredit,  setDureeCredit]  = useState("20");
  var [assurance2,   setAssurance2]   = useState("0.10");

  var result = useMemo(function(){
    var pa   = Number(prixAchat)||0;
    var fn2  = Number(fraisNotaire)||0;
    var tv   = Number(travaux)||0;
    var ap   = Number(apport)||0;
    var l    = Number(loyer)||0;
    var ch   = Number(charges)||0;
    var tf   = Number(taxeFonciere)||0;
    var fg   = Number(fraisGestion)||0;
    var vac  = Number(vacance)||0;
    var tauxC= Number(tauxCredit)||0;
    var dur  = Number(dureeCredit)||0;
    var ass  = Number(assurance2)||0;

    if (pa<=0||l<=0) return null;

    var coutTotal  = pa+fn2+tv;
    var emprunt    = Math.max(0, coutTotal-ap);
    var n          = dur*12;
    var t          = tauxC/100/12;
    var mensCredit = n>0 && t>0 ? emprunt*(t*Math.pow(1+t,n))/(Math.pow(1+t,n)-1) : emprunt/Math.max(n,1);
    var mensAss    = emprunt*ass/100/12;
    var mensTotal  = mensCredit+mensAss;

    var revAnnuel    = l*(12-vac);
    var chargesAnnuelles = ch*12 + tf + l*12*(fg/100);
    var revNet       = revAnnuel - chargesAnnuelles;
    var cashflow     = revNet - mensTotal*12;
    var cashflowMois = cashflow/12;

    var rendBrut  = pa>0 ? revAnnuel/coutTotal*100 : 0;
    var rendNet   = pa>0 ? revNet/coutTotal*100 : 0;
    var rendCash  = ap>0 ? cashflow/ap*100 : 0; // cash on cash

    // Projection 10 ans (revalorisation 1%/an loyer, 2%/an bien)
    var valeur10ans = coutTotal * Math.pow(1.02,10);
    var loyerCumul  = l*12 * ((Math.pow(1.01,10)-1)/0.01);
    var chargesCumul= chargesAnnuelles*10 + mensTotal*12*10;
    var plusValue    = valeur10ans - coutTotal;
    var gainTotal   = loyerCumul - chargesCumul + plusValue;

    return {
      coutTotal, emprunt, mensCredit, mensAss, mensTotal,
      revAnnuel, chargesAnnuelles, revNet, cashflow, cashflowMois,
      rendBrut:Math.round(rendBrut*100)/100,
      rendNet:Math.round(rendNet*100)/100,
      rendCash:Math.round(rendCash*100)/100,
      valeur10ans, loyerCumul, chargesCumul, plusValue, gainTotal,
    };
  }, [prixAchat,fraisNotaire,travaux,apport,loyer,charges,taxeFonciere,fraisGestion,vacance,tauxCredit,dureeCredit,assurance2]);

  function fmt2(v){ return Math.round(v).toLocaleString("fr-FR"); }
  function pct(v){ return Math.round(v*100)/100+"%"; }

  return (
    <div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid var(--g200)",padding:18,marginBottom:14}}>
        <div style={{fontWeight:800,color:"var(--navy)",fontSize:14,marginBottom:14}}>{"💎 Rentabilité investisseur"}</div>

        <div style={{fontWeight:700,color:"var(--navy)",fontSize:11,textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:"1px solid var(--g100)"}}>{"🏠 Acquisition"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[
            {label:"Prix d'achat (€)",    val:prixAchat,    set:setPrixAchat},
            {label:"Frais de notaire (€)", val:fraisNotaire, set:setFraisNotaire},
            {label:"Travaux estimés (€)",  val:travaux,      set:setTravaux},
            {label:"Apport personnel (€)", val:apport,       set:setApport},
          ].map(function(f){
            return (
              <div key={f.label}>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:3}}>{f.label.toUpperCase()}</label>
                <input type="number" value={f.val} onChange={function(e){f.set(e.target.value);}} style={{width:"100%",padding:"7px 10px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
              </div>
            );
          })}
        </div>

        <div style={{fontWeight:700,color:"var(--navy)",fontSize:11,textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:"1px solid var(--g100)"}}>{"💰 Revenus & Charges"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          {[
            {label:"Loyer mensuel (€)",    val:loyer,        set:setLoyer},
            {label:"Charges copro/mois",   val:charges,      set:setCharges},
            {label:"Taxe foncière/an (€)", val:taxeFonciere, set:setTaxeFonciere},
            {label:"Gestion locative (%)", val:fraisGestion, set:setFraisGestion},
            {label:"Vacance locative (mois/an)", val:vacance, set:setVacance},
          ].map(function(f){
            return (
              <div key={f.label}>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:3}}>{f.label.toUpperCase()}</label>
                <input type="number" value={f.val} onChange={function(e){f.set(e.target.value);}} style={{width:"100%",padding:"7px 10px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
              </div>
            );
          })}
        </div>

        <div style={{fontWeight:700,color:"var(--navy)",fontSize:11,textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:"1px solid var(--g100)"}}>{"🏦 Financement"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[
            {label:"Taux crédit (%)",   val:tauxCredit,  set:setTauxCredit},
            {label:"Durée (ans)",       val:dureeCredit, set:setDureeCredit},
            {label:"Assurance (% cap)", val:assurance2,  set:setAssurance2},
          ].map(function(f){
            return (
              <div key={f.label}>
                <label style={{fontSize:10,color:"var(--g400)",fontWeight:700,display:"block",marginBottom:3}}>{f.label.toUpperCase()}</label>
                <input type="number" step="0.01" value={f.val} onChange={function(e){f.set(e.target.value);}} style={{width:"100%",padding:"7px 10px",border:"2px solid var(--g200)",borderRadius:8,fontSize:14,fontWeight:700,outline:"none"}}/>
              </div>
            );
          })}
        </div>
      </div>

      {result && (
        <div>
          {/* Cashflow mensuel — metric principale */}
          <div style={{background:result.cashflowMois>=0?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#DC2626,#EF4444)",borderRadius:14,padding:"18px",marginBottom:14,color:"#fff",textAlign:"center"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{"CASHFLOW MENSUEL NET"}</div>
            <div style={{fontSize:48,fontWeight:900,lineHeight:1}}>{(result.cashflowMois>=0?"+":"")+fmt2(result.cashflowMois)+"€"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:6}}>{"après crédit, charges et vacance"}</div>
          </div>

          {/* 3 rendements */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {label:"Rendement brut",  val:pct(result.rendBrut),  color:"var(--blue)",  icon:"📊", sub:"loyers/coût total"},
              {label:"Rendement net",   val:pct(result.rendNet),   color:"var(--green)", icon:"✅", sub:"après charges"},
              {label:"Cash on cash",    val:pct(result.rendCash),  color:"var(--purple)",icon:"💎", sub:"sur apport seul"},
            ].map(function(k){
              return (
                <div key={k.label} style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",borderLeft:"4px solid "+k.color,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"var(--g400)",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{k.icon+" "+k.label}</div>
                  <div style={{fontSize:20,fontWeight:900,color:k.color,lineHeight:1}}>{k.val}</div>
                  <div style={{fontSize:9,color:"var(--g400)",marginTop:3}}>{k.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Décomposition mensuelle */}
          <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:14}}>
            <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Décomposition mensuelle"}</span>
            </div>
            {[
              ["Loyer encaissé (hors vacance)", fmt2(result.revAnnuel/12)+"€",     "var(--green)"],
              ["Crédit + assurance",            "-"+fmt2(result.mensTotal)+"€",     "var(--red)"],
              ["Charges & frais /mois",         "-"+fmt2(result.chargesAnnuelles/12)+"€","var(--amber)"],
              ["= Cashflow net",                (result.cashflowMois>=0?"+":"")+fmt2(result.cashflowMois)+"€", result.cashflowMois>=0?"var(--green)":"var(--red)"],
            ].map(function(row){
              return (
                <div key={row[0]} style={{display:"flex",justifyContent:"space-between",padding:"9px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <span style={{fontSize:13,color:"var(--g600)"}}>{row[0]}</span>
                  <span style={{fontWeight:700,color:row[2],fontSize:13}}>{row[1]}</span>
                </div>
              );
            })}
          </div>

          {/* Projection 10 ans */}
          <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"18px",color:"#fff"}}>
            <div style={{fontWeight:800,fontSize:13,marginBottom:12,color:"rgba(255,255,255,0.8)"}}>{"📅 Projection sur 10 ans (loyers +1%/an, bien +2%/an)"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {label:"Valeur du bien",    val:fmt2(result.valeur10ans)+"€",  color:"#6EE7B7"},
                {label:"Plus-value latente",val:fmt2(result.plusValue)+"€",   color:"#FCD34D"},
                {label:"Loyers cumulés",    val:fmt2(result.loyerCumul)+"€",  color:"#93C5FD"},
                {label:"Gain total estimé", val:fmt2(result.gainTotal)+"€",   color:"#FCA5A5"},
              ].map(function(k){
                return (
                  <div key={k.label} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:700,marginBottom:4}}>{k.label.toUpperCase()}</div>
                    <div style={{fontSize:18,fontWeight:900,color:k.color}}>{k.val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:10,fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>{"Estimations indicatives — hors fiscalité, hors remboursement capital."}</div>
          </div>
        </div>
      )}
    </div>
  );
}
