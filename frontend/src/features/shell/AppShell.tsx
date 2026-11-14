import type { ReactNode } from 'react'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  )
}
