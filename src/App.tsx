import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import Layout from './components/Layout'
import BackButtonHandler from './components/BackButtonHandler'
import { consumeRestoredFlag } from './store/training'

// P3-1: 路由级 code-split，降低首屏单包体积
const Home = lazy(() => import('./pages/Home'))
const Exercises = lazy(() => import('./pages/Exercises'))
const History = lazy(() => import('./pages/History'))
const Stats = lazy(() => import('./pages/Stats'))
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return <div className="empty">加载中…</div>
}

export default function App() {
  // 冷启动从快照恢复了训练：提示一次，让用户知道进程被系统回收后训练并未丢失
  useEffect(() => {
    if (consumeRestoredFlag()) Toast.show({ content: '已恢复未完成的训练', duration: 2500 })
  }, [])

  return (
    <>
      <BackButtonHandler />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/history" element={<History />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
