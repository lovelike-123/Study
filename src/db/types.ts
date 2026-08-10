export type Metric = 'weight_reps' | 'reps' | 'time' | 'distance'

export const METRIC_LABEL: Record<Metric, string> = {
  weight_reps: '重量 × 次数',
  reps: '仅次数',
  time: '时长',
  distance: '距离',
}

export type Category = '胸' | '背' | '腿' | '肩' | '手臂' | '核心' | '臀' | '有氧' | '前臂' | '其他'

export const CATEGORIES: Category[] = ['胸', '背', '腿', '肩', '手臂', '核心', '有氧', '其他']

export const EQUIPMENTS = ['杠铃', '哑铃', '器械', '绳索', '自重', '其他'] as const

export interface Exercise {
  id?: number
  name: string
  category: Category
  equipment: string
  metric: Metric
  isCustom: boolean
  /** 该动作是否需要录入坡度（跑步机/斜板等） */
  incline?: boolean
  /** 该动作是否需要录入速度（跑步机/自行车等） */
  speed?: boolean
  note?: string
  createdAt: number
}

export interface PlanItem {
  exerciseId: number
  /** 热身组数，可 0；time/distance 类动作不区分热身/正式组，建计划时强制为 0 */
  warmupSets: number
  /** 正式组数 */
  targetSets: number
  /** 重量×次数 / 仅次数：用 */
  targetReps?: number
  /** 重量×次数 / 时间类负重：用 */
  targetWeight?: number
  /** 时长：用（每组目标秒数） */
  targetDurationSec?: number
  /** 距离：用（每组目标 km） */
  targetDistance?: number
  /** 跑步机：目标坡度 % */
  targetIncline?: number
  /** 跑步机/自行车：目标速度 km/h */
  targetSpeed?: number
  /** 该动作的小组间休息覆盖值，秒；不填则用计划的 restBetweenSets */
  restSec?: number
}

export interface Plan {
  id?: number
  name: string
  note?: string
  items: PlanItem[]
  /** 小组间休息：同一动作两组之间，秒 */
  restBetweenSets: number
  /** 大组间休息：切换到下一个动作时，秒 */
  restBetweenExercises: number
  createdAt: number
  updatedAt: number
}

export const DEFAULT_REST_SETS = 90
export const DEFAULT_REST_EXERCISES = 180

export type CalorieSource = 'manual' | 'mi_health'

export interface Workout {
  id?: number
  planId?: number
  name: string
  startAt: number
  endAt?: number
  durationSec: number
  /** 本场训练热量消耗 kcal */
  calories?: number
  calorieSource?: CalorieSource
  note?: string
  status: 'done'
}

/** 来自智能手表 / 小米运动健康的每日数据，date 为 YYYY-MM-DD */
export interface DailyHealth {
  date: string
  calories: number
  steps?: number
  activeMinutes?: number
  avgHeartRate?: number
  source: CalorieSource
  importedAt: number
}

export interface SetRecord {
  id?: number
  workoutId: number
  exerciseId: number
  setNo: number
  /** 热身组 / 正式组，UI 摘要时通常只统计 work */
  kind: SetKind
  weight: number
  reps: number
  durationSec: number
  distance: number
  /** 跑步机：本次坡度 % */
  incline?: number
  /** 跑步机/自行车：本次速度 km/h */
  speed?: number
  rpe?: number
  done: boolean
  ts: number
}

export interface Setting {
  key: string
  value: unknown
}

// ---- 训练执行（仅运行时，不持久化） ----
export type SetKind = 'warmup' | 'work'

export interface SSet {
  setNo: number
  kind: SetKind
  weight: number
  reps: number
  durationSec: number
  distance: number
  /** 跑步机：本次坡度 % */
  incline?: number
  /** 跑步机/自行车：本次速度 km/h */
  speed?: number
  rpe?: number
  done: boolean
  doneTs?: number
}

export interface SEx {
  exerciseId: number
  name: string
  metric: Metric
  equipment: string
  warmupSets: number
  targetSets: number
  /** 重量×次数 / 仅次数 */
  targetReps?: number
  /** 重量×次数 */
  targetWeight?: number
  restSec?: number
  sets: SSet[]
}

export interface Session {
  planId?: number
  name: string
  planRs: number
  planRe: number
  vib: boolean
  sound: boolean
  startedAt: number
  items: SEx[]
}
