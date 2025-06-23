import { useStoreSelector } from '../../../src/index'
import store from '../store'

export default function ThemeToggle() {
  const { theme } = useStoreSelector(store, ['theme'])

  const handleThemeToggle = () => {
    store.set({ theme: theme === 'light' ? 'dark' : 'light' })
  }

  return (
    <section className="section">
      <h3>🎨 Theme (persisted)</h3>
      <div className="theme-controls">
        <span>Current theme: <strong>{theme}</strong></span>
        <button onClick={handleThemeToggle}>
          Switch to {theme === 'light' ? 'dark' : 'light'}
        </button>
        <p className="help-text">
          Theme persists across page reloads!
        </p>
      </div>
    </section>
  )
} 