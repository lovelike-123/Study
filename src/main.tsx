import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { unstableSetRender } from 'antd-mobile'
import App from './App'
import { ensureSeed } from './db/seed'
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

ensureSeed().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
})
