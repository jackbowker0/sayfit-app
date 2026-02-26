import * as Speech from 'expo-speech';

class VoiceService {
  constructor() {
    this.isListening = false;
    this.onCommandDetected = null;
    this.onPartialResult = null;
    this.onError = null;
  }

  async init() {
    if (__DEV__) console.log('[Voice] Using mock voice service (Expo Go mode)');
    return true;
  }

  async startListening() {
    this.isListening = true;
  }

  async stopListening() {
    this.isListening = false;
  }

  async speak(text, coachId = 'hype') {
    await Speech.stop();
    const voiceOptions = {
      drill: { rate: 1.1, pitch: 0.9 },
      hype: { rate: 1.15, pitch: 1.1 },
      zen: { rate: 0.85, pitch: 1.0 },
    };
    const options = voiceOptions[coachId] || voiceOptions.hype;
    Speech.speak(text, { language: 'en-US', rate: options.rate, pitch: options.pitch });
  }

  async stopSpeaking() {
    await Speech.stop();
  }

  async destroy() {
    await this.stopListening();
    await this.stopSpeaking();
  }
}

export const voiceService = new VoiceService();