import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Типы для базы данных
export interface Item {
    id: number | string
    name: string
    type: 'raw_material' | 'finished_good'
    unit_cost: number
    is_weighted?: boolean
    weight_per_pack?: number // Вес одной упаковки в граммах (для автозаполнения)
    icon?: string
    sale_price?: number // Рекомендуемая цена продажи
    batch_time_minutes?: number // Время производства одной партии в минутах
    max_batch_size?: number // Максимальный размер партии
    notes?: string // Заметки/инструкции для оператора

}

export interface Inventory {
    location_id: number | string
    item_id: number | string
    quantity: number
}

export interface Location {
    id: string  // UUID в базе данных
    name: string
    type: 'warehouse' | 'transit' | 'client'
    address?: string
    contact?: string
    latitude?: number
    longitude?: number
    status?: string  // Статус клиента: active, consignment, waiting_call, inactive
}

export interface Recipe {
    finished_good_id: number | string
    ingredient_id: number | string
    quantity: number
    returns_to_raw?: boolean  // Если true, результат возвращается в сырьё
    production_time_minutes?: number  // Время производства в минутах
}

export interface InventoryMove {
    id?: number
    item_id: number | string
    from_location_id?: number | string
    to_location_id?: number | string
    quantity: number
    type: 'purchase' | 'sale' | 'transfer' | 'production'
    unit_price?: number
    created_at?: string
    payment_date?: string
}

export interface ProductionQueueItem {
    id: number
    finished_good_id: string  // UUID
    quantity: number
    output_weight?: number  // Итоговый вес для промежуточной обработки
    started_at: string
    completes_at: string
    status: 'in_progress' | 'completed' | 'cancelled'
    location_id?: string
    created_at: string
}

// Типы для финансов
export interface FinancialCategory {
    id: number
    name: string
    type: 'capex' | 'opex' | 'income'
    is_system?: boolean
}

export interface Transaction {
    id: number
    created_at: string
    type: 'income' | 'expense'
    category_id?: number // Link to FinancialCategory
    category?: string // Legacy string fallback
    amount: number
    client_id?: string
    description?: string
    date: string
    is_capex?: boolean
    asset_id?: number
    categories?: FinancialCategory // Join
}

export interface Asset {
    id: number
    created_at: string
    name: string
    category: 'equipment' | 'furniture' | 'vehicle' | 'other'
    purchase_price: number
    purchase_date: string
    description?: string
    status: 'active' | 'sold' | 'written_off'
    current_value?: number
}

export interface Balance {
    id: number
    current_balance: number
    initial_capital: number
    updated_at: string
}
