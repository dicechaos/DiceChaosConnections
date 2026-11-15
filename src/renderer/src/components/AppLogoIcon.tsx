import React, { useId } from 'react'

interface AppLogoIconProps {
  size?: number
  className?: string
}

/**
 * Gold-Core Pure Wireframe D20 brand emblem (optical-small vector tuned for 18px-28px studio chrome).
 */
export function AppLogoIcon({ size = 22, className = '' }: AppLogoIconProps): React.JSX.Element {
  const gradId = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="42%" r="65%">
          <stop offset="0%" stopColor="#1b2440" />
          <stop offset="58%" stopColor="#0d1426" />
          <stop offset="100%" stopColor="#060a14" />
        </radialGradient>
      </defs>

      <rect x="20" y="20" width="472" height="472" rx="108" fill={`url(#${gradId})`} />
      <rect
        x="23"
        y="23"
        width="466"
        height="466"
        rx="105"
        fill="none"
        stroke="#3b4f70"
        strokeWidth="8"
        strokeOpacity="0.85"
      />

      <polygon
        points="256,66 422.3,162 422.3,354 256,450 89.7,354 89.7,162"
        fill="rgba(56, 189, 248, 0.05)"
      />
      <polygon
        points="256,142 356.5,316 155.5,316"
        fill="rgba(251, 191, 36, 0.1)"
      />

      {/* Outer Hexagon Connections */}
      <g strokeLinecap="round">
        <line x1="107" y1="152" x2="238.7" y2="76" stroke="#10b981" strokeWidth="10" />
        <line x1="273.3" y1="76" x2="405" y2="152" stroke="#f87171" strokeWidth="10" />
        <line x1="422.3" y1="182" x2="422.3" y2="334" stroke="#38bdf8" strokeWidth="10" />
        <line x1="405" y1="364" x2="273.3" y2="440" stroke="#fbbf24" strokeWidth="10" />
        <line x1="238.7" y1="440" x2="107" y2="364" stroke="#10b981" strokeWidth="10" />
        <line x1="89.7" y1="334" x2="89.7" y2="182" stroke="#a78bfa" strokeWidth="10" />

        {/* Facet Chords & Radial Spokes */}
        <line x1="109.6" y1="159.6" x2="234.2" y2="144.6" stroke="#10b981" strokeWidth="8.5" />
        <line x1="402.4" y1="159.6" x2="277.8" y2="144.6" stroke="#f87171" strokeWidth="8.5" />
        <line x1="414.4" y1="180.4" x2="365.2" y2="295.6" stroke="#38bdf8" strokeWidth="8.5" />
        <line x1="268" y1="434" x2="343.3" y2="333.6" stroke="#fbbf24" strokeWidth="8.5" />
        <line x1="244" y1="434" x2="168.7" y2="333.6" stroke="#38bdf8" strokeWidth="8.5" />
        <line x1="97.6" y1="180.4" x2="146.8" y2="295.6" stroke="#a78bfa" strokeWidth="8.5" />

        <line x1="256" y1="86" x2="256" y2="120" stroke="#fbbf24" strokeWidth="10" />
        <line x1="405" y1="344" x2="375.5" y2="327" stroke="#38bdf8" strokeWidth="10" />
        <line x1="107" y1="344" x2="136.5" y2="327" stroke="#10b981" strokeWidth="10" />

        {/* Luminous Gold Middle Triangle */}
        <line x1="267" y1="161" x2="345.5" y2="297" stroke="#fde68a" strokeWidth="13" />
        <line x1="334.5" y1="316" x2="177.5" y2="316" stroke="#fde68a" strokeWidth="13" />
        <line x1="166.5" y1="297" x2="245" y2="161" stroke="#fde68a" strokeWidth="13" />
      </g>

      {/* 9 Concentric Entity-Node Port Rings */}
      {[
        { cx: 256, cy: 66, r: 19, c: '#fbbf24' },
        { cx: 422.3, cy: 162, r: 19, c: '#f87171' },
        { cx: 422.3, cy: 354, r: 19, c: '#38bdf8' },
        { cx: 256, cy: 450, r: 19, c: '#fbbf24' },
        { cx: 89.7, cy: 354, r: 19, c: '#10b981' },
        { cx: 89.7, cy: 162, r: 19, c: '#a78bfa' },
        { cx: 256, cy: 142, r: 21, c: '#fde68a' },
        { cx: 356.5, cy: 316, r: 21, c: '#fde68a' },
        { cx: 155.5, cy: 316, r: 21, c: '#fde68a' }
      ].map((n, idx) => (
        <g key={idx}>
          <circle cx={n.cx} cy={n.cy} r={n.r + 3} fill="#0a1020" />
          <circle cx={n.cx} cy={n.cy} r={n.r - 3} fill="#0a1020" stroke={n.c} strokeWidth="6.5" />
          <circle cx={n.cx} cy={n.cy} r="5.5" fill={n.c} />
        </g>
      ))}
    </svg>
  )
}
