import { create } from 'zustand'
import { Toast } from 'antd-mobile'
import type { Exercise, Metric, Plan, SSet, SEx, Session } from '../db/types'
import { showTrainingNotification, cancelTrainingNotification } from '../utils/trainingNotification'
import { clearTrainingSnapshot, loadTrainingSnapshot, saveTrainingSnapshot } from '../utils/trainingPersist'

type Phase = 'idle' | 'start' | 'run' | 'done'
/** 休息倒计时。endAt 为绝对结束时间戳，进程被杀重启后仍能算出准确剩余秒数 */
interface Resting { seconds: number; endAt: number; next: { ex: number; set: number } }

function makeSets(opts: {
  warmup: number; work: number; reps: number; weight: number; durationSec: number; distance: number;
  incline?: number; speed?: number;
}): SSet[] {
  const { warmup, work, reps, weight, durationSec, distance, incline, speed } = opts
  const arr: SSet[] = []
  let n = 1
  for (let i = 0; i < warmup; i++) arr.push({ setNo: n++, kind: 'warmup', weight: 0, reps: 0, durationSec: 0, distance: 0, done: false })
  for (let i = 0; i < work; i++) arr.push({ setNo: n++, kind: 'work', weight, reps, durationSec, distance, incline, speed, done: false })
  return arr
}

function validateSet(metric: Metric, s: SSet): string {
  if (s.kind === 'warmup') return '' // 热身组无需录入
  if (metric === 'weight_reps' || metric === 'reps') return s.reps > 0 ? '' : '请填写次数'
  if (metric === 'time') return s.durationSec > 0 ? '' : '请填写时长'
  if (metric === 'distance') return s.distance > 0 ? '' : '请填写距离'
  return ''
}

interface TrainingState {
  phase: Phase
  session: Session | null
  cur: { ex: number; set: number } | null
  resting: Resting | null
  calories: string
  note: string
  /** 执行页"放弃"确认浮层是否打开（系统返回键也会操作它） */
  confirmAbandon: boolean
  /** 训练时长不足 30 分钟时的确认弹窗（数值为已训练秒数） */
  shortRun: number | null
  /** 训练已转入后台：界面隐藏但进程不中断，由系统通知 / 应用内横幅提供返回入口 */
  minimized: boolean
  /** 返回键触发的「后台运行 / 放弃训练」选择弹窗 */
  bgDialog: boolean

  setPhase: (p: Phase) => void
  reset: () => void
  setConfirmAbandon: (v: boolean) => void
  setShortRun: (v: number | null) => void
  setMinimized: (v: boolean) => void
  setBgDialog: (v: boolean) => void
  /** 转入后台：隐藏训练界面并挂出系统状态栏常驻通知（点击可返回） */
  background: () => void
  /** 回到训练：恢复训练界面并移除常驻通知 */
  resume: () => void
  /** 系统/物理返回键在训练中的统一行为 */
  back: () => void
  startPlan: (plan: Plan, exercises: Exercise[], vib: boolean, sound: boolean) => void
  startFree: (gRs: number, gRe: number, vib: boolean, sound: boolean) => void
  addExercise: (id: number, exercises: Exercise[]) => void
  updateSet: (ex: number, st: number, patch: Partial<SSet>) => void
  markDone: () => void
  /** 休息倒计时加时（秒），写回 endAt 以便跨进程恢复 */
  extendRest: (sec: number) => void
  advance: () => void
  skipExercise: () => void
  setCalories: (v: string) => void
  setNote: (v: string) => void
  allSets: () => SSet[]
  doneCount: () => number
  nextLoc: (ex: number, set: number) => { ex: number; set: number } | null
}

