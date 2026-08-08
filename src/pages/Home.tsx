import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { SwipeAction, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { db } from '../db'
import { Page } from '../components/Layout'
import { dayKey, trainedDays } from '../utils/stats'
import { useTraining } from '../store/training'
import PlanEditor from '../components/PlanEditor'
import { IconChevron } from '../components/Icons'
import { DEFAULT_WEEK_GOAL, SK, useSetting } from '../hooks/useSetting'
import type { Plan } from '../db/types'
import TrainPage from './Train'

function Ring({ pct }: { pct: number }) {
  const r = 27
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(pct, 1))
  return (
    <svg width="66" height="66" viewBox="0 0 66 66">
      <circle cx="33" cy="33" r={r} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="6" />
      <circle
        cx="33" cy="33" r={r} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 33 33)"
      />
    </svg>
  )
}

export default function Home() {
  const nav = useNavigate()
  const phase = useTraining(s => s.phase)
  const startTrain = useTraining(s => s.setPhase)
  const [weekGoal] = useSetting(SK.weekGoal, DEFAULT_WEEK_GOAL)

  const [editingPlan, setEditingPlan] = useState<Plan | null | undefined>(undefined)
  // undefined=列表, null=新建, Plan=编辑

  const stats = useLiveQuery(async () => {
    const monday = dayjs().startOf('week').add(1, 'day')
    const from = monday.isAfter(dayjs()) ? monday.subtract(7, 'day') : monday

    const workouts = await db.workouts.where('startAt').above(from.valueOf()).toArray()
    const done = workouts.filter(w => w.status === 'done')
    const days = trainedDays(done)
    const minutes = Math.round(done.reduce((s, w) => s + w.durationSec, 0) / 60)

    const healthRows = await db.dailyHealth
      .where('date')
      .aboveOrEqual(from.format('YYYY-MM-DD'))
      .toArray()
    const watchKcal = healthRows.reduce((s, r) => s + r.calories, 0)
    const manualKcal = done.reduce((s, w) => s + (w.calorieSource === 'manual' ? w.calories ?? 0 : 0), 0)
    const kcal = watchKcal + manualKcal

    return { dayCount: days.size, kcal, minutes, hasHealth: healthRows.length > 0 }
  }, [], { dayCount: 0, kcal: 0, minutes: 0, hasHealth: false })

  const exCount = useLiveQuery(() => db.exercises.count(), [], 0)
  const lastSync = useLiveQuery(() => db.dailyHealth.orderBy('importedAt').last(), [])
  const plans = useLiveQuery(() => db.plans.orderBy('updatedAt').reverse().toArray(), [], [] as Plan[])
  const exMap = useLiveQuery(async () => {
    const list = await db.exercises.toArray()
    return new Map(list.map(e => [e.id!, e]))
  }, [], new Map<number, any>())
  const pct = stats.dayCount / weekGoal

  // 训练进行中：直接在主选项卡内渲染训练界面，不跳转
  if (phase !== 'idle') return <TrainPage />

  // 编辑计划时，覆盖主页内容
  if (editingPlan !== undefined) {
    return <PlanEditor plan={editingPlan} onClose={() => setEditingPlan(undefined)} />
  }

  const onDeletePlan = async (p: Plan) => {
    if (p.id == null) return
    const ok = window.confirm(`删除计划「${p.name}」？已完成的训练记录不会丢失。`)
    if (ok) {
      await db.plans.delete(p.id)
      Toast.show('已删除')
    }
  }

  return (
    <Page title="FitLog">
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greet">今天，也要好好练</div>
            <div className="hero-date">{dayjs().format('M月D日')} · 本周目标 {weekGoal} 练</div>
          </div>
          <div className="hero-ring">
            <Ring pct={pct} />
            <div className="hero-ring-label">{stats.dayCount}<span>/{weekGoal}</span></div>
          </div>
        </div>
        <button className="btn-primary" onClick={() => startTrain('start')}>
          开始训练
        </button>
      </section>

      {/* 训练计划（已合并到首页） */}
      <div className="card">
        <h3 className="card-title">
          训练计划
          <span className="small muted" style={{ fontWeight: 400 }}>{plans.length} 个</span>
        </h3>
        {plans.length === 0 ? (
          <div className="empty small muted" style={{ padding: '12px 0' }}>还没有训练计划，点下方新建</div>
        ) : (
          <div style={{ marginTop: 4 }}>
            {plans.map(p => {
              const names = p.items
                .map(it => exMap.get(it.exerciseId)?.name)
                .filter(Boolean)
                .slice(0, 3)
                .join('、')
              return (
                <SwipeAction
                  key={p.id}
                  rightActions={[{ key: 'del', text: '删除', color: 'danger', onClick: () => onDeletePlan(p) }]}
                >
                  <div className="list-item" style={{ padding: '10px 0' }} onClick={() => setEditingPlan(p)}>
                    <div className="grow">
                      <div className="name">{p.name}</div>
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {p.items.length} 个动作{p.items.length ? ` · ${names}${p.items.length > 3 ? '…' : ''}` : ''}
                      </div>
                    </div>
                    <IconChevron size={18} />
                  </div>
                </SwipeAction>
              )
            })}
          </div>
        )}
        <button className="btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => setEditingPlan(null)}>
          + 新建训练计划
        </button>
      </div>

      {/* 动作库快捷入口 */}
      <div className="card" onClick={() => nav('/exercises')} style={{ cursor: 'pointer' }}>
        <div className="list-item">
          <div className="grow">
            <div className="name">动作库</div>
            <div className="small muted">共 {exCount} 个动作 · 点此管理</div>
          </div>
          <IconChevron size={18} />
        </div>
      </div>

      {/* 本周概览 */}
      <div className="card">
        <h3 className="card-title">
          本周概览
          <span className="small muted" style={{ fontWeight: 400 }}>
            {dayjs().startOf('week').add(1, 'day').format('M/D')} 起
          </span>
        </h3>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-num">{stats.dayCount}</div>
            <div className="stat-label">训练天数</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.kcal > 0 ? Math.round(stats.kcal) : '--'}</div>
            <div className="stat-label">热量消耗 kcal</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.minutes}</div>
            <div className="stat-label">时长 分钟</div>
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
          {lastSync
            ? `热量来自小米运动健康 · 最近同步至 ${dayKey(lastSync.importedAt)}`
            : '暂无热量数据；训练结束后可手动填入 kcal（或等后续版本接入 Health Connect）'}
        </div>
      </div>
    </Page>
  )
}