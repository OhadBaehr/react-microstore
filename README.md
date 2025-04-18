# react-microstore

A minimal global state manager for React with fine-grained subscriptions.

## Installation

```bash
npm install react-microstore
```

## Usage

```tsx
import { createStoreState, useStoreSelector } from 'react-microstore';

const counterStore = createStoreState({ count: 0 });

function Counter() {
  const { count } = useStoreSelector(counterStore, ['count']);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => counterStore.set({ count: count + 1 })}>
        Increment
      </button>
    </div>
  );
}
```

## Custom Comparison Function

```tsx
import { createStoreState, useStoreSelector } from 'react-microstore';

const taskStore = createStoreState({
  tasks: [
    { id: 1, title: 'Learn React', completed: false, priority: 'high' },
    { id: 2, title: 'Build app', completed: false, priority: 'medium' }
  ],
  filters: {
    showCompleted: true,
    priorityFilter: null
  }
});

function TaskList() {
  // Only re-render when task completion status changes
  const { tasks } = useStoreSelector(taskStore, [
    { 
      tasks: (prev, next) => 
        !prev.some((task, i) => task.id === next?.[i]?.id && task.completed !== next[i].completed)
    }
  ]);
  
  const toggleTask = (id) => {
    const currentTasks = taskStore.get().tasks;
    const updatedTasks = currentTasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    
    taskStore.set({ tasks: updatedTasks });
  };
  
  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id}>
          {task.title} - {task.completed ? 'Done' : 'Pending'}
          <button onClick={() => toggleTask(task.id)}>
            Toggle
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Example of setting store from outside components

```tsx
import { createStoreState, useStoreSelector } from 'react-microstore';

// Create store
const userStore = createStoreState({
  user: null,
  isLoading: false,
  error: null
});

// Function to update store from anywhere
export async function fetchUserData(userId) {
  // Update loading state
  userStore.set({ isLoading: true, error: null });
  
  try {
    // API call
    const response = await fetch(`/api/users/${userId}`);
    const userData = await response.json();
    
    // Update store with fetched data
    userStore.set({ 
      user: userData,
      isLoading: false 
    });
    
    return userData;
  } catch (error) {
    // Update store with error
    userStore.set({ 
      error: error.message,
      isLoading: false 
    });
    
    throw error;
  }
}

// Components can use the store
function UserProfile() {
  const { user, isLoading, error } = useStoreSelector(userStore, ['user', 'isLoading', 'error']);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user data</div>;
  
  return (
    <div>
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
    </div>
  );
}

// Can call the function from anywhere
// fetchUserData('123');
```

## Features

- Extremely lightweight (less than 2KB minified)
- Fine-grained subscriptions to minimize re-renders
- Custom comparison functions for complex state updates
- Fully Type-safe
- No dependencies other than React
- Update store from anywhere in your application

## Development Tools

### ESLint Plugin

[eslint-plugin-react-microstore](https://www.npmjs.com/package/eslint-plugin-react-microstore) provides ESLint rules to help you write with react-microstore.

#### Installation

```bash
npm install --save-dev eslint-plugin-react-microstore
```

#### Usage

ESLint configuration:

```tsx
import reactMicrostore from 'eslint-plugin-react-microstore';

const eslintConfig = [{
    "plugins": {
      "react-microstore": reactMicrostore
    },
    "rules": {
      "react-microstore/no-unused-selector-keys": "warn"
    }
}]
```

 `react-microstore/no-unused-selector-keys`  
  Warns when you select keys in `useStoreSelector` but don't destructure or use them.

```tsx
// ❌ This will trigger the rule
const { a } = useStoreSelector(store, ['a', 'b']); // 'b' is unused

// ✅ This is fine
const { a, b } = useStoreSelector(store, ['a', 'b']);
```