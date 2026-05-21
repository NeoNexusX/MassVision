import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(enLocale)

const COUNTRY_OVERRIDES: Record<string, string> = {
  CN: 'China',
  US: 'United States',
  GB: 'United Kingdom',
  RU: 'Russia',
  KR: 'South Korea',
  KP: 'North Korea',
}

export interface RegionOption {
  code: string
  name: string
}

export function getRegionOptions(): RegionOption[] {
  const countryObj = countries.getNames('en')
  return Object.entries(countryObj)
    .map(([code, name]) => ({
      code,
      name: COUNTRY_OVERRIDES[code] ?? name,
    }))
    .filter((c) => c.name.length <= 28)
    .sort((a, b) => a.name.localeCompare(b.name))
}
