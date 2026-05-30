interface PieSlice {
  label: string
  value: number
  color: string
}

export default function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  let angle = -Math.PI / 2
  const paths = slices.map((slice) => {
    const sweep = (slice.value / total) * 2 * Math.PI
    const x1 = 50 + 40 * Math.cos(angle)
    const y1 = 50 + 40 * Math.sin(angle)
    angle += sweep
    const x2 = 50 + 40 * Math.cos(angle)
    const y2 = 50 + 40 * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M50 50 L${x1.toFixed(1)} ${y1.toFixed(1)} A40 40 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`
    return { ...slice, d, pct: (slice.value / total) * 100 }
  })

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-36 h-36 mx-auto">
        {paths.map((p) => <path key={p.label} d={p.d} fill={p.color} />)}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-3">
        {paths.map((p) => (
          <div key={p.label} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-[11px] text-gray-400">
              {p.label} {p.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
