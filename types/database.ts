export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            achievements: {
                Row: {
                    category: string | null
                    code: string
                    color: string | null
                    created_at: string | null
                    description: string | null
                    icon: string | null
                    id: string
                    name: string
                    requirement_type: string | null
                    requirement_value: number | null
                    xp_reward: number | null
                }
                Insert: {
                    category?: string | null
                    code: string
                    color?: string | null
                    created_at?: string | null
                    description?: string | null
                    icon?: string | null
                    id?: string
                    name: string
                    requirement_type?: string | null
                    requirement_value?: number | null
                    xp_reward?: number | null
                }
                Update: {
                    category?: string | null
                    code?: string
                    color?: string | null
                    created_at?: string | null
                    description?: string | null
                    icon?: string | null
                    id?: string
                    name?: string
                    requirement_type?: string | null
                    requirement_value?: number | null
                    xp_reward?: number | null
                }
                Relationships: []
            }
            expiry_items: {
                Row: {
                    checked_at: string | null
                    checked_by: string | null
                    created_at: string | null
                    expiry_date: string | null
                    id: string
                    mfg_date: string | null
                    note: string | null
                    product_id: string
                    quantity: number | null
                    status: string | null
                    store_id: string
                    type: Database["public"]["Enums"]["expiry_type"]
                    updated_at: string | null
                }
                Insert: {
                    checked_at?: string | null
                    checked_by?: string | null
                    created_at?: string | null
                    expiry_date?: string | null
                    id?: string
                    mfg_date?: string | null
                    note?: string | null
                    product_id: string
                    quantity?: number | null
                    status?: string | null
                    store_id: string
                    type: Database["public"]["Enums"]["expiry_type"]
                    updated_at?: string | null
                }
                Update: {
                    checked_at?: string | null
                    checked_by?: string | null
                    created_at?: string | null
                    expiry_date?: string | null
                    id?: string
                    mfg_date?: string | null
                    note?: string | null
                    product_id?: string
                    quantity?: number | null
                    status?: string | null
                    store_id?: string
                    type?: Database["public"]["Enums"]["expiry_type"]
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "expiry_items_checked_by_fkey"
                        columns: ["checked_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "expiry_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "expiry_items_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_history: {
                Row: {
                    actual_stock: number | null
                    check_date: string
                    checked_by: string | null
                    created_at: string | null
                    diff: number | null
                    id: string
                    note: string | null
                    product_id: string
                    shift: number
                    status: Database["public"]["Enums"]["inventory_status"] | null
                    store_id: string
                    system_stock: number | null
                }
                Insert: {
                    actual_stock?: number | null
                    check_date: string
                    checked_by?: string | null
                    created_at?: string | null
                    diff?: number | null
                    id?: string
                    note?: string | null
                    product_id: string
                    shift: number
                    status?: Database["public"]["Enums"]["inventory_status"] | null
                    store_id: string
                    system_stock?: number | null
                }
                Update: {
                    actual_stock?: number | null
                    check_date?: string
                    checked_by?: string | null
                    created_at?: string | null
                    diff?: number | null
                    id?: string
                    note?: string | null
                    product_id?: string
                    shift?: number
                    status?: Database["public"]["Enums"]["inventory_status"] | null
                    store_id?: string
                    system_stock?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_history_checked_by_fkey"
                        columns: ["checked_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_history_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_history_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_items: {
                Row: {
                    actual_stock: number | null
                    check_date: string
                    checked_at: string | null
                    checked_by: string | null
                    created_at: string | null
                    diff: number | null
                    id: string
                    note: string | null
                    product_id: string
                    shift: number
                    status: Database["public"]["Enums"]["inventory_status"] | null
                    store_id: string
                    system_stock: number | null
                    updated_at: string | null
                }
                Insert: {
                    actual_stock?: number | null
                    check_date?: string
                    checked_at?: string | null
                    checked_by?: string | null
                    created_at?: string | null
                    diff?: number | null
                    id?: string
                    note?: string | null
                    product_id: string
                    shift: number
                    status?: Database["public"]["Enums"]["inventory_status"] | null
                    store_id: string
                    system_stock?: number | null
                    updated_at?: string | null
                }
                Update: {
                    actual_stock?: number | null
                    check_date?: string
                    checked_at?: string | null
                    checked_by?: string | null
                    created_at?: string | null
                    diff?: number | null
                    id?: string
                    note?: string | null
                    product_id?: string
                    shift?: number
                    status?: Database["public"]["Enums"]["inventory_status"] | null
                    store_id?: string
                    system_stock?: number | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_items_checked_by_fkey"
                        columns: ["checked_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_items_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            products: {
                Row: {
                    barcode: string
                    category: string | null
                    created_at: string | null
                    expiry_days: number | null
                    id: string
                    name: string
                    pvn: string | null
                    unit: string | null
                    unit_price: number | null
                }
                Insert: {
                    barcode: string
                    category?: string | null
                    created_at?: string | null
                    expiry_days?: number | null
                    id?: string
                    name: string
                    pvn?: string | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Update: {
                    barcode?: string
                    category?: string | null
                    created_at?: string | null
                    expiry_days?: number | null
                    id?: string
                    name?: string
                    pvn?: string | null
                    unit?: string | null
                    unit_price?: number | null
                }
                Relationships: []
            }
            recovery_items: {
                Row: {
                    check_date: string | null
                    created_at: string | null
                    created_by: string | null
                    id: string
                    missing_qty: number
                    note: string | null
                    product_id: string
                    reason: string | null
                    recovered_amount: number | null
                    status: string | null
                    store_id: string
                    unit_price: number | null
                    updated_at: string | null
                }
                Insert: {
                    check_date?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    id?: string
                    missing_qty: number
                    note?: string | null
                    product_id: string
                    reason?: string | null
                    recovered_amount?: number | null
                    status?: string | null
                    store_id: string
                    unit_price?: number | null
                    updated_at?: string | null
                }
                Update: {
                    check_date?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    id?: string
                    missing_qty?: number
                    note?: string | null
                    product_id?: string
                    reason?: string | null
                    recovered_amount?: number | null
                    status?: string | null
                    store_id?: string
                    unit_price?: number | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "recovery_items_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "recovery_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "recovery_items_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            stores: {
                Row: {
                    address: string | null
                    code: string
                    created_at: string | null
                    id: string
                    name: string
                }
                Insert: {
                    address?: string | null
                    code: string
                    created_at?: string | null
                    id?: string
                    name: string
                }
                Update: {
                    address?: string | null
                    code?: string
                    created_at?: string | null
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            tasks: {
                Row: {
                    assignee_id: string | null
                    completed_items: number | null
                    created_at: string | null
                    description: string | null
                    due_date: string | null
                    id: string
                    status: Database["public"]["Enums"]["task_status"] | null
                    store_id: string | null
                    target_items: number | null
                    title: string
                    type: Database["public"]["Enums"]["task_type"] | null
                    updated_at: string | null
                }
                Insert: {
                    assignee_id?: string | null
                    completed_items?: number | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    id?: string
                    status?: Database["public"]["Enums"]["task_status"] | null
                    store_id?: string | null
                    target_items?: number | null
                    title: string
                    type?: Database["public"]["Enums"]["task_type"] | null
                    updated_at?: string | null
                }
                Update: {
                    assignee_id?: string | null
                    completed_items?: number | null
                    created_at?: string | null
                    description?: string | null
                    due_date?: string | null
                    id?: string
                    status?: Database["public"]["Enums"]["task_status"] | null
                    store_id?: string | null
                    target_items?: number | null
                    title?: string
                    type?: Database["public"]["Enums"]["task_type"] | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tasks_assignee_id_fkey"
                        columns: ["assignee_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tasks_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_achievements: {
                Row: {
                    achievement_id: string | null
                    earned_at: string | null
                    id: string
                    user_id: string | null
                }
                Insert: {
                    achievement_id?: string | null
                    earned_at?: string | null
                    id?: string
                    user_id?: string | null
                }
                Update: {
                    achievement_id?: string | null
                    earned_at?: string | null
                    id?: string
                    user_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_achievements_achievement_id_fkey"
                        columns: ["achievement_id"]
                        isOneToOne: false
                        referencedRelation: "achievements"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "user_achievements_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            users: {
                Row: {
                    avatar_url: string | null
                    created_at: string | null
                    employee_id: string
                    id: string
                    level: number | null
                    name: string
                    password_hash: string
                    role: Database["public"]["Enums"]["user_role"] | null
                    store_id: string | null
                    updated_at: string | null
                    username: string
                    xp: number | null
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string | null
                    employee_id?: string
                    id?: string
                    level?: number | null
                    name: string
                    password_hash: string
                    role?: Database["public"]["Enums"]["user_role"] | null
                    store_id?: string | null
                    updated_at?: string | null
                    username: string
                    xp?: number | null
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string | null
                    employee_id?: string
                    id?: string
                    level?: number | null
                    name?: string
                    password_hash?: string
                    role?: Database["public"]["Enums"]["user_role"] | null
                    store_id?: string | null
                    updated_at?: string | null
                    username?: string
                    xp?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "users_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            xp_logs: {
                Row: {
                    amount: number
                    created_at: string | null
                    id: string
                    source: string | null
                    user_id: string | null
                }
                Insert: {
                    amount: number
                    created_at?: string | null
                    id?: string
                    source?: string | null
                    user_id?: string | null
                }
                Update: {
                    amount?: number
                    created_at?: string | null
                    id?: string
                    source?: string | null
                    user_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "xp_logs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            expiry_view: {
                Row: {
                    barcode: string | null
                    category: string | null
                    checked_at: string | null
                    checked_by: string | null
                    expiry_date: string | null
                    id: string | null
                    mfg_date: string | null
                    note: string | null
                    product_id: string | null
                    product_name: string | null
                    quantity: number | null
                    status: string | null
                    store_id: string | null
                    store_name: string | null
                    type: Database["public"]["Enums"]["expiry_type"] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "expiry_items_checked_by_fkey"
                        columns: ["checked_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "expiry_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "expiry_items_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_view: {
                Row: {
                    actual_stock: number | null
                    barcode: string | null
                    category: string | null
                    checked_at: string | null
                    checked_by: string | null
                    diff: number | null
                    id: string | null
                    note: string | null
                    product_id: string | null
                    product_name: string | null
                    shift: number | null
                    status: Database["public"]["Enums"]["inventory_status"] | null
                    store_id: string | null
                    store_name: string | null
                    system_stock: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_items_checked_by_fkey"
                        columns: ["checked_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_items_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_items_store_id_fkey"
                        columns: ["store_id"]
                        isOneToOne: false
                        referencedRelation: "stores"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Functions: {
            award_xp: {
                Args: {
                    p_user_id: string
                    p_amount: number
                    p_source?: string
                }
                Returns: {
                    new_xp: number
                    new_level: number
                }[]
            }
            calculate_expiry_days: {
                Args: {
                    expiry_date: string
                }
                Returns: number
            }
        }
        Enums: {
            expiry_type: "TỦ MÁT" | "BÁNH MÌ"
            inventory_status: "PENDING" | "MATCHED" | "MISSING" | "OVER"
            task_status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
            task_type: "GENERAL" | "AUDIT" | "EXPIRY"
            user_role: "ADMIN" | "EMPLOYEE"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
