'use client'

import { useEffect, useState, useCallback } from 'react'

interface Props {
  defaultTicker?: string
  onSuccess?: () => void
  hideTitle?: boolean
}

type OrderType = 'market' | 'limit'
type InputMode = 'qty' | 'notional'

interface MarketStatus {
  session: 'pre' | 'regular' | 'after' | 'closed'
  isOpen: boolean
  label: string
  color: string
  extendedHours: boolean
  allowFractional: boolean
  allowMarket: boolean
}

const SESSION_COLOR: Record<string, string> = {
  red:   'text-red-400 bg-red-950 border-red-800',
  amber: 'text-amber-400 bg-amber-950 border-amber-800',
  gray:  'text-gray-400 bg-gray-800 border-gray-700',
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}

// +/- 버튼이 붙은 숫자 입력 컴포넌트
function StepInput({
  value,
  onChange,
  step,
  min = 0,
  placeholder,
  prefix,
  suffix,
}: {
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  placeholder?: string
  prefix?: string
  suffix?: string
}) {
  const num = parseFloat(value) || 0
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0

  const adjust = (dir: 1 | -1) => {
    const next = Math.max(min, parseFloat((num + dir * step).toFixed(decimals + 2)))
    onChange(next.toFixed(decimals))
  }

  return (
    <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => adjust(-1)}
        className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-lg font-medium transition-colors select-none"
      >
        −
      </button>
      <div className="flex-1 flex items-center">
        {prefix && <span className="text-gray-500 text-sm pl-1">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-white text-sm text-center outline-none py-2 px-1"
        />
        {suffix && <span className="text-gray-500 text-sm pr-2">{suffix}</span>}
      </div>
      <button
        type="button"
        onClick={() => adjust(1)}
        className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-lg font-medium transition-colors select-none"
      >
        +
      </button>
    </div>
  )
}

