import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { OkacheCTA } from './components/OkacheCTA'

type Instance = {
  id: number
  name: string
  host: string
  port: number
  dbname: string
  user: string
  ssl_mode: string
  created_at: string
}

type SetupState = {
  id: number
  instance: number
  pg_version_num: number | null
  preload_ok: boolean
  ext_created: boolean
  ready: boolean
  last_checked_at: string
}

type SetupInfo = {
  status: string
  ready: boolean
  pg_version_num: number
  preload_ok: boolean
  ext_created: boolean
  checks: Record<string, string | number | boolean | null>
  params: Record<string, string>
}

type QueryStat = {
  queryid: string
  query_norm: string
  calls: number
  total_time_ms: number
  mean_time_ms: number
  rows: number
  shared_blks_read: number
  shared_blks_hit: number
  temp_blks_written: number
  wal_bytes: number
}

type Snapshot = {
  id: number
  instance: number
  captured_at: string
  query_stats: QueryStat[]
}

type Recommendation = {
  id: number
  instance: number
  type: string
  title: string
  details: string
  sql: string
  confidence: string
  score: number
  status: string
  created_at: string
}

type FormState = {
  name: string
  host: string
  port: string
  dbname: string
  user: string
  password: string
  ssl_mode: string
}

const API_BASE = '/api'

const defaultForm: FormState = {
  name: '',
  host: '',
  port: '5432',
  dbname: '',
  user: '',
  password: '',
  ssl_mode: 'prefer',
}

const sslModes = ['prefer', 'require', 'disable', 'verify-ca', 'verify-full']
const pgMajorVersion = (versionNum?: number | null) => {
  if (!versionNum) return null
  return Math.floor(versionNum / 10000)
}

const pgConfigName = (major?: number | null) => {
  if (!major) return 'postgresql.conf'
  return major >= 12 ? 'postgresql.conf' : 'postgresql.conf'
}

