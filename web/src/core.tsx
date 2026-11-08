import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CoreApp from './CoreApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CoreApp />
  </StrictMode>,
)
