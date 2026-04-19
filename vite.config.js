import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const closeOnServerStop = {
  name: 'close-on-server-stop',
  transformIndexHtml() {
    return [{ tag: 'script', attrs: { type: 'module' }, children:
      `const _ws=new WebSocket('ws://'+location.host);_ws.onclose=()=>window.close()`
    }]
  }
}

export default defineConfig({
  plugins: [react(), closeOnServerStop],
  base: './',
})
