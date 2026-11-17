/**
 * utils/weather-code.js
 * WMO weather_code → icon, Indonesian/English label, and colour tone.
 * Source of truth: PLAN.md §6.3.
 */

export const WEATHER_CODES = {
  0: { icon: 'sun', labelId: 'Cerah', labelEn: 'Clear sky', tone: 'clear' },
  1: { icon: 'sun-cloud', labelId: 'Sebagian besar cerah', labelEn: 'Mainly clear', tone: 'clear' },
  2: { icon: 'sun-cloud', labelId: 'Berawan sebagian', labelEn: 'Partly cloudy', tone: 'cloudy' },
  3: { icon: 'cloud', labelId: 'Mendung', labelEn: 'Overcast', tone: 'cloudy' },
  45: { icon: 'fog', labelId: 'Kabut', labelEn: 'Fog', tone: 'fog' },
  48: { icon: 'fog', labelId: 'Kabut beku (rime)', labelEn: 'Depositing rime fog', tone: 'fog' },
  51: { icon: 'drizzle', labelId: 'Gerimis ringan', labelEn: 'Light drizzle', tone: 'rain' },
  53: { icon: 'drizzle', labelId: 'Gerimis sedang', labelEn: 'Moderate drizzle', tone: 'rain' },
  55: { icon: 'drizzle', labelId: 'Gerimis lebat', labelEn: 'Dense drizzle', tone: 'rain' },
  56: { icon: 'drizzle', labelId: 'Gerimis beku ringan', labelEn: 'Light freezing drizzle', tone: 'rain' },
  57: { icon: 'drizzle', labelId: 'Gerimis beku lebat', labelEn: 'Dense freezing drizzle', tone: 'rain' },
  61: { icon: 'rain', labelId: 'Hujan ringan', labelEn: 'Slight rain', tone: 'rain' },
  63: { icon: 'rain', labelId: 'Hujan sedang', labelEn: 'Moderate rain', tone: 'rain' },
  65: { icon: 'rain-heavy', labelId: 'Hujan lebat', labelEn: 'Heavy rain', tone: 'rain' },
  66: { icon: 'rain', labelId: 'Hujan beku ringan', labelEn: 'Light freezing rain', tone: 'rain' },
  67: { icon: 'rain', labelId: 'Hujan beku lebat', labelEn: 'Heavy freezing rain', tone: 'rain' },
  71: { icon: 'snow', labelId: 'Salju ringan', labelEn: 'Slight snow fall', tone: 'snow' },
  73: { icon: 'snow', labelId: 'Salju sedang', labelEn: 'Moderate snow fall', tone: 'snow' },
  75: { icon: 'snow', labelId: 'Salju lebat', labelEn: 'Heavy snow fall', tone: 'snow' },
  77: { icon: 'snow', labelId: 'Butir salju', labelEn: 'Snow grains', tone: 'snow' },
  80: { icon: 'rain', labelId: 'Hujan lokal ringan', labelEn: 'Slight rain showers', tone: 'rain' },
  81: { icon: 'rain', labelId: 'Hujan lokal sedang', labelEn: 'Moderate rain showers', tone: 'rain' },
  82: { icon: 'rain-heavy', labelId: 'Hujan lokal lebat', labelEn: 'Violent rain showers', tone: 'rain' },
  85: { icon: 'snow', labelId: 'Hujan salju ringan', labelEn: 'Slight snow showers', tone: 'snow' },
  86: { icon: 'snow', labelId: 'Hujan salju lebat', labelEn: 'Heavy snow showers', tone: 'snow' },
  95: { icon: 'storm', labelId: 'Badai petir', labelEn: 'Thunderstorm', tone: 'storm' },
  96: { icon: 'storm', labelId: 'Badai petir + hujan es ringan', labelEn: 'Thunderstorm with slight hail', tone: 'storm' },
  99: { icon: 'storm', labelId: 'Badai petir + hujan es lebat', labelEn: 'Thunderstorm with heavy hail', tone: 'storm' }
};

const FALLBACK = {
  icon: 'cloud',
  labelId: 'Kondisi tidak dikenali',
  labelEn: 'Unknown condition',
  tone: 'cloudy'
};

/**
 * @param {number} code WMO weather code
 * @param {number} isDay 1 for daytime, 0 for night
 */
export function getWeatherMeta(code, isDay = 1) {
  const meta = WEATHER_CODES[code];

  if (!meta) {
    return {
      ...FALLBACK,
      labelId: `${FALLBACK.labelId} (kode ${code})`,
      labelEn: `${FALLBACK.labelEn} (code ${code})`
    };
  }

  if (isDay === 0 && (meta.icon === 'sun' || meta.icon === 'sun-cloud')) {
    return {
      ...meta,
      icon: meta.icon === 'sun' ? 'moon' : 'moon-cloud'
    };
  }

  return meta;
}