export default function OrderForm({ defaultTicker = '', onSuccess, hideTitle }: Props) {
  const [ticker, setTicker] = useState(defaultTicker)
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [inputMode, setInputMode] = useState<InputMode>('notional')
  const [value, setValue] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [market, setMarket] = useState<MarketStatus | null>(null)
  const [extendedScope, setExtendedScope] = useState<'regular' | 'extended'>('regular')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // 장 상태 조회
  useEffect(() => {
    fetch('/api/market/status')
      .then((r) => r.json())
      .then((d: MarketStatus) => {
        setMarket(d)
        if (!d.allowMarket) setOrderType('limit')
        if (d.extendedHours) setInputMode('qty')
      })
      .catch(() => {})
  }, [])

  // 현재가 조회 및 기본값 설정
  const fetchPrice = useCallback(async (sym: string) => {
    if (!sym.trim()) return
    setPriceLoading(true)
    try {
      // 1차: 최신 호가
      const quoteRes = await fetch(`/api/stocks/${sym}/quote`)
      const quoteData = await quoteRes.json()
      if (quoteData.quote?.ap && quoteData.quote?.bp) {
        const mid = (quoteData.quote.ap + quoteData.quote.bp) / 2
        setCurrentPrice(mid)
        setLimitPrice(mid.toFixed(2))
        setValue(inputMode === 'qty' ? '1' : mid.toFixed(2))
        return
      }
    } catch {}
    try {
      // 2차: 마감가 (장 마감 시)
      const barRes = await fetch(`/api/stocks/${sym}/bars?timeframe=1Day&limit=2`)
      const barData = await barRes.json()
      const bars = barData.bars ?? []
      if (bars.length > 0) {
        const last = bars[bars.length - 1].c
        setCurrentPrice(last)
        setLimitPrice(last.toFixed(2))
        setValue(inputMode === 'qty' ? '1' : last.toFixed(2))
      }
    } catch {}
    setPriceLoading(false)
  }, [])

  useEffect(() => {
    if (ticker.trim().length >= 1) {
      // 짧은 디바운스
      const t = setTimeout(() => fetchPrice(ticker), 600)
      return () => clearTimeout(t)
    }
  }, [ticker, fetchPrice])

  // 입력 모드 전환 시 값 변환
  const handleModeSwitch = (m: InputMode) => {
    setInputMode(m)
    if (m === 'qty') {
      // 수량 모드: 항상 1주 기본
      setValue('1')
    } else if (m === 'notional' && currentPrice && currentPrice > 0) {
      // 금액 모드: 1주 가격으로
      setValue(currentPrice.toFixed(2))
    }
  }

  const useExtendedHours =
    market?.session === 'pre' ||
    market?.session === 'after' ||
    (market?.session === 'closed' && extendedScope === 'extended')

  const canFractional = !useExtendedHours && (market?.allowFractional ?? false)

  // 스텝 계산
  const amountStep = inputMode === 'notional' ? 1 : canFractional ? 0.01 : 1
  const priceStep = currentPrice && currentPrice > 100 ? 0.05 : 0.01

  const submit = async () => {
    if (!ticker.trim() || !value) return
    const numVal = parseFloat(value)
    if (!canFractional && inputMode === 'qty' && !Number.isInteger(numVal)) {
      setResult({ ok: false, message: '정수 수량만 입력 가능합니다' })
      return
    }
    setSubmitting(true)
    setResult(null)

    const body: Record<string, unknown> = {
      ticker: ticker.trim().toUpperCase(),
      side: 'buy',
      type: orderType,
      ...(inputMode === 'qty' ? { qty: numVal } : { notional: numVal }),
      ...(orderType === 'limit' && limitPrice && { limitPrice: parseFloat(limitPrice) }),
      ...(useExtendedHours && { extendedHours: true }),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `주문 완료: ${data.order.status}` })
        setValue('')
        setLimitPrice('')
        onSuccess?.()
      } else {
        setResult({ ok: false, message: data.error ?? '주문 실패' })
      }
    } catch {
      setResult({ ok: false, message: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  const isClosed = market?.session === 'closed'
  const isExtendedSession = market?.session === 'pre' || market?.session === 'after'
  const sessionColorClass = SESSION_COLOR[market?.color ?? 'gray']
  const needLimitPrice = orderType === 'limit' || isExtendedSession || useExtendedHours

  // 예상 체결 시간 문자열
  function getExecutionTime() {
    if (!market) return '-'
    const session = market.session
    if (session === 'regular') {
      return orderType === 'market' ? '즉시 체결' : `지정가($${limitPrice}) 도달 시 당일 체결`
    }
    if (session === 'pre') return `지정가($${limitPrice}) 도달 시 체결 (프리마켓)`
    if (session === 'after') return `지정가($${limitPrice}) 도달 시 체결 (애프터마켓)`
    if (session === 'closed') {
      if (extendedScope === 'extended') return `다음 프리마켓 오픈 시 (04:00 ET / 한국 오전 6시)`
      return `다음 정규장 오픈 시 (09:30 ET / 한국 오후 11시 30분)`
    }
    return '-'
  }

  // 예상 금액
  function getEstimatedAmount() {
    const num = parseFloat(value)
    if (!num) return '-'
    if (inputMode === 'notional') return `$${num.toFixed(2)}`
    if (orderType === 'limit' && limitPrice) return `$${(num * parseFloat(limitPrice)).toFixed(2)}`
    if (currentPrice) return `$${(num * currentPrice).toFixed(2)} (현재가 기준)`
    return '-'
  }

  // 확인 화면
  if (confirming) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">주문 확인</h3>
          <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-white">
            ← 수정
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <Row label="종목" value={ticker.toUpperCase()} />
          <Row label="주문 유형" value={
            orderType === 'market' ? '시장가' :
            isClosed ? '지정가 (예약)' : '지정가'
          } />
          <Row label="수량/금액" value={
            inputMode === 'qty'
              ? `${parseFloat(value)}주`
              : `$${parseFloat(value).toFixed(2)}`
          } />
          {(orderType === 'limit' || isExtendedSession || useExtendedHours) && limitPrice && (
            <Row label="지정가" value={`$${parseFloat(limitPrice).toFixed(2)}`} />
          )}
          <Row label="예상 금액" value={getEstimatedAmount()} highlight />
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400">예상 체결 시간</p>
            <p className="text-sm text-white mt-0.5">{getExecutionTime()}</p>
          </div>
        </div>

        {result && (
          <p className={`text-xs ${result.ok ? 'text-blue-400' : 'text-gray-400'}`}>
            {result.message}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-semibold text-sm"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40"
          >
            {submitting ? '주문 중...' : '주문 확인'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!hideTitle && <h3 className="text-white font-semibold">매수 주문</h3>}

      {/* 장 상태 배지 */}
      {market && (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${sessionColorClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {market.label}
          {isExtendedSession && <span className="opacity-70">· 지정가만, 소수점 불가</span>}
          {isClosed && <span className="opacity-70">· 지정가 예약주문</span>}
        </div>
      )}

      {/* 장 마감 체결 범위 */}
      {isClosed && (
        <div className="flex gap-2">
          {([
            { value: 'regular',  label: '정규장만' },
            { value: 'extended', label: '프리·정규·애프터 포함' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setExtendedScope(opt.value)
                if (opt.value === 'extended') setInputMode('qty')
                else if (market?.allowFractional) setInputMode('notional')
              }}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                extendedScope === opt.value ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* 종목 */}
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      {/* 현재가 표시 */}
      {currentPrice !== null && (
        <p className="text-xs text-gray-400 -mt-1">
          현재가 <span className="text-white font-medium">${currentPrice.toFixed(2)}</span>
          {priceLoading && <span className="ml-1 text-gray-600">갱신 중...</span>}
        </p>
      )}

      {/* 주문 타입 */}
      {!isExtendedSession && (
        <div className="flex gap-2">
          {(['market', 'limit'] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              disabled={t === 'market' && !market?.allowMarket}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                orderType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t === 'market' ? '시장가' : isClosed ? '지정가 (예약)' : '지정가'}
            </button>
          ))}
        </div>
      )}

      {/* 입력 모드 */}
      {canFractional && (
        <div className="flex gap-2">
          {(['notional', 'qty'] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleModeSwitch(m)}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                inputMode === m ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {m === 'notional' ? 'USD 금액' : '주 수량'}
            </button>
          ))}
        </div>
      )}

      <div className={`flex gap-2 ${needLimitPrice ? '' : ''}`}>
        {/* 금액/수량 */}
        <div className="flex-1 space-y-1">
          <p className="text-xs text-gray-400 px-1">
            {inputMode === 'notional' ? '주문 금액' : '주문 수량'}
          </p>
          <StepInput
            value={value}
            onChange={setValue}
            step={amountStep}
            min={amountStep}
            prefix={inputMode === 'notional' ? '$' : undefined}
            suffix={inputMode === 'qty' ? '주' : undefined}
            placeholder={canFractional ? (inputMode === 'notional' ? '금액' : '수량') : '수량'}
          />
        </div>

        {/* 지정가 */}
        {needLimitPrice && (
          <div className="flex-1 space-y-1">
            <p className="text-xs text-gray-400 px-1">지정가</p>
            <StepInput
              value={limitPrice}
              onChange={setLimitPrice}
              step={priceStep}
              min={0.01}
              prefix="$"
              placeholder="지정가"
            />
          </div>
        )}
      </div>

      {result && (
        <p className={`text-xs ${result.ok ? 'text-blue-400' : 'text-gray-400'}`}>
          {result.message}
        </p>
      )}

      <button
        onClick={() => {
          if (!ticker.trim() || !value) return
          if (!canFractional && inputMode === 'qty' && !Number.isInteger(parseFloat(value))) {
            setResult({ ok: false, message: '정수 수량만 입력 가능합니다' })
            return
          }
          setResult(null)
          setConfirming(true)
        }}
        disabled={!ticker.trim() || !value || (needLimitPrice && !limitPrice)}
        className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
      >
        {isClosed ? '예약 매수' : '매수'}
      </button>
    </div>
  )
}
