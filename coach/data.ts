export type Status = 'ready' | 'slightly-tired' | 'tired'
// Real roster classification (coach app spec) — "healthy" only means "no
// open injury/sick report and has check-in data", never a guess.
export type RosterStatus = 'healthy' | 'sick' | 'injured' | 'unknown'

export interface Athlete {
  id: string
  initials: string
  name: string
  username: string
  note: string
  readiness: number
  status: Status
  weightKg: number
  isPrivate: boolean
  hasData?: boolean
  rosterStatus?: RosterStatus
}

export const athletes: Athlete[] = [
  { id: '1', initials: 'LK', name: 'Luka Kovač', username: 'luka.kovac', note: 'Ready · last training today', readiness: 92, status: 'ready', weightKg: 75.0, isPrivate: false },
  { id: '2', initials: 'NM', name: 'Nina Mlakar', username: 'nina.mlakar', note: 'Ready · recovery good', readiness: 88, status: 'ready', weightKg: 62.4, isPrivate: false },
  { id: '3', initials: 'TŽ', name: 'Tim Žagar', username: 'tim.zagar', note: 'Slightly tired · 6h of sleep', readiness: 71, status: 'slightly-tired', weightKg: 80.1, isPrivate: false },
  { id: '4', initials: 'EH', name: 'Eva Horvat', username: 'eva.horvat', note: 'Ready', readiness: 85, status: 'ready', weightKg: 58.6, isPrivate: true },
  { id: '5', initials: 'JN', name: 'Jure Novak', username: 'jure.novak', note: 'Tired · rest recommended', readiness: 48, status: 'tired', weightKg: 84.3, isPrivate: false },
  { id: '6', initials: 'AK', name: 'Ana Kos', username: 'ana.kos', note: 'Ready', readiness: 96, status: 'ready', weightKg: 60.2, isPrivate: false },
  { id: '7', initials: 'MP', name: 'Marko Potočnik', username: 'marko.potocnik', note: 'Slightly tired', readiness: 71, status: 'slightly-tired', weightKg: 77.8, isPrivate: true },
]

export interface ReadinessMetric {
  label: string
  sublabel: string
  weight: number
  score: number
}

const metricDefs = [
  { label: 'Recovery', sublabel: 'HRV · RHR · sleep', weight: 30 },
  { label: 'Wellness', sublabel: 'Morning questionnaire', weight: 25 },
  { label: 'Velocity', sublabel: 'AI from main lift', weight: 20 },
  { label: 'Nutrition', sublabel: '7-day average', weight: 15 },
  { label: 'Hydration + weight', sublabel: 'Daily log', weight: 10 },
  { label: 'Cycle', sublabel: 'Phase modulator', weight: 0 },
]

