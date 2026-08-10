import { Capacitor } from '@capacitor/core'
import type { Theme } from './hooks/useSetting'

const DARK_BG = '#0f1115'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 把 system/light/dark 解析为实际生效的 light | dark */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

/** 应用主题到 <html data-theme> 并同步原生状态栏（仅原生平台） */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  void syncStatusBar(resolved)
}

async function syncStatusBar(resolved: 'light' | 'dark'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, StatusBarStyle } = await import('@capacitor/status-bar')
    if (resolved === 'dark') {
      await StatusBar.setStyle({ style: StatusBarStyle.Dark })
      await StatusBar.setBackgroundColor({ color: DARK_BG })
    } else {
      await StatusBar.setStyle({ style: StatusBarStyle.Light })
      await StatusBar.setBackgroundColor({ color: '#FFFFFF' })
    }
  } catch {
    // 插件未就绪或平台不支持：忽略，Web 端不影响
  }
}
