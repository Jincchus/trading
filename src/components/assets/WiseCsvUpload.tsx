'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function WiseCsvUpload({ onSuccess }: Props) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ parsed: number; created: number } | null>(null)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/fx-records/wise', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        onSuccess?.()
      } else {
        setError(data.error ?? '업로드 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-2">Wise CSV 업로드</h3>
      <p className="text-xs text-gray-400 mb-3">
        Wise 앱 → 거래 내역 → 다운로드(CSV) 후 업로드. KRW→USD 환전 항목만 자동 추출합니다.
      </p>
      <label className={`block w-full py-3 text-center text-sm rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
        uploading ? 'border-gray-700 text-gray-500' : 'border-blue-800 text-blue-400 hover:border-blue-600'
      }`}>
        {uploading ? '처리 중...' : 'CSV 파일 선택'}
        <input type="file" accept=".csv" onChange={handleFile} disabled={uploading} className="hidden" />
      </label>
      {result && <p className="text-green-400 text-xs mt-2">{result.parsed}개 항목 발견 · {result.created}개 신규 저장</p>}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
