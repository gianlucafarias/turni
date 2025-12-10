import type { User } from '@supabase/supabase-js';

export interface Store {
  id: string;
  name: string;
  description: string;
  store_type: 'products' | 'appointments';
  user_id: string;
  created_at: string;
  updated_at: string;
}

declare namespace App {
  interface Locals {
    user?: User;
    store?: Store;
  }
} 