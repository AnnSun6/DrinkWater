import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function derivePassword(openid: string) {
  return createHmac('sha256', process.env.WECHAT_APP_SECRET!).update(openid).digest('hex')
}

export async function POST(request: NextRequest) {
  const { code } = await request.json()
  if (!code) {
    return NextResponse.json({ error: '缺少 code' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`
  )
  const wxData = await res.json()

  if (wxData.errcode) {
    return NextResponse.json({ error: wxData.errmsg }, { status: 401 })
  }

  const { openid } = wxData
  const email = `wechat_${openid}@internal.drinkwater.app`
  const password = derivePassword(openid)

  const { data: signIn } = await getSupabaseAdmin().auth.signInWithPassword({ email, password })

  if (signIn.session) {
    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      user_id: signIn.user!.id,
    })
  }

  return NextResponse.json({ error: '用户不存在', openid }, { status: 404 })
}