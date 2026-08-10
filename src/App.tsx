import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import Layout from './components/Layout'
import BackButtonHandler from './components/BackButtonHandler'
import { consumeRestoredFlag } from './store/training'
import Home from './pages/Home'
import Exercises from './pages/Exercises'
import History from './pages/History'
import Stats from './pages/Stats'
import WorkoutDetail from './pages/WorkoutDetail'
import Settings from './pages/Settings'

export default function App() {
  // 冷启动从快照恢复了训练：提示一次，让用户知道进程被系统回收后训练并未丢失
  useEffect(() => {
    if (consumeRestoredFlag()) Toast.show({ content: '已恢复未完成的训练', duration: 2500 })
  }, [])

  return (
    <>
      <BackButtonHandler />
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
    </>
  )
}
