import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { ThemeToggle } from "@/components/theme-toggle"
import { Toaster } from "@/components/ui/sonner"

export type RouterContext = {
  queryClient: QueryClient
}

function RootLayout() {
  return (
    <>
      <ThemeToggle />
      <Toaster position="top-center" richColors closeButton />
      <Outlet />
    </>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})
