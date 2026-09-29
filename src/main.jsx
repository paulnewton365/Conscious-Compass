import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installApiAuth } from './lib/apiAuth'

// Every /api/ call carries the session token the endpoints require (v3.100.1).
installApiAuth()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
