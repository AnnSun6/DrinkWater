import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('drink_logs')
    .select('id, amount_ml, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
