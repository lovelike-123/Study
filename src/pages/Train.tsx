import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Picker, Input, TextArea, Toast, Empty } from 'antd-mobile'
import { db } from '../db'
import {
  DEFAULT_REST_EXERCISES, DEFAULT_REST_SETS,
  type Exercise, type Metric, type Plan, type SSet,
} from '../db/types'
import { SK, useSetting, DEFAULT_UNIT, type Unit } from '../hooks/useSetting'
import { IconChevron } from '../components/Icons'
import { kgToLb, lbToKg, displayWeight, unitLabel } from '../utils/units'
import RestTimer from '../components/RestTimer'
import { useTraining } from '../store/training'

function setSummary(metric: Metric, s: SSet, unit: Unit): string {
  const parts: string[] = []
  if (metric === 'weight_reps') parts.push(`${displayWeight(s.weight || 0, unit)}${unitLabel(unit)} × ${s.reps || 0}`)
  else if (metric === 'reps') parts.push(`${s.reps || 0} 次`)
  else if (metric === 'time') parts.push(`${s.durationSec || 0} 秒`)
  else if (metric === 'distance') parts.push(`${s.distance || 0} km`)
  if (s.incline != null && s.incline > 0) parts.push(`坡度 ${s.incline}%`)
  if (s.speed != null && s.speed > 0) parts.push(`${s.speed} km/h`)
  if (s.rpe) parts.push(`RPE ${s.rpe}`)
  return parts.join(' · ')
}

/**
 * 把秒数格式化为「X 分 Y 秒」/「X 秒」/「X 分钟」。
 * - < 60 秒              →  "10 秒"
 * - < 10 分钟（且有零头）→  "3 分 25 秒"（避免出现「0 分钟」）
 * - < 10 分钟（整分钟）  →  "3 分钟"
 * - ≥ 10 分钟            →  "23 分钟"（继续取整到分钟）
 */
