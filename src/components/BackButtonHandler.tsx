import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useTraining } from '../store/training'
import { consumeTopBackHandler } from '../utils/backStack'

// 顶层 Tab 路由：命中说明用户正处于某个 Tab 根页
const TAB_ROUTES = ['/', '/history', '/stats', '/settings']

/**
 * 统一接管手机"系统/物理返回键"。只注册一次监听，当前路由通过 ref 读取，避免快速切换时重复注册。
 * 派发优先级：
 *   1) 若有浮层（弹窗 / Picker / Popup / 编辑态等）打开 → 关闭最上层浮层
 *   2) 若正在训练中（状态机未 idle）→ 走训练内的返回 / 放弃逻辑
 *   3) 嵌套路由（如 /history/:id）→ 路由后退
 *   4) 其他 Tab 根页 → 回到首页 Tab
 *   5) 已在首页：
 *        · 训练仍在进行 → 退到后台（moveTaskToBack），进程与训练状态保留，可随时切回继续
 *        · 无训练       → 退出 App
 * 非原生环境（浏览器）不注册监听，交由浏览器默认行为处理。
 */
export default function BackButtonHandler() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const navRef = useRef(nav)
  const pathRef = useRef(pathname)
  navRef.current = nav
  pathRef.current = pathname

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let detach: (() => void) | undefined
    App.addListener('backButton', () => {
      // 1) 浮层优先
      if (consumeTopBackHandler()) return

      // 2) 训练中（界面正在显示，未转入后台）
      const st = useTraining.getState()
      const inTrainingView = st.phase !== 'idle' && !st.minimized
      if (inTrainingView) {
        // 选择弹窗优先关闭
        if (st.bgDialog) { st.setBgDialog(false); return }
        // 执行中：返回键弹出「后台运行 / 放弃训练」选择，而非直接放弃
        if (st.phase === 'run') {
          if (st.confirmAbandon) { st.setConfirmAbandon(false); return } // 先关掉已打开的放弃确认
          st.setBgDialog(true)
          return
        }
        // 起始页 / 完成页保持原有返回行为
        st.back()
        return
      }

      // 3) / 4) / 5) 路由层
      const p = pathRef.current
      if (!TAB_ROUTES.includes(p)) {
        navRef.current(-1) // 嵌套路由（如训练详情）
      } else if (p !== '/') {
        navRef.current('/') // 非首页 Tab → 回首页
      } else if (st.phase !== 'idle' && st.session) {
        // 首页 + 训练未结束：不结束进程，退到后台继续训练。
        // background() 幂等：置 minimized 并挂系统状态栏常驻通知，作为返回入口。
        st.background()
        void App.minimizeApp().catch(() => {
          /* 低版本不支持 moveTaskToBack 时保持前台，也绝不 exitApp 中断训练 */
        })
      } else {
        App.exitApp() // 首页 + 无训练 → 正常退出
      }
    }).then(handle => {
      detach = () => handle.remove()
    }).catch(() => {
      /* 低版本或无法注册时静默降级 */
    })

    return () => detach?.()
  }, [])

  return null
}
