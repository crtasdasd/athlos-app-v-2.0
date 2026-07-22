import React from "react";
import { useTheme } from "../theme";

// Legal documents use a plain system sans-serif, not the brand's stylized
// Cormorant/Cinzel faces — a privacy policy should read as an official
// document, not a marketing surface.
const SYS_FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function ScreenPrivacy({ onClose }) {
  const C = useTheme();
  const H = ({ children }) => <h3 style={{ fontFamily: SYS_FONT, fontWeight: 700, fontSize: 15, color: C.text, margin: "14px 0 6px" }}>{children}</h3>;
  const P = ({ children }) => <p style={{ fontFamily: SYS_FONT, color: C.text2, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 8px" }}>{children}</p>;
  const LI = ({ children }) => <li style={{ fontFamily: SYS_FONT, color: C.text2, fontSize: 13.5, lineHeight: 1.55, marginBottom: 5 }}>{children}</li>;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(12,14,20,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{
        width: "100%", maxWidth: 430, maxHeight: "88vh", display: "flex", flexDirection: "column",
        background: C.bg, borderRadius: "24px 24px 0 0",
        boxShadow: C.name === "dark" ? "0 -18px 50px rgba(0,0,0,0.55)" : "0 -18px 50px rgba(16,24,40,0.18)",
        animation: "athlosRise 0.28s cubic-bezier(0.22,1,0.36,1)", overflow: "hidden",
      }}>
        {/* header — plain, official, with an explicit close control */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px 10px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: SYS_FONT, fontWeight: 600, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Pravno</div>
            <h2 style={{ fontFamily: SYS_FONT, fontWeight: 700, fontSize: 21.5, margin: "3px 0 0", color: C.text }}>Politika zasebnosti</h2>
          </div>
          <button onClick={onClose} aria-label="Zapri" style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontSize: 17, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
            ×
          </button>
        </div>

        {/* scrollable body */}
        <div className="athlos-scroll" style={{ overflowY: "auto", padding: "11px 14px 18px" }}>
          <div style={{ fontFamily: SYS_FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.04em", color: C.muted, marginBottom: 10 }}>ZADNJA POSODOBITEV: 6. JUNIJ 2026</div>
          <P>Ta politika zasebnosti opisuje, kako ATHLOS d.o.o. (Jarska cesta 70, Slovenija) zbira, uporablja in deli tvoje podatke pri uporabi aplikacije ATHLOS, ter tvoje pravice glede zasebnosti.</P>
          <H>Katere podatke zbiramo</H>
          <P>Osebni podatki, ki nam jih posreduješ:</P>
          <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
            <LI>E-poštni naslov</LI>
            <LI>Ime in priimek</LI>
            <LI>Telefonska številka</LI>
            <LI>Naslov, mesto, poštna številka</LI>
          </ul>
          <P>Podatki o uporabi (samodejno): IP naslov, tip in različica brskalnika, obiskane strani, trajanje seje in interakcije.</P>
          <P>Z dovoljenjem dostopamo tudi do: lokacije, kamere in galerije fotografij (za profilno sliko in video analizo vaj).</P>
          <H>Kako uporabljamo podatke</H>
          <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
            <LI>Za zagotavljanje in vzdrževanje storitve</LI>
            <LI>Za upravljanje tvojega računa</LI>
            <LI>Za izvajanje pogodbe (naročnina, plačila)</LI>
            <LI>Za stik s teboj (e-pošta, push obvestila o treningih)</LI>
            <LI>Za analizo uporabe in izboljšave storitve</LI>
          </ul>
          <H>Hramba podatkov</H>
          <P>Osebne podatke hranimo le toliko časa, kolikor je potrebno. Podatke o računu hranimo za čas trajanja tvoje naročnine in 30 dni po odjavi.</P>
          <H>Tvoje pravice</H>
          <P>Imaš pravico do dostopa, popravka in izbrisa svojih osebnih podatkov. Podatke lahko urejaš v nastavitvah aplikacije ali nas kontaktiraš neposredno.</P>
          <H>Zasebnost otrok</H>
          <P>Storitev ni namenjena osebam, mlajšim od 16 let. Zavestno ne zbiramo podatkov oseb, mlajših od 16 let.</P>
          <H>Tretje osebe</H>
          <P>Uporabljamo zunanje ponudnike storitev (npr. Mouseflow za analitiko, Google Places), ki imajo lahko dostop do tvojih podatkov v skladu s svojimi politikami zasebnosti.</P>
          <H>Varnost</H>
          <P>Varnost tvojih podatkov nam je pomembna, vendar noben način prenosa po internetu ni 100% varen. Uporabljamo komercialno razumne ukrepe za zaščito tvojih podatkov.</P>
          <H>Kontakt</H>
          <P>Za vprašanja o tej politiki zasebnosti nas kontaktiraj:</P>
          <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
            <LI>E-pošta: info@athl-os.com</LI>
            <LI>Telefon: 069 749 787</LI>
            <LI>Spletna stran: athlos-sync-flow.lovable.app</LI>
          </ul>
          <p style={{ textAlign: "center", fontFamily: SYS_FONT, color: C.muted2, fontSize: 11, marginTop: 14 }}>ATHLOS d.o.o. © 2026</p>
        </div>
      </div>
    </div>
  );
}
