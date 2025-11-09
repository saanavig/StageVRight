import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  server: {
    host: true,
    https: {
      cert: fs.readFileSync('./src/certs/192.168.4.39+2.pem'),
      key: fs.readFileSync('./src/certs/192.168.4.39+2-key.pem')
    }
  },
  preview: {
    host: true,
    https: {
      cert: fs.readFileSync('./src/certs/192.168.4.39+2.pem'),
      key: fs.readFileSync('./src/certs/192.168.4.39+2-key.pem')
    }
  }
})
