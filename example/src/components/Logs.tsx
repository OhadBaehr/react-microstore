import { useStoreSelector } from '../../../src/index'
import store from '../store'

export default function Logs() {
  const { logs } = useStoreSelector(store, ['logs'])

  const handleClearLogs = () => {
    store.set({ logs: [] })
  }

  return (
    <section className="section">
      <h3>📜 Middleware Logs</h3>
      <div className="logs-header">
        <span>{logs.length} logs</span>
        <button onClick={handleClearLogs} className="small">Clear</button>
      </div>
      <div className="logs">
        {logs.map(log => (
          <div key={log.id} className={`log-entry ${log.type}`}>
            <span className="timestamp">[{log.timestamp}]</span>
            <pre className="message">{log.message}</pre>
          </div>
        ))}
      </div>
    </section>
  )
} 