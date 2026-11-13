// Inline stroke icons; decorative unless the parent gives them a label.
type P = { size?: number; className?: string }
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const TagIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 9.5 9.5 3H21v18H9.5L3 14.5z" />
    <circle cx="9" cy="12" r="1.6" />
  </svg>
)
export const ArrowRight = ({ size, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.5}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const ArrowLeft = ({ size, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.5}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
)
export const Lock = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
export const Mic = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
)
export const Camera = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)
export const Stop = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="6" y="6" width="12" height="12" fill="currentColor" />
  </svg>
)
