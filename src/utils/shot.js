export function createEmptyShotDetails(units = 'yards') {
  return {
    shotType: null,
    distance: null,
    units,
    lie: null,
    ballLocation: null,
    wind: null,
    danger: null,
    dangerSide: null,
    pinPosition: null,
    greenSlope: null,
    bunkerType: null,
    bunkerLie: null,
    troubleType: null,
    chipGreenRatio: null,
    gatheringPhase: null,
    notes: '',
  }
}

export function createEmptyShot(units = 'yards') {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    details: createEmptyShotDetails(units),
    messages: [],
  }
}

export function hasActiveConversation(shot) {
  return shot?.messages?.length > 0
}
