# ATHLOS — formule za Readiness in Load (v1)

Datum: 2026-07-16
Status: predlog za implementacijo (v1, kalibracija sledi na realnih podatkih)

Ta dokument definira dva glavna indikatorja ATHLOS in vso matematiko za
implementacijo. Namen: en sam algoritem, ki daje **primerljive** score-e ne
glede na to, iz katerega brand-a (Garmin, Polar, Whoop, Oura) prihajajo
surovi podatki.

---

## 0. Načelo integracije brandov

Garmin in Polar že računata svoj readiness/load, a vsak na svoji skali. Če
prevzamemo njihove score-e, uporabnik ki preklopi napravo dobi nekonsistentne
številke.

**Pravilo:** črpamo surove signale (HR, HRV, RHR, sleep, čas po HR-conah) in
računamo vse sami z eno formulo. Native score naprave uporabimo le kot
fallback, kadar surovih signalov ni.

Vir podatkov (MVP): health-data agregator (Terra API ali Vital) — ena
integracija za vse brande, plačilo per connected user. Kasneje po potrebi
direktni API-ji (Whoop v2, Oura v2, Polar AccessLink; Garmin Health API
zahteva B2B partnerstvo).

---

## 1. Load / Strain indikator (0–21)

Modeliran po Whoop strain: kardiovaskularna obremenitev, logaritmično stisnjena
na 0–21.

Load je **algoritem, ne linearna vsota** — dve nelinearni stopnji kot pri
Whoopu: (1) eksponentna teža po intenziteti med nabiranjem, (2) logaritemska
kompresija na 0–21 (poglavje 1.3). Tako visoka intenziteta prispeva
nesorazmerno več kot lahka aktivnost.

### 1.1 TRIMP na aktivnost (Banister, eksponentno)

Konceptualna oblika (če imamo povprečni HR aktivnosti):

```
HRr   = (HR_avg − HR_rest) / (HR_max − HR_rest)          // % srčne rezerve, 0–1
TRIMP = D · HRr · k1 · e^(k2 · HRr)
        moški:  k1 = 0.64,  k2 = 1.92
        ženske: k1 = 0.86,  k2 = 1.67
        D = trajanje aktivnosti v minutah
```

**Priporočena praktična oblika** (uporablja čas po HR-conah, ki ga dajo vsi
brandi — bolje zajame intervalne treninge kot povprečni HR): vsaki coni
pripišemo eksponentno Banister utež na minuto in seštejemo.

```
HRr_i  = ( sredina_cone_i[%HRmax] · HR_max − HR_rest ) / (HR_max − HR_rest)
w_i    = HRr_i · k1 · e^(k2 · HRr_i)              // utež na minuto za cono i
load_activity = Σ ( minute_v_coni_i · w_i )
```

Primer uteži za atleta HRrest=40, HRmax=191 (cone 1–5):

```
w = [ 0.63, 1.04, 1.63, 2.46, 3.62 ]      // cona 5 = 5.7× cona 1, eksponentno
```

Validacija (437 dni realnih Whoop podatkov): ta oblika + log kompresija (1.3)
korelira z Whoop Day Strain **r = 0.92**; linearna Edwards vsota (zona × 1..5)
le r = 0.85. Zato je Edwards le skrajni fallback, ne privzeto.

### 1.2 Dnevni load (cel dan, ne le treningi)

Load mora zajeti **cel dan**, ne le zabeleženih treningov — sicer počivalni
dnevi padejo na 0, čeprav telo nabere obremenitev od NEAT (vsakdanja aktivnost)
in stresa. Na realnih podatkih: 98 od 437 dni (22 %) je brez treninga, a Whoop
tam kaže povprečno 5.8 strain; samo-trening model bi jih štel 0 in popačil
ATL/CTL → napihnil Freshness na počivalne dni.

```
L_d = L_trening  +  L_ozadje

L_trening = Σ zonski Banister vseh aktivnosti dneva (1.1)
L_ozadje  = k_bg · max(0, kalorije_dan − kalorije_počitek)   // NEAT + vsakdan
```

- `kalorije_počitek` ≈ bazalna dnevna poraba (BMR); `k_bg` kalibriran tako, da
  tipičen počivalni dan da realno ozadje (~5 strain, kot Whoop).
- Kalorije so **brand-prenosljive** (Garmin, Polar, Oura, Whoop jih vsi dajo) →
  cross-brand konsistentno.

**Fallback po brandu:** kjer naprava ponuja native celodnevni strain/load
(Whoop Day Strain — pokritost 419/437; Garmin, Polar), ga lahko uporabiš
direktno namesto rekonstrukcije.

Validacija (437 dni): sam `L_trening` + log kompresija korelira z Whoop Day
Strain r = 0.92; celodnevne kalorije r = 0.87. `L_d` je vhod za akutni/kronični
load v Readiness (poglavje 2).

