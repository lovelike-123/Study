import Dexie, { type Table } from 'dexie'
import type { DailyHealth, Exercise, Plan, SetRecord, Setting, Workout } from './types'

export class FitDB extends Dexie {
  exercises!: Table<Exercise, number>
  plans!: Table<Plan, number>
  workouts!: Table<Workout, number>
  sets!: Table<SetRecord, number>
  settings!: Table<Setting, string>
  dailyHealth!: Table<DailyHealth, string>

  constructor() {
    super('fitlog')
    this.version(1).stores({
      exercises: '++id, name, category, isCustom, createdAt',
      plans: '++id, name, updatedAt',
      workouts: '++id, startAt, status, planId',
      sets: '++id, workoutId, exerciseId, ts, [exerciseId+ts]',
      settings: 'key',
    })
    this.version(2).stores({
      dailyHealth: 'date, source, importedAt',
    })
    // v3：sets 增加 kind 字段，热身组/正式组在历史摘要中区分统计
    this.version(3).stores({
      sets: '++id, workoutId, exerciseId, kind, ts, [exerciseId+ts]',
    })
  }
}

export const db = new FitDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}
