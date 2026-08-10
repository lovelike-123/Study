import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useTraining } from '../store/training'

/** 后台训练常驻通知的固定 id，便于取消与点击识别 */
const NOTIF_ID = 4242

/**
 * 训练转入后台时在系统状态栏挂出常驻(ongoing)通知。
 * 点击通知即可回到训练界面（见 initTrainingNotificationTap）。
 * 非原生环境（浏览器）无系统返回键场景，仅用 Web Notification 做兼容兜底。
 */
export async function showTrainingNotification(name: string): Promise<void> {
  const title = '训练进行中'
  const body = `${name || '训练'} · 点击返回继续`

  if (!Capacitor.isNativePlatform()) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    } catch {
      /* 浏览器环境兜底失败，忽略 */
    }
    return
  }

  try {
    const cur = await LocalNotifications.checkPermissions()
    if (cur.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions()
      if (req.display !== 'granted') return
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIF_ID,
          title,
          body,
          smallIcon: 'ic_notification', // 避免 Android 8+ 通知无图标（白块/不显示）
          iconColor: '#19c18d', // 小图标染成品牌绿
          ongoing: true, // 常驻，不被滑动清除
          autoCancel: false,
        },
      ],
    })
  } catch {
    /* 通知异常不阻断训练 */
  }
}

/** 取消后台训练常驻通知 */
export async function cancelTrainingNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] })
  } catch {
    /* 忽略 */
  }
}

/**
 * 注册通知点击监听：点击常驻通知即回到训练界面。
 * 应在应用启动时调用一次。
 */
export function initTrainingNotificationTap(): void {
  if (!Capacitor.isNativePlatform()) return
  try {
    void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      if (event.notification.id === NOTIF_ID) {
        // 点击常驻通知即回到训练界面
        useTraining.getState().resume()
      }
    })
  } catch {
    /* 忽略 */
  }
}

/**
 * 监听前后台切换，维护「训练进行中」常驻通知。
 * 覆盖非返回键的离开路径（Home 键、任务切换、手势上滑），
 * 保证只要训练没结束，退到后台就一定有返回入口。
 */
export function initTrainingAppStateSync(): void {
  if (!Capacitor.isNativePlatform()) return
  try {
    void App.addListener('appStateChange', ({ isActive }) => {
      const st = useTraining.getState()
      if (st.phase === 'idle' || !st.session) return
      if (!isActive) {
        void showTrainingNotification(st.session.name)
      } else if (!st.minimized) {
        // 回到前台且训练界面本就显示，通知已无意义
        void cancelTrainingNotification()
      }
    })
  } catch {
    /* 忽略 */
  }
}
