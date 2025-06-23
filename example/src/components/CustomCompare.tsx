import { useEffect } from 'react'
import { useStoreSelector } from '../../../src/index'
import store from '../store'

// Child component that only animates when player health changes
function PlayerHealthBar() {
  const { gameState } = useStoreSelector(store, [
    {
      gameState: (prev, next) => {
        // Only re-render if player health changes
        return prev.player.health === next.player.health
      }
    }
  ])

  return (
    <div className="health-bar" key={gameState.player.health}>
      <div className="bar-label">Player Health</div>
      <div className="bar-container">
        <div 
          className="bar-fill health-fill animate-change" 
          style={{ width: `${gameState.player.health}%` }}
        >
          {gameState.player.health}/100
        </div>
      </div>
    </div>
  )
}

// Child component that only animates when player mana changes
function PlayerManaBar() {
  const { gameState } = useStoreSelector(store, [
    {
      gameState: (prev, next) => {
        // Only re-render if player mana changes
        return prev.player.mana === next.player.mana
      }
    }
  ])

  return (
    <div className="mana-bar" key={gameState.player.mana}>
      <div className="bar-label">Player Mana</div>
      <div className="bar-container">
        <div 
          className="bar-fill mana-fill animate-change" 
          style={{ width: `${gameState.player.mana * 2}%` }}
        >
          {gameState.player.mana}/50
        </div>
      </div>
    </div>
  )
}

// Child component that only animates when enemy health changes
function EnemyHealthBar() {
  const { gameState } = useStoreSelector(store, [
    {
      gameState: (prev, next) => {
        // Only re-render if enemy health, name, or max health changes
        return prev.enemy.health === next.enemy.health && 
               prev.enemy.name === next.enemy.name
      }
    }
  ])

  // Get max health based on enemy type
  const getMaxHealth = (enemyName: string) => {
    const enemies: Record<string, number> = {
      'Goblin': 30,
      'Orc': 50,
      'Troll': 75,
      'Dragon': 120,
      'Wizard': 80,
      'Demon Lord': 150
    }
    return enemies[enemyName] || 30
  }

  const maxHealth = getMaxHealth(gameState.enemy.name)
  const healthPercent = (gameState.enemy.health / maxHealth) * 100

  return (
    <div className="enemy-health" key={`${gameState.enemy.name}-${gameState.enemy.health}`}>
      <div className="bar-label">Enemy: {gameState.enemy.name}</div>
      <div className="bar-container">
        <div 
          className="bar-fill enemy-fill animate-change" 
          style={{ width: `${healthPercent}%` }}
        >
          {gameState.enemy.health}/{maxHealth}
        </div>
      </div>
    </div>
  )
}

