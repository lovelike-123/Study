import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { Workout } from '../db/types'

dayjs.extend(isoWeek)

export const dayKey = (ts: number | string | Date) => dayjs(ts).format('YYYY-MM-DD')

/** 训练过的日期集合（按天去重） */
export function trainedDays(workouts: Workout[]): Set<string> {
  const s = new Set<string>()
  for (const w of workouts) if (w.status === 'done') s.add(dayKey(w.startAt))
  return s
}

export interface WeekStat {
  /** 该周周一 */
  start: string
  label: string
  days: number
}

/** 最近 n 周，每周的训练天数（用于"一周几练"） */
export function weeklyStats(workouts: Workout[], weeks = 8): WeekStat[] {
  const days = trainedDays(workouts)
  const thisMonday = dayjs().startOf('isoWeek')
  const out: WeekStat[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday.subtract(i, 'week')
    let n = 0
    for (let d = 0; d < 7; d++) {
      if (days.has(start.add(d, 'day').format('YYYY-MM-DD'))) n++
    }
    out.push({
      start: start.format('YYYY-MM-DD'),
      label: i === 0 ? '本周' : start.format('M/D'),
      days: n,
    })
  }
  return out
}

/** 平均一周几练，只统计已开始训练之后的周 */
export function avgPerWeek(stats: WeekStat[]): number {
  const firstActive = stats.findIndex(s => s.days > 0)
  if (firstActive < 0) return 0
  const eff = stats.slice(firstActive)
  return Math.round((eff.reduce((s, x) => s + x.days, 0) / eff.length) * 10) / 10
}

/** 连续打卡：当前连续天数与历史最长 */
export function streaks(days: Set<string>): { current: number; best: number } {
  if (days.size === 0) return { current: 0, best: 0 }
  const sorted = [...days].sort()

  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const gap = dayjs(sorted[i]).diff(dayjs(sorted[i - 1]), 'day')
    run = gap === 1 ? run + 1 : 1
    if (run > best) best = run
  }

  let current = 0
  let cursor = dayjs()
  if (!days.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  while (days.has(cursor.format('YYYY-MM-DD'))) {
    current++
    cursor = cursor.subtract(1, 'day')
  }

  return { current, best }
}

export interface HeatCell {
  date: string
  inFuture: boolean
  trained: boolean
  isToday: boolean
}

/** 打卡热力图：最近 n 周 × 7 天（列=周，行=周一..周日） */
export function heatmapGrid(days: Set<string>, weeks = 12): HeatCell[][] {
  const today = dayjs()
  const thisMonday = today.startOf('isoWeek')
  const cols: HeatCell[][] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday.subtract(i, 'week')
    const col: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const day = start.add(d, 'day')
      const key = day.format('YYYY-MM-DD')
      col.push({
        date: key,
        inFuture: day.isAfter(today, 'day'),
        trained: days.has(key),
        isToday: day.isSame(today, 'day'),
      })
    }
    cols.push(col)
  }
  return cols
}
