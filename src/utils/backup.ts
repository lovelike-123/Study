import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import dayjs from 'dayjs'
import { db } from '../db'
import { METRIC_LABEL, type Exercise, type Plan, type SetRecord, type Workout } from '../db/types'

export const BACKUP_VERSION = 1

export interface ExportPayload {
  version: number
  exportedAt: number
  exercises: Exercise[]
  plans: Plan[]
  workouts: Workout[]
  sets: SetRecord[]
  settings: { key: string; value: unknown }[]
}

export function isExportPayload(d: unknown): d is ExportPayload {
  if (!d || typeof d !== 'object') return false
  const x = d as any
  return x.version === BACKUP_VERSION
    && Array.isArray(x.exercises)
    && Array.isArray(x.plans)
    && Array.isArray(x.workouts)
    && Array.isArray(x.sets)
    && Array.isArray(x.settings)
    && typeof x.exportedAt === 'number'
}

/** 从数据库采集完整备份数据 */
async function collectPayload(): Promise<ExportPayload> {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    plans: await db.plans.toArray(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
    settings: await db.settings.toArray(),
  }
}

/**
 * 把备份数据渲染成人类可读的 txt。
 * 末尾内嵌一份可程序解析的 JSON（用标记包裹），保证导出的 txt 既能给人看，也能再次导入。
 */
export function toBackupText(p: ExportPayload): string {
  const L: string[] = []
  L.push('========================================')
  L.push('           FitLog 数据备份')
  L.push('========================================')
  L.push(`导出版本：v${p.version}`)
  L.push(`导出时间：${dayjs(p.exportedAt).format('YYYY-MM-DD HH:mm:ss')}`)
  L.push('')
  L.push('---- 概览 ----')
  L.push(`动作库：${p.exercises.length} 个`)
  L.push(`训练计划：${p.plans.length} 个`)
  L.push(`训练记录：${p.workouts.length} 条`)
  L.push(`训练组：${p.sets.length} 组`)
  L.push(`设置项：${p.settings.length} 项`)
  L.push('')
  L.push('---- 设置 ----')
  for (const s of p.settings) L.push(`${s.key} = ${JSON.stringify(s.value)}`)
  L.push('')
  L.push('---- 动作库 (exercises) ----')
  for (const e of p.exercises) {
    const parts = [`[${e.id}] ${e.name}`, e.category, e.equipment, METRIC_LABEL[e.metric], e.isCustom ? '自定义' : '系统']
    if (e.incline) parts.push('坡度')
    if (e.speed) parts.push('速度')
    if (e.note) parts.push(`备注:${e.note}`)
    L.push(parts.join(' | '))
  }
  L.push('')
  L.push('---- 训练计划 (plans) ----')
  for (const pl of p.plans) {
    L.push(`[${pl.id}] ${pl.name}（${pl.items.length} 个动作）`)
    for (const it of pl.items) {
      const seg = [`动作#${it.exerciseId}`, `热身${it.warmupSets}/正式${it.targetSets}`]
      if (it.targetReps) seg.push(`${it.targetReps}次`)
      if (it.targetWeight) seg.push(`${it.targetWeight}kg`)
      if (it.targetDurationSec) seg.push(`${it.targetDurationSec}s`)
      if (it.targetDistance) seg.push(`${it.targetDistance}km`)
      if (it.restSec) seg.push(`组间${it.restSec}s`)
      L.push('   - ' + seg.join(' '))
    }
  }
  L.push('')
  L.push('---- 训练记录 (workouts) ----')
  for (const w of p.workouts) {
    const seg = [`[${w.id}] ${w.name}`, `开始 ${dayjs(w.startAt).format('YYYY-MM-DD HH:mm')}`, `时长 ${w.durationSec}s`]
    if (w.calories != null) seg.push(`${w.calories}kcal`)
    if (w.note) seg.push(`备注:${w.note}`)
    L.push(seg.join(' | '))
  }
  L.push('')
  L.push('---- 训练组 (sets) ----')
  for (const s of p.sets) {
    const seg = [`[${s.id}] 训练#${s.workoutId}`, `动作#${s.exerciseId}`, `第${s.setNo}组(${s.kind})`]
    if (s.weight) seg.push(`${s.weight}kg`)
    if (s.reps) seg.push(`${s.reps}次`)
    if (s.durationSec) seg.push(`${s.durationSec}s`)
    if (s.distance) seg.push(`${s.distance}km`)
    if (s.incline != null) seg.push(`坡${s.incline}%`)
    if (s.speed != null) seg.push(`${s.speed}km/h`)
    if (s.rpe != null) seg.push(`RPE${s.rpe}`)
    L.push(seg.join(' '))
  }
  L.push('')
  L.push('---- 以下为可导入的机器数据，请勿手动修改 ----')
  L.push('===FITLOG-BACKUP-JSON===')
  L.push(JSON.stringify(p, null, 2))
  L.push('===END-FITLOG-BACKUP-JSON===')
  return L.join('\n')
}

/** 解析备份文本：先尝试整体 JSON，再尝试内嵌 JSON 块；失败抛错 */
export async function parseBackupText(text: string): Promise<ExportPayload> {
  try {
    const d = JSON.parse(text)
    if (isExportPayload(d)) return d
  } catch { /* 不是纯 JSON，继续尝试内嵌块 */ }
  const m = text.match(/===FITLOG-BACKUP-JSON===([\s\S]*?)===END-FITLOG-BACKUP-JSON===/)
  if (m) {
    const d = JSON.parse(m[1].trim())
    if (isExportPayload(d)) return d
  }
  throw new Error('文件格式不合法或不是 FitLog 备份')
}

export interface ExportResult {
  /** 是否成功写入手机本地存储（仅原生环境为 true） */
  saved: boolean
  /** 真实可导航的文件路径（如 /storage/emulated/0/Documents/fitlog-backup/xxx.txt） */
  filePath?: string
  /** 文件 uri */
  uri?: string
  /** 给用户的提示文案 */
  message: string
}

const BACKUP_DIR = 'fitlog-backup'

/**
 * 导出备份为 txt：
 * - 原生环境：用 Capacitor Filesystem 写入手机「文档(Documents)」下的 fitlog-backup 目录，并返回真实路径。
 * - 浏览器环境：回退为文件下载，并提示用户切换手机 App 使用完整能力。
 */
export async function exportBackup(): Promise<ExportResult> {
  const payload = await collectPayload()
  const text = toBackupText(payload)
  const fileName = `fitlog-${dayjs().format('YYYY-MM-DD-HHmm')}.txt`

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await Filesystem.writeFile({
        path: `${BACKUP_DIR}/${fileName}`,
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      // 尽量解析出用户可在文件管理中导航的真实路径
      let filePath = `/storage/emulated/0/Documents/${BACKUP_DIR}/${fileName}`
      try {
        const g = await Filesystem.getUri({ path: `${BACKUP_DIR}/${fileName}`, directory: Directory.Documents })
        if (g.uri.startsWith('file://')) filePath = decodeURIComponent(g.uri.replace('file://', ''))
      } catch { /* 用默认路径兜底 */ }
      return {
        saved: true,
        filePath,
        uri: res.uri,
        message: `已保存到手机本地存储：\n${filePath}`,
      }
    } catch (e) {
      return { saved: false, message: '保存到本地存储失败：' + (e as Error).message }
    }
  }

  // 浏览器回退
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return {
    saved: false,
    message: `当前为浏览器环境，已触发文件下载（${fileName}）。\n在手机 App 中导出会直接存入本地存储 Documents/${BACKUP_DIR}/ 并在完成后显示路径。`,
  }
}
