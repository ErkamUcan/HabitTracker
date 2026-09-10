import React, { useState, useEffect } from 'react'
import { useLang } from '../context/LangContext'

export default function Settings() {
  const { t, lang, setLanguage } = useLang()
  const [notifications, setNotifications] = useState(true)
  const [exportMsg, setExportMsg]         = useState(null)
  const [exportErr, setExportErr]         = useState(null)
  const [loading, setLoading]             = useState(false)

  // Study settings
  const [studySound, setStudySound]       = useState(true)
  const [dailyGoal, setDailyGoal]         = useState('120')
  const [idleTimeout, setIdleTimeout]     = useState('8')
  const [focusGoalHours, setFocusGoalHours] = useState('12')
  const [focusColor, setFocusColor]       = useState('#15172e')
  const [studySettingsSaved, setStudySettingsSaved] = useState(false)

  // Practice settings
  const [negativeMarking, setNegativeMarking] = useState(true)
  const [practiceSettingsSaved, setPracticeSettingsSaved] = useState(false)

  // Countdown settings
  const [examDate,  setExamDate]  = useState('2026-09-06')
  const [examLabel, setExamLabel] = useState('6 Eylül KPSS sınavına')
  const [countdownSaved, setCountdownSaved] = useState(false)

  useEffect(() => {
    window.api.settings.get('notifications_enabled').then(val => {
      if (val !== null) setNotifications(val === 'true')
    })
    window.api.settings.get('study_sound_enabled').then(val => {
      if (val !== null) setStudySound(val !== 'false')
    })
    window.api.settings.get('study_daily_goal_minutes').then(val => {
      if (val) setDailyGoal(val)
    })
    window.api.settings.get('study_idle_timeout_minutes').then(val => {
      if (val) setIdleTimeout(val)
    })
    window.api.settings.get('focus_goal_hours').then(val => {
      if (val) setFocusGoalHours(val)
    })
    window.api.settings.get('focus_color').then(val => {
      if (val) setFocusColor(val)
    })
    window.api.settings.get('negative_marking_enabled').then(val => {
      if (val !== null) setNegativeMarking(val !== 'false')
    })
    window.api.settings.get('exam_date').then(val  => { if (val) setExamDate(val) })
    window.api.settings.get('exam_label').then(val => { if (val) setExamLabel(val) })
  }, [])

  async function saveCountdownSettings() {
    await window.api.settings.set('exam_date',  examDate)
    await window.api.settings.set('exam_label', examLabel)
    setCountdownSaved(true)
    setTimeout(() => setCountdownSaved(false), 2000)
  }

  async function saveStudySettings() {
    await window.api.settings.set('study_sound_enabled', String(studySound))
    await window.api.settings.set('study_daily_goal_minutes', dailyGoal)
    await window.api.settings.set('study_idle_timeout_minutes', idleTimeout)
    await window.api.settings.set('focus_goal_hours', focusGoalHours)
    await window.api.settings.set('focus_color', focusColor)
    setStudySettingsSaved(true)
    setTimeout(() => setStudySettingsSaved(false), 2000)
  }

  async function toggleNotifications() {
    const next = !notifications
    setNotifications(next)
    await window.api.settings.set('notifications_enabled', String(next))
  }

  async function doExport(type) {
    setLoading(true)
    setExportMsg(null)
    setExportErr(null)
    try {
      const result = type === 'json'
        ? await window.api.export.toJSON()
        : await window.api.export.toExcel()

      if (!result.canceled && result.ok) {
        setExportMsg(t('settings.saved', { path: result.path }))
      }
    } catch (e) {
      setExportErr(t('settings.error', { msg: e.message }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>

      {/* Language */}
      <div className="settings-section">
        <h3>{t('settings.language')}</h3>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.lang.label')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${lang === 'tr' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLanguage('tr')}
            >
              {t('settings.lang.tr')}
            </button>
            <button
              className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLanguage('en')}
            >
              {t('settings.lang.en')}
            </button>
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* Sınav Geri Sayımı */}
      <div className="settings-section">
        <h3>Sınav Geri Sayımı</h3>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Sınav tarihi</div>
            <div className="settings-row-desc">Sol paneldeki geri sayım bu tarihe göre hesaplanır. Sınav günü sayılmaz.</div>
          </div>
          <input
            type="date"
            value={examDate}
            onChange={e => setExamDate(e.target.value)}
            style={{ width: 160 }}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Geri sayım mesajı</div>
            <div className="settings-row-desc">Gün sayısının üstünde görünen yazı.</div>
          </div>
          <input
            type="text"
            value={examLabel}
            onChange={e => setExamLabel(e.target.value)}
            style={{ width: 220 }}
            placeholder="ör. 6 Eylül KPSS sınavına"
            maxLength={60}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={saveCountdownSettings}>
            Kaydet
          </button>
          {countdownSaved && (
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
              ✓ Kaydedildi — uygulamayı yeniden açınca sol panelde güncellenir
            </span>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* Notifications */}
      <div className="settings-section">
        <h3>{t('settings.notifications')}</h3>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.notif.label')}</div>
            <div className="settings-row-desc">{t('settings.notif.desc')}</div>
          </div>
          <button
            className={`toggle${notifications ? ' on' : ''}`}
            onClick={toggleNotifications}
            aria-label="Bildirimleri aç/kapat"
          />
        </div>
      </div>

      <div className="divider" />

      {/* Export */}
      <div className="settings-section">
        <h3>{t('settings.export')}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {t('settings.export.desc')}
        </p>
        <div className="export-buttons">
          <button className="btn btn-ghost" onClick={() => doExport('json')} disabled={loading}>
            {t('settings.export.json')}
          </button>
          <button className="btn btn-ghost" onClick={() => doExport('excel')} disabled={loading}>
            {t('settings.export.excel')}
          </button>
        </div>
        {exportMsg && <p className="export-result">✓ {exportMsg}</p>}
        {exportErr && <p className="export-error">✕ {exportErr}</p>}
      </div>

      <div className="divider" />

      {/* Study Timer */}
      <div className="settings-section">
        <h3>Çalışma Zamanlayıcısı</h3>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Başlangıç/bitiş sesi</div>
            <div className="settings-row-desc">Oturum başladığında ve bittiğinde kısa bip sesi çalar.</div>
          </div>
          <button
            className={`toggle${studySound ? ' on' : ''}`}
            onClick={() => setStudySound(v => !v)}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Günlük çalışma hedefi</div>
            <div className="settings-row-desc">Seri takibi için gereken minimum günlük süre.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="number" min="15" max="720" step="15"
              value={dailyGoal}
              onChange={e => setDailyGoal(e.target.value)}
              style={{ width:72 }}
            />
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>dakika</span>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Hareketsizlik uyarısı</div>
            <div className="settings-row-desc">Aktif oturumdayken bu kadar dakika hareketsizlik algılanırsa bildirim göster.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="number" min="1" max="60"
              value={idleTimeout}
              onChange={e => setIdleTimeout(e.target.value)}
              style={{ width:64 }}
            />
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>dakika</span>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Günlük Hedef Sayacı — varsayılan süre</div>
            <div className="settings-row-desc">Zamanlayıcı sekmesindeki Günlük Hedef paneli bu saati varsayılan olarak kullanır.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input
              type="number" min="1" max="24"
              value={focusGoalHours}
              onChange={e => setFocusGoalHours(e.target.value)}
              style={{ width:64 }}
            />
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>saat</span>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Odak Modu arka plan rengi</div>
            <div className="settings-row-desc">Odak modunda (tam ekran) kullanılacak arka plan rengi.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input
              type="color"
              value={focusColor}
              onChange={e => setFocusColor(e.target.value)}
              style={{ width:44, height:36, border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', padding:2 }}
            />
            <span style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{focusColor}</span>
          </div>
        </div>

        <div style={{ marginTop:16 }}>
          <button className="btn btn-primary btn-sm" onClick={saveStudySettings}>
            Ayarları Kaydet
          </button>
          {studySettingsSaved && (
            <span style={{ marginLeft:12, fontSize:12, color:'var(--success)', fontFamily:'var(--font-mono)' }}>
              ✓ Kaydedildi
            </span>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* Practice */}
      <div className="settings-section">
        <h3>Soru Çözme Takibi</h3>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">4 yanlış 1 doğruyu götürür</div>
            <div className="settings-row-desc">Kapalıysa net = doğru sayısı. Açıkken net = doğru − yanlış÷4.</div>
          </div>
          <button
            className={`toggle${negativeMarking ? ' on' : ''}`}
            onClick={async () => {
              const next = !negativeMarking
              setNegativeMarking(next)
              await window.api.settings.set('negative_marking_enabled', String(next))
              setPracticeSettingsSaved(true)
              setTimeout(() => setPracticeSettingsSaved(false), 2000)
            }}
          />
        </div>
        {practiceSettingsSaved && (
          <span style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓ Kaydedildi</span>
        )}
      </div>

      <div className="divider" />

      {/* About */}
      <div className="settings-section">
        <h3>{t('settings.about')}</h3>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">KPSS Habit Tracker</div>
            <div className="settings-row-desc">{t('settings.version')}</div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.data_location')}</div>
            <div className="settings-row-desc">
              {t('settings.data_desc')}
            </div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('settings.sources')}</div>
            <div className="settings-row-desc">
              {t('settings.sources_desc')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
