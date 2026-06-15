import { useSuspenseQuery } from "@tanstack/react-query"
import { Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router"
import {
  Activity,
  AppWindow,
  BookOpenCheck,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { type ComponentType, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { GlobalSearch } from "@/features/admin/global-search"
import { configQueryOptions } from "@/features/admin/query-options"
import { signOut, useSession } from "@/lib/auth-client"

type AdminRoute =
  | "/admin/overview"
  | "/admin/applications"
  | "/admin/users"
  | "/admin/sessions"
  | "/admin/api-keys"
  | "/admin/audit-log"
  | "/admin/security"
  | "/admin/config"

type NavigationItem = {
  path: AdminRoute
  label: string
  icon: ComponentType<{ className?: string }>
}

const OPERATE_ITEMS = [
  { path: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/applications", label: "Applications", icon: AppWindow },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/sessions", label: "Sessions", icon: Activity },
  { path: "/admin/api-keys", label: "API keys", icon: KeyRound },
  { path: "/admin/audit-log", label: "Audit log", icon: BookOpenCheck },
] satisfies readonly NavigationItem[]

const HARDEN_ITEMS = [
  { path: "/admin/security", label: "Security", icon: ShieldCheck },
  { path: "/admin/config", label: "Settings", icon: Settings2 },
] satisfies readonly NavigationItem[]

function hasAdminRole(role: unknown): boolean {
  return String(role ?? "")
    .split(",")
    .map((part) => part.trim())
    .includes("admin")
}

function getInitials(name: string | undefined): string {
  const initials = name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return initials || "A"
}

function NavigationGroup({ label, items }: { label: string; items: readonly NavigationItem[] }) {
  const matchRoute = useMatchRoute()
  const navigate = useNavigate()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                isActive={Boolean(matchRoute({ to: item.path, fuzzy: true }))}
                tooltip={item.label}
                onClick={() => void navigate({ to: item.path })}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AdminLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { data: config } = useSuspenseQuery(configQueryOptions())
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut)
    return () => window.removeEventListener("keydown", handleKeyboardShortcut)
  }, [])

  if (isPending) {
    return <AdminLoadingState />
  }

  if (!session || !hasAdminRole(session.user.role)) {
    return null
  }

  const branding =
    typeof config?.config.brandingName === "string" ? config.config.brandingName : "Gatehouse"
  const environment =
    typeof config?.config.environmentLabel === "string"
      ? config.config.environmentLabel
      : "Control plane"

  async function handleSignOut() {
    try {
      const result = await signOut()
      if (result.error) {
        throw new Error(result.error.message || "Unable to sign out")
      }
      await navigate({ to: "/login" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out")
    }
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(145deg,oklch(0.58_0.22_275),oklch(0.66_0.16_225))] text-white shadow-lg shadow-violet-500/20">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold">{branding}</p>
                <p className="truncate text-[10px] text-muted-foreground">Identity control plane</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarSeparator />

          <SidebarContent>
            <NavigationGroup label="Operate" items={OPERATE_ITEMS} />
            <NavigationGroup label="Harden" items={HARDEN_ITEMS} />
          </SidebarContent>

          <SidebarSeparator />

          <SidebarFooter>
            <div className="flex items-center gap-2 p-1.5 group-data-[collapsible=icon]:justify-center">
              <Avatar className="size-8">
                <AvatarFallback className="text-[10px]">
                  {getInitials(session.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-medium">{session.user.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{session.user.email}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="group-data-[collapsible=icon]:hidden"
                aria-label="Sign out"
                onClick={() => void handleSignOut()}
              >
                <LogOut />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="hidden h-5 w-px bg-border sm:block" />
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full max-w-sm justify-start text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
              <span className="truncate">Search users, apps, events…</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] sm:inline-flex">
                Ctrl K
              </kbd>
            </Button>
            <div className="ml-auto flex items-center gap-2 pr-10">
              <Badge variant="outline" className="hidden sm:flex">
                {environment}
              </Badge>
              <Badge variant="secondary">admin</Badge>
            </div>
          </header>

          <main className="min-h-[calc(100vh-3.5rem)] overflow-auto">
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading console…
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}

export default AdminLayout
