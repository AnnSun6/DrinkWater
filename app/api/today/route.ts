import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: logs } = await supabase
    .from('drink_logs')
    .select('amount_ml')
    .eq('user_id', userId)
    .gte('created_at', todayStart)

  const total_ml = logs?.reduce((sum, log) => sum + log.amount_ml, 0) || 0

  const { data: settings } = await supabase
    .from('user_settings')
    .select('daily_goal_ml')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({
    total_ml,
    goal_ml: settings?.daily_goal_ml || 2000,
  })
}
