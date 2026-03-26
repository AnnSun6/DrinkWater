import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await getSupabaseAdmin()
    .from('user_profiles')
    .select('nickname, avatar_url')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({
    nickname: data?.nickname || '',
    avatar_url: data?.avatar_url || '',
  })
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const update: Record<string, string> = {}

  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim()
    if (!nickname || nickname.length > 20) {
      return NextResponse.json({ error: 'nickname must be 1-20 characters' }, { status: 400 })
    }
    update.nickname = nickname
  }

  if (body.avatar_url !== undefined) {
    update.avatar_url = String(body.avatar_url)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('user_profiles')
    .update(update)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
