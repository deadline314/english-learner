interface SrsUpdate {
  srsLevel: number
  easeFactor: number
  intervalDays: number
  nextReviewAt: number
}

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
      newInterval = 1
    } else if (currentLevel === 1) {
      newInterval = 3
    } else {
      newInterval = Math.round(intervalDays * easeFactor)
    }
    newLevel = Math.min(7, currentLevel + 1)
    newEase = Math.max(1.3, easeFactor + 0.1)
  } else {
    newLevel = Math.max(0, currentLevel - 2)
    newInterval = 1
    newEase = Math.max(1.3, easeFactor - 0.2)
  }

  return {
    srsLevel: newLevel,
    easeFactor: newEase,
    intervalDays: newInterval,
    nextReviewAt: now + newInterval * 86400,
  }
}
