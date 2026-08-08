import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../db'

/** 读写 settings 表的单个键，返回值会随数据库变化自动更新 */
export function useSetting<T>(key: string, fallback: T): [T, (v: T) => Promise<void>] {
  const row = useLiveQuery(() => db.settings.get(key), [key])
  const value = row === undefined ? fallback : (row.value as T)
  return [value, (v: T) => setSetting(key, v)]
}

export const SK = {
  restSets: 'default_rest_sets',
  restExercises: 'default_rest_exercises',
  restVibrate: 'rest_vibrate',
  restSound: 'rest_sound',
  unit: 'unit',           // 'kg' | 'lb'
  weekGoal: 'week_goal',  // number
} as const

export type Unit = 'kg' | 'lb'
export const DEFAULT_UNIT: Unit = 'kg'
export const DEFAULT_WEEK_GOAL = 4
