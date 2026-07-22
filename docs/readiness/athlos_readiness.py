"""
ATHLOS — Readiness in Load kalkulator (V2)
==========================================

KAKO UPORABITI (za člane ekipe):
  1. Izvozi svoje Whoop podatke (Whoop app -> Settings -> Data Export).
     Razširi ZIP -> dobiš physiological_cycles.csv in workouts.csv.
  2. To datoteko + svoja dva CSV-ja naloži na Claude in reci:
     "Poženi athlos_readiness.py na mojih podatkih."
  3. Spodaj v NASTAVITVE vpiši svoj profil (starost, teža, višina, spol)
     in pot do mape z Whoop CSV-ji.

  Koda uporablja samo standardni Python (brez namestitev).

  Kaj dobiš:
    - LOAD / STRAIN (0-21)  -> dnevna obremenitev, kot Whoop strain
    - READINESS (0-100)     -> pripravljenost za trening danes

Trener: vsi parametri, ki jih smeš spreminjati, so v razdelku NASTAVITVE
in NASTAVLJIVI PARAMETRI. Razlaga v RAZLAGA-ZA-TRENERJE.md.
"""

import csv, math, sys, statistics as st
from datetime import datetime

# ======================================================================
# NASTAVITVE  —  vpiši svoje (vsak član ekipe svoje)
# ======================================================================
EXPORT_FOLDER = "."          # mapa s physiological_cycles.csv in workouts.csv
PROFILE = {
    "starost": 22,           # leta
    "teza_kg": 92,           # kg
    "visina_cm": 196,        # cm
    "spol": "M",             # "M" ali "F"
}

# ======================================================================
# NASTAVLJIVI PARAMETRI  —  trener lahko spreminja (privzeto = priporočeno)
# ======================================================================
# PRESETI (spremeni le ta dva gumba, če želiš drugačen značaj):
#   V2 (privzeto):        beta_freshness = 0.35,  acwr_prag = 1.30
#   V3 (bolj velikodušno): beta_freshness = 0.25,  acwr_prag = 1.40
#     -> V3: svežina manj niha Readiness, kazen za nadobremenitev se sproži
#        kasneje. Rezultat je malce višji/mehkejši Readiness.
P = {
    # --- Load / Strain ---
    "background_faktor": 0.06,   # koliko vsakdanja aktivnost (kalorije) šteje k loadu
    # --- Freshness (obremenitveno ravnovesje) ---
    "tau_acute": 7,              # spomin akutne utrujenosti (dni); manjši = bolj odziven
    "tau_chronic": 28,           # spomin kronične kondicije (dni)
    # --- Recovery asimetrija ---
    "recovery_baseline_dni": 7,  # čez koliko dni se meri "normalni" recovery
    "gain_navzgor": 0.60,        # koliko šteje dober dan po slabem tednu (odboj)
    "gain_navzdol": 0.25,        # koliko šteje slab dan po dobrem tednu (odpuščanje)
    # --- Uteži v Readiness enačbi (sidrna V2) ---
    "beta_freshness": 0.35,      # koliko svežina niha Readiness
    "beta_wellness": 0.15,       # koliko dnevni wellness niha Readiness
    # --- Kazni ---
    "acwr_prag": 1.30,           # nad tem ACWR se sproži nadobremenitvena kazen
    "acwr_kazen_faktor": 40,     # jakost nadobremenitvene kazni
    "wellness_prag": 50,         # pod tem wellness dan velja za "slab"
    "wellness_kazen_max": 0.25,  # največja kazen zaradi vzorca slabih wellness dni
    "wellness_kazen_ref": 40,    # kako hitro se sproži wellness kazen
}

# Dnevni wellness (subjektivno počutje 0-100) — če ga NE meriš, pusti prazno {}
# in Readiness bo računan pri nevtralnem (50). Ključ = "YYYY-MM-DD".
# Primer: WELLNESS = {"2026-07-16": 70, "2026-07-15": 40}
WELLNESS = {}

