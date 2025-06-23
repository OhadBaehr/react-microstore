import { useStoreSelector } from '../../src/index'
import store from './store'
import Counter from './components/Counter'
import UserManager from './components/UserManager'
import ThemeToggle from './components/ThemeToggle'
import Search from './components/Search'
import TodoList from './components/TodoList'
import Logs from './components/Logs'
import CustomCompare from './components/CustomCompare'
import './App.css'

function App() {
  // Only subscribe to theme for the main app wrapper
  const { theme } = useStoreSelector(store, ['theme'])

  return (
    <div className={`app ${theme}`}>
      <div className="container">
        <h1>🧪 React Microstore Demo</h1>
        <p>This demo shows middleware, persistence, and fine-grained subscriptions in action!</p>

        <Counter />
        <UserManager />
        <ThemeToggle />
        <Search />
        <TodoList />
        <CustomCompare />
        <Logs />
      </div>
    </div>
  )
}

export default App