### 1.3 Prikaz na 0–21

```
Strain = 21 · ln(1 + L_d / L_ref) / ln(1 + L_max / L_ref)
```

- `L_ref` — referenčni dnevni load (start: 60, kalibriraj)
- `L_max` — 99. percentil dnevnega loada v populaciji (start: 400)

Konstante kalibriramo tako, da porazdelitev strain-a ustreza pričakovani
(mediana ~10–12 za aktivnega uporabnika).

---

## 2. Readiness indikator (0–100)

### 2.1 Glavna enačba (V2 — sidrna)

Recovery je **hrbtenica** (sidro), ostali dejavniki nihajo ± okoli njega.
Prejšnja utežena oblika (`0.65·R + 0.35·F`) je Freshness centriral pri 50 in
sistematično razredčil Readiness pod Recovery — Readiness je umetno visel"
pri ~50. Sidrna oblika to odpravi:

```
Readiness = clip( R_eff
                  + β_F·(F − 50)
                  + β_W·(W_eff − 50)
                  − overloadPen
                  − wellnessPen , 0, 100 )

β_F = 0.35        overloadPen = max(0, ACWR − 1.3) · 40
β_W = 0.15        wellnessPen = (1 − WellnessGuard) · 50
```

- `R_eff` (2.2b) — asimetrični recovery, sidro (vpliv 1:1).
- `F` (2.3) — Freshness; `(F−50)` centrirano pri nič → uravnovešen trening
  nič ne odbije, svežina doda, utrujenost odvzame.
- `W_eff` (2.4) — wellness trend; majhen prispevek (β_W nizek), ker vzorec
  slabih dni nosi `wellnessPen`.
- `overloadPen` — kazen le ob pravi nadobremenitvi (ACWR > 1.3), sicer 0.
- `wellnessPen` — kazen le ob kopičenju slabih wellness dni (2.7), sicer 0.

Prehrana (v2): dodaj člen `β_N·(N − 50)`, β_N ≈ 0.15.

**Vpliv na dnevni Readiness (validirano na realnih podatkih):**

| Dejavnik            | Občutljivost               | Tipičen prispevek |
|---------------------|----------------------------|-------------------|
| Recovery (R_eff)    | +10 vhod → **+10** Readiness | sidro, 48–86      |
| Freshness           | +10 vhod → **+3.5** Readiness | ±3 (ekstrem ±16)  |
| Nadobremenitev      | ACWR 1.3→1.5 → **−8**       | ~5–6 dni/mesec    |

Rezultat: sidrna oblika dvigne povprečni Readiness, da sledi Recovery-ju
(pri testnem atletu 51 → 68), ohrani pa spodnjo stran ob nadobremenitvi.
Fiziološka streha ostane: Readiness ne more trajno krepko presegati Recovery-ja
(če je Recovery nizek, je Readiness pošteno nizek).

### 2.2 Pod-score R — Recovery (0–100)

Če naprava daje native recovery/readiness (Whoop recovery %, Oura readiness,
Garmin Training Readiness) — uporabi ga direktno. Sicer izračunaj:

```
R = 0.50·HRV_score + 0.25·RHR_score + 0.25·Sleep_score

HRV_score   = clip(50 + 15·(HRV_danes − HRV_base) / SD_base, 0, 100)
RHR_score   = clip(50 − 15·(RHR_danes − RHR_base) / SD_base, 0, 100)   // nižji = bolje
Sleep_score = 100 · min(spanec_dejanski / spanec_potreben, 1)
```

- `*_base`, `SD_base` = 28–60 dnevno drseče povprečje in std. odklon
  **posameznika**. Absolutne vrednosti med ljudmi niso primerljive — vedno
  z-score glede na osebni baseline.

Vrednost `R` zgoraj je surovi dnevni recovery (native ali izračunan). Preden
vstopi v glavno enačbo, gre skozi **asimetrično acute+baseline transformacijo**
(2.2b).

### 2.2b Asimetrična teža današnjega Recovery-ja → R_eff

Namen: dober dan po slabem tednu naj šteje veliko (nagrada za odboj), slab dan
po dobrem tednu naj skoraj nič ne zniža (odpuščanje enkratnega padca).

```
R_baza = povprečje recovery zadnjih 7 dni (brez današnjega)
Δ      = R_danes − R_baza
R_eff  = clip( R_baza + g · Δ, 0, 100 )
         g = a_up = 0.60   če  Δ ≥ 0   (odklon navzgor šteje več)
         g = a_dn = 0.25   če  Δ < 0   (odklon navzdol šteje manj)
```

`R_eff` je vrednost, ki nadomesti `R` v glavni enačbi (2.1).

Obnašanje (primeri):

