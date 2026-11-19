/**
 * Sign-in screens use the same rail as the console: the product is the agent,
 * so the first thing you see is what it does, not a stock illustration.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium tracking-tight">
            Job apply agent
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs sm:p-8">
            {children}
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            It watches your channels, scores every posting and writes the
            applications you approve. It never applies for you.
          </p>
        </div>
      </main>
    </div>
  )
}
