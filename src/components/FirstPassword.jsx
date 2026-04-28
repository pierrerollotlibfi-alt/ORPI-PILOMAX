import { useState } from "react";

export default function FirstPassword({ user, onSuccess, onCancel }) {
  var [pwd,   setPwd]   = useState("");
  var [pwd2,  setPwd2]  = useState("");
  var [error, setError] = useState("");

  function submit() {
    if (pwd.length < 6) { setError("Mot de passe trop court (6 caractères min.)"); return; }
    if (pwd !== pwd2)   { setError("Les mots de passe ne correspondent pas"); return; }
    onSuccess(pwd);
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(145deg,#1D3557,#E63946)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:"38px 32px",width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:10}}>{"🔑"}</div>
          <h2 style={{color:"var(--navy)",fontWeight:800}}>{"Bienvenue, "+user.nom+"!"}</h2>
          <p style={{color:"#64748B",fontSize:13,marginTop:6}}>{"Première connexion — créez votre mot de passe personnel."}</p>
        </div>
        {error && <div className="alert alert-danger" style={{marginBottom:14}}>{"⚠️ "+error}</div>}
        <div className="form-group" style={{marginBottom:12}}>
          <label className="form-label">{"Choisir un mot de passe"}</label>
          <input type="password" className="form-input" placeholder="Minimum 6 caractères" value={pwd} onChange={function(e){setPwd(e.target.value);setError("");}}/>
        </div>
        <div className="form-group" style={{marginBottom:20}}>
          <label className="form-label">{"Confirmer le mot de passe"}</label>
          <input type="password" className="form-input" placeholder="Répétez votre mot de passe" value={pwd2} onChange={function(e){setPwd2(e.target.value);setError("");}} onKeyDown={function(e){if(e.key==="Enter")submit();}}/>
        </div>
        <button className="btn btn-primary" style={{width:"100%",padding:13,justifyContent:"center",marginBottom:10}} onClick={submit}>
          {"Créer mon mot de passe →"}
        </button>
        <button className="btn btn-secondary" style={{width:"100%",justifyContent:"center"}} onClick={onCancel}>
          {"Annuler"}
        </button>
      </div>
    </div>
  );
}
