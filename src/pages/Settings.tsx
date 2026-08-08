import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Toast } from 'antd-mobile'
import dayjs from 'dayjs'
import { db } from '../db'
import {
  DEFAULT_REST_EXERCISES, DEFAULT_REST_SETS,
  type Exercise, type Plan, type SetRecord, type Workout,
} from '../db/types'
import { DEFAULT_UNIT, DEFAULT_WEEK_GOAL, SK, useSetting } from '../hooks/useSetting'
import { Page } from '../components/Layout'
import RestTimer from '../components/RestTimer'
import { canVibrate, notifyRestEnd } from '../utils/feedback'

const SETTINGS_VERSION = 1
const REST_PRESETS = [30, 60, 90, 120, 180]
const WEEK_GOAL_MIN = 2
const WEEK_GOAL_MAX = 7

interface ExportPayload {
  version: number
  exportedAt: number
  exercises: Exercise[]
  plans: Plan[]
  workouts: Workout[]
  sets: SetRecord[]
  settings: { key: string; value: unknown }[]
}

export default function Settings() {
  const nav = useNavigate()
  const [restSets, setRestSets] = useSetting(SK.restSets, DEFAULT_REST_SETS)
  const [restEx, setRestEx] = useSetting(SK.restExercises, DEFAULT_REST_EXERCISES)
  const [vib, setVib] = useSetting(SK.restVibrate, true)
  const [sound, setSound] = useSetting(SK.restSound, true)
  const [unit, setUnit] = useSetting(SK.unit, DEFAULT_UNIT)
  const [weekGoal, setWeekGoal] = useSetting(SK.weekGoal, DEFAULT_WEEK_GOAL)

  // 数据统计（用于导出预览/清空说明）
  const counts = useLiveQuery(async () => ({
    exercises: await db.exercises.count(),
    plans: await db.plans.count(),
    workouts: await db.workouts.count(),
    sets: await db.sets.count(),
  }), [], { exercises: 0, plans: 0, workouts: 0, sets: 0 })

  // 导入/导出/清空
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmImport, setConfirmImport] = useState<ExportPayload | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wipeText, setWipeText] = useState('')
  const [demo, setDemo] = useState<number | null>(null)

  const exportData = async () => {
    const payload: ExportPayload = {
      version: SETTINGS_VERSION,
      exportedAt: Date.now(),
      exercises: await db.exercises.toArray(),
      plans: await db.plans.toArray(),
      workouts: await db.workouts.toArray(),
      sets: await db.sets.toArray(),
      settings: await db.settings.toArray(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitlog-${dayjs().format('YYYY-MM-DD-HHmm')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    Toast.show('已导出')
  }

  const pickImport = () => fileRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 重置以便选同一文件也能触发
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!isExportPayload(data)) throw new Error('文件格式不合法')
      setConfirmImport(data)
    } catch (err) {
      Toast.show('导入失败：' + (err as Error).message)
    }
  }

  const doImport = async () => {
    if (!confirmImport) return
    setConfirmImport(null)
    try {
      await db.transaction('rw', db.exercises, db.plans, db.workouts, db.sets, db.settings, async () => {
        await db.exercises.clear()
        await db.plans.clear()
        await db.workouts.clear()
        await db.sets.clear()
        await db.settings.clear()
        if (confirmImport.exercises.length) await db.exercises.bulkAdd(confirmImport.exercises)
        if (confirmImport.plans.length) await db.plans.bulkAdd(confirmImport.plans)
        if (confirmImport.workouts.length) await db.workouts.bulkAdd(confirmImport.workouts)
        if (confirmImport.sets.length) await db.sets.bulkAdd(confirmImport.sets)
        if (confirmImport.settings.length) await db.settings.bulkPut(confirmImport.settings)
      })
      Toast.show('导入完成')
      nav('/')
    } catch (err) {
      Toast.show('导入出错：' + (err as Error).message)
    }
  }

  const doWipe = async () => {
    await db.transaction('rw', db.exercises, db.plans, db.workouts, db.sets, db.settings, async () => {
      await db.workouts.clear()
      await db.sets.clear()
      await db.plans.clear()
      await db.exercises.filter(e => e.isCustom).delete()
      // 重置关键设置为默认值
      await db.settings.put({ key: SK.restSets, value: DEFAULT_REST_SETS })
      await db.settings.put({ key: SK.restExercises, value: DEFAULT_REST_EXERCISES })
      await db.settings.put({ key: SK.restVibrate, value: true })
      await db.settings.put({ key: SK.restSound, value: true })
      await db.settings.put({ key: SK.weekGoal, value: DEFAULT_WEEK_GOAL })
      await db.settings.put({ key: SK.unit, value: DEFAULT_UNIT })
    })
    Toast.show('数据已清空')
    setConfirmWipe(false)
    setWipeText('')
    nav('/')
  }

  return (
    <>
      <Page title="设置">
        {/* 训练默认值 */}
        <div className="card">
          <h3 className="card-title">
            训练默认值
            <span className="small muted" style={{ fontWeight: 400 }}>新建计划时从这里继承</span>
          </h3>
          <div className="set-row">
            <span className="grow">小组间休息</span>
            <span className="small muted">{restSets}秒</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6 }}>
            {REST_PRESETS.map(s => (
              <button key={s} className={'chip' + (restSets === s ? ' on' : '')} onClick={() => setRestSets(s)}>{s}s</button>
            ))}
          </div>

          <div className="set-row" style={{ marginTop: 12 }}>
            <span className="grow">大组间休息</span>
            <span className="small muted">{restEx}秒</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6 }}>
            {[120, 180, 240, 300].map(s => (
              <button key={s} className={'chip' + (restEx === s ? ' on' : '')} onClick={() => setRestEx(s)}>{s}s</button>
            ))}
          </div>
        </div>

        {/* 提示 */}
        <div className="card">
          <h3 className="card-title">休息提示</h3>
          <div className="set-row">
            <span className="grow">震动</span>
            <Switch on={vib} onChange={setVib} />
          </div>
          <div className="set-row">
            <span className="grow">提示音</span>
            <Switch on={sound} onChange={setSound} />
          </div>
          <div className="small muted" style={{ paddingTop: 4 }}>
            {canVibrate() ? '本设备支持震动' : '当前浏览器不支持震动，装成 App 后生效'}；提示音在桌面仍可听到。
          </div>

          {demo === null ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => notifyRestEnd({ vibrate: vib, sound: sound })}>
                测试提示
              </button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setDemo(5)}>试跑 5 秒倒计时</button>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <RestTimer seconds={demo} label="演示" onDone={() => setDemo(null)} onCancel={() => setDemo(null)} />
            </div>
          )}
        </div>

        {/* 训练目标 */}
        <div className="card">
          <h3 className="card-title">训练目标</h3>
          <div className="set-row">
            <span className="grow">每周训练天数</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn-step" onClick={() => setWeekGoal(Math.max(WEEK_GOAL_MIN, weekGoal - 1))}>−</button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{weekGoal}</span>
              <button className="btn-step" onClick={() => setWeekGoal(Math.min(WEEK_GOAL_MAX, weekGoal + 1))}>+</button>
            </div>
          </div>
        </div>

        {/* 单位（暂留入口，未接通全部 UI） */}
        <div className="card">
          <h3 className="card-title">单位</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={'chip' + (unit === 'kg' ? ' on' : '')} onClick={() => setUnit('kg')}>公斤 kg</button>
            <button className={'chip' + (unit === 'lb' ? ' on' : '')} onClick={() => setUnit('lb')}>磅 lb</button>
          </div>
          <div className="small muted" style={{ paddingTop: 8 }}>
            当前选择：<b>{unit === 'kg' ? '公斤' : '磅'}</b>。
            当前已记住偏好，训练录入与历史显示的换算会在后续版本接通——
            现在所有数字仍按 kg 原值展示。
          </div>
        </div>

        {/* 数据备份 */}
        <div className="card">
          <h3 className="card-title">数据备份</h3>
          <div className="small muted" style={{ paddingBottom: 10 }}>
            当前 {counts.exercises} 动作 · {counts.plans} 计划 · {counts.workouts} 训练 · {counts.sets} 组
          </div>
          <button className="btn-ghost" style={{ width: '100%' }} onClick={exportData}>导出全部数据（JSON）</button>
          <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={pickImport}>从 JSON 导入</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFileChange} />
          <div className="small muted" style={{ paddingTop: 8 }}>
            导入将覆盖现有数据，建议先导出当前数据备份。
          </div>
        </div>

        {/* 清空数据 */}
        <div className="card">
          <h3 className="card-title" style={{ color: '#e5484d' }}>危险操作</h3>
          {!confirmWipe ? (
            <>
              <div className="small muted" style={{ paddingBottom: 10 }}>
                将删除：全部训练记录 · 全部计划 · 自定义动作。<br />
                将保留：内置种子动作 · 设置默认值。
              </div>
              <button
                className="btn-ghost"
                style={{ width: '100%', color: '#e5484d', borderColor: '#e5484d' }}
                onClick={() => setConfirmWipe(true)}
              >清空数据</button>
            </>
          ) : (
            <div>
              <div className="small" style={{ marginBottom: 8 }}>
                输入<b>「删除」</b>二字以确认：
              </div>
              <input
                type="text"
                value={wipeText}
                onChange={e => setWipeText(e.target.value)}
                placeholder="请输入：删除"
                style={{ width: '100%', height: 36, border: '1px solid var(--line)', borderRadius: 8, padding: '0 10px', fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setConfirmWipe(false); setWipeText('') }}>取消</button>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, color: '#fff', background: wipeText === '删除' ? '#e5484d' : '#fca5a5', borderColor: '#e5484d', cursor: wipeText === '删除' ? 'pointer' : 'not-allowed' }}
                  disabled={wipeText !== '删除'}
                  onClick={doWipe}
                >确认清空</button>
              </div>
            </div>
          )}
        </div>
      </Page>

      {/* 导入确认弹窗 */}
      {confirmImport && (
        <div className="modal-mask" onClick={() => setConfirmImport(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-title">确认导入？</div>
            <div className="modal-body" style={{ textAlign: 'left' }}>
              文件版本：v{confirmImport.version}<br />
              导出时间：{dayjs(confirmImport.exportedAt).format('YYYY-MM-DD HH:mm')}<br />
              含 {confirmImport.exercises.length} 动作 · {confirmImport.plans.length} 计划 ·
              {confirmImport.workouts.length} 训练 · {confirmImport.sets.length} 组
              <br /><br />
              <b style={{ color: '#e5484d' }}>将覆盖现有全部数据，且不可撤销。</b>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmImport(null)}>取消</button>
              <button className="btn-ghost" style={{ flex: 1, color: '#fff', background: '#e5484d', borderColor: '#e5484d' }} onClick={doImport}>确认导入</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? 'var(--brand)' : '#e3e5e9',
        border: 'none', position: 'relative', transition: 'background .18s',
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left .18s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

function isExportPayload(d: unknown): d is ExportPayload {
  if (!d || typeof d !== 'object') return false
  const x = d as any
  return x.version === SETTINGS_VERSION
    && Array.isArray(x.exercises)
    && Array.isArray(x.plans)
    && Array.isArray(x.workouts)
    && Array.isArray(x.sets)
    && Array.isArray(x.settings)
    && typeof x.exportedAt === 'number'
}