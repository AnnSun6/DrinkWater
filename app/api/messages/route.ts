import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'
import { sendSubscribeMessage } from '@/lib/wechat'

async function areFriends(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, friendId: string): Promise<boolean> {
  const { data } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
    )
    .limit(1)
  return !!(data && data.length > 0)
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const friendId = searchParams.get('friend_id')
  if (!friendId) {
    return NextResponse.json({ error: 'Missing friend_id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  if (!(await areFriends(supabase, userId, friendId))) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('message')
    .select('id, sender_id, receiver_id, message, is_read, created_at')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { receiver_id, message } = await request.json()
  if (!receiver_id || !message) {
    return NextResponse.json({ error: 'Missing receiver_id or message' }, { status: 400 })
  }

  if (String(message).length > 200) {
    return NextResponse.json({ error: 'Message too long (max 200)' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  if (!(await areFriends(supabase, userId, receiver_id))) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 })
  }

  const { error } = await supabase.from('message').insert({
    sender_id: userId,
    receiver_id,
    message: String(message),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let notificationSent = false
  const { data: receiver } = await supabase
    .from('user_profiles')
    .select('wechat_openid, nickname')
    .eq('user_id', receiver_id)
    .single()

  const { data: sender } = await supabase
    .from('user_profiles')
    .select('nickname')
    .eq('user_id', userId)
    .single()

  if (receiver?.wechat_openid) {
    const templateId = process.env.WECHAT_SUBSCRIBE_TEMPLATE_ID
    if (templateId) {
      const now = new Date()
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      notificationSent = await sendSubscribeMessage(
        receiver.wechat_openid,
        templateId,
        {
          thing1: { value: String(message).slice(0, 20) },
          thing2: { value: sender?.nickname || '好友' },
          time3: { value: timeStr },
        },
        `pages/chat/chat?friend_id=${userId}`
      )
    }
  }

  return NextResponse.json({ success: true, notification_sent: notificationSent })
}
