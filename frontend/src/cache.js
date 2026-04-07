const CACHE_KEY = "classmate_responses"
const MAX_ENTRIES = 200

export function cacheResponse(question, answer, language) {
  try {
    const existing = getCachedResponses()
    const entry = {
      question: question.toLowerCase().trim(),
      answer,
      language,
      timestamp: Date.now()
    }
    existing.unshift(entry)
    localStorage.setItem(CACHE_KEY, JSON.stringify(existing.slice(0, MAX_ENTRIES)))
  } catch (e) {
    console.log("Cache save failed:", e)
  }
}

export function findCachedResponse(question, language) {
  try {
    const responses = getCachedResponses()
    const q = question.toLowerCase().trim()

    const exact = responses.find(r =>
      r.question === q && r.language === language
    )
    if (exact) return exact.answer

    const words = q.split(" ").filter(w => w.length > 3)
    const partial = responses.find(r =>
      r.language === language &&
      words.filter(w => r.question.includes(w)).length >= 3
    )
    if (partial) return partial.answer

    return null
  } catch (e) {
    return null
  }
}

export function getCachedResponses() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")
  } catch (e) {
    return []
  }
}

export function getCacheSize() {
  return getCachedResponses().length
}