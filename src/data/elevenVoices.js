// The only voices offered in OtherSide. Each ID comes from the ElevenLabs
// voice page supplied for the stage demo.
export const ELEVEN_VOICES = [
  {
    id: 'cBTYF7NiJbR8Bvmdeuse',
    name: 'Mike',
    detail: 'Casual · expressive',
    url: 'https://elevenlabs.io/voices/cBTYF7NiJbR8Bvmdeuse',
  },
  {
    id: 'JYUzXNeyCPmymMkfcicu',
    name: 'Jon',
    detail: 'Warm · storyteller',
    url: 'https://elevenlabs.io/voices/JYUzXNeyCPmymMkfcicu',
  },
  {
    id: 'QAmlwgbPtjxpk7u98Qs9',
    name: 'Adam',
    detail: 'Compelling · deep pitch',
    url: 'https://elevenlabs.io/voices/QAmlwgbPtjxpk7u98Qs9',
  },
  {
    id: '7jynqzOvnVP89nA7TB0m',
    name: 'Nick',
    detail: 'Relatable · engaging',
    url: 'https://elevenlabs.io/voices/7jynqzOvnVP89nA7TB0m',
  },
  {
    id: '1SM7GgM6IMuvQlz2BwM3',
    name: 'Mark',
    detail: 'Friendly · conversational',
    url: 'https://elevenlabs.io/voices/1SM7GgM6IMuvQlz2BwM3',
  },
  {
    id: 'ppLqTilh7rH7fbUVlXsf',
    name: 'David',
    detail: 'Documentary · authoritative',
    url: 'https://elevenlabs.io/voices/ppLqTilh7rH7fbUVlXsf',
  },
  {
    id: 'B9U4Lk9uR0DBeFxDocVd',
    name: 'Extra voice',
    detail: 'Added stage voice',
    url: 'https://elevenlabs.io/voices/B9U4Lk9uR0DBeFxDocVd',
  },
]

export const DEFAULT_VOICE_A = ELEVEN_VOICES[0].id
export const DEFAULT_VOICE_B = ELEVEN_VOICES[1].id
export const ELEVEN_VOICE_IDS = ELEVEN_VOICES.map((voice) => voice.id)

export function voiceById(id) {
  return ELEVEN_VOICES.find((voice) => voice.id === id) ?? ELEVEN_VOICES[0]
}

export function isElevenVoiceId(id) {
  return ELEVEN_VOICE_IDS.includes(id)
}