const pgServiceName = (major?: number | null) => {
  if (!major) return 'postgresql'
  return major >= 10 ? `postgresql@${major}` : 'postgresql'
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat().format(value)
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)} ms`
}

function App() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [setupStates, setSetupStates] = useState<Record<number, SetupState>>({})
  const [setupInfo, setSetupInfo] = useState<Record<number, SetupInfo>>({})
  const [snapshots, setSnapshots] = useState<Record<number, Snapshot>>({})
  const [recommendations, setRecommendations] = useState<Record<number, Recommendation[]>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [resetPassword, setResetPassword] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId]
  )

  const selectedSetup = selectedId ? setupInfo[selectedId] ?? null : null
  const selectedSetupState = selectedId ? setupStates[selectedId] ?? null : null
  const selectedSnapshot = selectedId ? snapshots[selectedId] ?? null : null
  const selectedRecommendations = selectedId ? recommendations[selectedId] ?? [] : []
  const selectedPgMajor = pgMajorVersion(selectedSetup?.pg_version_num ?? selectedSetupState?.pg_version_num)
  const configName = pgConfigName(selectedPgMajor)
  const serviceName = pgServiceName(selectedPgMajor)

  useEffect(() => {
    void initialize()
  }, [])

  async function initialize() {
    await Promise.all([loadInstances(), loadSetupStates(), loadSnapshots(), loadRecommendations()])
  }

  async function loadInstances() {
    try {
      const res = await fetch(`${API_BASE}/instances/`)
      if (!res.ok) throw new Error('Failed to load instances.')
      const data = (await res.json()) as Instance[]
      setInstances(data)
      if (data.length && selectedId === null) {
        setSelectedId(data[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load instances.')
    }
  }

  async function loadSetupStates() {
    try {
      const res = await fetch(`${API_BASE}/setup-states/`)
      if (!res.ok) throw new Error('Failed to load setup states.')
      const data = (await res.json()) as SetupState[]
      const next: Record<number, SetupState> = {}
      data.forEach((state) => {
        if (!next[state.instance]) {
          next[state.instance] = state
        }
      })
      setSetupStates(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load setup states.')
    }
  }

  async function loadSnapshots() {
    try {
      const res = await fetch(`${API_BASE}/snapshots/`)
      if (!res.ok) throw new Error('Failed to load snapshots.')
      const data = (await res.json()) as Snapshot[]
      const next: Record<number, Snapshot> = {}
      data.forEach((snapshot) => {
        if (!next[snapshot.instance]) {
          next[snapshot.instance] = snapshot
        }
      })
      setSnapshots(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load snapshots.')
    }
  }

  async function loadRecommendations() {
    try {
      const res = await fetch(`${API_BASE}/recommendations/`)
      if (!res.ok) throw new Error('Failed to load recommendations.')
      const data = (await res.json()) as Recommendation[]
      const next: Record<number, Recommendation[]> = {}
      data.forEach((rec) => {
        if (!next[rec.instance]) {
          next[rec.instance] = []
        }
        next[rec.instance].push(rec)
      })
      Object.values(next).forEach((list) => {
        list.sort((a, b) => b.score - a.score)
      })
      setRecommendations(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load recommendations.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusyAction('create')

    try {
      const payload = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number(form.port),
        dbname: form.dbname.trim(),
        user: form.user.trim(),
        password: form.password,
        ssl_mode: form.ssl_mode,
      }

      const res = await fetch(`${API_BASE}/instances/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? 'Unable to save connection.')
      }

      const created = (await res.json()) as Instance
      setInstances((prev) => [created, ...prev])
      setSelectedId(created.id)
      setForm({ ...defaultForm, name: form.name })

      await checkSetup(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create connection.')
    } finally {
      setBusyAction(null)
    }
  }

  async function checkSetup(instanceId: number) {
    setError(null)
    setBusyAction('check')

    try {
      const res = await fetch(`${API_BASE}/instances/${instanceId}/check_setup/`, {
        method: 'POST',
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? 'Check failed.')
      }
      const info = (await res.json()) as SetupInfo
      setSetupInfo((prev) => ({ ...prev, [instanceId]: info }))
      await loadSetupStates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check setup.')
    } finally {
      setBusyAction(null)
    }
  }

  async function collectSnapshot(instanceId: number) {
    setError(null)
    setBusyAction('collect')

    try {
      const res = await fetch(`${API_BASE}/instances/${instanceId}/collect/`, {
        method: 'POST',
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? 'Snapshot failed.')
      }
      await Promise.all([loadSnapshots(), loadRecommendations()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to collect snapshot.')
    } finally {
      setBusyAction(null)
    }
  }

  async function resetCredentials(instanceId: number) {
    setError(null)
    setBusyAction('reset')
    try {
      const res = await fetch(`${API_BASE}/instances/${instanceId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail ?? 'Unable to reset credentials.')
      }
      setResetPassword('')
      await checkSetup(instanceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset credentials.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="min-h-screen font-sans text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-midnight/70">PgOkache</p>
          <h1 className="font-logo text-2xl text-midnight">Postgres Query Advisor</h1>
        </div>
        <OkacheCTA variant="nav" />
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 pb-10">
        <section className="rounded-2xl border border-midnight/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-midnight">Connect your Postgres instance</h2>
          <p className="mt-2 text-sm text-midnight/70">
            Save credentials locally, run the pg_stat_statements readiness checks, and capture snapshots for index
            recommendations.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-midnight/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-midnight">New connection</h3>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-midnight">
                  Name
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Staging analytics"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  Host
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                    placeholder="db.internal"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  Port
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.port}
                    onChange={(event) => setForm({ ...form, port: event.target.value })}
                    placeholder="5432"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  Database
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.dbname}
                    onChange={(event) => setForm({ ...form, dbname: event.target.value })}
                    placeholder="app_db"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  User
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.user}
                    onChange={(event) => setForm({ ...form, user: event.target.value })}
                    placeholder="postgres"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  Password
                  <input
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="••••••••"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-midnight">
                  SSL mode
                  <select
                    className="mt-2 w-full rounded-lg border border-midnight/20 bg-white px-3 py-2 text-sm"
                    value={form.ssl_mode}
                    onChange={(event) => setForm({ ...form, ssl_mode: event.target.value })}
                  >
                    {sslModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                className="w-full rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-midnight transition hover:bg-mint/90"
                type="submit"
                disabled={busyAction === 'create'}
              >
                {busyAction === 'create' ? 'Saving...' : 'Save & check pg_stat_statements'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-midnight/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-midnight">Saved connections</h3>
              {selectedInstance ? (
                <span className="rounded-full bg-mint/20 px-3 py-1 text-xs font-semibold text-midnight">
                  Active: {selectedInstance.name}
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {instances.length === 0 ? (
                <p className="text-sm text-midnight/70">No connections yet. Add one to begin.</p>
              ) : (
                instances.map((instance) => (
                  <button
                    key={instance.id}
                    type="button"
                    onClick={() => setSelectedId(instance.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      instance.id === selectedId
                        ? 'border-mint bg-mint/10'
                        : 'border-midnight/10 hover:border-mint/40 hover:bg-mint/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-midnight">{instance.name}</p>
                      <span className="text-xs text-midnight/60">
                        {instance.host}:{instance.port}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-midnight/60">
                      {instance.user}@{instance.dbname}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 rounded-xl border border-midnight/10 bg-canvas p-4">
              <h4 className="text-sm font-semibold text-midnight">pg_stat_statements readiness</h4>
              {selectedInstance ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-midnight/70">Status</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedSetup?.ready || selectedSetupState?.ready
                          ? 'bg-mint/30 text-midnight'
                          : 'bg-midnight/10 text-midnight/80'
                      }`}
                    >
                      {selectedSetup?.status ?? (selectedSetupState?.ready ? 'READY' : 'CHECK NEEDED')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-midnight/70">Postgres version</span>
                    <span className="font-semibold text-midnight">
                      {selectedSetup?.pg_version_num ?? selectedSetupState?.pg_version_num ?? '—'}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-white px-3 py-2 text-xs">
                      <p className="text-midnight/60">shared_preload_libraries</p>
                      <p className="mt-1 font-semibold text-midnight">
                        {selectedSetup?.preload_ok || selectedSetupState?.preload_ok ? 'enabled' : 'missing'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 text-xs">
                      <p className="text-midnight/60">extension created</p>
                      <p className="mt-1 font-semibold text-midnight">
                        {selectedSetup?.ext_created || selectedSetupState?.ext_created ? 'yes' : 'no'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-midnight/20 px-3 py-2 text-xs font-semibold text-midnight transition hover:border-mint/40"
                      type="button"
                      onClick={() => checkSetup(selectedInstance.id)}
                      disabled={busyAction === 'check'}
                    >
                      {busyAction === 'check' ? 'Checking...' : 'Run checks'}
                    </button>
                    <button
                      className="rounded-lg bg-mint px-3 py-2 text-xs font-semibold text-midnight transition hover:bg-mint/90"
                      type="button"
                      onClick={() => collectSnapshot(selectedInstance.id)}
                      disabled={busyAction === 'collect'}
                    >
                      {busyAction === 'collect' ? 'Collecting...' : 'Collect snapshot'}
                    </button>
                  </div>

                  <div className="rounded-lg border border-midnight/10 bg-white px-3 py-2 text-xs text-midnight/70">
                    <p className="font-semibold text-midnight">Reset stored credentials</p>
                    <p className="mt-1">
                      Use this if the encryption key changed or the password was rotated.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        className="min-w-[180px] flex-1 rounded-md border border-midnight/20 px-3 py-2 text-xs"
                        type="password"
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        placeholder="New password"
                      />
                      <button
                        className="rounded-md bg-mint px-3 py-2 text-xs font-semibold text-midnight transition hover:bg-mint/90"
                        type="button"
                        onClick={() => resetCredentials(selectedInstance.id)}
                        disabled={busyAction === 'reset' || resetPassword.length === 0}
                      >
                        {busyAction === 'reset' ? 'Resetting...' : 'Reset password'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white px-3 py-2 text-xs text-midnight/70">
                    <p className="font-semibold text-midnight">Parameters</p>
                    {selectedSetup ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {Object.entries(selectedSetup.params).map(([key, value]) => (
                          <div key={key} className="rounded-md bg-canvas px-2 py-1">
                            <span className="text-midnight/60">{key}</span>
                            <span className="ml-2 font-semibold text-midnight">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2">Run the checks to see pg_stat_statements parameters.</p>
                    )}
                  </div>

                  {selectedSetup && !selectedSetup.ready ? (
                    <div className="rounded-lg border border-mint/30 bg-white p-4 text-xs text-midnight/70">
                      <p className="text-sm font-semibold text-midnight">
                        Setup guide for Postgres {selectedPgMajor ?? 'your version'}
                      </p>
                      <p className="mt-1">
                        Use these steps to enable pg_stat_statements, then click “Run checks” again.
                      </p>
                      <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-[11px] text-midnight/80">
                        <p className="font-semibold text-midnight">1. Enable the extension</p>
                        <p className="mt-1">
                          Run once per database:
                          <span className="ml-2 font-mono text-midnight">CREATE EXTENSION IF NOT EXISTS pg_stat_statements;</span>
                        </p>
                      </div>
                      <div className="mt-2 rounded-md bg-canvas px-3 py-2 text-[11px] text-midnight/80">
                        <p className="font-semibold text-midnight">2. Add to shared_preload_libraries</p>
                        <p className="mt-1">
                          Update <span className="font-mono text-midnight">{configName}</span> and add:
                        </p>
                        <p className="mt-1 font-mono text-midnight">shared_preload_libraries = 'pg_stat_statements'</p>
                      </div>
                      <div className="mt-2 rounded-md bg-canvas px-3 py-2 text-[11px] text-midnight/80">
                        <p className="font-semibold text-midnight">3. Restart Postgres</p>
                        <p className="mt-1">
                          Restart your service (example):{' '}
                          <span className="font-mono text-midnight">systemctl restart {serviceName}</span>
                        </p>
                      </div>
                      <div className="mt-2 rounded-md bg-canvas px-3 py-2 text-[11px] text-midnight/80">
                        <p className="font-semibold text-midnight">4. Optional tuning</p>
                        <p className="mt-1">
                          Set these in <span className="font-mono text-midnight">{configName}</span> if needed:
                        </p>
                        <p className="mt-1 font-mono text-midnight">
                          pg_stat_statements.track = all
                        </p>
                        <p className="mt-1 font-mono text-midnight">
                          pg_stat_statements.max = 10000
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-midnight/70">Select a connection to view readiness.</p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-midnight/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-midnight">Latest query snapshot</h3>
            {selectedSnapshot ? (
              <span className="text-xs text-midnight/60">Captured {new Date(selectedSnapshot.captured_at).toLocaleString()}</span>
            ) : null}
          </div>
          {selectedSnapshot ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-midnight/60">
                  <tr>
                    <th className="px-3 py-2">Query</th>
                    <th className="px-3 py-2">Calls</th>
                    <th className="px-3 py-2">Total time</th>
                    <th className="px-3 py-2">Mean time</th>
                    <th className="px-3 py-2">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSnapshot.query_stats.slice(0, 8).map((stat) => (
                    <tr key={stat.queryid} className="border-t border-midnight/10">
                      <td className="px-3 py-3 text-xs text-midnight">
                        <span className="block max-w-lg truncate font-mono">{stat.query_norm}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-midnight">{formatNumber(stat.calls)}</td>
                      <td className="px-3 py-3 text-xs text-midnight">{formatMs(stat.total_time_ms)}</td>
                      <td className="px-3 py-3 text-xs text-midnight">{formatMs(stat.mean_time_ms)}</td>
                      <td className="px-3 py-3 text-xs text-midnight">{formatNumber(stat.rows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-midnight/70">
              No snapshots captured yet. Collect a snapshot after pg_stat_statements is ready.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-midnight/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-midnight">Recommendations</h3>
            {selectedRecommendations.length ? (
              <span className="text-xs text-midnight/60">{selectedRecommendations.length} suggestion(s)</span>
            ) : null}
          </div>
          {selectedRecommendations.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedRecommendations.map((rec) => (
                <div key={rec.id} className="rounded-xl border border-midnight/10 bg-canvas p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-midnight">{rec.title}</p>
                    <span className="rounded-full bg-mint/20 px-2 py-1 text-[10px] font-semibold text-midnight">
                      {rec.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-midnight/70">{rec.details}</p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-midnight/60">
                    <span className="rounded-full bg-white px-2 py-1">Confidence: {rec.confidence}</span>
                    <span className="rounded-full bg-white px-2 py-1">Score: {rec.score}</span>
                  </div>
                  {rec.sql ? (
                    <p className="mt-2 rounded-md bg-white px-2 py-2 text-[11px] font-mono text-midnight">
                      {rec.sql}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-midnight/70">
              No recommendations yet. Collect a snapshot to generate index or read replica suggestions.
            </p>
          )}
        </section>

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>
        ) : null}

        <section className="rounded-2xl border border-midnight/10 bg-canvas p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-midnight">Need hosted uptime + SSL + alerts?</h3>
              <p className="mt-2 text-sm text-midnight/70">
                Use Okache for production monitoring while PgOkache stays local-first.
              </p>
            </div>
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
