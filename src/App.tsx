import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Exercises from './pages/Exercises'
import History from './pages/History'
import Stats from './pages/Stats'
import WorkoutDetail from './pages/WorkoutDetail'
import Settings from './pages/Settings'

export default function App() {
  return (
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
  )
}
