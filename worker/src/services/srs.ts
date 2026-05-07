interface SrsUpdate {
  srsLevel: number
  easeFactor: number
  intervalDays: number
  nextReviewAt: number
}

const INTERVAL_MINUTES_LEVEL_0 = 0
const INTERVAL_HOURS_LEVEL_1 = 1
const INTERVAL_HOURS_LEVEL_2 = 8

export function calculateSrs(
  correct: boolean,
  currentLevel: number,
  easeFactor: number,
  intervalDays: number
): SrsUpdate {
  const now = Math.floor(Date.now() / 1000)
  let newLevel = currentLevel
  let newEase = easeFactor
  let newInterval = intervalDays

  if (correct) {
    if (currentLevel === 0) {
      newLevel = 1
      newEase = Math.max(1.3, easeFactor + 0.1)
      return {
        srsLevel: newLevel,
        easeFactor: newEase,
        intervalDays: 0,
        nextReviewAt: now + INTERVAL_MINUTES_LEVEL_0 * 60,
      }
    } else if (currentLevel === 1) {
      newLevel = 2
      newEase = Math.max(1.3, easeFactor + 0.1)
      return {
        srsLevel: newLevel,
        easeFactor: newEase,
        intervalDays: 0,
        nextReviewAt: now + INTERVAL_HOURS_LEVEL_1 * 3600,
      }
    } else if (currentLevel === 2) {
      newLevel = 3
      newEase = Math.max(1.3, easeFactor + 0.1)
      return {
        srsLevel: newLevel,
        easeFactor: newEase,
        intervalDays: 1,
        nextReviewAt: now + INTERVAL_HOURS_LEVEL_2 * 3600,
      }
    } else {
      newInterval = Math.round(intervalDays * easeFactor)
      newLevel = Math.min(7, currentLevel + 1)
      newEase = Math.max(1.3, easeFactor + 0.1)
    }
  } else {
    newLevel = Math.max(0, currentLevel - 2)
    newInterval = 0
    newEase = Math.max(1.3, easeFactor - 0.2)
    return {
      srsLevel: newLevel,
      easeFactor: newEase,
      intervalDays: 0,
      nextReviewAt: now + INTERVAL_MINUTES_LEVEL_0 * 60,
    }
  }

  return {
    srsLevel: newLevel,
    easeFactor: newEase,
    intervalDays: newInterval,
    nextReviewAt: now + newInterval * 86400,
  }
}
