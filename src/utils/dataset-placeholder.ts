type PlaceholderOptions = {
  size?: number | string
  lineColor?: string
  primaryColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  showGuides?: boolean
}

export function getDatasetPlaceholderSvg(options: PlaceholderOptions = {}) {
  const {
    size = "100%",
    lineColor = "#3F51B5",
    primaryColor = "#3F51B5",
    secondaryColor = "#90CAF9",
    tertiaryColor = "#C5CAE9",
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
    : ""

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