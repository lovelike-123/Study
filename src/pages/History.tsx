import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Toast } from 'antd-mobile'
import dayjs from 'dayjs'
import { db } from '../db'
import { Page } from '../components/Layout'
import { dayKey } from '../utils/stats'
import { SK, useSetting, DEFAULT_UNIT, type Unit } from '../hooks/useSetting'
import { displayWeight, unitLabel } from '../utils/units'
import type { Exercise, Metric, SetRecord, Workout } from '../db/types'

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}分钟`
  return `${Math.floor(m / 60)}小时${m % 60}分`
}

function fmtDurMin(sec: number): string {
  if (sec < 60) return `${sec}秒`
  return `${Math.round(sec / 60)} 分钟`
}

/** 把一组集合并成简写：「60kg × 10」/「20 次」/「30 秒」/「5 km」（按设置单位展示重量） */
function fmtSet(metric: Metric, s: SetRecord, unit: Unit): string {
  if (metric === 'weight_reps') return `${displayWeight(s.weight || 0, unit)}${unitLabel(unit)} × ${s.reps || 0}`
  if (metric === 'reps') return `${s.reps || 0} 次`
  if (metric === 'time') return `${s.durationSec || 0} 秒`
  if (metric === 'distance') return `${s.distance || 0} km`
  return ''
}

/** 把同一动作的多组合并成简写（按设置单位展示重量） */
function summarize(ex: Exercise | undefined, sets: SetRecord[], unit: Unit): string {
  const metric: Metric = ex?.metric ?? 'weight_reps'
  if (sets.length === 0) return ''
  if (metric === 'time') {
    const sec = sets.reduce((s, x) => s + (x.durationSec || 0), 0)
    const parts: string[] = [`${sets.length} 组 × ${fmtDurMin(sec)}`]
    const w = Math.max(...sets.map(x => x.weight || 0))
    if (w > 0) parts.unshift(`负重 ${displayWeight(w, unit)}${unitLabel(unit)}`)
    return parts.join(' · ')
  }
  if (metric === 'distance') {
    const km = sets.reduce((s, x) => s + (x.distance || 0), 0)
    const parts: string[] = [`${km.toFixed(1)} km · ${sets.length} 组`]
    // 跑步机：附加坡度/速度（取第一组为代表）
    const first = sets[0]
    if (first.incline != null && first.incline > 0) parts.unshift(`坡度 ${first.incline}%`)
    if (first.speed != null && first.speed > 0) parts.push(`速度 ${first.speed} km/h`)
    return parts.join(' · ')
  }
  // 重量×次数 / 仅次数：取第一组作为代表（一般实际训练每组相同目标）
  const first = sets[0]
  return `${fmtSet(metric, first, unit)} · ${sets.length} 组`
}

export default function History() {
  const [cursor, setCursor] = useState(dayjs().startOf('month'))
  const [selected, setSelected] = useState(dayjs().format('YYYY-MM-DD'))
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null)
  const [unit] = useSetting(SK.unit, DEFAULT_UNIT)
  const cursorKey = cursor.format('YYYY-MM')

  const monthWorkouts = useLiveQuery(
    async () => {
      const start = cursor.startOf('month').valueOf()
      const end = cursor.endOf('month').valueOf()
      return db.workouts
        .where('startAt').between(start, end, true, true)
        .reverse()
        .sortBy('startAt')
    },
    [cursorKey],
    [] as Workout[],
  )

  const trainedDates = new Set(monthWorkouts.map(w => dayKey(w.startAt)))
  const selectedWorkouts = monthWorkouts
    .filter(w => dayKey(w.startAt) === selected)
    .sort((a, b) => b.startAt - a.startAt)

  // 月历网格
  const daysInMonth = cursor.daysInMonth()
  const firstDay = cursor.startOf('month')
  const leading = firstDay.day() // 0=Sun
  const cells: (dayjs.Dayjs | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => firstDay.add(i, 'day')),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const goPrev = () => setCursor(cursor.subtract(1, 'month'))
  const goNext = () => setCursor(cursor.add(1, 'month'))
  const goToday = () => {
    const t = dayjs()
    setCursor(t.startOf('month'))
    setSelected(t.format('YYYY-MM-DD'))
  }

  const totalSets = useLiveQuery(async () => {
    const start = cursor.startOf('month').valueOf()
    const end = cursor.endOf('month').valueOf()
    const ws = await db.workouts.where('startAt').between(start, end, true, true).toArray()
    if (ws.length === 0) return { workouts: 0, sets: 0 }
    const ids = ws.map(w => w.id!).filter(Boolean)
    const sets = await db.sets.where('workoutId').anyOf(ids).count()
    return { workouts: ws.length, sets }
  }, [cursorKey], { workouts: 0, sets: 0 })

  // 展开动作需要的数据
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[])
  const expandedSets = useLiveQuery(
    () => expandedId == null
      ? Promise.resolve([] as SetRecord[])
      : db.sets.where('workoutId').equals(expandedId).sortBy('ts'),
    [expandedId],
    [] as SetRecord[],
  )

  const exMap = new Map(exercises.map(e => [e.id!, e]))

  const removeWorkout = async (wid: number) => {
    await db.transaction('rw', db.workouts, db.sets, async () => {
      await db.sets.where('workoutId').equals(wid).delete()
      await db.workouts.delete(wid)
    })
    Toast.show('训练记录已删除')
    setConfirmDelId(null)
    if (expandedId === wid) setExpandedId(null)
  }

  return (
    <Page title="历史">
      {/* 月历 */}
      <div className="card compact">
        <div className="cal-head">
          <button className="cal-nav" onClick={goPrev}>‹</button>
          <div className="cal-title">
            {cursor.format('YYYY年M月')}
            <span className="small muted" style={{ fontWeight: 400, marginLeft: 8 }} onClick={goToday}>回到今天</span>
          </div>
          <button className="cal-nav" onClick={goNext}>›</button>
        </div>

        <div className="cal-week">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
        </div>

        <div className="cal-grid">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-cell empty" />
            const k = d.format('YYYY-MM-DD')
            const isSel = k === selected
            const trained = trainedDates.has(k)
            const isToday = k === dayjs().format('YYYY-MM-DD')
            const inFuture = d.isAfter(dayjs(), 'day')
            return (
              <div
                key={i}
                className={
                  'cal-cell' +
                  (isSel ? ' sel' : '') +
                  (isToday ? ' today' : '') +
                  (trained ? ' trained' : '') +
                  (inFuture ? ' future' : '')
                }
                onClick={() => !inFuture && setSelected(k)}
              >
                <span className="cal-day-num">{d.date()}</span>
                {trained && <span className="cal-dot" />}
              </div>
            )
          })}
        </div>

        <div className="small muted" style={{ marginTop: 8, textAlign: 'center' }}>
          本月 {totalSets.workouts} 次训练 · {totalSets.sets} 组
        </div>
      </div>

      {/* 选中日期的训练列表 */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 className="card-title">
          {dayjs(selected).format('M月D日')}
          <span className="small muted" style={{ fontWeight: 400 }}>
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(selected).day()]}
          </span>
        </h3>

        {selectedWorkouts.length === 0 ? (
          <div className="empty small muted" style={{ padding: '24px 0' }}>该日无训练记录</div>
        ) : selectedWorkouts.map(w => {
          const open = expandedId === w.id
          return (
            <div key={w.id} className={'hi-row' + (open ? ' open' : '')}>
              <div className="list-item" onClick={() => setExpandedId(open ? null : w.id!)}>
                <div className="grow">
                  <div className="name">{w.name}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {dayjs(w.startAt).format('HH:mm')} · {fmtDur(w.durationSec)}
                    {w.calories ? ` · ${w.calories} kcal` : ''}
                  </div>
                </div>
                <span className={'chev' + (open ? ' down' : '')}>›</span>
              </div>

              {open && (
                <div className="hi-body">
                  {/* 动作摘要（按动作分组，只统计正式组） */}
                  {(() => {
                    const groups = new Map<number, SetRecord[]>()
                    for (const s of expandedSets) {
                      // 兜底：历史数据可能没有 kind 字段，按正式组处理
                      if (s.kind === 'warmup') continue
                      if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, [])
                      groups.get(s.exerciseId)!.push(s)
                    }
                    if (groups.size === 0) {
                      return <div className="small muted" style={{ padding: '6px 0' }}>该训练暂无正式组记录</div>
                    }
                    return [...groups.entries()].map(([exId, exSets]) => {
                      const ex = exMap.get(exId)
                      const name = ex?.name ?? `动作#${exId}`
                      return (
                        <div key={exId} className="ex-line">
                          <span className="name">{name}</span>
                          <span className="ex-summary">{summarize(ex, exSets, unit)}</span>
                        </div>
                      )
                    })
                  })()}

                  {w.note && (
                    <div className="small hi-note">
                      备注：{w.note}
                    </div>
                  )}

                  {/* 动作概要统计 */}
                  <div className="hi-foot small muted">
                    共 {expandedSets.filter(s => s.kind !== 'warmup').length} 个正式组
                    {expandedSets.some(s => s.kind === 'warmup') && (
                      <> · 热身 {expandedSets.filter(s => s.kind === 'warmup').length} 组不计</>
                    )}
                    {w.calories ? ` · ${w.calories} kcal` : ''}
                  </div>

                  {/* 删除 */}
                  <div className="hi-actions">
                    {confirmDelId === w.id ? (
                      <>
                        <span className="small muted">确定删除？</span>
                        <button className="btn-ghost hi-btn" onClick={() => setConfirmDelId(null)}>取消</button>
                        <button className="btn-ghost hi-btn danger" onClick={() => removeWorkout(w.id!)}>删除</button>
                      </>
                    ) : (
                      <button className="btn-ghost hi-btn danger" onClick={() => setConfirmDelId(w.id!)}>删除记录</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Page>
  )
}