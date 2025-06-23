import { useStoreSelector } from '../../../src/index'
import store from '../store'
import { useRef } from 'react'

export default function Counter() {
  const { count } = useStoreSelector(store, ['count'])
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isLongPressRef = useRef(false)

  const START_DELAY = 250
  const REPEAT_DELAY = 50
  
  const handleCountIncrement = () => {
    const {count} = store.select(['count'])
    store.set({ count: count + 1 })
  }

  const handleCountDecrement = () => {
    const {count} = store.select(['count'])
    store.set({ count: count - 1 })
  }

  const handleCountReset = () => {
    store.set({ count: 0 })
  }

  const startIncrement = () => {
    isLongPressRef.current = false
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true
      handleCountIncrement()
      intervalRef.current = setInterval(() => {
        handleCountIncrement()
      }, REPEAT_DELAY)
    }, START_DELAY)
  }

  const startDecrement = () => {
    isLongPressRef.current = false
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true
      handleCountDecrement()
      intervalRef.current = setInterval(() => {
        handleCountDecrement()
      }, REPEAT_DELAY)
    }, START_DELAY)
  }

  const stopPress = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleIncrementClick = () => {
    if (!isLongPressRef.current) {
      handleCountIncrement()
    }
    isLongPressRef.current = false
  }

  const handleDecrementClick = () => {
    if (!isLongPressRef.current) {
      handleCountDecrement()
    }
    isLongPressRef.current = false
  }

  return (
    <section className="section">
      <h3>🔢 Counter (with validation middleware)</h3>
      <div className="counter">
        <span className="count-display">Count: {count}</span>
        <div className="button-group">
          <button 
            onMouseDown={startDecrement}
            onMouseUp={stopPress}
            onMouseLeave={stopPress}
            onTouchStart={startDecrement}
            onTouchEnd={stopPress}
            onClick={handleDecrementClick}
          >
            -1
          </button>
          <button 
            onMouseDown={startIncrement}
            onMouseUp={stopPress}
            onMouseLeave={stopPress}
            onTouchStart={startIncrement}
            onTouchEnd={stopPress}
            onClick={handleIncrementClick}
          >
            +1
          </button>
          <button onClick={handleCountReset}>Reset</button>
        </div>
        <p className="help-text">
          Negative values are validated and blocked by middleware
          <br />
          <strong>Hold buttons to rapidly increment/decrement!</strong>
        </p>
      </div>
    </section>
  )
} 