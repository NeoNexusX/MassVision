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

export function getRegionOptions(): Record<string, string> {
  const countryObj = countries.getNames('en')
  const result: Record<string, string> = {}
  for (const [code, name] of Object.entries(countryObj)) {
    const overrideName = COUNTRY_OVERRIDES[code] ?? name
    if (overrideName.length <= 28) {
      result[overrideName] = code
    }
  }
  return result
}

export function getRegionName(code: string): string {
  const regionMap = getRegionOptions()
  const entry = Object.entries(regionMap).find(([, c]) => c === code)
  return entry ? entry[0] : code
}
