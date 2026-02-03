import React from 'react'
import ReactDOM from 'react-dom/client'
import { Dashboard } from '@/components/Dashboard'
import '@/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
)