import { useTraining } from '../store/training'

/**
 * 训练转入后台后，在应用内顶部常驻一个返回横幅。
 * 点击即恢复训练界面（resume 同时移除系统状态栏常驻通知）。
 * 与系统通知互补：即使非原生环境或通知被忽略，也能随时返回训练。
 */
export default function TrainingResumeBanner() {
  const minimized = useTraining(s => s.minimized)
  const phase = useTraining(s => s.phase)
  const resume = useTraining(s => s.resume)

  if (!minimized || phase === 'idle') return null

  return (
    <button className="train-resume-banner" onClick={resume}>
      <span className="dot" />
      <span className="label">训练进行中 · 点击返回</span>
      <span className="go">返回 ›</span>
    </button>
  )
}
