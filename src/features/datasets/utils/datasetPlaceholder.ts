type PlaceholderOptions = {
  id?: string | null
  size?: number | string
  lineColor?: string
  primaryColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  showGuides?: boolean
}

// 12 sets of elegant preset color schemes, each including primary, secondary, tertiary, and line colors
const COLOR_SCHEMES = [
  // 1. Blue (Classic)
  { primary: '#3F51B5', secondary: '#90CAF9', tertiary: '#C5CAE9', line: '#3F51B5' },
  // 2. Purple (Elegant)
  { primary: '#7C3AED', secondary: '#F0ABFC', tertiary: '#DDD6FE', line: '#7C3AED' },
  // 3. Teal (Fresh)
  { primary: '#0D9488', secondary: '#5EEAD4', tertiary: '#A7F3D0', line: '#0D9488' },
  // 4. Rose (Warm)
  { primary: '#E11D48', secondary: '#FDA4AF', tertiary: '#FECDD3', line: '#E11D48' },
  // 5. Amber (Vibrant)
  { primary: '#D97706', secondary: '#FCD34D', tertiary: '#FDE68A', line: '#D97706' },
  // 6. Magenta (Vivid)
  { primary: '#C026D3', secondary: '#E879F9', tertiary: '#FAE8FF', line: '#C026D3' },
  // 7. Indigo (Deep)
  { primary: '#4338CA', secondary: '#A5B4FC', tertiary: '#E0E7FF', line: '#4338CA' },
  // 8. Cyan (Ocean)
  { primary: '#0891B2', secondary: '#67E8F9', tertiary: '#CFFAFE', line: '#0891B2' },
  // 9. Pink (Soft)
  { primary: '#DB2777', secondary: '#F9A8D4', tertiary: '#FCE7F3', line: '#DB2777' },
  // 10. Orange (Sunset)
  { primary: '#EA580C', secondary: '#FDBA74', tertiary: '#FEF08A', line: '#EA580C' },
  // 11. Slate (Minimalist)
  { primary: '#475569', secondary: '#CBD5E1', tertiary: '#F1F5F9', line: '#475569' },
  // 12. Violet (Mystic)
  { primary: '#5B21B6', secondary: '#C4B5FD', tertiary: '#EDE9FE', line: '#5B21B6' },
]

export function getDatasetPlaceholderSvg(options: PlaceholderOptions = {}) {
  // Pick a random color scheme on each call (non-deterministic)
  const randomIndex = Math.floor(Math.random() * COLOR_SCHEMES.length)
  const scheme = COLOR_SCHEMES[randomIndex] || COLOR_SCHEMES[0]!

  const {
    size = '100%',
    lineColor = options.lineColor || scheme.line,
    primaryColor = options.primaryColor || scheme.primary,
    secondaryColor = options.secondaryColor || scheme.secondary,
    tertiaryColor = options.tertiaryColor || scheme.tertiary,
    showGuides = true,
  } = options

  const guides = showGuides
    ? `
      <g>
        <line x1="56" y1="128" x2="200" y2="128" stroke="${lineColor}" stroke-opacity="0.08" stroke-width="2"/>
        <line x1="128" y1="56" x2="128" y2="200" stroke="${lineColor}" stroke-opacity="0.08" stroke-width="2"/>
        <ellipse cx="128" cy="128" rx="58" ry="34" fill="none" stroke="${lineColor}" stroke-opacity="0.10" stroke-width="4"/>
        <ellipse cx="128" cy="128" rx="34" ry="58" fill="none" stroke="${lineColor}" stroke-opacity="0.06" stroke-width="3"/>
      </g>
    `
    : ''

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
      ${guides}

      <g>
        <circle cx="128" cy="84" r="8" fill="${primaryColor}" fill-opacity="0.95"/>
        <circle cx="104" cy="104" r="6" fill="${secondaryColor}" fill-opacity="0.92"/>
        <circle cx="152" cy="104" r="6" fill="${secondaryColor}" fill-opacity="0.92"/>
        <circle cx="88" cy="128" r="7" fill="${tertiaryColor}" fill-opacity="0.95"/>
        <circle cx="168" cy="128" r="7" fill="${tertiaryColor}" fill-opacity="0.95"/>
        <circle cx="104" cy="152" r="6" fill="${secondaryColor}" fill-opacity="0.92"/>
        <circle cx="152" cy="152" r="6" fill="${secondaryColor}" fill-opacity="0.92"/>
        <circle cx="128" cy="172" r="8" fill="${primaryColor}" fill-opacity="0.95"/>
        <circle cx="128" cy="128" r="10" fill="${primaryColor}" fill-opacity="0.22"/>
      </g>

      <g>
        <circle cx="120" cy="128" r="18" fill="${primaryColor}" fill-opacity="0.05"/>
        <circle cx="136" cy="128" r="18" fill="${primaryColor}" fill-opacity="0.05"/>
      </g>
    </svg>
  `
}
