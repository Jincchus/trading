import { NextResponse } from 'next/server'

const THEMES = [
  { id: 'ai', name: 'AI', tickers: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMD', 'SMCI'] },
  { id: 'semiconductor', name: '반도체', tickers: ['INTC', 'AMD', 'NVDA', 'QCOM', 'AVGO', 'MU'] },
  { id: 'ev', name: '전기차', tickers: ['TSLA', 'RIVN', 'LCID', 'NIO', 'F', 'GM'] },
  { id: 'dividend', name: '배당주', tickers: ['JNJ', 'KO', 'PG', 'T', 'VZ', 'MO'] },
  { id: 'cloud', name: '클라우드', tickers: ['AMZN', 'MSFT', 'GOOGL', 'CRM', 'SNOW', 'DDOG'] },
  { id: 'fintech', name: '핀테크', tickers: ['SQ', 'PYPL', 'V', 'MA', 'COIN', 'AFRM'] },
]

export async function GET() {
  return NextResponse.json({ themes: THEMES })
}
