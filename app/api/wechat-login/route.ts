import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { code } = await request.json()
  if (!code) {
    return NextResponse.json({ error: '缺少 code' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`
  )
  const data = await res.json()

  if (data.errcode) {
    return NextResponse.json({ error: data.errmsg }, { status: 401 })
  }

  return NextResponse.json({ openid: data.openid })
}