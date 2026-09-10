let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function tone(freq, startTime, duration, vol = 0.25, type = 'sine') {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

// Duraklat: hafif alçalan çift ton
export function playPause() {
  const t = getCtx().currentTime
  tone(660, t, 0.12)
  tone(440, t + 0.13, 0.18)
}

// Devam et: hafif yükselen çift ton
export function playResume() {
  const t = getCtx().currentTime
  tone(440, t, 0.1)
  tone(660, t + 0.12, 0.18)
}

// Ders değiştir: iki tonlu kısa chime
export function playSwitch() {
  const t = getCtx().currentTime
  tone(523, t, 0.11)
  tone(659, t + 0.14, 0.2)
}

// Bitir: üç tonlu tamamlanma sesi
export function playFinish() {
  const t = getCtx().currentTime
  tone(523, t, 0.14)
  tone(659, t + 0.17, 0.14)
  tone(784, t + 0.34, 0.35)
}

// 1 saat milestone: pozitif C-E-G-C arpeji
export function playMilestone() {
  const t = getCtx().currentTime
  tone(523, t, 0.22)
  tone(659, t + 0.16, 0.22)
  tone(784, t + 0.32, 0.22)
  tone(1047, t + 0.48, 0.38)
}

// Hedef düşük tamamlama (0-30%): hayal kırıklığı, alçalan
export function playGoalLow() {
  const t = getCtx().currentTime
  tone(392, t, 0.15, 0.2, 'square')
  tone(330, t + 0.20, 0.18, 0.15, 'square')
  tone(262, t + 0.42, 0.35, 0.12, 'square')
}

// Hedef orta tamamlama (31-60%): nötr, karışık
export function playGoalMid() {
  const t = getCtx().currentTime
  tone(440, t, 0.15)
  tone(523, t + 0.18, 0.15)
  tone(440, t + 0.36, 0.22)
}

// Hedef iyi tamamlama (61-90%): sevinçli arpeji
export function playGoalGood() {
  const t = getCtx().currentTime
  tone(523, t, 0.13)
  tone(659, t + 0.15, 0.13)
  tone(784, t + 0.30, 0.13)
  tone(1047, t + 0.45, 0.30)
}

// Hedef mükemmel tamamlama (91%+): zafer fanfarı
export function playGoalExcellent() {
  const t = getCtx().currentTime
  tone(523, t, 0.10)
  tone(659, t + 0.13, 0.10)
  tone(784, t + 0.26, 0.10)
  tone(1047, t + 0.39, 0.10)
  tone(1319, t + 0.52, 0.45, 0.28)
  tone(784, t + 0.66, 0.20, 0.12)
}

// Deneme başlangıcı: enerjik yükselen süpürme
export function playExamStart() {
  const t = getCtx().currentTime
  tone(392, t, 0.07)
  tone(523, t + 0.10, 0.07)
  tone(659, t + 0.20, 0.07)
  tone(784, t + 0.30, 0.07)
  tone(1047, t + 0.40, 0.55, 0.32)
}

// Deneme bitişi: zafer fanfarı
export function playExamEnd() {
  const t = getCtx().currentTime
  tone(659, t, 0.12)
  tone(784, t + 0.16, 0.12)
  tone(988, t + 0.32, 0.12)
  tone(1319, t + 0.48, 0.14)
  tone(1047, t + 0.66, 0.12)
  tone(1319, t + 0.82, 0.60, 0.30)
}

// Süre aşımı uyarısı: tekli dikkat çekici ton
export function playExamOvertime() {
  const t = getCtx().currentTime
  tone(880, t, 0.18, 0.22)
  tone(659, t + 0.24, 0.15, 0.18)
  tone(880, t + 0.44, 0.18, 0.15)
}
