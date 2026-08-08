import { db, getSetting, setSetting } from './index'
import type { Exercise } from './types'

const SEED_FLAG = 'seeded_v1'

const SEED_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [
  { name: '杠铃卧推', category: '胸', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '哑铃飞鸟', category: '胸', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '引体向上', category: '背', equipment: '自重', metric: 'reps', isCustom: false },
  { name: '杠铃划船', category: '背', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '深蹲', category: '腿', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '硬拉', category: '腿', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '坐姿推肩', category: '肩', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '杠铃弯举', category: '手臂', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '平板支撑', category: '核心', equipment: '自重', metric: 'time', isCustom: false },
  { name: '跑步机', category: '有氧', equipment: '器械', metric: 'distance', isCustom: false, incline: true, speed: true },
]

export async function ensureSeed() {
  const done = await getSetting(SEED_FLAG, false)
  if (done) return
  const now = Date.now()
  await db.exercises.bulkAdd(
    SEED_EXERCISES.map((e, i) => ({ ...e, createdAt: now + i })) as Exercise[],
  )
  await setSetting(SEED_FLAG, true)
}
