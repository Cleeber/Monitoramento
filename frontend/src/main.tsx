import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// The production proxy caches CSS URLs; version this release to refresh styles.
import './index.css?admin-relayout=20261013'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
