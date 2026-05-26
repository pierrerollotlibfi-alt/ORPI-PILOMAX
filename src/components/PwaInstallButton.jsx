import { useState } from "react";

function detectPlatform() {
  var ua = navigator.userAgent || "";
  return {
    isIOS:        /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
    isFirefox:    /Firefox/.test(ua),
    isSafari:     /Safari/.test(ua) && !/Chrome/.test(ua),
    isStandalone: window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone,
  };
}

export default function PwaInstallButton({ canInstall, installApp }) {
  var [showModal, setShowModal] = useState(false);
  var plat = detectPlatform();

  if (plat.isStandalone) return null;

  var btnStyle = {background:"var(--navy)",color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"var(--font)"};

  if (canInstall) {
    return (
      <button onClick={installApp} style={btnStyle} title="Installer">
        <span style={{fontSize:14}}>{"\u{1F4F2}"}</span>
        <span>{"Installer"}</span>
      </button>
    );
  }

  if (plat.isIOS && plat.isSafari) {
    var steps = [
      {n:"1", text:"Bouton Partage en bas de Safari", icon:"\u2B06\uFE0F"},
      {n:"2", text:"Faites defiler le menu vers le bas", icon:"\u{1F447}"},
      {n:"3", text:"Sur l\'ecran d\'accueil puis Ajouter", icon:"\u2705"},
    ];
    return (
      <>
        <button onClick={function(){setShowModal(true);}} style={btnStyle}>
          <span style={{fontSize:14}}>{"\u{1F4F2}"}</span>
          <span>{"Installer"}</span>
        </button>
        {showModal && (
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end"}} onClick={function(){setShowModal(false);}}>
            <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:480}} onClick={function(e){e.stopPropagation();}}>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:48,marginBottom:8}}>{"\u{1F4F2}"}</div>
                <div style={{fontWeight:900,fontSize:18,color:"#1D3557"}}>{"Ajouter a l\'ecran d\'accueil"}</div>
              </div>
              {steps.map(function(s){
                return (
                  <div key={s.n} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:"1px solid #F1F5F9"}}>
                    <div style={{width:36,height:36,borderRadius:18,background:"#1D3557",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:15,flexShrink:0}}>{s.n}</div>
                    <div style={{fontWeight:700,color:"#1D3557",fontSize:14,flex:1}}>{s.text}</div>
                    <span style={{fontSize:22}}>{s.icon}</span>
                  </div>
                );
              })}
              <button onClick={function(){setShowModal(false);}} style={{width:"100%",background:"#1D3557",color:"#fff",border:"none",borderRadius:12,padding:14,fontWeight:800,fontSize:15,cursor:"pointer",marginTop:20}}>{"Compris !"}</button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (plat.isFirefox) {
    return (
      <button onClick={function(){alert("Menu hamburger en haut a droite puis Installer l\'application");}} style={btnStyle}>
        <span style={{fontSize:14}}>{"\u{1F4F2}"}</span>
        <span>{"Installer"}</span>
      </button>
    );
  }

  return null;
}
