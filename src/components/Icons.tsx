interface P {
  size?: number
}

const wrap = (d: string) => ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export const IconTrain = wrap('M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11')
export const IconPlan = wrap('M8 4h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8M8 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h2M8 4v16M11 9h5M11 13h5')
export const IconHistory = wrap('M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9h16M8 3v3M16 3v3M8.5 13h1M15 13h1M8.5 16.5h1M12 13h1M12 16.5h1')
export const IconStats = wrap('M4 20h16M7 20v-6M12 20V7M17 20v-9')
export const IconPlus = wrap('M12 5v14M5 12h14')
export const IconChevron = wrap('M9 6l6 6-6 6')
export const IconMe = wrap('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0')
