/// <reference types="vinxi/types/client" />
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'
import { PostHogProvider } from 'posthog-js/react'

const router = createRouter()

hydrateRoot(document, (
  <PostHogProvider
    apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
    options={{
      api_host: 'https://us.i.posthog.com',
    }}
  >
    <StartClient router={router} />
  </PostHogProvider>
))
