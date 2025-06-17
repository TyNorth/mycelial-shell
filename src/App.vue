<script setup>
import { reactive, onMounted } from 'vue'
import { assert, ValidationError } from './mycoassert'

// --- The Shell's Context (CTX) ---
const shellCTX = reactive({
  data: {
    users: {
      get: async (userId) => {
        console.log(`SHELL: Fetching user with ID: ${userId}...`)
        return { id: userId, name: 'Mock User', email: 'user@shell.com' }
      },
    },
  },
  services: {
    notifications: {
      send: (userId, message) => {
        console.log(`SHELL: Sending notification to ${userId}: "${message}"`)
        alert(`Notification for user ${userId}:\n${message}`)
      },
    },
  },
  state: {
    currentUser: { id: 1, name: 'Host User' },
  },
  utils: {
    assert,
    ValidationError,
  },
})

// --- Spore Loading Logic ---
const loadSpore = (sporeName, targetElementId) => {
  // --- CORRECTED PATH: Removed the '/dist' part ---
  const scriptSrc = `http://localhost:5174/spore.umd.js`

  const script = document.createElement('script')
  script.src = scriptSrc

  script.onload = () => {
    console.log(`SHELL: Spore script '${sporeName}' loaded.`)
    const spore = window.SporeUserRegistration

    if (spore && typeof spore.mount === 'function') {
      const targetElement = document.getElementById(targetElementId)
      if (targetElement) {
        spore.mount(targetElement, shellCTX)
        console.log(`SHELL: Successfully mounted '${sporeName}' into #${targetElementId}.`)
      } else {
        console.error(`SHELL: Target element #${targetElementId} not found.`)
      }
    } else {
      console.error(`SHELL: Spore '${sporeName}' did not expose a valid mount function.`)
    }
  }

  script.onerror = () => {
    console.error(`SHELL: Failed to load spore script from ${scriptSrc}.`)
  }

  document.head.appendChild(script)
}

onMounted(() => {
  loadSpore('SporeUserRegistration', 'spore-host-1')
})
</script>

<template>
  <div class="shell-container">
    <header class="shell-header">
      <h1 class="shell-title">MycelialShell</h1>
      <p class="shell-status">Status: Running</p>
    </header>

    <main class="spore-grid">
      <div id="spore-host-1" class="spore-host">
        <p class="spore-description">Loading User Registration Spore...</p>
      </div>
      <div class="spore-host">
        <h2 class="spore-title">Spore 2 Placeholder</h2>
        <p class="spore-description">Another Spore could be loaded here.</p>
      </div>
    </main>

    <footer class="shell-footer">
      <p>Mycelial Shell Context (CTX) is initialized and ready.</p>
    </footer>
  </div>
</template>

<style scoped>
/* Styles are the same as before */
.shell-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    sans-serif;
  background-color: #1a1a1a;
  color: #f0f0f0;
}
.shell-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #333;
  text-align: center;
}
.shell-title {
  font-size: 2rem;
  font-weight: 700;
  color: #a78bfa;
}
.shell-status {
  color: #888;
}
.spore-grid {
  flex-grow: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  padding: 2rem;
}
.spore-host {
  border: 2px dashed #444;
  border-radius: 8px;
  padding: 1.5rem;
  background-color: #242424;
  min-height: 400px;
}
.spore-title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}
.spore-description {
  color: #999;
}
.shell-footer {
  padding: 1rem 2rem;
  border-top: 1px solid #333;
  text-align: center;
  font-size: 0.8rem;
  color: #666;
}
</style>
