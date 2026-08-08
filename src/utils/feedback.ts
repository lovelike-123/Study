/**
 * 休息结束提示：震动 + 蜂鸣。
 * 桌面浏览器普遍不支持 Vibration API，此时靠蜂鸣验证；
 * 打包为 Android APK 后 WebView 支持 navigator.vibrate。
 */

let ctx: AudioContext | null = null

export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function vibrate(pattern: number | number[]) {
  if (!canVibrate()) return false
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

/** 用 WebAudio 生成短促蜂鸣，无需音频资源 */
export function beep(times = 2, freq = 880, durMs = 140, gapMs = 110) {
  try {
    ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    for (let i = 0; i < times; i++) {
      const start = ctx.currentTime + (i * (durMs + gapMs)) / 1000
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durMs / 1000)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + durMs / 1000 + 0.02)
    }
    return true
  } catch {
    return false
  }
}

/** 休息结束的统一提示 */
export function notifyRestEnd(opts: { vibrate?: boolean; sound?: boolean } = {}) {
  const { vibrate: v = true, sound = true } = opts
  if (v) vibrate([400, 150, 400])
  if (sound) beep(2)
}

/** 倒计时最后 3 秒的轻提示 */
export function notifyRestTick() {
  vibrate(60)
  beep(1, 1200, 70)
}
