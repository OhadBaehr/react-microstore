import { useState, useEffect } from 'react'
import { useStoreSelector } from '../../../src/index'
import store from '../store'

export default function UserManager() {
  const { userName: currentUserName, userEmail: currentUserEmail, isLoggedIn, userError } = useStoreSelector(store, ['userName', 'userEmail', 'isLoggedIn', 'userError'])
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // Clear form on successful login
  useEffect(() => {
    if (isLoggedIn && !userError) {
      setUserName('')
      setUserEmail('')
    }
  }, [isLoggedIn, userError])

  const handleUserUpdate = () => {
    store.set({
      userName,
      userEmail,
      isLoggedIn: true
    })
  }

  const handleUserLogout = () => {
    store.set({
      userName: '',
      userEmail: '',
      isLoggedIn: false
    })
  }

  return (
    <section className="section">
      <h3>👤 User Management (with persistence & transformation)</h3>
      <div className="user-info">
        {isLoggedIn ? (
          <div>
            <p><strong>Name:</strong> {currentUserName}</p>
            <p><strong>Email:</strong> {currentUserEmail}</p>
            <button onClick={handleUserLogout}>Logout</button>
          </div>
        ) : (
          <div className="user-form">
            <input
              type="text"
              placeholder="Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
            <button onClick={handleUserUpdate}>Login</button>
            {userError && <div className="error-message">{userError}</div>}
            <p className="help-text">
              Names are normalized and emails are validated *
            </p>
          </div>
        )}
      </div>
    </section>
  )
} 