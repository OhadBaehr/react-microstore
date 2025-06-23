import { createStoreState, createPersistenceMiddleware, loadPersistedState } from '../../src/index';

// Define our app state interface
interface AppState {
  count: number;
  userName: string;
  userEmail: string;
  isLoggedIn: boolean;
  userError: string;
  theme: 'light' | 'dark';
  todos: Array<{ id: number; text: string; completed: boolean }>;
  searchResults: string[];
  isSearching: boolean;
  logs: Array<{ id: number; message: string; type: string; timestamp: string }>;
  // Complex object for custom compare demo
  gameState: {
    player: {
      name: string;
      health: number;
      mana: number;
      level: number;
      experience: number;
    };
    enemy: {
      name: string;
      health: number;
      damage: number;
      isAlive: boolean;
    };
    ui: {
      showInventory: boolean;
      showMap: boolean;
      notifications: string[];
    };
    turn: 'player' | 'enemy';
    isProcessingTurn: boolean;
  };
}

// Load persisted state
const persistedState = loadPersistedState<AppState>(
  localStorage, 
  'microstore-example', 
  ['userName', 'userEmail', 'isLoggedIn', 'theme']
);

// Create store with initial state merged with persisted state
const store = createStoreState<AppState>({
  count: 0,
  userName: '',
  userEmail: '',
  isLoggedIn: false,
  userError: '',
  theme: 'light',
  ...persistedState, // Apply persisted state
  todos: [],
  searchResults: [],
  isSearching: false,
  logs: [],
  // Complex object for custom compare demo
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
});

// Persistence
store.addMiddleware(createPersistenceMiddleware(localStorage, 'microstore-example', ['userName', 'userEmail', 'isLoggedIn', 'theme']));

// Block negative counts
store.addMiddleware((state, update, next) => {
  if (update.count !== undefined && update.count < 0) {
    addLog(`Blocked: ${formatValue(state.count)} → ${formatValue(update.count)}`, 'error');
    return;
  }
  next();
}, ['count']);

// Email validation
store.addMiddleware((state, update, next) => {
  if (update.userEmail && !update.userEmail.includes('@')) {
    addLog(`Blocked: ${formatValue(state.userEmail)} → ${formatValue(update.userEmail)}`, 'error');
    next({ userError: 'Invalid email format' });
    return;
  }
  if (update.userEmail !== undefined) {
    next({ ...update, userError: '' });
  } else {
    next();
  }
}, ['userEmail']);

// Auto-normalize user data
store.addMiddleware((_, update, next) => {
  const mod = { ...update };
  let changed = false;
  
  if (update.userName) {
    const norm = update.userName.trim().toUpperCase();
    if (norm !== update.userName) { mod.userName = norm; changed = true; }
  }
  
  if (update.userEmail) {
    const norm = update.userEmail.trim().toLowerCase();
    if (norm !== update.userEmail) { mod.userEmail = norm; changed = true; }
  }
  
  if (changed) addLog('Transform: name/email normalized', 'info');
  next(mod);
}, ['userName', 'userEmail']);

// Log all changes
store.addMiddleware((state, update, next) => {
  Object.keys(update).filter(k => k !== 'logs').forEach(key => {
    const before = state[key as keyof AppState];
    const after = update[key as keyof AppState];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      addLog(`${key}: ${formatValue(before)} → ${formatValue(after)}`, 'info');
    }
  });
  next();
});

// Helper function to format values for display
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2);
      const lines = str.split('\n');
      if (lines.length > 5) {
        return lines.slice(0, 4).join('\n') + '\n  ...\n}';
      }
      return str;
    } catch {
      return '{object}';
    }
  }
  return String(value);
}

// Mock search function
function performSearch(query: string): string[] {
  const mockData = [
    'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js',
    'Express', 'MongoDB', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes'
  ];
  
  if (!query.trim()) return [];
  
  return mockData.filter(item => 
    item.toLowerCase().includes(query.toLowerCase())
  );
}

// Search functionality with debouncing
export function updateSearchQuery(query: string) {
  // Check current state
  const {isSearching} = store.select(['isSearching']);
  const results = performSearch(query);

  if(!query){
    store.set({
      searchResults: [],
      isSearching: false
    });
    return;
  }

  if(!isSearching) {
    store.set({ 
      isSearching: query.length > 0 
    });
  }
  
  // Debounced search execution (300ms delay)
  store.set({
    searchResults: results,
    isSearching: false
  }, 300);
}

// Helper function to add logs to store
let logCounter = 0;
function addLog(message: string, type: string = 'info') {
  const currentState = store.get();
  const newLog = {
    id: Date.now() + (++logCounter), // Ensure unique IDs
    message,
    type,
    timestamp: new Date().toLocaleTimeString()
  };
  
  // Keep only last 50 logs
  const newLogs = [...currentState.logs, newLog].slice(-50);
  
  // Update logs without triggering middleware (direct state update)
  store.set({ logs: newLogs });
}

export default store; 