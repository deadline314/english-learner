import { useCallback, useEffect, useRef, useState } from 'react'

type Accent = 'us' | 'uk'

interface UseTTSOptions {
  accent?: Accent
  rate?: number
  pitch?: number
}

export function useTTS(options: UseTTSOptions = {}) {
  const { accent = 'us', rate = 0.9, pitch = 1 } = options
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return

    const loadVoices = () => {
      const available = synth.getVoices()
      if (available.length > 0) setVoices(available)
    }

    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)

    const interval = setInterval(() => {
      const v = synth.getVoices()
      if (v.length > 0) {
        setVoices(v)
        clearInterval(interval)
      }
    }, 200)

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices)
      clearInterval(interval)
    }
  }, [])

  const getVoice = useCallback((targetAccent: Accent) => {
    const lang = targetAccent === 'uk' ? 'en-GB' : 'en-US'

    const googleVoice = voices.find(
      (v) => v.lang === lang && v.name.toLowerCase().includes('google')
    )
    if (googleVoice) return googleVoice

    const microsoftVoice = voices.find(
      (v) => v.lang === lang && v.name.toLowerCase().includes('microsoft')
    )
    if (microsoftVoice) return microsoftVoice

    const langMatch = voices.find((v) => v.lang === lang)
    if (langMatch) return langMatch

    return voices.find((v) => v.lang.startsWith('en')) || null
  }, [voices])

  const speak = useCallback((text: string, overrideAccent?: Accent) => {
    const synth = window.speechSynthesis
    if (!synth) return

    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = getVoice(overrideAccent || accent)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = (overrideAccent || accent) === 'uk' ? 'en-GB' : 'en-US'
    }
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance

    setTimeout(() => synth.speak(utterance), 50)
  }, [accent, rate, pitch, getVoice])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, voices, hasVoices: voices.length > 0 }
}
