import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useAdminAuth } from './auth'

export type AppearanceFontSize = 'small' | 'medium' | 'large'
export type AppearanceFontFamily = 'inter' | 'roboto' | 'arial' | 'system'

export type AppearanceColors = {
  primary: string
  text: string
  secondaryText: string
  pageBackground: string
  surface: string
  border: string
  sidebarBackground: string
  sidebarText: string
  headerBackground: string
  headerText: string
}

export type AppearanceSettings = {
  fontSize: AppearanceFontSize
  fontFamily: AppearanceFontFamily
  colors: AppearanceColors
}

export const APPEARANCE_STORAGE_KEY = 'kipi.admin.appearance'
export const THEME_STORAGE_KEY = 'kipi.admin.theme'

function appearanceStorageKey(adminId: number | null) {
  return adminId === null ? APPEARANCE_STORAGE_KEY : `${APPEARANCE_STORAGE_KEY}.${adminId}`
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 'medium',
  fontFamily: 'inter',
  colors: {
    primary: '#315CF5',
    text: '#1E293B',
    secondaryText: '#64748B',
    pageBackground: '#F1F5F9',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    sidebarBackground: '#F1F5F9',
    sidebarText: '#334155',
    headerBackground: '#FFFFFF',
    headerText: '#1E293B',
  },
}

export const FONT_SIZE_OPTIONS: { value: AppearanceFontSize; label: string; pixels: number }[] = [
  { value: 'small', label: 'Small', pixels: 12 },
  { value: 'medium', label: 'Medium', pixels: 14 },
  { value: 'large', label: 'Large', pixels: 16 },
]

export const FONT_FAMILY_OPTIONS: { value: AppearanceFontFamily; label: string; stack: string }[] = [
  { value: 'inter', label: 'Inter', stack: 'Inter, "Noto Sans Myanmar", "Myanmar Text", sans-serif' },
  { value: 'roboto', label: 'Roboto', stack: 'Roboto, "Noto Sans Myanmar", "Myanmar Text", sans-serif' },
  { value: 'arial', label: 'Arial', stack: 'Arial, "Noto Sans Myanmar", "Myanmar Text", sans-serif' },
  { value: 'system', label: 'System', stack: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Myanmar", "Myanmar Text", sans-serif' },
]

type AppearanceContextValue = {
  settings: AppearanceSettings
  dark: boolean
  preview: (settings: AppearanceSettings) => void
  save: (settings: AppearanceSettings) => void
  reset: () => void
  toggleTheme: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function readAppearance(adminId: number | null): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE

  try {
    const stored = JSON.parse(window.localStorage.getItem(appearanceStorageKey(adminId)) ?? 'null') as Partial<AppearanceSettings> | null
    const colors = stored?.colors
    return {
      fontSize: stored?.fontSize === 'small' || stored?.fontSize === 'large' ? stored.fontSize : DEFAULT_APPEARANCE.fontSize,
      fontFamily: stored?.fontFamily === 'roboto' || stored?.fontFamily === 'arial' || stored?.fontFamily === 'system' ? stored.fontFamily : DEFAULT_APPEARANCE.fontFamily,
      colors: {
        ...DEFAULT_APPEARANCE.colors,
        ...Object.fromEntries(Object.entries(colors ?? {}).filter(([, value]) => isHexColor(value))),
      },
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

function applyAppearance(settings: AppearanceSettings, dark: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const colors = dark ? {
    ...settings.colors,
    text: '#E5EDF8',
    secondaryText: '#94A3B8',
    pageBackground: '#0B1220',
    surface: '#111C2E',
    border: '#243249',
    sidebarBackground: '#0F1A2B',
    sidebarText: '#94A3B8',
    headerBackground: '#111C2E',
    headerText: '#E5EDF8',
  } : settings.colors
  const fontSize = FONT_SIZE_OPTIONS.find((option) => option.value === settings.fontSize)?.pixels ?? 14
  const fontFamily = FONT_FAMILY_OPTIONS.find((option) => option.value === settings.fontFamily)?.stack ?? FONT_FAMILY_OPTIONS[0].stack
  const values: Record<string, string> = {
    '--appearance-font-size': `${fontSize}px`,
    '--appearance-font-family': fontFamily,
    '--primary': colors.primary,
    '--primary-hover': `color-mix(in srgb, ${colors.primary} 84%, #000000)`,
    '--text': colors.text,
    '--text-primary': colors.text,
    '--muted': colors.secondaryText,
    '--text-secondary': colors.secondaryText,
    '--background': colors.pageBackground,
    '--body-bg': colors.pageBackground,
    '--surface': colors.surface,
    '--surface-bg': colors.surface,
    '--border': colors.border,
    '--border-color': colors.border,
    '--sidebar': colors.sidebarBackground,
    '--sidebar-bg': colors.sidebarBackground,
    '--sidebar-text': colors.sidebarText,
    '--header-bg': colors.headerBackground,
    '--header-text': colors.headerText,
  }
  Object.entries(values).forEach(([property, value]) => root.style.setProperty(property, value))
}

function cloneDefaults() {
  return { ...DEFAULT_APPEARANCE, colors: { ...DEFAULT_APPEARANCE.colors } }
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const adminId = useAdminAuth((state) => state.user?.id ?? null)
  const [settings, setSettings] = useState<AppearanceSettings>(() => readAppearance(adminId))
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark')

  useEffect(() => {
    setSettings(readAppearance(adminId))
  }, [adminId])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    applyAppearance(settings, dark)
    window.localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
  }, [settings, dark])

  const preview = useCallback((next: AppearanceSettings) => {
    setSettings(next)
  }, [])

  const save = useCallback((next: AppearanceSettings) => {
    setSettings(next)
    window.localStorage.setItem(appearanceStorageKey(adminId), JSON.stringify(next))
  }, [adminId])

  const reset = useCallback(() => {
    const defaults = cloneDefaults()
    setSettings(defaults)
    window.localStorage.setItem(appearanceStorageKey(adminId), JSON.stringify(defaults))
  }, [adminId])

  const toggleTheme = useCallback(() => {
    setDark((value) => !value)
  }, [])

  const value = useMemo(() => ({ settings, dark, preview, save, reset, toggleTheme }), [settings, dark, preview, save, reset, toggleTheme])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}

