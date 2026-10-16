import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { LanguageProvider } from '../../../packages/i18n/src'
import './tailwind.css'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><LanguageProvider><App /></LanguageProvider></QueryClientProvider></StrictMode>)
