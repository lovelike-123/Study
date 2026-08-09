import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Toast, Empty } from 'antd-mobile'
import dayjs from 'dayjs'
import { db } from '../db'
import type { Exercise, SetRecord } from '../db/types'
import { pushBackHandler } from '../utils/backStack'

type SetPatch = Partial<SetRecord> & { _deleted?: boolean }

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}分钟`
  return `${Math.floor(m / 60)}小时${m % 60}分`
}

function fmtSetRow(metric: Exercise['metric'], s: SetRecord): string {
  const parts: string[] = []
  if (metric === 'weight_reps') parts.push(`${s.weight || 0}kg × ${s.reps || 0} 次`)
  else if (metric === 'reps') parts.push(`${s.reps || 0} 次`)
  else if (metric === 'time') parts.push(`${s.durationSec || 0} 秒`)
  else if (metric === 'distance') parts.push(`${s.distance || 0} km`)
  if (s.incline != null && s.incline > 0) parts.push(`坡度 ${s.incline}%`)
  if (s.speed != null && s.speed > 0) parts.push(`${s.speed} km/h`)
  return parts.join(' · ')
}

function exerciseOf(exercises: Exercise[], id: number): Exercise | undefined {
  return exercises.find(e => e.id === id)
}

export default function WorkoutDetail() {
  const { id } = useParams()
  const wid = Number(id)
  const nav = useNavigate()
  const [editing, setEditing] = useState(false)
  // 编辑态的本地补丁：id → 局部字段（_deleted 仅是 UI 标记）
  const [patch, setPatch] = useState<Record<number, SetPatch>>({})
  const [confirmDel, setConfirmDel] = useState(false)

  const workout = useLiveQuery(() => db.workouts.get(wid), [wid])
  const sets = useLiveQuery(
    () => db.sets.where('workoutId').equals(wid).sortBy('ts'),
    [wid],
    [] as SetRecord[],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[])

  // 系统返回键：编辑态先退出编辑，删除确认先关确认
  useEffect(() => {
    if (!editing) return
    return pushBackHandler(() => { setPatch({}); setEditing(false) })
  }, [editing])
  useEffect(() => {
    if (!confirmDel) return
    return pushBackHandler(() => setConfirmDel(false))
  }, [confirmDel])

  if (!workout) {
    return (
      <>
        <header className="nav"><div className="nav-left" onClick={() => nav(-1)}>返回</div></header>
        <main className="body"><div className="card"><Empty description="记录不存在或已删除" /></div></main>
      </>
    )
  }

  // 按动作分组
  const groups = new Map<number, SetRecord[]>()
  for (const s of sets) {
    if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, [])
    groups.get(s.exerciseId)!.push(s)
  }

  const save = async () => {
    const pendingDelete = sets.filter(s => patch[s.id!]?._deleted).map(s => s.id!)
    const valueUpdates = Object.entries(patch).filter(([, p]) => !p._deleted) as [string, Partial<SetRecord>][]
    if (pendingDelete.length === 0 && valueUpdates.length === 0) { setEditing(false); return }

    await db.transaction('rw', db.sets, async () => {
      if (pendingDelete.length > 0) await db.sets.bulkDelete(pendingDelete)
      for (const [sid, p] of valueUpdates) {
        await db.sets.update(Number(sid), p)
      }
    })
    Toast.show(`已保存修改${pendingDelete.length ? ` · 删除 ${pendingDelete.length} 组` : ''}`)
    setPatch({})
    setEditing(false)
  }

  const removeSet = (sid: number) => {
    const remain = sets.length - Object.values(patch).filter(p => p._deleted).length - 1
    if (remain < 1) { Toast.show('至少保留 1 组'); return }
    setPatch(prev => ({ ...prev, [sid]: { _deleted: true } }))
  }

  const cancelEdit = () => {
    setPatch({})
    setEditing(false)
  }

  const applyPatch = (sid: number, p: Partial<SetRecord>) => {
    setPatch(prev => ({ ...prev, [sid]: { ...prev[sid], ...p } }))
  }

  const removeWorkout = async () => {
    await db.transaction('rw', db.workouts, db.sets, async () => {
      await db.sets.where('workoutId').equals(wid).delete()
      await db.workouts.delete(wid)
    })
    Toast.show('训练记录已删除')
    nav(-1)
  }

  return (
    <>
      <header className="nav">
        <div className="nav-left" onClick={() => editing ? cancelEdit() : nav(-1)}>返回</div>
        {dayjs(workout.startAt).format('M月D日 HH:mm')}
        <div className="nav-right" onClick={() => editing ? save() : setEditing(true)}>
          {editing ? '保存' : '编辑'}
        </div>
      </header>

      <main className="body">
        {/* 概览 */}
        <div className="card">
          <div className="list-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="grow">
              <div className="name">{workout.name}</div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {dayjs(workout.startAt).format('YYYY-MM-DD HH:mm')}
                {workout.endAt ? ` ~ ${dayjs(workout.endAt).format('HH:mm')}` : ''}
              </div>
            </div>
          </div>
          <div className="stat-row" style={{ marginTop: 10 }}>
            <div className="stat"><div className="stat-num">{fmtDur(workout.durationSec)}</div><div className="stat-label">时长</div></div>
            <div className="stat"><div className="stat-num">{sets.length}</div><div className="stat-label">总组数</div></div>
            <div className="stat"><div className="stat-num">{workout.calories ?? '--'}</div><div className="stat-label">热量 kcal</div></div>
          </div>
          {workout.note && (
            <div className="field block" style={{ marginTop: 10 }}>
              <label>备注</label>
              <div className="small">{workout.note}</div>
            </div>
          )}
        </div>

        {/* 动作明细 */}
        {[...groups.entries()].map(([exId, exSets]) => {
          const ex = exerciseOf(exercises, exId)
          const name = ex?.name ?? `动作#${exId}`
          const metric = ex?.metric ?? 'weight_reps'
          return (
            <div className="card" key={exId}>
              <h3 className="card-title">{name}</h3>
              {exSets.map(s => {
                const pending = patch[s.id!]
                const merged: SetRecord = pending && !(pending as any)._deleted
                  ? { ...s, ...pending }
                  : s
                if (pending && (pending as any)._deleted) {
                  return (
                    <div key={s.id} className="set-row pending-delete">
                      <span className="tag gray">第 {s.setNo} 组</span>
                      <span className="grow small muted" style={{ textAlign: 'right' }}>已标记删除</span>
                    </div>
                  )
                }
                return (
                  <div key={s.id} className="set-row">
                    <span className="tag gray">第 {s.setNo} 组</span>
                    {editing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {metric === 'weight_reps' && (
                          <>
                            <Num label="kg" v={merged.weight} onChange={x => applyPatch(s.id!, { weight: x })} />
                            <Num label="次" v={merged.reps} onChange={x => applyPatch(s.id!, { reps: x })} />
                          </>
                        )}
                        {metric === 'reps' && (
                          <Num label="次" v={merged.reps} onChange={x => applyPatch(s.id!, { reps: x })} />
                        )}
                        {metric === 'time' && (
                          <Num label="秒" v={merged.durationSec} onChange={x => applyPatch(s.id!, { durationSec: x })} />
                        )}
                        {metric === 'distance' && (
                          <Num label="km" v={merged.distance} onChange={x => applyPatch(s.id!, { distance: x })} />
                        )}
                        <Num label="RPE" v={merged.rpe ?? 0} onChange={x => applyPatch(s.id!, { rpe: x || undefined })} />
                      </div>
                    ) : (
                      <span className="grow" style={{ textAlign: 'right' }}>
                        {fmtSetRow(metric, merged)}
                        {merged.rpe ? ` · RPE ${merged.rpe}` : ''}
                      </span>
                    )}
                    {editing && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ color: '#e5484d', borderColor: '#e5484d', padding: '2px 8px', height: 28, fontSize: 12 }}
                        onClick={() => removeSet(s.id!)}
                      >删除</button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* 删除整条记录 */}
        {!editing && (
          <div className="card">
            {!confirmDel ? (
              <button className="btn-ghost" style={{ width: '100%', color: '#e5484d', borderColor: '#e5484d' }} onClick={() => setConfirmDel(true)}>
                删除整条记录
              </button>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="small muted">确定删除这条训练及其所有组？此操作不可撤销。</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>取消</button>
                  <button className="btn-ghost" style={{ flex: 1, color: '#fff', background: '#e5484d', borderColor: '#e5484d' }} onClick={removeWorkout}>确认删除</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}

function Num({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="small muted">{label}</span>
      <input
        type="number"
        value={v ? String(v) : ''}
        onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{ width: 56, height: 28, border: '1px solid var(--line)', borderRadius: 6, padding: '0 6px', fontSize: 13 }}
      />
    </span>
  )
}