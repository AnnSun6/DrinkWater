import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await getSupabaseAdmin()
    .from('user_settings')
    .select('cup_size_ml, daily_goal_ml')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({
    cup_size_ml: data?.cup_size_ml || 250,
    daily_goal_ml: data?.daily_goal_ml || 2000,
  })
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const update: Record<string, any> = { user_id: userId, updated_at: new Date().toISOString() }

  if (body.cup_size_ml !== undefined) {
    const v = parseInt(body.cup_size_ml) || 250
    if (v < 50 || v > 1000) {
      return NextResponse.json({ error: 'cup_size_ml must be 50-1000' }, { status: 400 })
    }
    update.cup_size_ml = v
  }

  if (body.daily_goal_ml !== undefined) {
    const v = parseInt(body.daily_goal_ml) || 2000
    if (v < 500 || v > 10000) {
      return NextResponse.json({ error: 'daily_goal_ml must be 500-10000' }, { status: 400 })
    }
    update.daily_goal_ml = v
  }

  const { error } = await getSupabaseAdmin()
    .from('user_settings')
    .upsert(update, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
