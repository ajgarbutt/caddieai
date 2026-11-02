export const CLUB_TYPES = [
  'Driver',
  '3 Wood',
  '5 Wood',
  '7 Wood',
  '3 Hybrid',
  '4 Hybrid',
  '5 Hybrid',
  '4 Iron',
  '5 Iron',
  '6 Iron',
  '7 Iron',
  '8 Iron',
  '9 Iron',
  'Pitching Wedge',
  'Gap Wedge',
  'Sand Wedge',
  'Lob Wedge',
  'Putter',
]

const CLUB_ORDER = Object.fromEntries(CLUB_TYPES.map((name, index) => [name, index]))

export function sortClubs(clubs) {
  return [...clubs].sort((a, b) => {
    const orderA = CLUB_ORDER[a.name] ?? 999
    const orderB = CLUB_ORDER[b.name] ?? 999
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name)
  })
}

export function formatUnitShort(units) {
  return units === 'metres' ? 'm' : 'yds'
}

export function formatUnitLong(units) {
  return units === 'metres' ? 'metres' : 'yards'
}

export function validateClubDistance(distance, clubName, units) {
  const isPutter = clubName === 'Putter'

  if (distance === '' || distance === null || distance === undefined) {
    if (isPutter) return { valid: true, value: null }
    return { valid: false, error: 'Please enter a carry distance.' }
  }

  const parsed = typeof distance === 'number' ? distance : parseInt(distance, 10)

  if (isNaN(parsed) || parsed <= 0) {
    return { valid: false, error: 'Please enter a valid positive distance.' }
  }

  const max = units === 'metres' ? 370 : 400
  const min = isPutter ? 1 : 10

  if (parsed < min) {
    return {
      valid: false,
      error: `Distance should be at least ${min} ${formatUnitLong(units)}.`,
    }
  }

  if (parsed > max) {
    return {
      valid: false,
      error: `Distance should be no more than ${max} ${formatUnitLong(units)}.`,
    }
  }

  return { valid: true, value: parsed }
}

export function isClubInBag(clubs, clubName) {
  return clubs.some((c) => c.name === clubName)
}
