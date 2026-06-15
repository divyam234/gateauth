import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

const THEMES = ["light", "dark", "system"] as const

type ThemeName = (typeof THEMES)[number]

const THEME_ICON: Record<ThemeName, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

function isThemeName(value: string | undefined): value is ThemeName {
  return value === "light" || value === "dark" || value === "system"
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const activeTheme = isThemeName(theme) ? theme : "system"
  const Icon = THEME_ICON[activeTheme]

  function cycleTheme() {
    const currentIndex = THEMES.indexOf(activeTheme)
    setTheme(THEMES[(currentIndex + 1) % THEMES.length])
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={cycleTheme}
      className="fixed right-4 top-4 z-50 bg-background shadow-xs"
      title={`Theme: ${activeTheme}. Click to switch`}
      aria-label={`Current theme: ${activeTheme}. Switch theme`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  )
}
