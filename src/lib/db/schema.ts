export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          created_at: string
          name: string
          user_id: string
          plan: string
          store_type: 'products' | 'appointments'
          products_count: number
          setup_completed: boolean
          description: string
          location: string
          whatsapp_url?: string
          twitter_url?: string
          banner_url?: string
          logo_url?: string
          business_category?: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          user_id: string
          plan?: string
          store_type?: 'products' | 'appointments'
          products_count?: number
          setup_completed?: boolean
          description?: string
          location?: string
          whatsapp_url?: string
          twitter_url?: string
          banner_url?: string
          logo_url?: string
          business_category?: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          user_id?: string
          plan?: string
          store_type?: 'products' | 'appointments'
          products_count?: number
          setup_completed?: boolean
          description?: string
          location?: string
          whatsapp_url?: string
          twitter_url?: string
          banner_url?: string
          logo_url?: string
          business_category?: string
        }
      }
      products: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string
          price: number
          store_id: string
          image_url: string
          stock: number
          active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description: string
          price: number
          store_id: string
          image_url: string
          stock?: number
          active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string
          price?: number
          store_id?: string
          image_url?: string
          stock?: number
          active?: boolean
        }
      }
      appointments: {
        Row: {
          id: string
          created_at: string
          store_id: string
          client_name: string
          client_email: string
          date: string
          time: string
          duration: number
          status: 'pending' | 'confirmed' | 'cancelled'
          service_name: string
          service_price: number
        }
        Insert: {
          id?: string
          created_at?: string
          store_id: string
          client_name: string
          client_email: string
          date: string
          time: string
          duration: number
          status?: 'pending' | 'confirmed' | 'cancelled'
          service_name: string
          service_price: number
        }
        Update: {
          id?: string
          created_at?: string
          store_id?: string
          client_name?: string
          client_email?: string
          date?: string
          time?: string
          duration?: number
          status?: 'pending' | 'confirmed' | 'cancelled'
          service_name?: string
          service_price?: number
        }
      }
    }
  }
} 