function seedFromId(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000
  return h
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function getAthleteMetrics(athlete: Athlete): ReadinessMetric[] {
  const seed = seedFromId(athlete.id)
  return metricDefs.map((m, i) => {
    const offset = ((seed + i * 137) % 41) - 20
    const score = clamp(Math.round(athlete.readiness + offset), 30, 99)
    return { ...m, score }
  })
}

export function getAthleteTrend(athlete: Athlete): number[] {
  const seed = seedFromId(athlete.id)
  const days = 7
  const arr: number[] = []
  for (let i = 0; i < days; i++) {
    const offset = ((seed + i * 53) % 31) - 18 + i * 2
    arr.push(clamp(Math.round(athlete.readiness + offset), 25, 99))
  }
  arr[days - 1] = athlete.readiness
  return arr
}

export interface WeightPoint {
  month: string
  kg: number
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getAthleteWeightSeries(athlete: Athlete): WeightPoint[] {
  const seed = seedFromId(athlete.id)
  const drift = 4 + (seed % 6)
  const direction = seed % 2 === 0 ? 1 : -1
  const start = athlete.weightKg + direction * drift

  const points: WeightPoint[] = monthLabels.map((month, i) => {
    const t = i / (monthLabels.length - 1)
    const noise = (((seed + i * 67) % 17) - 8) / 10
    const kg = start + (athlete.weightKg - start) * t + noise
    return { month, kg: Math.round(kg * 10) / 10 }
  })
  points[points.length - 1] = { month: monthLabels[monthLabels.length - 1], kg: athlete.weightKg }
  return points
}

export interface ReadinessStatus {
  title: string
  desc: string
  color: string
}

export function readinessStatus(readiness: number): ReadinessStatus {
  if (readiness >= 85) {
    return { title: 'Ready for max', desc: 'Green light for peak training — full load.', color: 'var(--green)' }
  }
  if (readiness >= 70) {
    return { title: 'Ready', desc: 'Good shape for a normal training load.', color: 'var(--green)' }
  }
  if (readiness >= 55) {
    return { title: 'Slightly tired', desc: 'Consider a lighter session today.', color: 'var(--yellow)' }
  }
  return { title: 'Rest recommended', desc: 'Recovery is low — go easy or rest today.', color: 'var(--red)' }
}

// Roster overview (coach app spec) — real buckets from rosterStatus, not the
// old fabricated ready/tired split. Athletes with no check-in data yet
// ('unknown') are part of the total but deliberately not counted as
// "healthy" — that would be reporting a status the coach has no data for.
export function getTeamStats(list: Athlete[] = athletes) {
  return {
    total: list.length,
    healthy: list.filter((a) => a.rosterStatus === 'healthy').length,
    sick: list.filter((a) => a.rosterStatus === 'sick').length,
    injured: list.filter((a) => a.rosterStatus === 'injured').length,
  }
}

// Hours slept per night, last 7 days. Loosely correlates with readiness so the
// demo numbers tell a coherent story (tired athletes sleep less).
export function getAthleteSleepSeries(athlete: Athlete): number[] {
  const seed = seedFromId(athlete.id)
  const base = 5.5 + (athlete.readiness / 100) * 2.5
  const arr: number[] = []
  for (let i = 0; i < 7; i++) {
    const noise = (((seed + i * 89) % 21) - 10) / 10
    arr.push(clamp(Math.round((base + noise) * 10) / 10, 4, 9.5))
  }
  return arr
}

export interface AttendanceStats {
  done: number
  missed: number
  rate: number
}

// ── Readiness → today's training prescription ────────────────
// Straight from the coach playbook (RAZLAGA-ZA-TRENERJE): the planned session
// is multiplied by an intensity and a volume factor read off the athlete's
// morning readiness. Zones: green 67–100, yellow 34–66, red 0–33.
// Coaches: tune the percentages here — each row is independent.
export interface ReadinessRx {
  load: string      // intensity, % of plan
  volume: string    // volume, % of plan
  note: string
  color: string
}

export function readinessRx(readiness: number): ReadinessRx {
  if (readiness >= 80) return { load: '100–110%', volume: '100–110%', note: 'Green light — key session possible.', color: 'var(--green)' }
  if (readiness >= 67) return { load: '100%', volume: '100%', note: 'Train as planned.', color: 'var(--green)' }
  if (readiness >= 55) return { load: '90%', volume: '100%', note: 'Lower the intensity, keep the volume.', color: 'var(--yellow)' }
  if (readiness >= 40) return { load: '75%', volume: '85%', note: 'Easy day — technique work.', color: 'var(--yellow)' }
  if (readiness >= 25) return { load: '50%', volume: '60%', note: 'Regeneration only.', color: 'var(--red)' }
  return { load: 'Rest', volume: 'Rest', note: 'No training today.', color: 'var(--red)' }
}

// Sessions completed vs. missed over the last 30 days.
export function getAthleteAttendance(athlete: Athlete): AttendanceStats {
  const seed = seedFromId(athlete.id)
  const planned = 16 + (seed % 5)
  const missRatio = athlete.readiness >= 85 ? 0.05 : athlete.readiness >= 70 ? 0.14 : 0.3
  const missed = clamp(Math.round(planned * missRatio) + (seed % 2), 0, planned)
  const done = planned - missed
  return { done, missed, rate: Math.round((done / planned) * 100) }
}

export interface ChatMessage {
  id: string
  from: 'coach' | 'user'
  text: string
}

export const initialChat: ChatMessage[] = [
  { id: 'm1', from: 'coach', text: "Hey coach! I can help you plan training sessions, analyze your team's load, and track readiness. What do you need?" },
  { id: 'm2', from: 'user', text: 'Who needs rest today?' },
  { id: 'm3', from: 'coach', text: 'Based on the data, I recommend rest for Jure Novak (recovery 58) and a lighter session for Tim Žagar (71, low sleep). The rest of the team is ready for normal training.' },
]

export const quickActions = ['Suggest Wednesday training', 'Team load analysis']

export type EventType = 'training' | 'match' | 'recovery'

export interface CalEvent {
  id: string
  type: EventType
  title: string
  subtitle: string
  startHour: number
  durationHours: number
}

export interface ScheduleDay {
  id: string
  day: string
  shortDay: string
  date: number
  month: string
  events: CalEvent[]
}

export const schedule: ScheduleDay[] = [
  {
    id: 'mon', day: 'Monday', shortDay: 'Mon', date: 22, month: 'Jun',
    events: [
      { id: 'mon-1', type: 'training', title: 'Strength training', subtitle: 'Gym · full team', startHour: 7, durationHours: 1.5 },
    ],
  },
  {
    id: 'tue', day: 'Tuesday', shortDay: 'Tue', date: 23, month: 'Jun',
    events: [
      { id: 'tue-1', type: 'training', title: 'Technique', subtitle: 'Field A', startHour: 8, durationHours: 1 },
      { id: 'tue-2', type: 'recovery', title: 'Physio check-in', subtitle: 'Medical room', startHour: 16, durationHours: 0.5 },
    ],
  },
  {
    id: 'wed', day: 'Wednesday', shortDay: 'Wed', date: 24, month: 'Jun',
    events: [
      { id: 'wed-1', type: 'recovery', title: 'Recovery', subtitle: 'Pool · optional', startHour: 8, durationHours: 1 },
      { id: 'wed-2', type: 'training', title: 'Set-piece work', subtitle: 'Field B', startHour: 10, durationHours: 1 },
      { id: 'wed-3', type: 'match', title: 'Tactics review', subtitle: 'Film room', startHour: 17, durationHours: 1 },
    ],
  },
  {
    id: 'thu', day: 'Thursday', shortDay: 'Thu', date: 25, month: 'Jun',
    events: [
      { id: 'thu-1', type: 'training', title: 'Endurance', subtitle: 'Stadium', startHour: 7, durationHours: 1.5 },
    ],
  },
  {
    id: 'fri', day: 'Friday', shortDay: 'Fri', date: 26, month: 'Jun',
    events: [
      { id: 'fri-1', type: 'recovery', title: 'Mobility', subtitle: 'Gym', startHour: 9, durationHours: 0.5 },
      { id: 'fri-2', type: 'training', title: 'Sharpening', subtitle: 'Field A', startHour: 16.5, durationHours: 1 },
    ],
  },
  {
    id: 'sat', day: 'Saturday', shortDay: 'Sat', date: 27, month: 'Jun',
    events: [
      { id: 'sat-1', type: 'match', title: 'Match · home', subtitle: 'Stadium · meet at 9:00', startHour: 11, durationHours: 2 },
    ],
  },
  {
    id: 'sun', day: 'Sunday', shortDay: 'Sun', date: 28, month: 'Jun',
    events: [],
  },
]

export const COACH_NAME = 'Coach Matej'

export type AttachmentKind = 'img' | 'video' | 'file'

export interface ChatBubbleMsg {
  id: string
  from?: string
  me: boolean
  text?: string
  kind?: AttachmentKind
  fileName?: string
  fileSize?: string
  time: string
}

export interface Conversation {
  id: string
  initials: string
  name: string
  isGroup: boolean
  preview: string
  time: string
  unread: number
  subtitle: string
}

export const conversations: Conversation[] = [
  { id: 'u17', initials: 'U17', name: 'Team U17', isGroup: true, preview: 'Coach: training tomorrow at 17:00 ⚽', time: '09:42', unread: 5, subtitle: '18 members · active now' },
  { id: 'luka', initials: 'LK', name: 'Luka Kovač', isGroup: false, preview: 'Ok, thanks coach!', time: 'yesterday', unread: 0, subtitle: 'last active yesterday' },
  { id: 'nina', initials: 'NM', name: 'Nina Mlakar', isGroup: false, preview: 'Will you send the exercise video?', time: 'yesterday', unread: 1, subtitle: 'last active yesterday' },
  { id: 'regen', initials: 'RG', name: 'Recovery', isGroup: true, preview: 'Eva: pool tomorrow still on?', time: 'Mon', unread: 0, subtitle: '6 members' },
  { id: 'jure', initials: 'JN', name: 'Jure Novak', isGroup: false, preview: 'Resting today as advised', time: 'Mon', unread: 0, subtitle: 'last active Mon' },
]

export const conversationMessages: Record<string, ChatBubbleMsg[]> = {
  u17: [
    { id: 'm1', from: 'Coach', me: true, text: 'Hey team! Training tomorrow at 17:00 ⚽', time: '9:40' },
    { id: 'm2', from: 'Luka', me: false, text: "Sounds good coach 💪", time: '9:41' },
    { id: 'm3', from: 'Nina', me: false, text: "I'll be there!", time: '9:42' },
  ],
  luka: [
    { id: 'm1', me: false, text: 'Coach, how did you like my last training?', time: '18:20' },
    { id: 'm2', me: true, text: 'Great work, your recovery is 92. Keep it up!', time: '18:25' },
    { id: 'm3', me: false, text: 'Ok, thanks coach!', time: '18:26' },
  ],
  nina: [
    { id: 'm1', me: false, text: 'Will you send the exercise video?', time: '12:10' },
  ],
  regen: [
    { id: 'm1', from: 'Eva', me: false, text: 'Pool tomorrow still on?', time: 'Mon 19:00' },
  ],
  jure: [
    { id: 'm1', me: false, text: 'My knee hurts a bit today', time: 'Mon 16:30' },
    { id: 'm2', me: true, text: 'Rest today, come to a lighter recovery session tomorrow.', time: 'Mon 16:45' },
  ],
}

export function getOrCreateAthleteConversation(athlete: Athlete): string {
  const existing = conversations.find((c) => !c.isGroup && c.name === athlete.name)
  if (existing) return existing.id

  const id = `athlete-${athlete.id}`
  conversations.unshift({
    id,
    initials: athlete.initials,
    name: athlete.name,
    isGroup: false,
    preview: '',
    time: 'now',
    unread: 0,
    subtitle: 'new conversation',
  })
  conversationMessages[id] = []
  return id
}

export interface ChatBackground {
  id: string
  label: string
  css: string
}

export const chatBackgrounds: ChatBackground[] = [
  { id: 'default', label: 'default', css: 'var(--bg)' },
  { id: 'dark2', label: '', css: '#0a0d0a' },
  { id: 'green', label: '', css: 'radial-gradient(circle at 30% 20%, rgba(59,143,224,.10), #000 60%)' },
  { id: 'graph', label: '', css: 'repeating-linear-gradient(0deg,#000,#000 22px,#0d100d 23px), repeating-linear-gradient(90deg,#000,#000 22px,#0d100d 23px)' },
  { id: 'stadium', label: '⚽', css: 'linear-gradient(180deg,#0a140d,#000)' },
  { id: 'blue', label: '', css: 'radial-gradient(circle at 70% 30%, rgba(60,120,255,.12), #000 60%)' },
  { id: 'warm', label: '', css: 'radial-gradient(circle at 50% 0%, rgba(255,204,77,.08), #000 60%)' },
  { id: 'purple', label: '', css: 'radial-gradient(circle at 30% 80%, rgba(170,90,255,.12), #000 60%)' },
]

export const coachProfile = {
  initials: 'M',
  name: 'Coach Matej',
  role: 'Head coach',
  club: 'NK Domžale',
}

export const teamSchedule = {
  teamName: 'NK Domžale U17',
}

export interface SettingsItem {
  id: string
  label: string
  description: string
  type: 'toggle' | 'link'
  defaultOn?: boolean
}

export const settingsGroups: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Preferences',
    items: [
      { id: 'notif', label: 'Notifications', description: 'Readiness alerts & messages', type: 'toggle', defaultOn: true },
      { id: 'dark', label: 'Dark mode', description: 'Switch between dark and light theme', type: 'toggle', defaultOn: true },
      { id: 'units', label: 'Metric units', description: 'kg, km, °C', type: 'toggle', defaultOn: true },
    ],
  },
  {
    title: 'AI Coach',
    items: [
      { id: 'ai-suggest', label: 'Proactive suggestions', description: 'Let AI Coach message you first', type: 'toggle', defaultOn: false },
    ],
  },
]
