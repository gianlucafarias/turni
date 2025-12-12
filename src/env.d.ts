/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CLOUDFLARE_ACCOUNT_ID?: string
  readonly CLOUDFLARE_R2_ACCESS_KEY_ID?: string
  readonly CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string
  readonly CLOUDFLARE_R2_BUCKET_NAME?: string
  readonly CLOUDFLARE_R2_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
import type { User, Session } from '@supabase/supabase-js'

declare namespace App {
  interface Locals {
    user?: User
    session?: Session
    store?: {
      id: string
      name: string
      user_id: string
      store_type: 'products' | 'appointments'
      setup_completed: boolean
      plan: string
      products_count: number
      created_at: string
    }
  }
}