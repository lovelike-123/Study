import { useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { db } from '../db'
import { Page } from '../components/Layout'
import { avgPerWeek, heatmapGrid, streaks, trainedDays, weeklyStats, type WeekStat } from '../utils/stats'
import { SK, useSetting, DEFAULT_UNIT, DEFAULT_THEME, type Unit } from '../hooks/useSetting'
import { displayWeight, unitLabel, LB_PER_KG } from '../utils/units'
import { resolveTheme } from '../theme'
import type { Exercise, Metric, SetRecord, Workout } from '../db/types'

dayjs.extend(isoWeek)
echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, MarkLineComponent, LegendComponent, CanvasRenderer])

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const BRAND = '#19c18d'
const BRAND_2 = '#0fb27e'
const CATEGORY_COLORS: Record<string, string> = {
  '胸': '#19c18d', '背': '#3b82f6', '腿': '#f59e0b',
  '肩': '#a855f7', '手臂': '#ec4899', '核心': '#10b981',
  '臀': '#06b6d4', '有氧': '#ef4444', '前臂': '#f97316', '其他': '#9ca3af',
}

/** 单动作最佳成绩展示值（按设置单位换算重量） */
function prVal(metric: Metric, set: SetRecord, unit: Unit): string {
  if (metric === 'weight_reps') return `${displayWeight(set.weight || 0, unit)}${unitLabel(unit)} × ${set.reps || 0}`
  if (metric === 'reps') return `${set.reps || 0} 次`
  if (metric === 'time') return `${set.durationSec || 0} 秒`
  return `${set.distance || 0} km`
}