function fmtTotal(sec: number): string {
  if (sec < 60) return `${sec} 秒`
  const min = sec / 60
  if (min < 10) {
    const m = Math.floor(min)
    const s = sec - m * 60
    return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`
  }
  return `${Math.round(min)} 分钟`
}

function metricTag(m: Metric): string {
  return m === 'weight_reps' ? '重量×次数' : m === 'reps' ? '仅次数' : m === 'time' ? '时长' : '距离'
}

function MetricInputs({ metric, s, set, unit }: { metric: Metric; s: SSet; set: (p: Partial<SSet>) => void; unit: Unit }) {
  const hasIncline = (s.incline ?? 0) > 0 || metric === 'distance' // 跑步机距离类统一显示坡度
  const hasSpeed = (s.speed ?? 0) > 0 || metric === 'distance'
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
      {(metric === 'weight_reps' || metric === 'time') && (
        <Num
          label={metric === 'time' ? `负重${unitLabel(unit)}` : `重量${unitLabel(unit)}`}
          value={s.weight}
          onChange={v => set({ weight: v })}
          toDisplay={unit === 'lb' ? (kg) => Math.round(kgToLb(kg) * 2) / 2 : undefined}
          fromDisplay={unit === 'lb' ? lbToKg : undefined}
        />
      )}
      {(metric === 'weight_reps' || metric === 'reps') && (
        <Num label="次数" value={s.reps} onChange={v => set({ reps: v })} />
      )}
      {metric === 'time' && (
        <Num label="时长秒" value={s.durationSec} onChange={v => set({ durationSec: v })} />
      )}
      {metric === 'distance' && (
        <Num label="距离km" value={s.distance} onChange={v => set({ distance: v })} />
      )}
      {hasIncline && (
        <Num label="坡度%" value={s.incline ?? 0} onChange={v => set({ incline: v })} />
      )}
      {hasSpeed && (
        <Num label="速度km/h" value={s.speed ?? 0} onChange={v => set({ speed: v })} />
      )}
      <Num label="RPE" value={s.rpe ?? 0} onChange={v => set({ rpe: v || undefined })} />
    </div>
  )
}

function Num({ label, value, onChange, toDisplay, fromDisplay }: {
  label: string; value: number; onChange: (v: number) => void;
  toDisplay?: (kg: number) => number; fromDisplay?: (display: number) => number;
}) {
  const shown = toDisplay ? toDisplay(value) : value
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="small muted">{label}</span>
      <Input
        value={shown ? String(shown) : ''}
        onChange={str => {
          const raw = Math.max(0, Number(str) || 0)
          onChange(fromDisplay ? fromDisplay(raw) : raw)
        }}
        type="number" placeholder="0" style={{ width: 64 }}
      />
    </div>
  )
}

export default function TrainPage() {
  const t = useTraining()
  const plans = useLiveQuery(() => db.plans.orderBy('updatedAt').reverse().toArray(), [], [] as Plan[])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[])
  const [gRs] = useSetting(SK.restSets, DEFAULT_REST_SETS)
  const [gRe] = useSetting(SK.restExercises, DEFAULT_REST_EXERCISES)
  const [vib] = useSetting(SK.restVibrate, true)
  const [sound] = useSetting(SK.restSound, true)
  const [unit] = useSetting(SK.unit, DEFAULT_UNIT)
  const nav = useNavigate()
  const [picker, setPicker] = useState(false)
  const [pickerValue, setPickerValue] = useState<number | null>(null)

  const startPlan = (p: Plan) => t.startPlan(p, exercises, vib, sound)
  const startFree = () => t.startFree(gRs, gRe, vib, sound)
  const addExercise = (id: number) => { t.addExercise(id, exercises); setPicker(false) }

  const finish = () => t.setPhase('done')

  const save = async () => {
    const { session, calories, note } = t
    if (!session) return
    const endAt = Date.now()
    const durationSec = Math.round((endAt - session.startedAt) / 1000)
    // 30 分钟以内的训练（含休息时间）弹放弃选项，让用户决定是否保留
    if (durationSec < 30 * 60) {
      t.setShortRun(durationSec)
      return
    }
    const doneSets = session.items.flatMap(ex => ex.sets.filter(s => s.done).map(s => ({
      exerciseId: ex.exerciseId, setNo: s.setNo, kind: s.kind,
      weight: s.weight, reps: s.reps,
      durationSec: s.durationSec, distance: s.distance,
      incline: s.incline, speed: s.speed,
      rpe: s.rpe, done: true, ts: s.doneTs ?? Date.now(),
    })))
    if (doneSets.length === 0) { Toast.show('本次没有完成任何组，已取消保存'); t.reset(); return }
    const workout = {
      planId: session.planId, name: session.name,
      startAt: session.startedAt, endAt,
      durationSec,
      calories: calories ? Number(calories) : undefined,
      calorieSource: calories ? ('manual' as const) : undefined,
      note: note.trim() || undefined, status: 'done' as const,
    }
    await db.transaction('rw', db.workouts, db.sets, async () => {
      const wid = await db.workouts.add(workout)
      await db.sets.bulkAdd(doneSets.map(r => ({ ...r, workoutId: wid })))
    })
    Toast.show('训练已保存')
    t.reset()
  }

  // ---------- 起始页 ----------
  if (t.phase === 'start') {
    return (
      <>
        <header className="nav">
          <div className="nav-left" onClick={() => t.setPhase('idle')}>返回</div>
          开始训练
        </header>
        <main className="body">
          <div className="card">
            <h3 className="card-title">从计划开始</h3>
            {plans.length === 0 ? (
              <Empty description="还没有计划，先去建一个" />
            ) : plans.map(p => (
              <div className="list-item" key={p.id} onClick={() => startPlan(p)}>
                <div className="grow">
                  <div className="name">{p.name}</div>
                  <div className="small muted">{p.items.length} 个动作</div>
                </div>
                <IconChevron size={18} />
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ width: '100%' }} onClick={startFree}>自由训练（无计划）</button>
        </main>
      </>
    )
  }

  // ---------- 完成 / 保存页 ----------
  if (t.phase === 'done') {
    const dur = t.session ? Math.round((Date.now() - t.session.startedAt) / 1000) : 0
    return (
      <>
        <header className="nav">
          <div className="nav-left" onClick={() => t.setPhase('run')}>返回</div>
          结束训练
        </header>
        <main className="body">
          <div className="card">
            <div className="stat-row">
              <div className="stat"><div className="stat-num">{fmtTotal(dur)}</div><div className="stat-label">时长</div></div>
              <div className="stat"><div className="stat-num">{t.doneCount()}</div><div className="stat-label">完成组数</div></div>
              <div className="stat"><div className="stat-num">{t.session?.items.length ?? 0}</div><div className="stat-label">动作种类</div></div>
            </div>
          </div>
          <div className="card">
            <div className="field">
              <label>热量 kcal</label>
              <Input value={t.calories} onChange={t.setCalories} type="number" placeholder="手动填写（来自手表）" />
            </div>
            <div className="field block">
              <label>备注</label>
              <TextArea value={t.note} onChange={t.setNote} placeholder="选填，如：状态不错" maxLength={100} showCount rows={2} />
            </div>
          </div>
          <button className="btn-primary" style={{ width: '100%' }} onClick={save}>保存训练</button>

          {t.shortRun !== null && (
            <div className="modal-mask" onClick={() => t.setShortRun(null)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-title">训练时长不足 30 分钟</div>
                <div className="modal-body">
                  本次训练仅 <b>{fmtTotal(t.shortRun!)}</b>（含休息时间），是否放弃？
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => t.setShortRun(null)}>继续</button>
                  <button className="btn-ghost" style={{ flex: 1, color: '#fff', background: '#e5484d', borderColor: '#e5484d' }} onClick={() => { t.setShortRun(null); t.reset() }}>放弃</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </>
    )
  }

  // ---------- 执行页 ----------
  const curEx = t.cur ? t.session!.items[t.cur.ex] : null
  const curSet = t.cur && curEx ? curEx.sets[t.cur.set] : null

  return (
    <>
      <header className="nav">
        <div className="nav-left" onClick={() => t.setConfirmAbandon(true)}>放弃</div>
        {t.session?.name}
        <div className="nav-right" onClick={finish}>结束</div>
      </header>
      <main className="body">
        {t.confirmAbandon && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div>确定放弃本次训练？已记录的内容不会保存。</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => t.setConfirmAbandon(false)}>继续</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => { t.setConfirmAbandon(false); t.reset() }}>放弃</button>
            </div>
          </div>
        )}

        {t.bgDialog && (
          <div className="modal-mask" onClick={() => t.setBgDialog(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-title">训练仍在进行</div>
              <div className="modal-body">
                是否转入后台继续训练？未主动放弃前，训练进程不会中断，可随时通过状态栏通知或顶部横幅返回。
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => t.setBgDialog(false)}>继续训练</button>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, color: '#fff', background: 'var(--brand)', borderColor: 'var(--brand)' }}
                  onClick={() => { t.setBgDialog(false); t.background(); nav('/') }}
                >后台运行</button>
              </div>
              <button
                className="btn-ghost"
                style={{ width: '100%', marginTop: 10, color: '#fff', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => { t.setBgDialog(false); t.setConfirmAbandon(true) }}
              >放弃训练</button>
            </div>
          </div>
        )}

        <div className="small muted" style={{ padding: '4px 2px 10px', display: 'flex', justifyContent: 'space-between' }}>
          <span>已完成 {t.doneCount()} / {t.allSets().length} 组</span>
          {t.session?.planId === undefined && <span className="tag gray" style={{ border: 'none' }} onClick={() => { setPickerValue(exercises[0]?.id ?? null); setPicker(true) }}>+ 加动作</span>}
        </div>

        {t.session?.items.length === 0 ? (
          <div className="card"><Empty description="还没有动作，点上方 + 加动作" /></div>
        ) : t.resting ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <RestTimer
              seconds={t.resting.seconds}
              endAt={t.resting.endAt}
              vibrate={t.session!.vib}
              sound={t.session!.sound}
              onCancel={t.advance}
              onExtend={t.extendRest}
            />
          </div>
        ) : curEx && curSet ? (
          <div className="card">
            <div className="list-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="grow">
                <div className="name">{curEx.name}</div>
                <div className="small muted">{curEx.equipment}</div>
              </div>
              <span className="tag">{metricTag(curEx.metric)}</span>
            </div>

            {curEx.sets.map((s, j) => {
              const active = j === t.cur!.set
              const isTimed = curEx.metric === 'time' || curEx.metric === 'distance'
              // time/distance 不区分热身/正式，统一显示"第 N 组"
              const tag = isTimed ? `第 ${s.setNo} 组` : (s.kind === 'warmup' ? `热身 ${s.setNo}` : `正式 ${s.setNo}`)
              if (active) {
                const hasNext = !!t.nextLoc(t.cur!.ex, t.cur!.set)
                return (
                  <div key={j} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className={'tag ' + (s.kind === 'warmup' && !isTimed ? 'gray' : '')}>{tag}</span>
                      <button className="btn-primary btn-sm" onClick={t.markDone}>
                        {hasNext ? '开始休息' : '完成训练'}
                      </button>
                    </div>
                    {s.kind !== 'warmup' && <MetricInputs metric={curEx.metric} s={s} set={p => t.updateSet(t.cur!.ex, j, p)} unit={unit} />}
                  </div>
                )
              }
              return (
                <div key={j} className="list-item" style={{ padding: '12px 0', borderTop: '1px solid var(--line)', opacity: s.done ? 1 : 0.45 }}>
                  <span className={'tag ' + (s.kind === 'warmup' && !isTimed ? 'gray' : '')}>{tag}</span>
                  <div className="grow" style={{ textAlign: 'right' }}>
                    {s.done ? (isTimed || s.kind === 'warmup' ? '已完成' : setSummary(curEx.metric, s, unit)) : '未开始'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card"><Empty description="所有组已完成 🎉" /></div>
        )}

        <Picker
          visible={picker}
          title="选个动作加进去"
          value={pickerValue != null ? [pickerValue] : undefined}
          columns={[exercises.map(e => ({ label: `${e.category} · ${e.name}`, value: e.id! }))]}
          onClose={() => setPicker(false)}
          onConfirm={(v) => { const id = v[0] as number; if (id != null) { setPickerValue(id); addExercise(id) } }}
        />
      </main>
    </>
  )
}
