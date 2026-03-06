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

  const openid = wxData.openid
  if (!openid) {
    return NextResponse.json({ error: '微信返回数据异常' }, { status: 502 })
  }
  const email = `wechat_${openid}@internal.drinkwater.app`
  const password = derivePassword(openid)

  const { data: signIn } = await getSupabaseAdmin().auth.signInWithPassword({ email, password })

  if (signIn.session && signIn.user) {
    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      user_id: signIn.user.id,
    })
  }

  // 新用户，创建账号
  const { data: created, error: createErr } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createErr || !created.user) {
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 })
  }

  const newUserId = created.user.id
  const nickname = `微信用户_${openid.slice(-6)}`

  // 写入业务表
  await getSupabaseAdmin().from('users').insert({ id: newUserId, nickname })
  await getSupabaseAdmin().from('user_identities').insert({ user_id: newUserId, provider: 'wechat', provider_id: openid })
  await getSupabaseAdmin().from('user_profiles').insert({ user_id: newUserId, email, nickname })
  await getSupabaseAdmin().from('user_settings').insert({
    user_id: newUserId,
    cup_size_ml: 250,
    daily_goal_ml: 2000,
    reminder_start_hour: 8,
    reminder_end_hour: 22,
    reminder_interval_min: 0,
  })

  // 登录拿 token
  const { data: newSignIn } = await getSupabaseAdmin().auth.signInWithPassword({ email, password })

  if (!newSignIn.session) {
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }

  return NextResponse.json({
    access_token: newSignIn.session.access_token,
    refresh_token: newSignIn.session.refresh_token,
    user_id: newUserId,
    is_new_user: true,
  })
}