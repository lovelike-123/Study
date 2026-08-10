import { db, getSetting, setSetting } from './index'
import type { Exercise } from './types'

// 种子版本随内置动作库扩容递增；老用户带旧标记会被视为未种，触发补种
const SEED_FLAG = 'seeded_v2'

const SEED_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [
  { name: '杠铃卧推', category: '胸', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '哑铃飞鸟', category: '胸', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '上斜哑铃卧推', category: '胸', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '双杠臂屈伸', category: '胸', equipment: '自重', metric: 'reps', isCustom: false },
  { name: '引体向上', category: '背', equipment: '自重', metric: 'reps', isCustom: false },
  { name: '杠铃划船', category: '背', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '高位下拉', category: '背', equipment: '器械', metric: 'weight_reps', isCustom: false },
  { name: '坐姿划船', category: '背', equipment: '器械', metric: 'weight_reps', isCustom: false },
  { name: '深蹲', category: '腿', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '硬拉', category: '腿', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '腿举', category: '腿', equipment: '器械', metric: 'weight_reps', isCustom: false },
  { name: '保加利亚分腿蹲', category: '腿', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '站姿提踵', category: '腿', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '坐姿推肩', category: '肩', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '哑铃侧平举', category: '肩', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '面拉', category: '肩', equipment: '绳索', metric: 'weight_reps', isCustom: false },
  { name: '杠铃弯举', category: '手臂', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '锤式弯举', category: '手臂', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
  { name: '三头下压', category: '手臂', equipment: '绳索', metric: 'weight_reps', isCustom: false },
  { name: '平板支撑', category: '核心', equipment: '自重', metric: 'time', isCustom: false },
  { name: '卷腹', category: '核心', equipment: '自重', metric: 'reps', isCustom: false },
  { name: '臀桥', category: '臀', equipment: '杠铃', metric: 'weight_reps', isCustom: false },
  { name: '壶铃摇摆', category: '臀', equipment: '壶铃', metric: 'weight_reps', isCustom: false },
  { name: '跑步机', category: '有氧', equipment: '器械', metric: 'distance', isCustom: false, incline: true, speed: true },
  { name: '椭圆机', category: '有氧', equipment: '器械', metric: 'distance', isCustom: false },
  { name: '跳绳', category: '有氧', equipment: '自重', metric: 'reps', isCustom: false },
  { name: '农夫行走', category: '前臂', equipment: '哑铃', metric: 'weight_reps', isCustom: false },
]

export async function ensureSeed() {
  const done = await getSetting(SEED_FLAG, false)
  if (done) return
  const now = Date.now()
  // 按名称去重：只补种库里还没有的内置动作，老用户升级时不重复、不动自定义动作
  const existing = new Set((await db.exercises.toArray()).map(e => e.name))
  const toAdd = SEED_EXERCISES.filter(e => !existing.has(e.name))
  if (toAdd.length) {
    await db.exercises.bulkAdd(
      toAdd.map((e, i) => ({ ...e, createdAt: now + i })) as Exercise[],
    )
  }
  await setSetting(SEED_FLAG, true)
}
