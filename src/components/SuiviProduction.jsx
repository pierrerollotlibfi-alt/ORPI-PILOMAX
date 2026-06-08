import { useMemo } from "react";
import { fmt, avatarColor } from "./Shared";

// ─── SUIVI DE PRODUCTION ANNUELLE (point mort agence) ───────────────────────
// Donnees issues du fichier Excel "Suivi production ORPI 2026".
// Commission TTC -> HT (TVA 20%) -> part negociateur / part agence.
// L'objectif agence est de couvrir le point mort annuel.

var PROD_2026 = {
  annee: 2026,
  pointMort: 292037,
  objectifMensuel: 24336,
  mois: [
    { m: "Jan", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 0 },
    { m: "Fév", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 0 },
    { m: "Mar", ttc: 27000,  ht: 22500,  partAgence: 11250, cumul: 11250 },
    { m: "Avr", ttc: 29000,  ht: 24167,  partAgence: 12083, cumul: 23333 },
    { m: "Mai", ttc: 166900, ht: 139083, partAgence: 93188, cumul: 116521 },
    { m: "Juin",ttc: 79900,  ht: 66583,  partAgence: 54083, cumul: 170604 },
    { m: "Juil",ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
    { m: "Août",ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
    { m: "Sep", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
    { m: "Oct", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
    { m: "Nov", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
    { m: "Déc", ttc: 0,      ht: 0,      partAgence: 0,     cumul: 170604 },
  ],
  total: { ttc: 302800, ht: 252333, partNego: 81729, partAgence: 170604 },
  parNegociateur: [
    { nom: "Cédric Salle",      ttc: 80000, nb: 6 },
    { nom: "Clément Leroy",     ttc: 42500, nb: 5 },
    { nom: "Pierre Rollot",     ttc: 38400, nb: 3 },
    { nom: "Isabelle Descombes",ttc: 55000, nb: 4 },
    { nom: "Landry Boungo",     ttc: 34000, nb: 4 },
    { nom: "Nathalie Ducrocq",  ttc: 26400, nb: 4 },
    { nom: "Laetitia Vat",      ttc: 14000, nb: 1 },
    { nom: "Frédéric Carré",    ttc: 12500, nb: 1 },
  ],
};

function Carte({ label, valeur, sous, couleur }) {
  return (
    <div style={{
      flex: "1 1 150px", minWidth: 140, background: "#fff",
      border: "1px solid var(--g200)", borderRadius: 12, padding: "14px 16px",
      borderTop: "3px solid " + (couleur || "var(--navy)"),
    }}>
      <div style={{ fontSize: 11, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--g900)" }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: "var(--g400)", marginTop: 2 }}>{sous}</div>}
    </div>
  );
}

export default function SuiviProduction() {
  var d = PROD_2026;

  var tauxAtteinte = useMemo(function () {
    return Math.min(100, Math.round((d.total.partAgence / d.pointMort) * 100));
  }, [d]);

  var resteACouvrir = Math.max(0, d.pointMort - d.total.partAgence);
  var maxCumul = d.pointMort;
  var maxMensuel = Math.max.apply(null, d.mois.map(function (x) { return x.partAgence; }).concat([1]));
  var maxNego = Math.max.apply(null, d.parNegociateur.map(function (x) { return x.ttc; }).concat([1]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--g900)", margin: 0 }}>
          {"\uD83D\uDCC8 Suivi de production " + d.annee}
        </h2>
        <p style={{ fontSize: 13, color: "var(--g500)", margin: "4px 0 0" }}>
          {"Commissions encaissées et couverture du point mort de l'agence (part agence HT)."}
        </p>
      </div>

      {/* Cartes KPI */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Carte label="Production TTC" valeur={fmt(d.total.ttc)} sous={"HT : " + fmt(d.total.ht)} couleur="var(--navy)" />
        <Carte label="Part agence HT" valeur={fmt(d.total.partAgence)} sous={"Part négos : " + fmt(d.total.partNego)} couleur="var(--red)" />
        <Carte label="Point mort annuel" valeur={fmt(d.pointMort)} sous={"Objectif mensuel : " + fmt(d.objectifMensuel)} couleur="#64748B" />
        <Carte label="Reste à couvrir" valeur={fmt(resteACouvrir)} sous={resteACouvrir === 0 ? "Point mort atteint !" : "avant équilibre"} couleur={resteACouvrir === 0 ? "#16A34A" : "#F59E0B"} />
      </div>

      {/* Jauge point mort */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)" }}>{"Couverture du point mort"}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: tauxAtteinte >= 100 ? "#16A34A" : "var(--red)" }}>{tauxAtteinte + " %"}</span>
        </div>
        <div style={{ height: 22, background: "var(--g100)", borderRadius: 11, overflow: "hidden", position: "relative" }}>
          <div style={{
            height: "100%", width: tauxAtteinte + "%",
            background: tauxAtteinte >= 100 ? "#16A34A" : "linear-gradient(90deg,#E8001D,#FF6B6B)",
            borderRadius: 11, transition: "width .4s",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--g400)", marginTop: 4 }}>
          <span>{fmt(d.total.partAgence)}</span>
          <span>{fmt(d.pointMort)}</span>
        </div>
      </div>

      {/* Evolution mensuelle (part agence HT) */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Part agence HT par mois"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
          {d.mois.map(function (mo, i) {
            var h = Math.round((mo.partAgence / maxMensuel) * 130);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: "var(--g500)", height: 12 }}>{mo.partAgence > 0 ? Math.round(mo.partAgence / 1000) + "k" : ""}</div>
                <div style={{
                  width: "100%", maxWidth: 34, height: Math.max(2, h),
                  background: mo.partAgence > 0 ? "var(--red)" : "var(--g200)",
                  borderRadius: "4px 4px 0 0",
                }} />
                <div style={{ fontSize: 10, color: "var(--g500)" }}>{mo.m}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Courbe cumul vs point mort */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Cumul agence vs point mort"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150, position: "relative" }}>
          {/* ligne point mort */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 8, borderTop: "2px dashed #64748B", zIndex: 1 }}>
            <span style={{ position: "absolute", right: 0, top: -16, fontSize: 10, color: "#64748B" }}>{"Point mort " + fmt(d.pointMort)}</span>
          </div>
          {d.mois.map(function (mo, i) {
            var h = Math.round((mo.cumul / maxCumul) * 120);
            var atteint = mo.cumul >= d.pointMort;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 2 }}>
                <div style={{
                  width: "100%", maxWidth: 34, height: Math.max(2, h),
                  background: atteint ? "#16A34A" : "var(--navy)",
                  borderRadius: "4px 4px 0 0", opacity: mo.cumul > 0 ? 1 : 0.3,
                }} />
                <div style={{ fontSize: 10, color: "var(--g500)" }}>{mo.m}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Production par negociateur */}
      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g800)", marginBottom: 14 }}>{"Production par négociateur (TTC)"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.parNegociateur.map(function (n, i) {
            var pct = Math.round((n.ttc / maxNego) * 100);
            var ini = n.nom.split(" ").map(function (x) { return x[0]; }).join("").slice(0, 2).toUpperCase();
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: avatarColor(n.nom), color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>{ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: "var(--g800)" }}>{n.nom}</span>
                    <span style={{ color: "var(--g600)" }}>{fmt(n.ttc) + " \u00B7 " + n.nb + " vente" + (n.nb > 1 ? "s" : "")}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--g100)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: avatarColor(n.nom), borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--g400)", textAlign: "center" }}>
        {"Source : Suivi production ORPI " + d.annee + " — TVA 20 % \u00B7 part négociateur selon règles de reversement."}
      </div>
    </div>
  );
}