# ======================================================================
# KODA  (od tu naprej ni treba spreminjati)
# ======================================================================

def _f(x):
    try: return float(x)
    except: return None

def _dt(x):
    try: return datetime.strptime(x[:19], "%Y-%m-%d %H:%M:%S")
    except: return None


def nalozi_podatke(folder, profile):
    """Prebere Whoop CSV-je in izračuna dnevni load (cel dan)."""
    # Mifflin-St Jeor bazalna poraba (počivalne kalorije)
    s = 5 if profile["spol"].upper() == "M" else -161
    BMR = 10*profile["teza_kg"] + 6.25*profile["visina_cm"] - 5*profile["starost"] + s
    k1, k2 = (0.64, 1.92) if profile["spol"].upper() == "M" else (0.86, 1.67)

    cyc = []
    with open(f"{folder}/physiological_cycles.csv", newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            dt = _dt(r["Cycle start time"])
            if not dt: continue
            cyc.append({
                "key": r["Cycle start time"], "date": dt.date(),
                "rec": _f(r["Recovery score %"]),
                "rhr": _f(r["Resting heart rate (bpm)"]),
                "cal": _f(r["Energy burned (cal)"]),
                "whoop_strain": _f(r["Day Strain"]),
            })
    cyc.sort(key=lambda c: c["date"])

    # atletove konstante
    rhrs = [c["rhr"] for c in cyc if c["rhr"]]
    HRrest = st.median(rhrs) if rhrs else 60
    maxhrs = []
    wk = []
    with open(f"{folder}/workouts.csv", newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            mh = _f(r["Max HR (bpm)"])
            if mh: maxhrs.append(mh)
            wk.append((r["Cycle start time"], _f(r["Duration (min)"]) or 0,
                       [_f(r[f"HR Zone {i} %"]) or 0 for i in range(1, 6)]))
    HRmax = sorted(maxhrs)[int(0.99*len(maxhrs))-1] if maxhrs else 190

    # eksponentne (Banister) uteži po HR-conah
    zmid = [0.55, 0.65, 0.75, 0.85, 0.95]
    zw = []
    for m in zmid:
        hrr = max(0, (m*HRmax - HRrest) / (HRmax - HRrest))
        zw.append(hrr * k1 * math.exp(k2 * hrr))

    trening = {}
    for key, dur, zones in wk:
        trening[key] = trening.get(key, 0) + sum(dur*(zones[i]/100)*zw[i] for i in range(5))

    for c in cyc:
        L_trening = trening.get(c["key"], 0.0)
        L_ozadje = P["background_faktor"] * max(0, (c["cal"] - BMR) if c["cal"] else 0)
        c["load"] = L_trening + L_ozadje
    return cyc, HRrest, HRmax


def strain_0_21(cyc):
    """Log kompresija dnevnega loada na 0-21 (kot Whoop strain)."""
    pos = [c["load"] for c in cyc if c["load"] > 0]
    Lref = st.median(pos) * 0.5
    Lmax = sorted(pos)[int(0.99*len(pos))-1]
    for c in cyc:
        c["strain"] = 0.0 if c["load"] <= 0 else min(21, 21*math.log(1+c["load"]/Lref)/math.log(1+Lmax/Lref))


def izracunaj(cyc):
    """Glavni izračun: Freshness (EWMA lag-1), R_eff, Readiness (V2 sidrna)."""
    aA = 1 - math.exp(-1/P["tau_acute"])
    aC = 1 - math.exp(-1/P["tau_chronic"])
    eA = eC = None
    for i, c in enumerate(cyc):
        # ATL/CTL do VČERAJ (lag-1): stanje pred vključitvijo današnjega dne
        c["ATL"] = eA if eA is not None else c["load"]
        c["CTL"] = max(eC if eC is not None else c["load"], 1e-6)
        # posodobi EWMA z današnjim dnem (za jutri)
        eA = c["load"] if eA is None else eA + aA*(c["load"] - eA)
        eC = c["load"] if eC is None else eC + aC*(c["load"] - eC)

        TSB = c["CTL"] - c["ATL"]
        c["ACWR"] = c["ATL"] / c["CTL"]
        c["F"] = 100 / (1 + math.exp(-4 * TSB / c["CTL"]))

        # asimetrični Recovery (sidro)
        prior = [cc["rec"] for cc in cyc[max(0, i-P["recovery_baseline_dni"]):i] if cc["rec"] is not None]
        if c["rec"] is not None and prior:
            base = sum(prior)/len(prior)
            d = c["rec"] - base
            g = P["gain_navzgor"] if d >= 0 else P["gain_navzdol"]
            c["Reff"] = max(0, min(100, base + g*d))
        else:
            c["Reff"] = c["rec"]

        # wellness (današnji + 7-dnevni trend) + kazen za vzorec slabih dni
        w_days = _wellness_zadnjih(cyc, i)
        if w_days:
            w_today = w_days[-1]
            w_7d = sum(w_days)/len(w_days)
            W_eff = 0.25*w_today + 0.75*w_7d
            S = sum(max(0, P["wellness_prag"]-w) for w in w_days)/len(w_days)
            wellGuard = max(1-P["wellness_kazen_max"], min(1, 1 - P["wellness_kazen_max"]*(S/P["wellness_kazen_ref"])))
        else:
            W_eff = 50.0        # nevtralno, če wellness ni izmerjen
            wellGuard = 1.0
        wellnessPen = (1 - wellGuard) * 50

        overloadPen = max(0, c["ACWR"] - P["acwr_prag"]) * P["acwr_kazen_faktor"]

        if c["Reff"] is None:
            c["readiness"] = None
        else:
            c["readiness"] = max(0, min(100,
                c["Reff"]
                + P["beta_freshness"] * (c["F"] - 50)
                + P["beta_wellness"] * (W_eff - 50)
                - overloadPen
                - wellnessPen))
        c["W_eff"] = W_eff
        c["overloadPen"] = overloadPen
        c["wellnessPen"] = wellnessPen
    return cyc


def _wellness_zadnjih(cyc, i):
    """Zadnjih 7 dni wellness vrednosti (le če jih je uporabnik vnesel)."""
    out = []
    for cc in cyc[max(0, i-6):i+1]:
        v = WELLNESS.get(str(cc["date"]))
        if v is not None:
            out.append(v)
    return out


def porocilo(cyc, dni=30):
    zadnji = [c for c in cyc if (cyc[-1]["date"] - c["date"]).days <= dni]
    def povp(k):
        xs = [c[k] for c in zadnji if c.get(k) is not None]
        return sum(xs)/len(xs) if xs else 0
    print("="*60)
    print(f"ATHLOS — zadnjih {len(zadnji)} dni")
    print("="*60)
    print(f"Readiness povprečje : {povp('readiness'):.0f} / 100")
    print(f"Load povprečje      : {povp('strain'):.1f} / 21")
    print(f"Recovery povprečje  : {povp('rec'):.0f} %")
    print()
    print(f"{'datum':12s}{'Readiness':>10}{'Load':>7}{'Recovery':>10}{'Freshness':>11}{'ACWR':>7}")
    print("-"*57)
    for c in zadnji:
        rd = f"{c['readiness']:.0f}" if c["readiness"] is not None else "-"
        print(f"{str(c['date']):12s}{rd:>10}{c['strain']:>7.1f}{(c['rec'] or 0):>10.0f}{c['F']:>11.0f}{c['ACWR']:>7.2f}")


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else EXPORT_FOLDER
    cyc, HRrest, HRmax = nalozi_podatke(folder, PROFILE)
    strain_0_21(cyc)
    izracunaj(cyc)
    print(f"Profil: {PROFILE}  |  HRrest={HRrest:.0f}  HRmax={HRmax:.0f}\n")
    porocilo(cyc, dni=30)


if __name__ == "__main__":
    main()
