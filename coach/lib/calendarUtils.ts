export const CAL_YEAR = 2026

export function getMonthGrid(monthIndex: number) {
  const firstDay = new Date(CAL_YEAR, monthIndex, 1)
  const daysInMonth = new Date(CAL_YEAR, monthIndex + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

export function monthAbbrev(monthIndex: number) {
  return new Date(CAL_YEAR, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' })
}

export function monthName(monthIndex: number) {
  return new Date(CAL_YEAR, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' })
}
