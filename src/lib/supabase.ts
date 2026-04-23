import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DragonAccount = {
  id: string
  account: string
  class_base: string
  class_path: string[]
  class_label: string
  level: number
  spam: number
  ticket: number
  created_at: string
  updated_at: string
}

export type DragonAccountInput = Omit<
  DragonAccount,
  'id' | 'created_at' | 'updated_at'
>

export type CounterField = 'spam' | 'ticket'

export type ClassNode = {
  id: string
  label: string
  parent_id: string | null
  sort_order: number
}

export type Patchnote = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export type User = {
  id: string
  username: string | null
  is_admin: boolean
  created_at: string
}

// ─── DB type ──────────────────────────────────────────────────────────────────

type Database = {
  public: {
    Tables: {
      dragon_accounts: {
        Row: DragonAccount
        Insert: {
          id?: string
          account: string
          class_base: string
          class_path: string[]
          class_label: string
          level?: number
          spam?: number
          ticket?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<DragonAccountInput>
        Relationships: []
      }
      class_tree: {
        Row: ClassNode
        Insert: { label: string; parent_id?: string | null; sort_order?: number }
        Update: Partial<Omit<ClassNode, 'id' | 'created_at'>>
        Relationships: []
      }
      patchnotes: {
        Row: Patchnote
        Insert: { title: string; content: string }
        Update: Partial<Pick<Patchnote, 'title' | 'content'>>
        Relationships: []
      }
      users: {
        Row: User
        Insert: { id: string; username?: string; is_admin?: boolean }
        Update: Partial<Omit<User, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_reset_password: {
        Args: { user_id: string; new_password: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ─── Client singleton ─────────────────────────────────────────────────────────

const DRAGON_ACCOUNT_COLUMNS =
  'id, account, class_base, class_path, class_label, level, spam, ticket, created_at, updated_at'

let browserClient: SupabaseClient<Database> | null = null

export function getBrowserClient(): SupabaseClient<Database> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
    )
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return browserClient
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getMyUser(): Promise<User | null> {
  const client = getBrowserClient()
  const { data: { user: authUser } } = await client.auth.getUser()
  if (!authUser) return null

  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', authUser.id) // specifically filter for the current user
    .single()

  if (error) {
    console.error('[Supabase] getMyUser error:', error)
    return null
  }
  return data
}

// ─── Dragon Accounts ──────────────────────────────────────────────────────────

export async function listDragonAccounts(): Promise<DragonAccount[]> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('dragon_accounts')
    .select(DRAGON_ACCOUNT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createDragonAccount(
  input: DragonAccountInput,
): Promise<DragonAccount> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('dragon_accounts')
    .insert(input)
    .select(DRAGON_ACCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateDragonAccount(
  id: string,
  input: DragonAccountInput,
): Promise<DragonAccount> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('dragon_accounts')
    .update(input)
    .eq('id', id)
    .select(DRAGON_ACCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateDragonAccountCounter(
  id: string,
  field: CounterField,
  value: number,
): Promise<DragonAccount> {
  const client = getBrowserClient()
  const counterPatch: Partial<Pick<DragonAccountInput, CounterField>> = {
    [field]: value,
  }
  const { data, error } = await client
    .from('dragon_accounts')
    .update(counterPatch)
    .eq('id', id)
    .select(DRAGON_ACCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

// ─── Class Tree ───────────────────────────────────────────────────────────────

export async function listClassTree(): Promise<ClassNode[]> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('class_tree')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function createClassNode(
  label: string,
  parent_id: string | null,
  sort_order: number,
): Promise<ClassNode> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('class_tree')
    .insert({ label, parent_id, sort_order })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteClassNode(id: string): Promise<void> {
  const client = getBrowserClient()
  const { error } = await client.from('class_tree').delete().eq('id', id)
  if (error) throw error
}

// ─── Patchnotes ───────────────────────────────────────────────────────────────

export async function listPatchnotes(): Promise<Patchnote[]> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('patchnotes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createPatchnote(
  title: string,
  content: string,
): Promise<Patchnote> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('patchnotes')
    .insert({ title, content })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deletePatchnote(id: string): Promise<void> {
  const client = getBrowserClient()
  const { error } = await client.from('patchnotes').delete().eq('id', id)
  if (error) throw error
}

// ─── Admin: User Management ───────────────────────────────────────────────────

export async function listAllUsers(): Promise<User[]> {
  const client = getBrowserClient()
  const { data, error } = await client
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const client = getBrowserClient()
  const { error } = await client.rpc('admin_reset_password', {
    user_id: userId,
    new_password: newPassword,
  })
  if (error) throw error
}

export async function updateMyUsername(newUsername: string): Promise<void> {
  const client = getBrowserClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await client
    .from('users')
    .update({ username: newUsername })
    .eq('id', user.id)
  if (error) throw error
}

export async function updateMyPassword(newPassword: string): Promise<void> {
  const client = getBrowserClient()
  const { error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw error
}
