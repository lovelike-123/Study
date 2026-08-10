import type { Session } from '../db/types'

/**
 * 训练进程持久化。
 *
 * 背景：Android 在 App 退到后台后随时可能回收进程（低内存、系统策略），
 * 单靠内存里的 zustand 状态无法保证"训练不中断"。这里把训练快照写进
 * localStorage，冷启动时再还原，做到「退出 App / 进程被杀 → 重新进入仍在训练中」。
 *
 * 只持久化训练进程本身，浮层类瞬态 UI（放弃确认 / 后台选择弹窗）不落盘。
 */

const KEY = 'fitlog.training.snapshot.v1'
/** 超过该时长的快照视为陈旧（人不会连续练 12 小时），直接丢弃避免"永远在训练中" */
const MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface TrainingSnapshot {
  phase: 'start' | 'run' | 'done'
  session: Session | null
  cur: { ex: number; set: number } | null
  resting: { seconds: number; endAt: number; next: { ex: number; set: number } } | null
  calories: string
  note: string
  /** 写入时间，用于陈旧判定 */
  savedAt: number
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // 隐私模式 / 禁用存储
  }
}

/** 落盘一份训练快照；phase 为 idle 时应调用 clearTrainingSnapshot */
export function saveTrainingSnapshot(snap: Omit<TrainingSnapshot, 'savedAt'>): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify({ ...snap, savedAt: Date.now() }))
  } catch {
    /* 配额或序列化异常不影响训练本身 */
  }
}

/** 清除训练快照（训练结束 / 放弃 / 保存后调用） */
export function clearTrainingSnapshot(): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}

/** 读取训练快照；不存在、损坏或已陈旧时返回 null（并顺手清理） */
export function loadTrainingSnapshot(): TrainingSnapshot | null {
  const s = storage()
  if (!s) return null
  let raw: string | null = null
  try {
    raw = s.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const snap = JSON.parse(raw) as TrainingSnapshot
    const startedAt = snap.session?.startedAt ?? snap.savedAt
    const valid =
      snap
      && (snap.phase === 'start' || snap.phase === 'run' || snap.phase === 'done')
      && typeof startedAt === 'number'
      && Date.now() - startedAt < MAX_AGE_MS
    // start 阶段只是"选计划"页，没有进行中的训练，无需跨进程恢复
    if (!valid || snap.phase === 'start' || !snap.session) {
      clearTrainingSnapshot()
      return null
    }
    return snap
  } catch {
    clearTrainingSnapshot()
    return null
  }
}
