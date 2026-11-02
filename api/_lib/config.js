/** Change this fallback when upgrading the default OpenAI model. */
export const OPENAI_MODEL_FALLBACK = 'gpt-4o-mini'

export const OPENAI_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe'

export const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts'

export const OPENAI_TTS_VOICE = 'ash'

export const OPENAI_TTS_SPEED = 1.15

export const OPENAI_TTS_INSTRUCTIONS =
  'Speak as a confident, encouraging male UK golf caddie. Warm and reassuring but brisk and to the point — like quick advice on the tee box. Clear British English pronunciation. Keep a natural, lively pace, not slow or drawn out.'

export const MAX_SPEECH_CHARS = 600

export const MAX_OUTPUT_TOKENS = 400

export const OPENAI_ADVICE_TEMPERATURE = 0.4

export const OPENAI_SASS_TEMPERATURE = 0.65

export const MAX_RECORDING_SECONDS = 45

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024

export const MAX_CADDIE_BODY_BYTES = 64 * 1024

export const MAX_CONVERSATION_MESSAGES = 8

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/m4a',
])

export const GOLF_TRANSCRIPTION_PROMPT =
  'UK golf shot description. Terms: fairway, rough, bunker, out of bounds, driver, hybrid, wedge, pitching wedge, gap wedge, sand wedge, lob wedge, yards, metres, pin, green, tee shot, approach, chip, recovery, wind into, wind helping.'
