import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LanguageProvider } from '../../../packages/i18n/src'
import { SellerThemeProvider } from './lib/theme'
import './tailwind.css'
import './styles.css'
import { App } from './App'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><LanguageProvider><SellerThemeProvider><App /></SellerThemeProvider></LanguageProvider></QueryClientProvider></StrictMode>)
