import { useState, useEffect } from "react";

// Détecte l'OS/navigateur
function detectPlatform() {
  var ua = navigator.userAgent || "";
  var isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  var isAndroid = /Android/.test(ua);
  var isSafari  = /Safari/.test(ua) && !/Chrome/.test(ua);
  var isFirefox = /Firefox/.test(ua);
  var isChrome  = /Chrome/.test(ua) && !/Edge/.test(ua);
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  return { isIOS, isAndroid, isSafari, isFirefox, isChrome, isStandalone };
}

export default function PwaInstallButton({ canInstall, installApp }) {
  var [showIosModal, setShowIosModal] = useState(false);
  var plat = detectPlatform();

  // Déjà installé → ne rien afficher
  if (plat.isStandalone) return null;

  // iOS Safari → instructions manuelles (pas de beforeinstallprompt)
  if (plat.isIOS && plat.isSafari) {
    return (
      <>
        <button onClick={function(){setShowIosModal(true);}}
          style={{width:"100%",background:"rgba(255,255,255,0.15)",color:"#fff",border:"2px solid rgba(255,255,255,0.3)",borderRadius:16,padding:"12px 20px",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,backdropFilter:"blur(10px)",fontFamily:"inherit",marginTop:4}}>
          <span style={{fontSize:22}}>{"📲"}</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:900}}>{"Ajouter à l'écran d'accueil"}</div>
            <div style={{fontSize:10,opacity:.7}}>{"Instructions pour iPhone / iPad"}</div>
          </div>
        </button>

        {showIosModal && (
          <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={function(){setShowIosModal(false);}}>
            <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:480}} onClick={function(e){e.stopPropagation();}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:48,marginBottom:8}}>{"📲"}</div>
                <div style={{fontWeight:900,fontSize:18,color:"#1D3557"}}>{"Ajouter à l'écran d'accueil"}</div>
                <div style={{fontSize:13,color:"#64748B",marginTop:4}}>{"Suivez ces 3 étapes simples"}</div>
              </div>
              {[
                {emoji:"1️⃣", text:"Appuyez sur l'icône Partage", sub:"Le bouton □↑ en bas de Safari"},
                {emoji:"2️⃣", text:"Faites défiler vers le bas",   sub:"Dans le menu qui s'ouvre"},
                {emoji:"3️⃣", text:"'Sur l'écran d'accueil'", sub:"Puis confirmez avec 'Ajouter'"},
              ].map(function(s,i){
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:i<2?"1px solid #F1F5F9":"none"}}>
                    <span style={{fontSize:28,flexShrink:0}}>{s.emoji}</span>
                    <div>
                      <div style={{fontWeight:700,color:"#1D3557",fontSize:14}}>{s.text}</div>
                      <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{s.sub}</div>
                    </div>
                  </div>
                );
              })}
              <button onClick={function(){setShowIosModal(false);}} style={{width:"100%",background:"#1D3557",color:"#fff",border:"none",borderRadius:12,padding:14,fontWeight:800,fontSize:15,cursor:"pointer",marginTop:20}}>{"Compris !"}</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Firefox → pas de beforeinstallprompt non plus — instructions manuelles
  if (plat.isFirefox) {
    return (
      <button onClick={function(){
        alert("Pour installer l'app Firefox :\n\n1. Ouvrez le menu ☰ en haut à droite\n2. Sélectionnez \"Installer l'application\"\n\nSi cette option n'est pas visible, l'installation n'est pas encore supportée sur votre version de Firefox.");
      }}
        style={{width:"100%",background:"rgba(255,255,255,0.15)",color:"#fff",border:"2px solid rgba(255,255,255,0.3)",borderRadius:16,padding:"12px 20px",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,backdropFilter:"blur(10px)",fontFamily:"inherit",marginTop:4}}>
        <span style={{fontSize:22}}>{"🦊"}</span>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:900}}>{"Installer l'app"}</div>
          <div style={{fontSize:10,opacity:.7}}>{"Instructions Firefox"}</div>
        </div>
      </button>
    );
  }

  // Chrome Android + autres → beforeinstallprompt natif
  if (canInstall) {
    return (
      <button onClick={installApp}
        style={{width:"100%",background:"rgba(255,255,255,0.15)",color:"#fff",border:"2px solid rgba(255,255,255,0.3)",borderRadius:16,padding:"12px 20px",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,backdropFilter:"blur(10px)",fontFamily:"inherit",marginTop:4}}>
        <span style={{fontSize:22}}>{"✈️"}</span>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:900}}>{"Ajouter à l'écran d'accueil"}</div>
          <div style={{fontSize:10,opacity:.7}}>{"Accès rapide depuis votre téléphone"}</div>
        </div>
      </button>
    );
  }

  return null;
}
