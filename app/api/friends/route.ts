import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const { data: friendships } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

  if (!friendships || friendships.length === 0) {
    return NextResponse.json([])
  }

  const friendIds = friendships.map((f) =>
    f.sender_id === userId ? f.receiver_id : f.sender_id
  )

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, nickname, avatar_url')
    .in('user_id', friendIds)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: logs } = await supabase
    .from('drink_logs')
    .select('user_id, amount_ml')
    .in('user_id', friendIds)
    .gte('created_at', todayStart)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, daily_goal_ml')
    .in('user_id', friendIds)

  const logMap = new Map<string, number>()
  logs?.forEach((l) => {
    logMap.set(l.user_id, (logMap.get(l.user_id) || 0) + l.amount_ml)
  })

  const goalMap = new Map<string, number>()
  settings?.forEach((s) => {
    goalMap.set(s.user_id, s.daily_goal_ml)
  })

  const result = (profiles || []).map((p) => ({
    user_id: p.user_id,
    nickname: p.nickname || '',
    avatar_url: p.avatar_url || '',
    today_ml: logMap.get(p.user_id) || 0,
    goal_ml: goalMap.get(p.user_id) || 2000,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { friend_id } = await request.json()
  if (!friend_id || friend_id === userId) {
    return NextResponse.json({ error: 'Invalid friend_id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data: friendProfile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', friend_id)
    .single()

  if (!friendProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('friend_requests')
    .select('id')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friend_id}),and(sender_id.eq.${friend_id},receiver_id.eq.${userId})`
    )
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase.from('friend_requests').insert({
    sender_id: userId,
    receiver_id: friend_id,
    status: 'accepted',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
