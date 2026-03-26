import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data, error } = await getSupabaseAdmin().auth.getUser(token)

  if (error || !data.user) return null
  return data.user.id
}
