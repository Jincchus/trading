import { NextRequest, NextResponse } from 'next/server'

const BOT_API = process.env.BOT_API_URL ?? 'http://localhost:8000'
const BOT_API_TOKEN = process.env.BOT_API_TOKEN ?? ''

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params, 'GET')
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params, 'POST')
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params, 'PUT')
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params, 'PATCH')
}

async function proxy(req: NextRequest, params: { path: string[] }, method: string) {
  const path = '/' + params.path.join('/')
  const url = `${BOT_API}${path}${req.nextUrl.search}`
  try {
    const body = method === 'GET' ? undefined : await req.text()
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(BOT_API_TOKEN ? { Authorization: `Bearer ${BOT_API_TOKEN}` } : {}),
      },
      ...(body !== undefined ? { body } : {}),
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Bot server unreachable' }, { status: 502 })
  }
}
