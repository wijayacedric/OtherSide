// A deliberately small guardrail for the youth demo. It is not a classifier;
// it catches obviously harmful topics before they can be turned into polished
// "both sides" arguments by the template or the optional LLM.
const BLOCKED_PATTERNS = [
  /\b(kill|killing|murder|assassinate|assassination|massacre|genocide|ethnic cleansing)\b/i,
  /\b(rape|torture|slavery|trafficking|abuse|molest)\b/i,
  /\b(suicide|self[- ]harm|self[- ]injury)\b/i,
  /\b(bomb|bombing|shooting|mass shooting|weapon|weapons)\b/i,
  /\b(racist|racism|sexist|sexism|homophobic|homophobia|transphobic|transphobia|hate speech)\b/i,
  /\bhow to (hurt|harm|kill|attack|destroy|hack|steal)\b/i,
  /\b(hurt|harm) (someone|somebody|people|others)\b/i,
]

export function isSchoolAppropriateTopic(value) {
  const text = String(value ?? '').trim()
  if (text.length < 3 || text.length > 300) return false
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return false
  return true
}
