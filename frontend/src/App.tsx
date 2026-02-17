import { OkacheCTA } from './components/OkacheCTA'

function App() {
  return (
    <div className="min-h-screen font-sans">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <h1 className="font-logo text-2xl text-midnight">PgOkache</h1>
        <OkacheCTA variant="nav" />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-midnight">Local-first Postgres query advisor</h2>
          <p className="mt-2 text-ink">
            Connect a Postgres instance, verify pg_stat_statements setup, collect workload snapshots, and generate safe index suggestions.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-midnight/20 bg-canvas p-6">
          <h3 className="text-lg font-semibold text-midnight">Want uptime + SSL expiry + Lighthouse + alerts?</h3>
          <p className="mt-2 text-sm">Use hosted monitoring for your production stack while keeping SQL advisory local-first.</p>
          <div className="mt-4">
            <OkacheCTA variant="card" />
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-10 max-w-6xl border-t border-midnight/20 px-6 py-4">
        <OkacheCTA variant="footer" />
      </footer>
    </div>
  )
}

export default App