| R_danes | R_baza | R_eff | opomba                       |
|---------|--------|-------|------------------------------|
| 96      | 40     | 74    | slab teden, odličen odboj ↑  |
| 45      | 40     | 43    | slab teden, slab dan         |
| 50      | 80     | 72    | dober teden, slab dan ↓ malo |
| 85      | 80     | 83    | dober teden, dober dan       |

Nastavljanje: `a_up` višji → odboj šteje še več; `a_dn` nižji → slab dan še
manj pomemben.

### 2.3 Pod-score F — Freshness / Velocity (0–100)

To je "velocity → hitrost → spočitost". Temelji na Training Stress Balance.

Uporabi **EWMA (eksponentno uteženo)**, ne navadnega povprečja — nedavni dnevi
morajo šteti več (utrujenost upada eksponentno). Navadno povprečje da dnevu
izpred tedna enako težo kot včeraj, kar zabriše učinek lahkega/prostega dne.

```
α_ATL = 1 − e^(−1/τ_ATL)     τ_ATL = 7      // fatigue, kratek spomin
α_CTL = 1 − e^(−1/τ_CTL)     τ_CTL = 28     // fitness, dolg spomin
ATL_d = ATL_{d−1} + α_ATL · (L_d − ATL_{d−1})
CTL_d = CTL_{d−1} + α_CTL · (L_d − CTL_{d−1})
TSB   = CTL − ATL                           // + = svež
F     = 100 / (1 + e^(−4 · TSB / CTL))      // ~50 pri TSB=0, raste ko je svež
```

Teža po dnevih nazaj (EWMA τ=7): danes ~25 %, včeraj ~20 %, pred tednom ~5 %
(navadno povprečje: vsi 14 %). Tako lahek/prost dan opazno dvigne Freshness.

**Lag-1 za jutranji Readiness:** Freshness gleda load **do vključno včeraj**
(ATL/CTL zamaknjena za 1 dan), ker dan še ni odtreniran. Tako včerajšnji lahek
dan direktno dvigne današnji Readiness.

**Ločitev strain / readiness:**
- **Današnji strain** → svoj Load indikator (0–21), ni v današnjem Readinessu.
- **Freshness v Readinessu** → EWMA loada do včeraj (lag-1).
- **Današnji wellness** → JE v današnjem Readinessu (odgovoriš zjutraj, velja
  za danes).

Torej današnji strain zniža *jutrišnji* Readiness prek obremenitvenega
ravnovesja, ne kot isti-dan odbitek (isti-dan strain skoraj nič ne napove
recovery-ja, r≈0.05).

### 2.4 Pod-score W — Wellness (0–100)

Subjektivni vprašalnik (Hooper index), 5 vprašanj, lestvica 1–5, kjer je
5 = najbolje (naspanost, energija, mišice brez bolečin, umirjenost/nizek
stres, razpoloženje):

```
W_dan = 100 · (Σ odgovori − 5) / 20            // dnevni score, 0–100
```

Dnevni score sam po sebi ne gre neposredno v Readiness. Namesto tega gre
mešanica današnjega in 7-dnevnega trenda (trend nese večino teže), da en
slab dan ne prevlada:

```
W_7d  = povprečje (ali EWMA) W_dan zadnjih 7 dni
W_eff = α · W_dan + (1 − α) · W_7d             // α = 0.25
```

`W_eff` je vrednost, ki vstopi v glavno enačbo (2.1).

### 2.5 Pod-score N — Prehrana (0–100)

Placeholder za v2 (kalorije/makro vs. cilj, hidracija, timing). Do takrat
w_N = 0.

### 2.6 Nadobremenitvena kazen (overloadPen)

Varovalo, da visok Recovery ne skrije nevarnega skoka obremenitve. V sidrni
obliki (V2) je aditivna kazen, ne množitelj:

```
ACWR        = ATL / CTL
overloadPen = max(0, ACWR − 1.3) · 40        // 0 v optimalnem oknu
```

- Optimalno ACWR ≈ 0.8–1.3 → kazen 0.
- ACWR 1.4 → −4; 1.5 → −8; 1.7 → −16 (Readiness pada z resnostjo skoka).
- (Prejšnja V1 je uporabljala množitelj `InjuryGuard = clip(e^(−(ACWR−1)²/
  (2·0.35²)), 0.7, 1)`; V2 aditivna oblika ne razredči normalnih dni.)

### 2.7 WellnessGuard (0.75–1.0)

Multiplikativna kapa, ki se sproži **le ob kopičenju slabih wellness dni**.
En slab dan skoraj nič ne odbije; vzorec slabih dni znatno zniža Readiness.

```
deficit_d     = max(0, T − W_dan_d)              // "koliko pod pragom" za dan d
S             = povprečje deficit_d zadnjih 7 dni
WellnessGuard = clip( 1 − p · (S / S_ref), 1 − p, 1 )
```

