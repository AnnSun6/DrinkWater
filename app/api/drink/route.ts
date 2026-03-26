import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, getSupabaseAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amount_ml } = await request.json()
  if (!amount_ml || amount_ml <= 0 || amount_ml > 5000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('drink_logs')
    .insert({ user_id: userId, amount_ml })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('drink_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
