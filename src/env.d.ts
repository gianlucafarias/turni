/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
import type { User } from '@supabase/supabase-js'

declare namespace App {
  interface Locals {
    user?: User
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