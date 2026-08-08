import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Picker, Input, TextArea, Toast } from 'antd-mobile'
import { db } from '../db'
import {
  DEFAULT_REST_EXERCISES, DEFAULT_REST_SETS,
  type Exercise, type Plan, type PlanItem,
} from '../db/types'
import { SK, useSetting } from '../hooks/useSetting'

type DraftItem = PlanItem

function Stepper({ label, value, onChange, step = 1, min = 0, max = 999 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {label && <span className="small muted">{label}</span>}
      <button className="step-btn" onClick={() => set(value - step)} disabled={value <= min}>−</button>
      <span style={{ minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button className="step-btn" onClick={() => set(value + step)} disabled={value >= max}>+</button>
    </div>
  )
}

export default function PlanEditor({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [gRs] = useSetting(SK.restSets, DEFAULT_REST_SETS)
  const [gRe] = useSetting(SK.restExercises, DEFAULT_REST_EXERCISES)
  const exercises = useLiveQuery(() => db.exercises.orderBy('createdAt').toArray(), [], [] as Exercise[])
  const exMap = new Map(exercises.map(e => [e.id!, e]))

  const [name, setName] = useState(plan?.name ?? '')
  const [note, setNote] = useState(plan?.note ?? '')
  const [rs, setRs] = useState(plan?.restBetweenSets ?? DEFAULT_REST_SETS)
  const [re, setRe] = useState(plan?.restBetweenExercises ?? DEFAULT_REST_EXERCISES)
  const [items, setItems] = useState<DraftItem[]>(
    (plan?.items ?? []).map(i => ({ ...i, warmupSets: i.warmupSets ?? 0 })),
  )
  const [picker, setPicker] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // 新建计划时，休息时间默认继承全局设置
  useEffect(() => {
    if (!plan) { setRs(gRs); setRe(gRe) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gRs, gRe])

  const addItem = (id: number) => {
    const ex = exMap.get(id)
    const isTime = ex?.metric === 'time'
    const isDistance = ex?.metric === 'distance'
    const isTimed = isTime || isDistance
    setItems(prev => [...prev, {
      exerciseId: id,
      // time/distance 类动作不区分热身/正式组
      warmupSets: 0,
      targetSets: isTimed ? (isDistance ? 1 : 3) : 3,
      targetReps: isTimed ? undefined : 10,
      targetWeight: ex?.metric === 'weight_reps' || isTime ? 0 : undefined,
      targetDurationSec: isTime ? 60 : undefined,
      targetDistance: isDistance ? 1 : undefined,
      targetIncline: ex?.incline ? 5 : undefined,
      targetSpeed: ex?.speed ? 6 : undefined,
    }])
  }
  const patchItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    const n = name.trim()
    if (!n) { Toast.show('请填写计划名称'); return }
    if (items.length === 0) { Toast.show('请至少添加一个动作'); return }
    for (const it of items) {
      if (!(it.targetSets > 0)) { Toast.show('每个动作的组数必须大于 0'); return }
      const ex = exMap.get(it.exerciseId)
      if (!ex) continue
      if ((ex.metric === 'weight_reps' || ex.metric === 'reps') && !(it.targetReps && it.targetReps > 0)) {
        Toast.show(`${ex.name}：请填写目标次数`); return
      }
      if (ex.metric === 'time' && !(it.targetDurationSec && it.targetDurationSec > 0)) {
        Toast.show(`${ex.name}：请填写目标时长（秒）`); return
      }
      if (ex.metric === 'distance' && !(it.targetDistance && it.targetDistance > 0)) {
        Toast.show(`${ex.name}：请填写目标距离（km）`); return
      }
    }
    const data = {
      name: n,
      note: note.trim() || undefined,
      restBetweenSets: Math.max(15, rs || DEFAULT_REST_SETS),
      restBetweenExercises: Math.max(30, re || DEFAULT_REST_EXERCISES),
      items: items.map(it => {
        const ex = exMap.get(it.exerciseId)
        const isTime = ex?.metric === 'time'
        const isDistance = ex?.metric === 'distance'
        const isTimed = isTime || isDistance
        const out: PlanItem = {
          exerciseId: it.exerciseId,
          // time/distance 不区分热身/正式组，强制 0
          warmupSets: isTimed ? 0 : (it.warmupSets || 0),
          targetSets: it.targetSets,
          restSec: it.restSec && it.restSec > 0 ? it.restSec : undefined,
        }
        if (ex?.metric === 'weight_reps') {
          out.targetReps = it.targetReps || 0
          out.targetWeight = it.targetWeight || 0
        } else if (ex?.metric === 'reps') {
          out.targetReps = it.targetReps || 0
        } else if (ex?.metric === 'time') {
          out.targetDurationSec = it.targetDurationSec || 0
          // 平板支撑等负重计时动作支持 targetWeight
          if (it.targetWeight && it.targetWeight > 0) out.targetWeight = it.targetWeight
        } else if (ex?.metric === 'distance') {
          out.targetDistance = it.targetDistance || 0
        }
        if (ex?.incline) out.targetIncline = it.targetIncline || 0
        if (ex?.speed) out.targetSpeed = it.targetSpeed || 0
        return out
      }),
      updatedAt: Date.now(),
    }
    if (plan?.id != null) {
      await db.plans.update(plan.id, data)
      Toast.show('已保存')
    } else {
      await db.plans.add({ ...data, createdAt: Date.now() })
      Toast.show('已创建')
    }
    onClose()
  }

  const removePlan = async () => {
    if (plan?.id == null) return
    await db.plans.delete(plan.id)
    Toast.show('计划已删除')
    onClose()
  }

  return (
    <>
      <header className="nav">
        <div className="nav-left" onClick={onClose}>返回</div>
        {plan ? '编辑计划' : '新建计划'}
        <div className="nav-right" onClick={save}>保存</div>
      </header>
      <main className="body">
        <div className="card">
          <div className="field">
            <label>名称</label><Input value={name} onChange={setName} placeholder="如：推胸日" maxLength={20} />
          </div>
          <div className="field block">
            <label>备注</label>
            <TextArea value={note} onChange={setNote} placeholder="选填，如：热身 5 分钟" maxLength={100} showCount rows={2} />
          </div>
        </div>

        <h3 className="card-title" style={{ margin: '4px 2px' }}>
          本计划休息时间
          <span className="small muted" style={{ fontWeight: 400 }}>新建时继承全局设置，保存后独立</span>
        </h3>
        <div className="card">
          <div className="list-item">
            <div className="grow"><div className="name">小组间休息</div><div className="small muted">同一动作，两组之间</div></div>
            <Stepper label="" value={rs} onChange={setRs} step={15} min={15} max={600} />
          </div>
          <div className="list-item">
            <div className="grow"><div className="name">大组间休息</div><div className="small muted">换下一个动作时</div></div>
            <Stepper label="" value={re} onChange={setRe} step={30} min={30} max={900} />
          </div>
        </div>

        <h3 className="card-title" style={{ margin: '4px 2px', display: 'flex', justifyContent: 'space-between' }}>
          动作安排 <span className="small muted">{items.length} 个</span>
        </h3>
        <div className="card" style={{ paddingTop: 0 }}>
          {items.length === 0 ? (
            <div className="empty">还没有动作<br />点下方按钮从动作库添加</div>
          ) : items.map((it, idx) => {
            const ex = exMap.get(it.exerciseId)
            const isTimed = ex?.metric === 'time' || ex?.metric === 'distance'
            return (
              <div className="list-item" key={idx} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="name">{ex ? ex.name : '（动作已删除）'}</div>
                  <button className="tag gray" style={{ border: 'none' }} onClick={() => removeItem(idx)}>移除</button>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {!isTimed && <Stepper label="热身组" value={it.warmupSets} onChange={v => patchItem(idx, { warmupSets: v })} step={1} min={0} max={10} />}
                  <Stepper label={isTimed ? '组数' : '正式组'} value={it.targetSets} onChange={v => patchItem(idx, { targetSets: v })} step={1} min={1} max={20} />
                  {(ex?.metric === 'weight_reps' || ex?.metric === 'reps') && (
                    <Stepper label="次数" value={it.targetReps ?? 0} onChange={v => patchItem(idx, { targetReps: v })} step={1} min={1} max={100} />
                  )}
                  {(ex?.metric === 'weight_reps' || ex?.metric === 'time') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="small muted">{ex?.metric === 'time' ? '负重 kg' : '重量 kg'}</span>
                      <Input
                        value={it.targetWeight ? String(it.targetWeight) : ''}
                        onChange={s => patchItem(idx, { targetWeight: Number(s) || 0 })}
                        type="number" placeholder="0" style={{ width: 56 }}
                      />
                    </div>
                  )}
                  {ex?.metric === 'time' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="small muted">时长 秒</span>
                      <Input
                        value={it.targetDurationSec ? String(it.targetDurationSec) : ''}
                        onChange={s => patchItem(idx, { targetDurationSec: Number(s) || 0 })}
                        type="number" placeholder="秒" style={{ width: 72 }}
                      />
                    </div>
                  )}
                  {ex?.metric === 'distance' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="small muted">距离 km</span>
                      <Input
                        value={it.targetDistance ? String(it.targetDistance) : ''}
                        onChange={s => patchItem(idx, { targetDistance: Number(s) || 0 })}
                        type="number" placeholder="km" style={{ width: 72 }}
                      />
                    </div>
                  )}
                  {ex?.incline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="small muted">坡度 %</span>
                      <Input
                        value={it.targetIncline ? String(it.targetIncline) : ''}
                        onChange={s => patchItem(idx, { targetIncline: Number(s) || 0 })}
                        type="number" placeholder="0" style={{ width: 64 }}
                      />
                    </div>
                  )}
                  {ex?.speed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="small muted">速度 km/h</span>
                      <Input
                        value={it.targetSpeed ? String(it.targetSpeed) : ''}
                        onChange={s => patchItem(idx, { targetSpeed: Number(s) || 0 })}
                        type="number" placeholder="0" style={{ width: 72 }}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="small muted">组间休息(秒，留空用上面默认)</span>
                  <Input
                    value={it.restSec ? String(it.restSec) : ''}
                    onChange={s => patchItem(idx, { restSec: Number(s) || undefined })}
                    type="number" placeholder="默认" style={{ width: 64 }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={() => setPicker(true)}>
          + 添加动作
        </button>

        {plan?.id != null && (
          <div className="card" style={{ marginTop: 12 }}>
            {!confirmDel ? (
              <button className="btn-ghost" style={{ width: '100%', color: '#e5484d', borderColor: '#e5484d' }} onClick={() => setConfirmDel(true)}>
                删除此计划
              </button>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div className="small muted">确定删除计划「{plan.name}」？已完成的训练记录不会丢失。</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>取消</button>
                  <button className="btn-ghost" style={{ flex: 1, color: '#fff', background: '#e5484d', borderColor: '#e5484d' }} onClick={removePlan}>确认删除</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Picker
        visible={picker}
        columns={[exercises.map(e => ({ label: e.name, value: e.id! }))]}
        onClose={() => setPicker(false)}
        onConfirm={(v) => { const id = v[0] as number; if (id != null) addItem(id); setPicker(false) }}
      />
    </>
  )
}