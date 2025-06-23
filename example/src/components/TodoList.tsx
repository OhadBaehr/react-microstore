import { useState } from 'react'
import { useStoreSelector } from '../../../src/index'
import store from '../store'

export default function TodoList() {
  const { todos } = useStoreSelector(store, ['todos'])
  const [todoText, setTodoText] = useState('')

  const handleAddTodo = () => {
    if (todoText.trim()) {
      const newTodo = {
        id: Date.now(),
        text: todoText.trim(),
        completed: false
      }
      store.set({ todos: [...todos, newTodo] })
      setTodoText('')
    }
  }

  const handleToggleTodo = (id: number) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
    store.set({ todos: updatedTodos })
  }

  const handleDeleteTodo = (id: number) => {
    const updatedTodos = todos.filter(todo => todo.id !== id)
    store.set({ todos: updatedTodos })
  }

  return (
    <section className="section">
      <h3>📝 Todos</h3>
      <div className="todo-form">
        <input
          type="text"
          placeholder="Add a todo..."
          value={todoText}
          onChange={(e) => setTodoText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
        />
        <button onClick={handleAddTodo}>Add</button>
      </div>
      <div className="todo-list">
        {todos.map(todo => (
          <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggleTodo(todo.id)}
            />
            <span className="todo-text">{todo.text}</span>
            <button onClick={() => handleDeleteTodo(todo.id)} className="delete">
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  )
} 