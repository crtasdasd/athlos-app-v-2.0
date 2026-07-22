# ATHLOS Readiness — razlaga za trenerje

Ta dokument razloži, **kako nastaneta dve številki**, in ti pokaže, **katere
gumbe lahko spreminjaš**, če se s čim ne strinjaš. Na koncu je prostor, kjer
sam določiš, kako se **load in volumen tréninga** prilagodita glede na Readiness.

Ni ti treba znati programirati. Vsi gumbi so v datoteki `athlos_readiness.py`
v razdelku `NASTAVLJIVI PARAMETRI` (slovar `P`). Spremeniš številko, shraniš,
ponovno poženeš na Claude.

---

## 1. Dve številki

**LOAD / STRAIN (0–21)** — koliko je telo garalo ta dan. Kot Whoopov strain.
Visok = težka obremenitev, nizko = lahek/prost dan.

**READINESS (0–100)** — koliko je športnik pripravljen trenirati danes.
- 🟢 **67–100** = pripravljen, lahko trdo
- 🟡 **34–66** = zmerno, previdno
- 🔴 **0–33** = utrujen, počitek ali lahka regeneracija

---

## 2. Kako nastane READINESS (preprosto)

Readiness stoji na **štirih stebrih**. Recovery je glavni, ostali ga rahlo
premikajo gor ali dol:

```
READINESS  =  Recovery (glavni)
            + Svežina    (če je spočit → gor, če utrujen → dol)
            + Počutje    (današnji wellness → malo gor/dol)
            − Kazen       (če je preveč treniral zadnji teden)
```

**1. Recovery (glavni steber).** Whoopov recovery %. Da športnik jutranji
signal, kako je telo okrevalo. To je 1:1 osnova Readinessa.
- Poseben trik: če je imel **slab teden in se danes zelo dobro spočije**, to
  šteje veliko (nagrada za odboj). Če je imel **dober teden in en slab dan**,
  ta slab dan skoraj nič ne pokvari (odpuščanje). Tako en dan ne meče cele
  slike.

**2. Svežina.** Primerja obremenitev zadnjega tedna s krajšim in daljšim
povprečjem. Če je zadnje dni treniral manj kot običajno → svež → Readiness gor.
Če je natrpal težke dni → utrujen → Readiness dol. Nedavni dnevi štejejo več
kot dnevi izpred tedna.

**3. Počutje (wellness).** Zjutraj športnik odgovori 5 kratkih vprašanj
(naspanost, energija, mišice, stres, razpoloženje). To **šteje za današnji
dan**. En slab dan komaj kaj premakne; **več slabih dni zapored** pa Readiness
močno zniža.

**4. Kazen za nadobremenitev.** Če je zadnji teden treniral veliko več kot
običajno (razmerje ACWR nad 1.3), Readiness dobi kazen — varovalo pred
poškodbo. Sicer je kazen 0.

> Pomembno: **današnji trening (Load) NI v današnjem Readinessu.** Dan še ni
> odtreniran. Današnji Load se pozna šele **jutri** prek svežine.

---

## 3. Kako nastane LOAD (preprosto)

1. Za vsak trening se čas po srčnih conah utežuje — višja cona šteje
   **eksponentno** več (kot Whoop, ne linearno).
2. Doda se **celodnevno ozadje** (vsakdanja aktivnost iz porabe kalorij), da
   tudi počivalni dan ni nič.
3. Vse skupaj se stisne na lestvico **0–21**.

Preverjeno: ta izračun se z Whoopovim strainom ujema ~96 %.

---

## 4. Gumbi, ki jih lahko spreminjaš

V datoteki `athlos_readiness.py`, slovar `P`. Spremeni številko → shrani →
ponovno poženi.

| Gumb (v kodi)         | Kaj naredi                                            | Če se ti zdi... |
|-----------------------|-------------------------------------------------------|-----------------|
| `tau_acute` (7)       | spomin utrujenosti v dnevih                           | naj bo bolj odziven na zadnji dan → **znižaj** (npr. 5) |
| `tau_chronic` (28)    | spomin kondicije v dnevih                             | daljša baza → zvišaj |
| `gain_navzgor` (0.60) | koliko šteje dober dan po slabem tednu                | naj odboj šteje več → zvišaj |
| `gain_navzdol` (0.25) | koliko šteje slab dan po dobrem tednu                 | naj slab dan bolj boli → zvišaj |
| `beta_freshness`(0.35)| koliko svežina niha Readiness                         | naj obremenitev bolj vpliva → zvišaj |
| `beta_wellness` (0.15)| koliko dnevno počutje niha Readiness                  | naj počutje bolj šteje → zvišaj |
| `acwr_prag` (1.30)    | kdaj se sproži kazen za nadobremenitev                | strožje varovalo → znižaj (npr. 1.2) |
| `acwr_kazen_faktor`(40)| kako močna je ta kazen                               | ostrejša kazen → zvišaj |
| `background_faktor`(0.06)| koliko vsakdanja aktivnost šteje k Loadu           | počivalni dnevi naj štejejo več → zvišaj |

> Vsak parameter je neodvisen. Spremeni enega, poglej učinek, nadaljuj.

---

## 5. TVOJ DEL: Readiness → koliko treninga danes

Tu ti pustimo prosto. Ideja: **planiran trening pomnožiš s faktorjem**, ki je
odvisen od jutranjega Readinessa. Spodnja tabela je **osnutek — spremeni jo po
svoje.**

### Predlog (uredi po svoje)

| Readiness | Barva | Load (intenziteta) | Volumen (količina) | Opomba |
|-----------|-------|--------------------|--------------------|--------|
| 80–100    | 🟢🟢  | 100–110 %          | 100–110 %          | zeleno luč, lahko ključni trening |
| 67–79     | 🟢    | 100 %              | 100 %              | po planu |
| 55–66     | 🟡    | 90 %               | 100 %              | znižaj intenziteto, volumen ostane |
| 40–54     | 🟡    | 75 %               | 85 %               | lažji dan, tehnika |
| 25–39     | 🔴    | 50 %               | 60 %               | regeneracija |
| 0–24      | 🔴🔴  | počitek            | počitek            | brez treninga |

### Formula, ki jo lahko zgradiš

```
predpisan_load    = planiran_load    × faktor_intenzitete(Readiness)
predpisan_volumen = planiran_volumen × faktor_volumna(Readiness)
```

Kjer `faktor_*` prebereš iz zgornje tabele (ali narediš gladko krivuljo).

**Naslednji korak (če želiš):** to logiko lahko vgradimo direktno v
`athlos_readiness.py`, da poleg Readinessa izpiše tudi **priporočen % loada in
volumna za danes** — samo povej svoje številke v zgornji tabeli in jih vstavimo.

---

## 6. Kako pognati (za vsakega športnika)

1. Whoop app → Settings → Data Export → razširi ZIP.
2. Naloži na Claude: `athlos_readiness.py` + `physiological_cycles.csv` +
   `workouts.csv`.
3. V `athlos_readiness.py` (razdelek `NASTAVITVE`) vpiši starost, težo, višino,
   spol.
4. Reci Claudu: *"Poženi athlos_readiness.py na mojih podatkih."*
5. Dobiš tabelo zadnjih 30 dni z Readiness + Load.

Če imaš tudi dnevno počutje, ga vpiši v slovar `WELLNESS` (datum → 0–100).
Brez tega se Readiness računa pri nevtralnem počutju (50).