export default function Stats() {
  const workouts = useLiveQuery(() => db.workouts.toArray(), [], [] as Workout[])
  const sets = useLiveQuery(() => db.sets.toArray(), [], [] as SetRecord[])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[])
  const [unit] = useSetting(SK.unit, DEFAULT_UNIT)
  const [theme] = useSetting(SK.theme, DEFAULT_THEME)
  const dark = resolveTheme(theme) === 'dark'

  // 基础指标（P2 已有）
  const days = trainedDays(workouts)
  const weeks = weeklyStats(workouts, 8)
  const avg = avgPerWeek(weeks)
  const { current, best } = streaks(days)
  const grid = heatmapGrid(days, 12)

  // 容量 / 部位 / PR 计算
  const computed = useMemo(() => {
    const exMap = new Map(exercises.map(e => [e.id!, e]))
    const wMap = new Map(workouts.map(w => [w.id!, w]))

    // 12 周容量桶（按 ISO 周）
    const now = dayjs()
    const volBuckets = Array.from({ length: 12 }, (_, i) => {
      const start = now.startOf('isoWeek').subtract(11 - i, 'week')
      return {
        label: i === 11 ? '本周' : start.format('M/D'),
        start: start.valueOf(),
        end: start.add(7, 'day').valueOf(),
        volume: 0,
      }
    })

    // 部位占比（近 90 天）
    const since90 = now.subtract(90, 'day').valueOf()
    const catMap = new Map<string, number>()

    // PR：每个 exerciseId 的最佳一组
    const prMap = new Map<number, SetRecord>()

    for (const s of sets) {
      const kind = (s as any).kind ?? 'work'
      if (kind === 'warmup') continue
      const ex = exMap.get(s.exerciseId)
      if (!ex) continue
      const w = wMap.get(s.workoutId)

      if (ex.metric === 'weight_reps') {
        const v = (s.weight || 0) * (s.reps || 0)
        if (v > 0 && w) {
          // 容量
          const b = volBuckets.find(b => w.startAt >= b.start && w.startAt < b.end)
          if (b) b.volume += v
          // 部位
          if (w.startAt >= since90) {
            catMap.set(ex.category, (catMap.get(ex.category) || 0) + v)
          }
          // PR：选 v 最大
          const cur = prMap.get(s.exerciseId)
          if (!cur || v > (cur.weight || 0) * (cur.reps || 0)) prMap.set(s.exerciseId, s)
        }
      } else if (ex.metric === 'time' || ex.metric === 'distance' || ex.metric === 'reps') {
        // 不计入容量，但参与 PR
        const score = ex.metric === 'time' ? (s.durationSec || 0)
          : ex.metric === 'distance' ? (s.distance || 0)
          : (s.reps || 0)
        if (score > 0) {
          const cur = prMap.get(s.exerciseId)
          if (!cur) prMap.set(s.exerciseId, s)
          else {
            const curScore = ex.metric === 'time' ? (cur.durationSec || 0)
              : ex.metric === 'distance' ? (cur.distance || 0)
              : (cur.reps || 0)
            if (score > curScore) prMap.set(s.exerciseId, s)
          }
        }
      }
    }

    const prs = [...prMap.entries()]
      .map(([id, s]) => ({ ex: exMap.get(id), set: s }))
      .filter(x => x.ex)
      .map(({ ex, set }) => ({ name: ex!.name, category: ex!.category, metric: ex!.metric as Metric, set }))
      .sort((a, b) => {
        const order = ['胸', '背', '腿', '肩', '手臂', '核心', '臀', '有氧', '前臂', '其他']
        return order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name)
      })
      .slice(0, 10)

    const cats = [...catMap.entries()]
      .map(([cat, vol]) => ({ name: cat, value: vol, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS['其他'] }))
      .sort((a, b) => b.value - a.value)

    return { volBuckets, cats, prs }
  }, [workouts, sets, exercises])

  return (
    <Page title="统计">
      {/* 频率概览（P2） */}
      <div className="card">
        <h3 className="card-title">训练频率</h3>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-num">{avg || '--'}</div>
            <div className="stat-label">平均一周几练</div>
          </div>
          <div className="stat">
            <div className="stat-num">{current}</div>
            <div className="stat-label">连续打卡 天</div>
          </div>
          <div className="stat">
            <div className="stat-num">{best}</div>
            <div className="stat-label">最长连续 天</div>
          </div>
        </div>
      </div>

      {/* 每周训练天数（P2） */}
      <div className="card">
        <h3 className="card-title">
          每周训练天数
          <span className="small muted" style={{ fontWeight: 400 }}>近 8 周</span>
        </h3>
        <WeeklyBar data={weeks} avg={avg} dark={dark} />
      </div>

      {/* 训练容量趋势（P5 新增） */}
      <div className="card">
        <h3 className="card-title">
          训练容量趋势
          <span className="small muted" style={{ fontWeight: 400 }}>近 12 周 · 单位 {unitLabel(unit)}·次</span>
        </h3>
        <VolumeBar buckets={computed.volBuckets.map(b => ({ ...b, volume: unit === 'lb' ? b.volume / LB_PER_KG : b.volume }))} unit={unit} dark={dark} />
      </div>

      {/* 部位占比（P5 新增） */}
      <div className="card">
        <h3 className="card-title">
          部位容量占比
          <span className="small muted" style={{ fontWeight: 400 }}>近 90 天 · 仅含重量×次数</span>
        </h3>
        <CategoryPie data={computed.cats} unit={unit} dark={dark} />
      </div>

      {/* 单动作 PR（P5 新增） */}
      <div className="card">
        <h3 className="card-title">
          单动作最佳成绩
          <span className="small muted" style={{ fontWeight: 400 }}>前 10 · 仅含正式组</span>
        </h3>
        {computed.prs.length === 0 ? (
          <div className="empty small muted" style={{ padding: '16px 0' }}>暂无正式组记录</div>
        ) : (
          <div className="pr-list">
            {computed.prs.map((p) => (
              <div key={p.name} className="pr-row">
                <span className="tag" style={{ background: CATEGORY_COLORS[p.category] || CATEGORY_COLORS['其他'], color: '#fff', border: 'none' }}>{p.category}</span>
                <span className="pr-name">{p.name}</span>
                <span className="pr-val">{prVal(p.metric, p.set, unit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 每日打卡热力图（P2） */}
      <div className="card">
        <h3 className="card-title">
          每日打卡
          <span className="small muted" style={{ fontWeight: 400 }}>近 12 周</span>
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 4, paddingTop: 1 }}>
            {WEEKDAYS.map(d => (
              <div key={d} className="small muted" style={{ height: 16, lineHeight: '16px', fontSize: 10 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
            {grid.map((col, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 4, flex: 1, minWidth: 16 }}>
                {col.map(c => (
                  <div
                    key={c.date}
                    title={c.date + (c.trained ? ' · 已训练' : '')}
                    style={{
                      height: 16, borderRadius: 4,
                      background: c.inFuture ? 'transparent' : c.trained ? 'var(--brand)' : (dark ? '#1c212b' : '#eceef1'),
                      border: c.isToday ? '1.5px solid var(--brand)' : '1.5px solid transparent',
                      opacity: c.inFuture ? 0.35 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <span className="small muted">未练</span>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: dark ? '#1c212b' : '#eceef1' }} />
          <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--brand)' }} />
          <span className="small muted">已练</span>
        </div>
      </div>
    </Page>
  )
}

// ===== WeeklyBar（P2） =====
function WeeklyBar({ data, avg, dark }: { data: WeekStat[]; avg: number; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    if (!data.some(d => d.days > 0)) return  // 没数据时不挂图表，避免一片空白坐标轴
    const axisLine = dark ? '#3a4150' : '#e3e5e9'
    const label = dark ? '#8b93a1' : '#9ca3af'
    const split = dark ? '#232833' : '#f1f2f4'
    const chart = echarts.init(ref.current)
    chart.setOption({
      grid: { left: 26, right: 8, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>训练 ${p[0].value} 天` },
      xAxis: {
        type: 'category',
        data: data.map(d => d.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: axisLine } },
        axisLabel: { color: label, fontSize: 10 },
      },
      yAxis: {
        type: 'value', max: 7, interval: 1, minInterval: 1,
        axisLabel: { color: label, fontSize: 10 },
        splitLine: { lineStyle: { color: split } },
      },
      series: [{
        type: 'bar',
        data: data.map(d => d.days),
        barMaxWidth: 20,
        itemStyle: { color: BRAND, borderRadius: [4, 4, 0, 0] },
        markLine: avg > 0 ? {
          silent: true, symbol: 'none',
          lineStyle: { color: label, type: 'dashed', width: 1 },
          label: { formatter: `均 ${avg}`, fontSize: 10, color: label },
          data: [{ yAxis: avg }],
        } : undefined,
      }],
    })
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.dispose() }
  }, [data, avg])
  if (!data.some(d => d.days > 0)) {
    return <div className="empty small muted" style={{ padding: '16px 0' }}>暂无训练数据，开始训练后这里会长出柱子</div>
  }
  return <div ref={ref} style={{ width: '100%', height: 168 }} />
}

// ===== VolumeBar（P5 新增） =====
function VolumeBar({ buckets, unit, dark }: { buckets: { label: string; volume: number }[]; unit: Unit; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const axisLine = dark ? '#3a4150' : '#e3e5e9'
    const label = dark ? '#8b93a1' : '#9ca3af'
    const split = dark ? '#232833' : '#f1f2f4'
    const areaTop = dark ? '#1f8f6a' : '#34d8ae'
    const chart = echarts.init(ref.current)
    chart.setOption({
      grid: { left: 38, right: 8, top: 16, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        formatter: (p: any) => `${p[0].name}<br/>${(p[0].value || 0).toLocaleString()} ${unitLabel(unit)}·次`,
      },
      xAxis: {
        type: 'category',
        data: buckets.map(b => b.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: axisLine } },
        axisLabel: { color: label, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: label, fontSize: 10,
          formatter: (v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v),
        },
        splitLine: { lineStyle: { color: split } },
      },
      series: [{
        type: 'bar',
        data: buckets.map(b => b.volume),
        barMaxWidth: 18,
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: areaTop },
            { offset: 1, color: BRAND_2 },
          ] },
          borderRadius: [4, 4, 0, 0],
        },
      }],
    })
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.dispose() }
  }, [buckets])
  if (!buckets.some(b => b.volume > 0)) {
    return <div className="empty small muted" style={{ padding: '16px 0' }}>暂无容量数据</div>
  }
  return <div ref={ref} style={{ width: '100%', height: 168 }} />
}

// ===== CategoryPie（P5 新增） =====
function CategoryPie({ data, unit, dark }: { data: { name: string; value: number; color: string }[]; unit: Unit; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const label = dark ? '#8b93a1' : '#9ca3af'
    const sliceBorder = dark ? '#171b22' : '#fff'
    const chart = echarts.init(ref.current)
    chart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/>${p.value.toLocaleString()} ${unitLabel(unit)}·次 (${p.percent}%)`,
      },
      legend: {
        bottom: 0, left: 'center',
        textStyle: { fontSize: 11, color: label },
        itemWidth: 10, itemHeight: 10, itemGap: 8,
      },
      series: [{
        type: 'pie',
        radius: ['38%', '60%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: sliceBorder, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: data.map(d => ({ ...d, itemStyle: { color: d.color } })),
      }],
    })
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.dispose() }
  }, [data])
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return <div className="empty small muted" style={{ padding: '16px 0' }}>近 90 天暂无容量数据</div>
  }
  return <div ref={ref} style={{ width: '100%', height: 220 }} />
}