Privzeti parametri: `T = 50` (prag "slab dan"), `p = 0.25` (max kazen → dno
0.75), `S_ref = 40` (kako hitro guard ugrizne).

Skupni vpliv wellness-a na Readiness v V2 = `0.15·(W_eff−50) − wellnessPen`,
kjer `wellnessPen = (1−WellnessGuard)·50`:

| Scenarij (7 dni)      | W_eff | WellnessGuard | wellnessPen | skupni vpliv |
|-----------------------|-------|---------------|-------------|--------------|
| dober teden           | 70    | 1.00          | 0.0         | +3.0         |
| en slab dan           | 52    | 0.97          | 1.5         | −1.2         |
| trije slabi dnevi     | 41    | 0.92          | 4.0         | −5.4         |
| cel slab teden        | 20    | 0.81          | 9.5         | −14.0        |

En slab dan komaj kaj (−1.2), cel slab teden močno (−14) — natanko namen.

Nastavljanje občutljivosti:
- `α` nižji → en dan šteje še manj
- `S_ref` nižji → guard se sproži že pri 2 slabih dneh namesto pri celem tednu
- `p` višji → večja maksimalna kazen

---

## 3. Kalibracija (od "smiselno" do "optimalno")

Zgornje uteži so pametni priors, ne resnica. Optimizacija:

1. Zberi 4–8 tednov podatkov + izhodno metriko, ki nas zanima (npr. dejanska
   velocity/moč na treningu naslednji dan, ali subjektivna ocena zmogljivosti).
2. Regresija: `Readiness_komponente → outcome`. Uteži, ki najbolje napovedujejo
   outcome, so optimalne (linearna regresija ali logistična, če je outcome
   binaren).
3. Personalizacija baseline-ov je obvezna — glej 2.2.

---

## 4. Reference psevdokoda

```
function dailyLoad(activities, hr, day):    // cel dan = trening + ozadje
    zmid = [0.55,0.65,0.75,0.85,0.95]       // sredine con kot % HRmax
    w = []
    for m in zmid:
        HRr = max(0, (m*hr.max - hr.rest) / (hr.max - hr.rest))
        w.push( HRr * k1 * exp(k2 * HRr) )  // spol → k1,k2
    L_train = 0
    for a in activities:
        for i in 0..4:
            L_train += a.minutes_in_zone[i] * w[i]
    L_bg = k_bg * max(0, day.calories - day.calories_rest)   // NEAT/vsakdan
    return L_train + L_bg

function strain(L_d, L_ref, L_max):        // log kompresija na 0-21
    return 21 * ln(1 + L_d/L_ref) / ln(1 + L_max/L_ref)

function recoveryEff(rec_days):            // asimetrična teža današnjega
    R_today = rec_days.last(1)
    R_base  = mean(rec_days.last(7).exclude_today())
    d = R_today - R_base
    g = (d >= 0) ? 0.60 : 0.25
    return clamp(R_base + g*d, 0, 100)

function readiness(rec_days, loads, wellness_days):    // V2 sidrna
    R_eff = recoveryEff(rec_days)
    // --- load balance: EWMA do VČERAJ (lag-1) ---
    ATL = ewma(loads.through_yesterday(), tau=7)    // rekurzija, glej 2.3
    CTL = max(ewma(loads.through_yesterday(), tau=28), 1)
    TSB = CTL - ATL
    F   = 100 / (1 + exp(-4 * TSB / CTL))
    ACWR        = ATL / CTL
    overloadPen = max(0, ACWR - 1.3) * 40

    // --- wellness: acute+trend blend + cluster penalty ---
    W_today = wellness_days.last(1)
    W_7d    = mean(wellness_days.last(7))
    W_eff   = 0.25 * W_today + 0.75 * W_7d
    S            = mean( max(0, 50 - w) for w in wellness_days.last(7) )
    wellGuard    = clamp(1 - 0.25 * (S / 40), 0.75, 1.0)
    wellnessPen  = (1 - wellGuard) * 50

    // --- V2 sidrna: Recovery je sidro, ostalo niha ± ---
    return clamp( R_eff
                  + 0.35 * (F - 50)
                  + 0.15 * (W_eff - 50)
                  - overloadPen
                  - wellnessPen , 0, 100 )
```

---

## 5. Odprta vprašanja

- Konstante `L_ref`, `L_max`, `k` v HRV/RHR score-ih — kalibrirati na realnih
  Whoop/Garmin exportih.
- Kako obravnavati dneveljavne/manjkajoče dneve (bolezen, brez naprave) v
  ATL/CTL oknu — verjetno prenesi zadnjo veljavno vrednost + zmanjšaj zaupanje.
- Naprava-specifičen HR_max: privzeti 220−starost vs. izmerjeni iz podatkov.
- v2: prehrana (N) in EWMA namesto navadnega povprečja.
