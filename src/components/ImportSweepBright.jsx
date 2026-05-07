import { useState, useRef } from "react";
import { useApp } from "../App";
import { fmt } from "./Shared";
import * as XLSX from "xlsx";

// ─── MAPPING TYPES BIEN ──────────────────────────────────────────────────────
var TYPE_MAP = {
  "Maison":                "maison",
  "Appartement":           "appartement",
  "Locaux professionnels": "local_pro_vente",
  "Terrain":               "terrain",
  "Garage":                "garage",
  "Bureaux":               "local_pro_vente",
  "Commerce":              "fonds_commerce",
};

function cleanPrice(v) {
  if (v===null||v===undefined||v==="") return 0;
  return Math.round(parseFloat(String(v).replace(",",".").replace(/\s/g,""))||0);
}

function parseExcelDate(v) {
  if (!v) return "";
  var s = String(v);
  // format DD/MM/YYYY HH:MM:SS ou DD/MM/YYYY
  var m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3]+"-"+m[2]+"-"+m[1];
  return s.slice(0,10);
}

export default function ImportSweepBright() {
  var ctx     = useApp();
  var agenceId= ctx.currentUser.agenceId;
  var agents  = (ctx.users||[]).filter(function(u){ return u.agenceId===agenceId && u.actif; });

  // Mapping nego code → agentId — pré-rempli automatiquement depuis codeNego des agents
  var [mapping, setMapping] = useState(function(){
    var m = { FCA:"", PRO:"", LVA:"", LEC:"", DUN:"", SAH:"", IDE:"", BOL:"", HAP:"", SAC:"", FLK:"", PAS:"" };
    agents.forEach(function(a){
      if (a.codeNego) m[a.codeNego] = a.id;
    });
    // Mapper FCA et PRO sur Fred et Pierre
    agents.forEach(function(a){
      if ((a.role==="superadmin"||a.role==="manager") && a.email && a.email.includes("f.carre")) m["FCA"] = a.id;
      if ((a.role==="superadmin"||a.role==="manager") && a.email && a.email.includes("p.rollot")) m["PRO"] = a.id;
    });
    return m;
  });
  var [preview, setPreview]   = useState(null);  // mandats parsés
  var [importing, setImporting] = useState(false);
  var [result,  setResult]    = useState(null);
  var fileRef = useRef(null);

  function handleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = new Uint8Array(ev.target.result);
        var wb   = XLSX.read(data, {type:"array"});
        var ws   = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws);
        
        // Détecter les codes nego
        var codes = {};
        rows.forEach(function(r){ if(r.MandatCodeNego) codes[r.MandatCodeNego]=true; });
        var newMapping = {...mapping};
        Object.keys(codes).forEach(function(k){ if(!newMapping[k]) newMapping[k]=""; });
        setMapping(newMapping);
        
        // Parser les mandats
        var mandats = rows
          .filter(function(r){ return r.MandatStatut !== "Retiré"; })
          .map(function(r) {
            var typeBien = TYPE_MAP[r.MandatTypeBien] || "appartement";
            if (r.MandatType === "Location") typeBien = typeBien.replace("_vente","_location");
            return {
              ref:          "SB-"+String(r.MandatNumero||"").trim(),
              adresse:      String(r.MandatCommuneBien||"").trim(),
              nomClient:    String(r.MandatNom||"").trim().toUpperCase(),
              typeBien,
              typeMandat:   r.MandatExclusif ? "exclusif" : "simple",
              statut:       "mandat",
              prix:         cleanPrice(r.MandatNetProprietaire),
              commission:   cleanPrice(r.MandatHonoraires),
              codeNego:     String(r.MandatCodeNego||"").trim(),
              dateMandat:   parseExcelDate(r.MandatDateCreation),
              agenceId,
              source:       "sweepbright",
            };
          });
        setPreview(mandats);
        setResult(null);
      } catch(err) {
        alert("Erreur lecture fichier : "+err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function importer() {
    if (!preview) return;
    setImporting(true);
    var existingRefs = new Set((ctx.mandats||[]).map(function(m){return m.ref;}));
    var nouveaux = 0; var mis_a_jour = 0; var ignores = 0;
    
    var newMandats = [...(ctx.mandats||[])];
    
    preview.forEach(function(m) {
      var agentId = mapping[m.codeNego] || "";
      var entry = {...m, agentId, id: m.ref+"-"+agenceId };
      
      if (existingRefs.has(m.ref)) {
        // Mettre à jour
        newMandats = newMandats.map(function(ex){ return ex.ref===m.ref ? {...ex, ...entry} : ex; });
        mis_a_jour++;
      } else if (agentId) {
        newMandats.push(entry);
        nouveaux++;
      } else {
        ignores++;
      }
    });
    
    ctx.setMandats(newMandats);
    setResult({ nouveaux, mis_a_jour, ignores });
    setImporting(false);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  var codesNego = preview ? [...new Set(preview.map(function(m){return m.codeNego;}).filter(Boolean))] : Object.keys(mapping);

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#1D3557,#2a4a7a)",borderRadius:14,padding:"16px 18px",marginBottom:16,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:15,marginBottom:4}}>{"📥 Import SweepBright / ORPI"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{"Importez votre export Excel de mandats depuis SweepBright ou tout logiciel ORPI. Les mandats existants (même référence) seront mis à jour."}</div>
      </div>

      {/* Upload fichier */}
      <div style={{background:"#fff",borderRadius:12,border:"2px dashed var(--g200)",padding:20,textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:32,marginBottom:8}}>{"📊"}</div>
        <div style={{fontWeight:700,color:"var(--navy)",marginBottom:8}}>{"Sélectionnez votre fichier Excel"}</div>
        <div style={{fontSize:12,color:"var(--g400)",marginBottom:14}}>{"Format attendu : export-mandats.xlsx depuis SweepBright · Colonnes : MandatNumero, MandatTypeBien, MandatCodeNego, MandatNetProprietaire, MandatHonoraires…"}</div>
        <label style={{background:"var(--navy)",color:"#fff",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          {"📂 Choisir le fichier"}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleFile}/>
        </label>
      </div>

      {/* Résultat import */}
      {result && (
        <div style={{background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontWeight:800,color:"#065F46",fontSize:14,marginBottom:10}}>{"✅ Import terminé"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["✨ Nouveaux",result.nouveaux,"var(--green)"],["🔄 Mis à jour",result.mis_a_jour,"var(--blue)"],["⚠️ Ignorés*",result.ignores,"var(--amber)"]].map(function(k){
              return <div key={k[0]} style={{background:"#fff",borderRadius:8,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:k[2]}}>{k[1]}</div>
                <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{k[0]}</div>
              </div>;
            })}
          </div>
          {result.ignores>0 && <div style={{fontSize:11,color:"var(--amber)",marginTop:8}}>{"* Ignorés car agent non mappé — assignez les codes nego et réimportez"}</div>}
        </div>
      )}

      {/* Mapping codes nego → agents */}
      {codesNego.length>0 && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
          <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)"}}>
            <div style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"👤 Associer les codes agents"}</div>
            <div style={{fontSize:11,color:"var(--g400)",marginTop:2}}>{"Reliez chaque code nego à un agent de votre équipe"}</div>
          </div>
          <div style={{padding:"12px 14px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {codesNego.map(function(code){
                var count = preview ? preview.filter(function(m){return m.codeNego===code;}).length : 0;
                return (
                  <div key={code} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--g50)",borderRadius:8}}>
                    <div style={{fontWeight:900,color:"var(--navy)",fontSize:13,minWidth:36,background:"var(--navy)",color:"#fff",borderRadius:6,padding:"2px 8px",textAlign:"center"}}>{code}</div>
                    <div style={{flex:1}}>
                      <select className="form-select" style={{fontSize:12}} value={mapping[code]||""} onChange={function(e){setMapping(function(p){return{...p,[code]:e.target.value};});}}>
                        <option value="">{"— Choisir —"}</option>
                        {agents.map(function(a){return <option key={a.id} value={a.id}>{a.nom}</option>;})}
                      </select>
                    </div>
                    {count>0 && <span style={{fontSize:10,color:"var(--g400)",flexShrink:0}}>{count+" biens"}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Prévisualisation */}
      {preview && (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid var(--g200)",overflow:"hidden",marginBottom:16}}>
          <div style={{background:"var(--g50)",padding:"10px 14px",borderBottom:"1px solid var(--g100)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontWeight:800,color:"var(--navy)",fontSize:13}}>{"Aperçu — "+preview.length+" mandats"}</span>
              <span style={{fontSize:11,color:"var(--g400)",marginLeft:8}}>{"(mandats retirés exclus)"}</span>
            </div>
            <button className="btn btn-primary" onClick={importer} disabled={importing} style={{padding:"6px 16px"}}>
              {importing ? "Import en cours…" : "✅ Importer "+preview.length+" mandats"}
            </button>
          </div>
          <div style={{maxHeight:300,overflowY:"auto"}}>
            {preview.slice(0,30).map(function(m,i){
              var agent = agents.find(function(a){return a.id===mapping[m.codeNego];});
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <div>
                    <div style={{fontWeight:700,color:"var(--navy)",fontSize:12}}>{m.ref+" — "+m.nomClient}</div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{m.adresse+" · "+m.typeBien+" · "+(m.typeMandat==="exclusif"?"⭐ Excl.":"Simple")}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                    <div style={{fontWeight:700,fontSize:12,color:"var(--navy)"}}>{m.prix.toLocaleString("fr-FR")+"€"}</div>
                    <div style={{fontSize:10,color:agent?"var(--green)":"var(--red)"}}>{agent?agent.nom:"⚠️ "+m.codeNego+" non mappé"}</div>
                  </div>
                </div>
              );
            })}
            {preview.length>30 && <div style={{padding:"8px 14px",fontSize:11,color:"var(--g400)",textAlign:"center"}}>{"… et "+(preview.length-30)+" autres"}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