export const useTraining = create<TrainingState>((set, get) => ({
  phase: 'idle',
  session: null,
  cur: null,
  resting: null,
  calories: '',
  note: '',
  confirmAbandon: false,
  shortRun: null,
  minimized: false,
  bgDialog: false,

  setPhase: (p) => set({ phase: p }),
  reset: () => {
    cancelTrainingNotification()
    clearTrainingSnapshot()
    set({ phase: 'idle', session: null, cur: null, resting: null, calories: '', note: '', confirmAbandon: false, shortRun: null, minimized: false, bgDialog: false })
  },
  setConfirmAbandon: (v) => set({ confirmAbandon: v }),
  setShortRun: (v) => set({ shortRun: v }),
  setMinimized: (v) => set({ minimized: v }),
  setBgDialog: (v) => set({ bgDialog: v }),
  background: () => {
    const name = get().session?.name ?? '训练'
    set({ minimized: true, bgDialog: false })
    void showTrainingNotification(name)
  },
  resume: () => {
    set({ minimized: false })
    void cancelTrainingNotification()
  },

  // 系统返回键在训练中的统一逻辑，与屏内"返回/放弃"按钮行为一致
  back: () => {
    const { phase, confirmAbandon, shortRun } = get()
    if (phase === 'start') {
      set({ phase: 'idle' })
    } else if (phase === 'done') {
      if (shortRun !== null) set({ shortRun: null }) // 先关掉"时长不足"弹窗
      else set({ phase: 'run' })
    } else if (phase === 'run') {
      // 执行页：先关掉已打开的"放弃"确认，否则打开它
      set({ confirmAbandon: !confirmAbandon })
    }
  },

  startPlan: (plan, exercises, vib, sound) => {
    let skipped = 0
    const items: SEx[] = []
    for (const it of plan.items) {
      const ex = exercises.find(e => e.id === it.exerciseId)
      if (!ex) { skipped++; continue }
      const weight = it.targetWeight ?? 0
      const reps = it.targetReps ?? 0
      const durationSec = it.targetDurationSec ?? 0
      const distance = it.targetDistance ?? 0
      // time / distance 类的动作不区分热身/正式组，warmupSets 强制为 0
      const isTimed = ex.metric === 'time' || ex.metric === 'distance'
      const warmup = isTimed ? 0 : (it.warmupSets ?? 0)
      const incline = ex.incline ? it.targetIncline : undefined
      const speed = ex.speed ? it.targetSpeed : undefined
      items.push({
        exerciseId: ex.id!, name: ex.name, metric: ex.metric, equipment: ex.equipment,
        warmupSets: warmup, targetSets: it.targetSets,
        targetReps: reps, targetWeight: weight,
        restSec: it.restSec,
        sets: makeSets({ warmup, work: it.targetSets, reps, weight, durationSec, distance, incline, speed }),
      })
    }
    if (skipped) Toast.show(`已跳过 ${skipped} 个已删除的动作`)
    set({
      session: {
        planId: plan.id, name: plan.name,
        planRs: plan.restBetweenSets, planRe: plan.restBetweenExercises,
        vib, sound, startedAt: Date.now(), items,
      },
      cur: items.length ? { ex: 0, set: 0 } : null,
      resting: null, calories: '', note: '', phase: 'run',
    })
  },

  startFree: (gRs, gRe, vib, sound) => {
    set({
      session: { planId: undefined, name: '自由训练', planRs: gRs, planRe: gRe, vib, sound, startedAt: Date.now(), items: [] },
      cur: null, resting: null, calories: '', note: '', phase: 'run',
    })
  },

  addExercise: (id, exercises) => {
    const ex = exercises.find(e => e.id === id)
    if (!ex) { Toast.show('动作不存在'); return }
    const isTime = ex.metric === 'time'
    const isDistance = ex.metric === 'distance'
    const incline = ex.incline ? 5 : undefined
    const speed = ex.speed ? 6 : undefined
    const item: SEx = {
      exerciseId: ex.id!, name: ex.name, metric: ex.metric, equipment: ex.equipment,
      warmupSets: 0,
      targetSets: isTime ? 3 : isDistance ? 1 : 3,
      targetReps: isTime || isDistance ? undefined : 10,
      targetWeight: ex.metric === 'weight_reps' || isTime ? 0 : undefined,
      sets: makeSets({
        warmup: 0,
        work: isTime ? 3 : isDistance ? 1 : 3,
        reps: 0,
        weight: 0,
        durationSec: isTime ? 60 : 0,
        distance: isDistance ? 1 : 0,
        incline,
        speed,
      }),
    }
    set(prev => {
      if (!prev.session) return prev
      const items = [...prev.session.items, item]
      const nextCur = prev.cur ?? { ex: items.length - 1, set: 0 }
      return { session: { ...prev.session, items }, cur: nextCur }
    })
  },

  updateSet: (ex, st, patch) => {
    set(prev => prev.session ? {
      ...prev,
      session: {
        ...prev.session,
        items: prev.session.items.map((it, i) => i !== ex ? it : { ...it, sets: it.sets.map((s, j) => j !== st ? s : { ...s, ...patch }) }),
      },
    } : prev)
  },

  markDone: () => {
    const { session, cur } = get()
    if (!session || !cur) return
    const ex = session.items[cur.ex]
    const s = ex.sets[cur.set]
    const msg = validateSet(ex.metric, s)
    if (msg) { Toast.show(msg); return }

    set(prev => prev.session ? {
      ...prev,
      session: {
        ...prev.session,
        items: prev.session.items.map((it, i) => i !== cur.ex ? it : {
          ...it,
          sets: it.sets.map((x, j) => j !== cur.set ? x : { ...x, done: true, doneTs: Date.now() }),
        }),
      },
    } : prev)

    const nx = get().nextLoc(cur.ex, cur.set)
    if (!nx) { set({ cur: null, resting: null, phase: 'done' }); return }
    const sameEx = nx.ex === cur.ex
    const secs = sameEx ? (ex.restSec ?? session.planRs) : session.planRe
    set({ resting: { seconds: secs, endAt: Date.now() + secs * 1000, next: nx } })
  },

  extendRest: (sec) => {
    const r = get().resting
    if (!r) return
    set({ resting: { ...r, seconds: r.seconds + sec, endAt: r.endAt + sec * 1000 } })
  },

  advance: () => {
    const { resting } = get()
    if (resting) set({ cur: resting.next, resting: null })
  },

  skipExercise: () => set({ cur: null, resting: null, phase: 'done' }),

  setCalories: (v) => set({ calories: v }),
  setNote: (v) => set({ note: v }),

  allSets: () => get().session?.items.flatMap(i => i.sets) ?? [],
  doneCount: () => get().allSets().filter(s => s.done).length,
  nextLoc: (ex, set) => {
    const session = get().session
    if (!session) return null
    if (set + 1 < session.items[ex].sets.length) return { ex, set: set + 1 }
    for (let i = ex + 1; i < session.items.length; i++) {
      if (session.items[i].sets.length > 0) return { ex: i, set: 0 }
    }
    return null
  },
}))

