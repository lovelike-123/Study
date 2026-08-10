import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { unstableSetRender } from 'antd-mobile'
import App from './App'
import { ensureSeed } from './db/seed'
import { initTrainingNotificationTap, initTrainingAppStateSync } from './utils/trainingNotification'
import { hydrateTraining } from './store/training'
import { applyTheme } from './theme'
import { db } from './db'
import { DEFAULT_THEME, SK, type Theme } from './hooks/useSetting'
import './styles/global.css'

// V5: React 19 兼容补丁 — antd-mobile v5 默认假设 React 16~18，
// 缺少这个会让 Toast/Popup/SwipeAction 等静态方法在关闭时抛
// `unmountComponentAtNode is not a function`。
// 官方文档：https://mobile.ant.design/zh/guide/v5-for-19
// 要求 antd-mobile >= 5.40.0（当前 5.42.3 ✓）。
unstableSetRender((node, container) => {
  const root = (container as any)._reactRoot ?? createRoot(container as any)
  ;(container as any)._reactRoot = root
  root.render(node)
  return async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    root.unmount()
  }
})

// 注册系统状态栏「训练进行中」常驻通知的点击返回监听（仅原生平台生效）
initTrainingNotificationTap()
// 前后台切换时维护常驻通知（Home 键 / 手势退出也能留下返回入口）
initTrainingAppStateSync()
// 冷启动还原上次未结束的训练：进程被系统回收后重新进入 App 仍能接着练
hydrateTraining()
// 启动即应用主题（渲染前设定，避免首屏闪白/闪黑）
db.settings.get(SK.theme).then(r => applyTheme((r?.value as Theme) ?? DEFAULT_THEME)).catch(() => {})

ensureSeed().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
})
