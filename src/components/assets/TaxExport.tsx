'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function TaxExport() {
  const [loading, setLoading] = useState(false)

  const download = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tax-records/export')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tax-${new Date().getFullYear()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="flex items-center gap-2 w-full py-3 bg-gray-800 text-white text-sm rounded-xl disabled:opacity-40 justify-center font-medium"
    >
      <Download size={16} />
      {loading ? '생성 중...' : '세금 신고용 Excel 다운로드'}
    </button>
  )
}