// ---------------- 训练进程持久化 ----------------
// Android 可能在 App 退到后台后回收进程，仅靠内存状态无法保证"训练不中断"。
// 这里把影响恢复的字段实时落盘；瞬态浮层（确认框等）不触发写入。
let lastSnapKey: unknown[] = []
useTraining.subscribe((s) => {
  const { phase, session, cur, resting, calories, note } = s
  if (phase === 'idle' || !session) return // reset() 内已清除快照
  const key = [phase, session, cur, resting, calories, note]
  if (key.length === lastSnapKey.length && key.every((v, i) => v === lastSnapKey[i])) return
  lastSnapKey = key
  saveTrainingSnapshot({ phase, session, cur, resting, calories, note })
})

/** 冷启动是否从快照恢复了训练（供 UI 提示一次） */
let restoredOnBoot = false

/**
 * 冷启动还原上次未结束的训练。必须在 React 挂载前调用一次。
 * 进程重启后系统常驻通知已消失，因此直接回到训练界面（minimized=false），
 * 避免用户误以为训练被中断。
 */
export function hydrateTraining(): boolean {
  const snap = loadTrainingSnapshot()
  if (!snap?.session) return false
  useTraining.setState({
    phase: snap.phase,
    session: snap.session,
    cur: snap.cur ?? null,
    resting: snap.resting ?? null,
    calories: snap.calories ?? '',
    note: snap.note ?? '',
    minimized: false,
    confirmAbandon: false,
    shortRun: null,
    bgDialog: false,
  })
  restoredOnBoot = true
  return true
}

/** 读取并复位"本次冷启动恢复了训练"标记 */
export function consumeRestoredFlag(): boolean {
  const v = restoredOnBoot
  restoredOnBoot = false
  return v
}