// Child component that only animates when UI notifications change
function NotificationPanel() {
  const { gameState } = useStoreSelector(store, [
    {
      gameState: (prev, next) => {
        // Only re-render if notifications change
        return JSON.stringify(prev.ui.notifications) === JSON.stringify(next.ui.notifications)
      }
    }
  ])

  return (
    <div className="notifications" key={gameState.ui.notifications.length}>
      <div className="notification-header">Combat Log</div>
      <div className="notification-list animate-change">
        {gameState.ui.notifications.length === 0 ? (
          <div className="no-notifications">Ready for battle!</div>
        ) : (
          gameState.ui.notifications.slice(-5).map((notification, index) => (
            <div key={index} className="notification-item">
              {notification}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function CustomCompare() {
  const { gameState } = useStoreSelector(store, ['gameState'])

  // Handle enemy AI turn automatically
  useEffect(() => {
    if (gameState.turn === 'enemy' && !gameState.isProcessingTurn && gameState.player.health > 0) {
      // Set processing flag to prevent multiple AI actions
      store.set({
        gameState: {
          ...gameState,
          isProcessingTurn: true
        }
      })

      // AI action after 1 second delay
      setTimeout(() => {
        const currentState = store.get().gameState
        
        if (currentState.player.health <= 0) return // Player already dead
        
        // AI chooses action based on enemy type
        const enemyActions = {
          'Goblin': ['scratch', 'bite'],
          'Orc': ['club', 'roar', 'charge'],
          'Troll': ['smash', 'regenerate', 'throw_rock'],
          'Dragon': ['fire_breath', 'claw', 'wing_attack'],
          'Wizard': ['magic_missile', 'lightning', 'heal'],
          'Demon Lord': ['dark_magic', 'soul_drain', 'summon']
        }
        
        const availableActions = enemyActions[currentState.enemy.name as keyof typeof enemyActions] || ['attack']
        const action = availableActions[Math.floor(Math.random() * availableActions.length)]
        
        let damage = 0
        let actionText = ''
        let newEnemyHealth = currentState.enemy.health
        
                 switch (action) {
           case 'scratch':
           case 'bite':
           case 'attack':
             damage = 8
             actionText = `${currentState.enemy.name} attacks for ${damage} damage!`
             break
           case 'club':
           case 'smash':
           case 'claw':
             damage = 12
             actionText = `${currentState.enemy.name} uses ${action} for ${damage} damage!`
             break
           case 'fire_breath':
           case 'dark_magic':
             damage = 18
             actionText = `${currentState.enemy.name} casts ${action.replace('_', ' ')} for ${damage} damage!`
             break
           case 'regenerate':
           case 'heal': {
             const maxHealth = getMaxHealth(currentState.enemy.name)
             const healAmount = 15
             newEnemyHealth = Math.min(maxHealth, currentState.enemy.health + healAmount)
             actionText = `${currentState.enemy.name} heals for ${newEnemyHealth - currentState.enemy.health} HP!`
             break
           }
           default:
             damage = 10
             actionText = `${currentState.enemy.name} uses ${action.replace('_', ' ')} for ${damage} damage!`
         }
        
        const newPlayerHealth = Math.max(0, currentState.player.health - damage)
        const newNotifications = [...currentState.ui.notifications, actionText]
        
        store.set({
          gameState: {
            ...currentState,
            player: { ...currentState.player, health: newPlayerHealth },
            enemy: { ...currentState.enemy, health: newEnemyHealth },
            ui: { ...currentState.ui, notifications: newNotifications },
            turn: 'player',
            isProcessingTurn: false
          }
        })
      }, 1000)
    }
  }, [gameState.turn, gameState.isProcessingTurn, gameState])

  const getMaxHealth = (enemyName: string) => {
    const enemies: Record<string, number> = {
      'Goblin': 30,
      'Orc': 50,
      'Troll': 75,
      'Dragon': 120,
      'Wizard': 80,
      'Demon Lord': 150
    }
    return enemies[enemyName] || 30
  }

  const playerAction = (actionType: 'attack' | 'heal' | 'magic' | 'restore' | 'rest') => {
    if (gameState.turn !== 'player' || gameState.isProcessingTurn) return
    
    let newPlayerHealth = gameState.player.health
    let newPlayerMana = gameState.player.mana
    let newEnemyHealth = gameState.enemy.health
    let actionText = ''
    let enemyDefeated = false
    
         switch (actionType) {
       case 'attack': {
         const damage = 15
         newEnemyHealth = Math.max(0, gameState.enemy.health - damage)
         actionText = `You attack ${gameState.enemy.name} for ${damage} damage!`
         enemyDefeated = newEnemyHealth === 0
         break
       }
       case 'heal': {
         if (gameState.player.mana < 10) {
           actionText = 'Not enough mana for healing!'
           break
         }
         const healAmount = 25
         newPlayerHealth = Math.min(100, gameState.player.health + healAmount)
         newPlayerMana = gameState.player.mana - 10
         actionText = `You heal for ${newPlayerHealth - gameState.player.health} HP! (-10 mana)`
         break
       }
       case 'magic': {
         if (gameState.player.mana < 10) {
           actionText = 'Not enough mana!'
           break
         }
         const magicDamage = 25
         newEnemyHealth = Math.max(0, gameState.enemy.health - magicDamage)
         newPlayerMana = gameState.player.mana - 10
         actionText = `You cast fireball for ${magicDamage} damage!`
         enemyDefeated = newEnemyHealth === 0
         break
       }
       case 'restore': {
         const restoreAmount = 20
         newPlayerMana = Math.min(50, gameState.player.mana + restoreAmount)
         actionText = `You meditate and restore ${newPlayerMana - gameState.player.mana} mana!`
         break
       }
       case 'rest': {
         const restoreAmount = 15
         newPlayerHealth = Math.min(100, gameState.player.health + restoreAmount)
         actionText = `You rest and restore ${newPlayerHealth - gameState.player.health} HP!`
         break
       }
     }
     
     let finalNotifications = [...gameState.ui.notifications, actionText]
    let nextTurn: 'player' | 'enemy' = 'enemy'
    let newEnemy = gameState.enemy
    
    if (enemyDefeated && gameState.enemy.isAlive) {
      // Enemy defeated - check if it's the final boss
      if (gameState.enemy.name === 'Demon Lord') {
        // Player wins the game!
        finalNotifications = ['Demon Lord defeated! You are victorious!']
        newEnemy = { ...gameState.enemy, health: 0, isAlive: false }
        nextTurn = 'player'
      } else {
        // Spawn next enemy
        const enemies = [
          { name: 'Goblin', health: 30, damage: 5 },
          { name: 'Orc', health: 50, damage: 8 },
          { name: 'Troll', health: 75, damage: 12 },
          { name: 'Dragon', health: 120, damage: 20 },
          { name: 'Wizard', health: 80, damage: 25 },
          { name: 'Demon Lord', health: 150, damage: 30 }
        ]
        
        const currentEnemyIndex = enemies.findIndex(e => e.name === gameState.enemy.name)
        const nextEnemyIndex = Math.min(currentEnemyIndex + 1, enemies.length - 1)
        const nextEnemy = enemies[nextEnemyIndex]
        
        // Clear all logs and only keep the defeat message
        finalNotifications = [`${gameState.enemy.name} defeated! ${nextEnemy.name} appears!`]
        newEnemy = { ...nextEnemy, isAlive: true }
        nextTurn = 'player' // Stay on player turn for new enemy
      }
    } else {
      // Just update enemy health if not defeated
      newEnemy = { ...gameState.enemy, health: newEnemyHealth }
    }
    
    store.set({
      gameState: {
        ...gameState,
        player: { ...gameState.player, health: newPlayerHealth, mana: newPlayerMana },
        enemy: newEnemy,
        ui: { ...gameState.ui, notifications: finalNotifications },
        turn: nextTurn,
        isProcessingTurn: false
      }
    })
  }

  const resetGame = () => {
    store.set({
      gameState: {
        player: {
          name: 'Player 1',
          health: 100,
          mana: 50,
          level: 1,
          experience: 0
        },
        enemy: {
          name: 'Goblin',
          health: 30,
          damage: 5,
          isAlive: true
        },
        ui: {
          showInventory: false,
          showMap: false,
          notifications: []
        },
        turn: 'player',
        isProcessingTurn: false
      }
    })
  }

  const isPlayerDefeated = gameState.player.health <= 0
  const isPlayerTurn = gameState.turn === 'player'
  const canAct = isPlayerTurn && !gameState.isProcessingTurn && !isPlayerDefeated
  const isGameWon = gameState.enemy.name === 'Demon Lord' && !gameState.enemy.isAlive
  
  // Add defeat log when player is defeated
  useEffect(() => {
    if (isPlayerDefeated && gameState.ui.notifications.length > 0 && 
        !gameState.ui.notifications.some(n => n.includes('You have been defeated'))) {
      store.set({
        gameState: {
          ...gameState,
          ui: {
            ...gameState.ui,
            notifications: [...gameState.ui.notifications, 'You have been defeated!']
          }
        }
      })
    }
  }, [isPlayerDefeated, gameState])

  return (
    <section className="section">
      <h3>⚙️ Custom Compare Functions Demo</h3>
      <p className="demo-description">
        Each UI component below uses a custom compare function to only re-render when its specific data changes.
        Watch the flash animations - they only trigger when that component's subscribed data updates!
      </p>
      
      {isPlayerDefeated ? (
        <div className="game-over">
          <div className="defeated-message">DEFEATED</div>
          <button onClick={resetGame}>Reset Game</button>
        </div>
      ) : isGameWon ? (
        <div className="game-over">
          <div className="defeated-message" style={{color: '#4CAF50'}}>VICTORY!</div>
          <button onClick={resetGame}>Play Again</button>
        </div>
      ) : (
        <>
          <div className="turn-indicator">
            {gameState.isProcessingTurn ? (
              <div className="processing-turn">Processing...</div>
            ) : (
              <div className={`turn-display ${gameState.turn}`}>
                {gameState.turn === 'player' ? '🗡️ Your Turn' : '👹 Enemy Turn'}
              </div>
            )}
          </div>
          
          <div className="game-controls">
            <button 
              onClick={() => playerAction('attack')} 
              disabled={!canAct}
            >
              ⚔️ Attack (15 dmg)
            </button>
            <button 
              onClick={() => playerAction('heal')} 
              disabled={!canAct}
            >
              ❤️ Heal (+25 HP, -10 mana)
            </button>
            <button 
              onClick={() => playerAction('magic')} 
              disabled={!canAct || gameState.player.mana < 10}
            >
              🔥 Fireball (25 dmg, -10 mana)
            </button>
            <button 
              onClick={() => playerAction('restore')} 
              disabled={!canAct}
            >
              🧘 Restore Mana (+20)
            </button>
            <button 
              onClick={() => playerAction('rest')} 
              disabled={!canAct}
            >
              😴 Rest (+15 HP)
            </button>
            <button onClick={resetGame} className="small">Reset Game</button>
          </div>
        </>
      )}

      <div className="game-ui">
        <div className="player-stats">
          <PlayerHealthBar />
          <PlayerManaBar />
        </div>
        
        <div className="enemy-stats">
          <EnemyHealthBar />
        </div>
        
        <div className="ui-panel">
          <NotificationPanel />
        </div>
      </div>

      <div className="help-text">
        <strong>Fine-grained subscriptions:</strong> Each health/mana bar only re-renders when its specific data changes.
        <br />
        <strong>Performance optimization:</strong> PlayerHealthBar won't re-render when mana changes, EnemyHealthBar won't re-render when player stats change, etc.
        <br />
        The flash animations demonstrate exactly when each component updates - notice how they're independent!
      </div>
    </section>
  )
} 