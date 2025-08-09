/*
  Minimal Web Audio sonifier for year-based playback.
  - Initializes/resumes AudioContext on first user gesture
  - Maps year (1600-1800) to a pleasant pentatonic scale across ~2 octaves
  - Plays one short blip per year, with gain scaled by number of points that year
  - Hard caps gain to avoid clipping
*/

export class Sonifier {
  private static instance: Sonifier | null = null
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private initialized: boolean = false

  static getInstance(): Sonifier {
    if (!Sonifier.instance) {
      Sonifier.instance = new Sonifier()
    }
    return Sonifier.instance
  }

  init(): void {
    if (this.initialized) return
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.value = 0.5

    // Soft limiter to prevent peaks
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 20
    limiter.ratio.value = 12
    limiter.attack.value = 0.002
    limiter.release.value = 0.25

    master.connect(limiter)
    limiter.connect(ctx.destination)

    this.audioContext = ctx
    this.masterGain = master
    this.initialized = true
  }

  // Map year to frequency using a C major pentatonic scale over ~2 octaves
  // 1600 -> low end, 1800 -> high end
  private frequencyForYear(year: number): number {
    const clampedYear = Math.max(1600, Math.min(1800, year))
    const t = (clampedYear - 1600) / 200 // 0..1

    const scaleSemitones = [0, 2, 4, 7, 9] // C major pentatonic
    const totalSteps = 5 * 10 // 10 groups of the pentatonic = 50 steps
    const idx = Math.floor(t * (totalSteps - 1))
    const octave = Math.floor(idx / scaleSemitones.length)
    const degree = idx % scaleSemitones.length
    const baseMidi = 60 // C4
    const midi = baseMidi + octave * 2 + scaleSemitones[degree] // climb ~2 octaves
    // Convert MIDI to frequency
    return 440 * Math.pow(2, (midi - 69) / 12)
  }

  // Play one or more brief blips for the given year; number of notes scales with count
  playYear(year: number, numPoints: number): void {
    if (!this.initialized || !this.audioContext || !this.masterGain) return
    const ctx = this.audioContext
    const now = Math.max(ctx.currentTime, 0)
    const freq = this.frequencyForYear(year)

    const safeCount = Math.max(0, numPoints)
    // Number of notes: 1..16, scaling sublinearly with count
    const burstNotes = Math.max(1, Math.min(16, Math.round(2 * Math.log2(safeCount + 1))))
    // Total loudness grows with count but is log-compressed
    const totalLoudness = 0.06 + 0.20 * Math.min(1, Math.log1p(safeCount) / Math.log(301))
    // Distribute across notes sublinearly to avoid clipping
    const perNoteGain = totalLoudness / Math.sqrt(burstNotes)

    const baseInterval = 0.014 // 14ms spacing between notes
    const detuneSemitones = [0, 2, 4, 7, 9, 12] // small arpeggio

    for (let i = 0; i < burstNotes; i += 1) {
      const jitter = (Math.random() - 0.5) * 0.006 // +/-6ms
      const startAt = now + i * baseInterval + Math.max(-0.006, Math.min(0.006, jitter))

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      const semi = detuneSemitones[i % detuneSemitones.length]
      const freqVar = freq * Math.pow(2, semi / 12)
      osc.frequency.setValueAtTime(freqVar, startAt)

      const attack = 0.004
      const decay = 0.12
      const sustain = 0.0
      const release = 0.08
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(perNoteGain, startAt + attack)
      gain.gain.exponentialRampToValueAtTime(Math.max(1e-4, perNoteGain * 0.25), startAt + attack + decay)
      gain.gain.linearRampToValueAtTime(sustain, startAt + attack + decay + release)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(startAt)
      osc.stop(startAt + attack + decay + release + 0.02)
    }
  }
}

export const sonifier = Sonifier.getInstance()


