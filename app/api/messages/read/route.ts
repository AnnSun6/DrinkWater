import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { friend_id } = await request.json()
  if (!friend_id) {
    return NextResponse.json({ error: 'Missing friend_id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const { data: friendship } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friend_id}),and(sender_id.eq.${friend_id},receiver_id.eq.${userId})`
    )
    .limit(1)

  if (!friendship || friendship.length === 0) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('message')
    .update({ is_read: true })
    .eq('sender_id', friend_id)
    .eq('receiver_id', userId)
    .eq('is_read', false)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: data?.length || 0 })
}
