import { useEffect, useRef, useState } from 'react'
import { notifyRestEnd, vibrate as vibrateFn, beep } from '../utils/feedback'

interface Props {
  seconds: number
  /** 绝对结束时间戳；由 store 持有，进程被杀重启后剩余时间依然准确 */
  endAt?: number
  label?: string
  vibrate?: boolean
  sound?: boolean
  onDone?: () => void
  onCancel?: () => void
  /** 加时回调（秒）。传入时由上层写回 endAt，保证加时可持久化 */
  onExtend?: (sec: number) => void
}

/**
 * 休息倒计时。基于绝对结束时间计算剩余秒数，
 * 页面被后台节流、甚至进程重启后回到前台依然准确。
 */
export default function RestTimer({ seconds, endAt, label = '休息中', vibrate = true, sound = true, onDone, onCancel, onExtend }: Props) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil(((endAt ?? Date.now() + seconds * 1000) - Date.now()) / 1000)))
  const endRef = useRef(endAt ?? Date.now() + seconds * 1000)
  const tickedRef = useRef<Set<number>>(new Set())
  const firedRef = useRef(false)

  useEffect(() => {
    const end = endAt ?? Date.now() + seconds * 1000
    const remain0 = Math.max(0, Math.ceil((end - Date.now()) / 1000))
    endRef.current = end
    tickedRef.current = new Set()
    // 恢复时倒计时已过期：直接显示 00:00，不再补放提示音/震动
    firedRef.current = remain0 === 0
    setLeft(remain0)

    const id = setInterval(() => {
      const remain = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000))
      setLeft(remain)

      if (remain > 0 && remain <= 3 && !tickedRef.current.has(remain)) {
        tickedRef.current.add(remain)
        if (sound) beep(1, 1200, 70)
        if (vibrate) vibrateFn(60)
      }
      if (remain === 0 && !firedRef.current) {
        firedRef.current = true
        notifyRestEnd({ vibrate, sound })
        clearInterval(id)
        onDone?.()
      }
    }, 200)

    return () => clearInterval(id)
  }, [seconds, endAt])

  const pct = seconds > 0 ? left / seconds : 0
  const R = 52
  const C = 2 * Math.PI * R
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto' }}>
        <svg width="132" height="132" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="66" cy="66" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
          <circle
            cx="66" cy="66" r={R} fill="none"
            stroke={left <= 3 ? '#e5484d' : 'var(--brand)'}
            strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: 'stroke-dashoffset .2s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
          <div className="small muted">{label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className="btn-ghost"
          onClick={() => {
            if (onExtend) { onExtend(30); return } // 交给 store，加时同样可持久化
            endRef.current += 30000
            setLeft(l => l + 30)
          }}
        >+30 秒</button>
        <button className="btn-ghost" onClick={onCancel}>跳过休息</button>
      </div>
    </div>
  )
}
