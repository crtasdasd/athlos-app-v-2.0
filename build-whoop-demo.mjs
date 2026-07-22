// Builds src/lib/whoopDemo.json from a Whoop export (scripts/whoop-sample/).
// Port of nalozi_podatke() in docs/readiness/athlos_readiness.py: per-day
// whole-day load = zone-weighted Banister TRIMP of all workouts + calorie
// background above BMR. Output: [{ date, rec, load, whoopStrain }] — the
// engine (src/lib/athlosReadinessV2.js) computes everything else at runtime.
//
// Run: node scripts/build-whoop-demo.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const FOLDER = join(here, 'whoop-sample')
const OUT = join(here, '..', 'src', 'lib', 'whoopDemo.json')
const KEEP_DAYS = 120

// Athlete profile — same defaults as the Python NASTAVITVE block.
const PROFILE = { starost: 22, teza_kg: 92, visina_cm: 196, spol: 'M' }
const BACKGROUND_FAKTOR = 0.06

// Minimal CSV parser (Whoop exports: quoted fields, no embedded newlines).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length)
  const split = (line) => {
    const out = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }
  const head = split(lines[0])
  return lines.slice(1).map((l) => {
    const cells = split(l)
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
  })
}

const f = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : null }

// Mifflin-St Jeor BMR + Banister sex constants.
const s = PROFILE.spol === 'M' ? 5 : -161
const BMR = 10 * PROFILE.teza_kg + 6.25 * PROFILE.visina_cm - 5 * PROFILE.starost + s
const [k1, k2] = PROFILE.spol === 'M' ? [0.64, 1.92] : [0.86, 1.67]

const cycRows = parseCsv(readFileSync(join(FOLDER, 'physiological_cycles.csv'), 'utf8'))
const wkRows = parseCsv(readFileSync(join(FOLDER, 'workouts.csv'), 'utf8'))

const cyc = cycRows
  .map((r) => ({
    key: r['Cycle start time'],
    date: (r['Cycle start time'] || '').slice(0, 10),
    rec: f(r['Recovery score %']),
    rhr: f(r['Resting heart rate (bpm)']),
    cal: f(r['Energy burned (cal)']),
    whoopStrain: f(r['Day Strain']),
  }))
  .filter((c) => c.date.length === 10)
  .sort((a, b) => (a.date < b.date ? -1 : 1))

// Athlete constants from their own data.
const rhrs = cyc.map((c) => c.rhr).filter((v) => v != null).sort((a, b) => a - b)
const HRrest = rhrs.length ? rhrs[Math.floor(rhrs.length / 2)] : 60
const maxhrs = wkRows.map((r) => f(r['Max HR (bpm)'])).filter((v) => v != null).sort((a, b) => a - b)
const HRmax = maxhrs.length ? maxhrs[Math.max(0, Math.floor(0.99 * maxhrs.length) - 1)] : 190

// Exponential (Banister) per-minute weights for HR zones 1–5.
const zmid = [0.55, 0.65, 0.75, 0.85, 0.95]
const zw = zmid.map((m) => {
  const hrr = Math.max(0, (m * HRmax - HRrest) / (HRmax - HRrest))
  return hrr * k1 * Math.exp(k2 * hrr)
})

const training = {}
for (const r of wkRows) {
  const dur = f(r['Duration (min)']) || 0
  const zones = [1, 2, 3, 4, 5].map((i) => f(r[`HR Zone ${i} %`]) || 0)
  const load = zones.reduce((sum, z, i) => sum + dur * (z / 100) * zw[i], 0)
  const key = r['Cycle start time']
  training[key] = (training[key] || 0) + load
}

for (const c of cyc) {
  const lTrain = training[c.key] || 0
  const lBg = BACKGROUND_FAKTOR * Math.max(0, c.cal != null ? c.cal - BMR : 0)
  c.load = +(lTrain + lBg).toFixed(2)
}

const out = cyc.slice(-KEEP_DAYS).map(({ date, rec, load, whoopStrain }) => ({ date, rec, load, whoopStrain }))
writeFileSync(OUT, JSON.stringify(out))
console.log(`profile: ${JSON.stringify(PROFILE)}  HRrest=${HRrest}  HRmax=${HRmax}`)
console.log(`wrote ${out.length} days -> ${OUT}`)
console.log('last day:', JSON.stringify(out[out.length - 1]))
