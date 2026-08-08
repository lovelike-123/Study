import { useEffect, useRef, useState } from 'react'
import { notifyRestEnd, vibrate as vibrateFn, beep } from '../utils/feedback'

interface Props {
  seconds: number
  label?: string
  vibrate?: boolean
  sound?: boolean
  onDone?: () => void
  onCancel?: () => void
}

/**
 * 休息倒计时。基于绝对结束时间计算剩余秒数，
 * 页面被后台节流后回到前台依然准确。
 */
export default function RestTimer({ seconds, label = '休息中', vibrate = true, sound = true, onDone, onCancel }: Props) {
  const [left, setLeft] = useState(seconds)
  const endRef = useRef(Date.now() + seconds * 1000)
  const tickedRef = useRef<Set<number>>(new Set())
  const firedRef = useRef(false)

  useEffect(() => {
    endRef.current = Date.now() + seconds * 1000
    tickedRef.current = new Set()
    firedRef.current = false
    setLeft(seconds)

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
  }, [seconds])

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
          onClick={() => { endRef.current += 30000; setLeft(l => l + 30) }}
        >+30 秒</button>
        <button className="btn-ghost" onClick={onCancel}>跳过休息</button>
      </div>
    </div>
  )
}
