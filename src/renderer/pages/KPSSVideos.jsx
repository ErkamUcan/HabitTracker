import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import RingProgress from '../components/RingProgress'
import ColorPicker from '../components/ColorPicker'
import { getColor } from '../utils/colors'

// ---- Süre parsing: "1:35:22", "35:22", "45" ----
function parseDuration(str) {
  if (!str && str !== 0) return 0
  const s = String(str).trim()
  if (!s) return 0
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p) || 0)
    if (parts.length === 3) return Math.round(parts[0] * 60 + parts[1] + parts[2] / 60)
    if (parts.length === 2) return Math.round(parts[0] + parts[1] / 60)
  }
  return parseInt(s) || 0
}

function fmt(min) {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0 && m > 0) return `${h}s ${m}dk`
  if (h > 0) return `${h} saat`
  return `${m} dk`
}

// ---- İlerleme bar rengi ----
function barColor(pct) {
  if (pct === 100) return 'var(--success)'
  if (pct >= 70)   return 'var(--accent)'
  if (pct >= 30)   return 'var(--gold)'
  return 'var(--warn)'
}

// ---- Toplu ekleme parser ----
function parseBulkLines(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(p => p.trim())
      return { title: parts[0] || '', duration_min: parseDuration(parts[1]), link: parts[2] || '' }
    })
    .filter(item => item.title)
}

// ---- Hız istatistikleri (ders bazlı) ----
function SpeedStats({ remainingMin }) {
  if (remainingMin <= 0) return null

  const at1x  = remainingMin
  const at15x = Math.round(remainingMin / 1.5)
  const at2x  = Math.round(remainingMin / 2)

  const daily15at15x = Math.ceil(at15x / 15)
  const daily20at15x = Math.ceil(at15x / 20)

  return (
    <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', margin: '4px 0 8px', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
        <SpeedItem label="1×" value={at1x} />
        <SpeedItem label="1.5×" value={at15x} highlight />
        <SpeedItem label="2×" value={at2x} />
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Günde <strong style={{ color: '#ef4444' }}>{fmt(daily15at15x)}</strong> izleyerek 15 günde
        {' · '}
        günde <strong style={{ color: '#b45309' }}>{fmt(daily20at15x)}</strong> izleyerek 20 günde bitirir
        <span style={{ opacity: 0.6, marginLeft: 4 }}>(1.5×)</span>
      </div>
    </div>
  )
}

function SpeedItem({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: 'var(--font-heading)', color: highlight ? 'var(--accent)' : 'var(--text)' }}>
        {fmt(value)}
      </div>
    </div>
  )
}

// ---- Tek video satırı ----
function VideoRow({ video, lessons, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing]   = useState(false)
  const [eTitle, setETitle]     = useState(video.title)
  const [eDur, setEDur]         = useState(video.duration_min > 0 ? String(video.duration_min) : '')
  const [eLink, setELink]       = useState(video.link || '')
  const [eLessonId, setELessonId] = useState(video.lesson_id != null ? String(video.lesson_id) : '')
  const ref = useRef(null)

  function startEdit() {
    setETitle(video.title)
    setEDur(video.duration_min > 0 ? String(video.duration_min) : '')
    setELink(video.link || '')
    setELessonId(video.lesson_id != null ? String(video.lesson_id) : '')
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function commitEdit() {
    const title = eTitle.trim()
    if (!title) { setEditing(false); return }
    onUpdate(video.id, {
      title, duration_min: parseDuration(eDur),
      link: eLink.trim(), lesson_id: eLessonId ? parseInt(eLessonId) : null
    })
    setEditing(false)
  }

  return (
    <div className={`video-item${video.done ? ' done' : ''}`}>
      <div className={`cb${video.done ? ' checked' : ''}`}
        onClick={() => onToggle(video.id, !video.done)} style={{ flexShrink: 0 }} />

      {editing ? (
        <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={ref} type="text" value={eTitle} onChange={e => setETitle(e.target.value)}
            placeholder="Başlık" style={{ flex: 1, minWidth: 120, fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }} />
          <input type="text" value={eDur} onChange={e => setEDur(e.target.value)}
            placeholder="1:35:22 veya 45" style={{ width: 90, fontSize: 12 }}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit() }} />
          <input type="text" value={eLink} onChange={e => setELink(e.target.value)}
            placeholder="Link" style={{ width: 110, fontSize: 12 }}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit() }} />
          <select value={eLessonId} onChange={e => setELessonId(e.target.value)}
            style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 7px', background: 'var(--bg)', color: 'var(--text)' }}>
            <option value="">— Kategorisiz —</option>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="btn btn-primary btn-xs" onClick={commitEdit}>Kaydet</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>İptal</button>
        </div>
      ) : (
        <>
          <span className="video-title" onDoubleClick={startEdit}>{video.title}</span>
          {video.duration_min > 0 && <span className="video-duration">{fmt(video.duration_min)}</span>}
          {video.link && (
            <button
              className="icon-btn"
              style={{ fontSize: 13 }}
              title="Tarayıcıda aç"
              onClick={() => window.api.shell.open(video.link)}
            >
              ↗
            </button>
          )}
          <div className="video-actions">
            <button className="icon-btn" title="Düzenle" onClick={startEdit}>✎</button>
            <button className="icon-btn danger" title="Sil" onClick={() => onDelete(video.id)}>✕</button>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Ders bloğu ----
const LessonBlock = React.forwardRef(function LessonBlock({ lesson, videos, allLessons, onRename, onDelete, onSetColor, onToggle, onDeleteVideo, onUpdateVideo, searchQuery, onBulkAdd, onAddVideo, onMoveUp, onMoveDown }, ref) {
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef(null)
  const [renaming, setRenaming] = useState(false)

  useImperativeHandle(ref, () => ({
    openAndScroll() {
      setOpen(true)
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }))
  const [lessonName, setLessonName] = useState(lesson.name)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDur, setNewDur]     = useState('')
  const [newLink, setNewLink]   = useState('')
  const nameRef = useRef(null)
  const addRef  = useRef(null)

  const color    = getColor(lesson.color)
  const filtered = searchQuery
    ? videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : videos

  const watched    = videos.filter(v => v.done).length
  const total      = videos.length
  const totalMin   = videos.reduce((s, v) => s + (v.duration_min || 0), 0)
  const remainMin  = videos.filter(v => !v.done).reduce((s, v) => s + (v.duration_min || 0), 0)
  const pct        = total > 0 ? Math.round((watched / total) * 100) : 0

  function commitRename() {
    const t = lessonName.trim()
    if (t && t !== lesson.name) onRename(lesson.id, t)
    else setLessonName(lesson.name)
    setRenaming(false)
  }

  async function handleBulkAdd() {
    const items = parseBulkLines(bulkText)
    if (!items.length) return
    await onBulkAdd(items.map(it => ({ ...it, lesson_id: lesson.id })))
    setBulkText(''); setShowBulk(false)
  }

  async function handleAddSingle() {
    const title = newTitle.trim()
    if (!title) return
    await onAddVideo({ title, duration_min: parseDuration(newDur), link: newLink.trim(), lesson_id: lesson.id })
    setNewTitle(''); setNewDur(''); setNewLink('')
    addRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="kpss-category" style={{ borderLeft: `3px solid ${color.hex}` }}>
      {/* Header */}
      <div className="kpss-category-header" style={{ background: color.bg }}
        onClick={() => !renaming && setOpen(o => !o)}>

        <ColorPicker color={lesson.color} onChange={c => onSetColor(lesson.id, c)} />

        {renaming ? (
          <input ref={nameRef} className="kpss-category-name-input" value={lessonName}
            onChange={e => setLessonName(e.target.value)} onClick={e => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setLessonName(lesson.name); setRenaming(false) } }} />
        ) : (
          <span className="kpss-category-name-static"
            onDoubleClick={e => { e.stopPropagation(); setRenaming(true); setTimeout(() => nameRef.current?.focus(), 0) }}>
            {lesson.name}
          </span>
        )}

        <span className={`badge ${pct === 100 && total > 0 ? 'badge-success' : 'badge-neutral'}`}>
          {watched}/{total}
          {totalMin > 0 && <span style={{ marginLeft: 5, opacity: 0.7 }}>{fmt(totalMin)}</span>}
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }} onClick={e => e.stopPropagation()}>
          {onMoveUp && (
            <button className="icon-btn" title="Yukarı taşı" style={{ fontSize: 12 }} onClick={onMoveUp}>↑</button>
          )}
          {onMoveDown && (
            <button className="icon-btn" title="Aşağı taşı" style={{ fontSize: 12 }} onClick={onMoveDown}>↓</button>
          )}
          <button className={`icon-btn${showAdd ? ' active' : ''}`} title="Video ekle"
            onClick={() => { setShowAdd(p => !p); setShowBulk(false); setOpen(true) }}>+</button>
          <button className={`icon-btn${showBulk ? ' active' : ''}`} title="Toplu ekle" style={{ fontSize: 12 }}
            onClick={() => { setShowBulk(p => !p); setShowAdd(false); setOpen(true) }}>⇥</button>
          <button className="icon-btn danger" title="Dersi sil"
            onClick={() => { if (window.confirm(`"${lesson.name}" dersi silinsin mi? Videolar kategorisiz olarak kalır.`)) onDelete(lesson.id) }}>✕</button>
        </div>
        <span className={`kpss-chevron${open ? ' open' : ''}`}>›</span>
      </div>

      {/* İlerleme */}
      {total > 0 && (() => {
        const remaining = total - watched
        const per15 = remaining > 0 ? Math.ceil(remaining / 15) : 0
        const per20 = remaining > 0 ? Math.ceil(remaining / 20) : 0
        return (
          <div className="kpss-progress">
            <div className="kpss-progress-label">
              <span>{pct}% izlendi</span>
              <span>{watched} / {total} video</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%`, background: barColor(pct) }} />
            </div>
            {remaining > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  padding: '1px 8px', borderRadius: 99,
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
                  color: '#ef4444',
                }}>
                  15g → <strong>{per15}</strong>/gün
                </span>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  padding: '1px 8px', borderRadius: 99,
                  background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.28)',
                  color: '#b45309',
                }}>
                  20g → <strong>{per20}</strong>/gün
                </span>
              </div>
            )}
          </div>
        )
      })()}

      {open && (
        <div className="kpss-category-body">
          {/* Hız hesabı (bu derse özel) */}
          {remainMin > 0 && <SpeedStats remainingMin={remainMin} />}

          {/* Toplu ekleme */}
          {showBulk && (
            <div className="kpss-bulk-area">
              <textarea rows={5}
                placeholder={'Her satıra bir video:\nKPSS TARİH 1. GÜN: İslamiyet Öncesi | 1:35:22\nOsmanlı Kuruluş Dönemi | 45:10\nAnayasa Giriş | 30'}
                value={bulkText} onChange={e => setBulkText(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }} autoFocus />
              <div className="kpss-bulk-hint">
                Format: Başlık | Süre | Link (süre: 1:35:22, 45:10 veya 45 — hepsi çalışır)
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-primary btn-xs" onClick={handleBulkAdd} disabled={!bulkText.trim()}>
                  {parseBulkLines(bulkText).length > 0 ? `${parseBulkLines(bulkText).length} Video Ekle` : 'Ekle'}
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowBulk(false)}>İptal</button>
              </div>
            </div>
          )}

          {/* Tekli ekleme */}
          {showAdd && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
              <input ref={addRef} type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Video başlığı" style={{ flex: 1, minWidth: 160, fontSize: 13 }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSingle() }} autoFocus />
              <input type="text" value={newDur} onChange={e => setNewDur(e.target.value)}
                placeholder="1:35:22 veya 45" style={{ width: 110, fontSize: 12 }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSingle() }} />
              <input type="text" value={newLink} onChange={e => setNewLink(e.target.value)}
                placeholder="Link (isteğe bağlı)" style={{ width: 140, fontSize: 12 }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSingle() }} />
              <button className="btn btn-primary btn-xs" onClick={handleAddSingle}>Ekle</button>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowAdd(false)}>Kapat</button>
            </div>
          )}

          {/* Video listesi */}
          {filtered.map(v => (
            <VideoRow key={v.id} video={v} lessons={allLessons}
              onToggle={onToggle} onDelete={onDeleteVideo} onUpdate={onUpdateVideo} />
          ))}

          {searchQuery && filtered.length === 0 && (
            <div style={{ padding: '6px 4px', color: 'var(--text-light)', fontSize: 13 }}>Arama sonucu yok</div>
          )}
          {!searchQuery && filtered.length === 0 && !showAdd && !showBulk && (
            <div style={{ padding: '10px 4px', color: 'var(--text-light)', fontSize: 13, fontStyle: 'italic' }}>
              Henüz video yok — + veya ⇥ ile ekle
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// ---- Ana sayfa ----
export default function KPSSVideos() {
  const [lessons, setLessons] = useState([])
  const [videos,  setVideos]  = useState([])
  const [search,  setSearch]  = useState('')
  const [addingLesson, setAddingLesson]     = useState(false)
  const [newLessonName, setNewLessonName]   = useState('')
  const [newLessonColor, setNewLessonColor] = useState('indigo')
  const [showGlobalAdd, setShowGlobalAdd]   = useState(false)
  const [gTitle, setGTitle]     = useState('')
  const [gDur,   setGDur]       = useState('')
  const [gLink,  setGLink]      = useState('')
  const [gLessonId, setGLessonId] = useState('')
  const [showGlobalBulk, setShowGlobalBulk] = useState(false)
  const [bulkText, setBulkText]   = useState('')
  const [bulkLessonId, setBulkLessonId] = useState('')
  const lessonInputRef = useRef(null)
  const blockRefs      = useRef({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [ls, vs] = await Promise.all([window.api.lessons.list(), window.api.videos.list()])
    setLessons(ls); setVideos(vs)
  }

  async function addLesson() {
    const name = newLessonName.trim(); if (!name) return
    const l = await window.api.lessons.add(name, newLessonColor)
    setLessons(prev => [...prev, l])
    setNewLessonName(''); setNewLessonColor('indigo'); setAddingLesson(false)
  }

  async function renameLesson(id, name) {
    await window.api.lessons.rename(id, name)
    setLessons(prev => prev.map(l => l.id === id ? { ...l, name } : l))
  }

  async function setLessonColor(id, color) {
    await window.api.lessons.setColor(id, color)
    setLessons(prev => prev.map(l => l.id === id ? { ...l, color } : l))
  }

  async function deleteLesson(id) {
    await window.api.lessons.delete(id)
    setLessons(prev => prev.filter(l => l.id !== id))
    setVideos(prev => prev.map(v => v.lesson_id === id ? { ...v, lesson_id: null } : v))
  }

  async function moveLesson(id, dir) {
    setLessons(prev => {
      const arr = [...prev]
      const i = arr.findIndex(l => l.id === id)
      const j = i + dir
      if (j < 0 || j >= arr.length) return prev
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      const updates = arr.map((l, idx) => ({ id: l.id, sort_order: idx }))
      window.api.lessons.reorder(updates)
      return arr.map((l, idx) => ({ ...l, sort_order: idx }))
    })
  }

  async function addVideo(data) {
    const v = await window.api.videos.add(data)
    setVideos(prev => [...prev, v])
  }

  async function bulkAdd(items) {
    const added = await window.api.videos.bulkAdd(items)
    setVideos(prev => [...prev, ...added])
  }

  async function toggleVideo(id, done) {
    const v = await window.api.videos.toggle(id, done)
    setVideos(prev => prev.map(x => x.id === id ? v : x))
  }

  async function deleteVideo(id) {
    await window.api.videos.delete(id)
    setVideos(prev => prev.filter(x => x.id !== id))
  }

  async function updateVideo(id, data) {
    const v = await window.api.videos.update(id, data)
    setVideos(prev => prev.map(x => x.id === id ? v : x))
  }

  async function handleGlobalAdd() {
    const title = gTitle.trim(); if (!title) return
    await addVideo({ title, duration_min: parseDuration(gDur), link: gLink.trim(), lesson_id: gLessonId ? parseInt(gLessonId) : null })
    setGTitle(''); setGDur(''); setGLink('')
  }

  async function handleGlobalBulk() {
    const items = parseBulkLines(bulkText); if (!items.length) return
    const lessonId = bulkLessonId ? parseInt(bulkLessonId) : null
    await bulkAdd(items.map(it => ({ ...it, lesson_id: lessonId })))
    setBulkText(''); setShowGlobalBulk(false)
  }

  const total       = videos.length
  const watched     = videos.filter(v => v.done).length
  const totalMin    = videos.reduce((s, v) => s + (v.duration_min || 0), 0)
  const watchedMin  = videos.filter(v => v.done).reduce((s, v) => s + (v.duration_min || 0), 0)
  const pct         = total > 0 ? Math.round((watched / total) * 100) : 0

  const uncategorized = videos.filter(v => !v.lesson_id)

  function videosFor(lessonId) {
    return videos.filter(v => v.lesson_id === lessonId)
  }

  function LessonSelect({ value, onChange, placeholder = '— Kategorisiz —' }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
        <option value="">{placeholder}</option>
        {lessons.map(l => <option key={l.id} value={l.id}>● {l.name}</option>)}
      </select>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>KPSS Videolar</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Derslerine göre videoları organize et. Çift tıkla düzenle · Süre formatı: 1:35:22, 45:10 veya 45
        </p>
      </div>

      {/* Genel istatistikler */}
      {total > 0 && (() => {
        const remTotal = total - watched
        const gPer15 = remTotal > 0 ? Math.ceil(remTotal / 15) : 0
        const gPer20 = remTotal > 0 ? Math.ceil(remTotal / 20) : 0
        return (
          <div style={{ marginBottom: 16, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <RingProgress value={pct} size={72} strokeWidth={7}
                label={`${watched} / ${total} video izlendi`}
                sub={watchedMin > 0 ? `${fmt(watchedMin)} / ${fmt(totalMin)}` : `Toplam ${fmt(totalMin)}`} />
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
                {lessons.map(l => {
                  const lvs = videosFor(l.id)
                  const ld  = lvs.filter(v => v.done).length
                  const lp  = lvs.length > 0 ? Math.round((ld / lvs.length) * 100) : 0
                  const lc  = getColor(l.color)
                  return (
                    <div key={l.id} style={{ fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: lc.hex, display: 'inline-block', flexShrink: 0 }} />
                        {l.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ld}/{lvs.length} · {lp}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
            {remTotal > 0 && (
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingRight: 12, borderRight: '1px solid var(--border)' }}>
                  Kalan <strong style={{ color: 'var(--text)' }}>{remTotal}</strong> video
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    padding: '2px 10px', borderRadius: 99,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#ef4444',
                  }}>
                    15 gün → günde <strong>{gPer15}</strong> video
                  </span>
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    padding: '2px 10px', borderRadius: 99,
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
                    color: '#b45309',
                  }}>
                    20 gün → günde <strong>{gPer20}</strong> video
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Araç çubuğu */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Video ara…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, maxWidth: 300 }} />
        <button className="btn btn-primary btn-sm"
          onClick={() => { setAddingLesson(true); setTimeout(() => lessonInputRef.current?.focus(), 0) }}>
          + Ders Ekle
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowGlobalAdd(p => !p); setShowGlobalBulk(false) }}>
          {showGlobalAdd ? '✕ Kapat' : '+ Video Ekle'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowGlobalBulk(p => !p); setShowGlobalAdd(false) }}>
          {showGlobalBulk ? '✕ Kapat' : '⇥ Toplu Ekle'}
        </button>
      </div>

      {/* Yeni ders formu */}
      {addingLesson && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <ColorPicker color={newLessonColor} onChange={setNewLessonColor} />
          <input ref={lessonInputRef} type="text" placeholder="Ders adı (örn: Anayasa Hukuku)" value={newLessonName}
            onChange={e => setNewLessonName(e.target.value)} style={{ maxWidth: 280 }}
            onKeyDown={e => { if (e.key === 'Enter') addLesson(); if (e.key === 'Escape') { setAddingLesson(false); setNewLessonName('') } }} />
          <button className="btn btn-primary btn-sm" onClick={addLesson}>Ekle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAddingLesson(false); setNewLessonName('') }}>İptal</button>
        </div>
      )}

      {/* Global tekli ekleme */}
      {showGlobalAdd && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
          {[
            { label: 'Başlık *', el: <input type="text" value={gTitle} onChange={e => setGTitle(e.target.value)} placeholder="Video başlığı" onKeyDown={e => { if (e.key === 'Enter') handleGlobalAdd() }} autoFocus style={{ fontSize: 13 }} />, style: { flex: 1, minWidth: 180 } },
            { label: 'Süre', el: <input type="text" value={gDur} onChange={e => setGDur(e.target.value)} placeholder="1:35:22 veya 45" onKeyDown={e => { if (e.key === 'Enter') handleGlobalAdd() }} style={{ fontSize: 12 }} />, style: { width: 120 } },
            { label: 'Link', el: <input type="text" value={gLink} onChange={e => setGLink(e.target.value)} placeholder="https://..." onKeyDown={e => { if (e.key === 'Enter') handleGlobalAdd() }} style={{ fontSize: 12 }} />, style: { width: 130 } },
            { label: 'Ders', el: <LessonSelect value={gLessonId} onChange={setGLessonId} />, style: { minWidth: 160 } },
          ].map(({ label, el, style }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</label>
              {el}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
            <button className="btn btn-primary btn-sm" onClick={handleGlobalAdd}>Ekle</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGlobalAdd(false)}>İptal</button>
          </div>
        </div>
      )}

      {/* Global toplu ekleme */}
      {showGlobalBulk && (
        <div style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Hangi derse eklensin?</label>
            <LessonSelect value={bulkLessonId} onChange={setBulkLessonId} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            Her satır = 1 video · Format: Başlık | Süre | Link (süre: 1:35:22, 45:10 veya 45 — hepsi çalışır)
          </div>
          <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)} autoFocus
            placeholder={'KPSS TARİH 1. GÜN: İslamiyet Öncesi Türk Tarihi -I | 1:35:22\nKPSS TARİH 2. GÜN: Osmanlı Kuruluş Dönemi | 58:40\nKPSS Genel Kültür Coğrafya | 45'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleGlobalBulk} disabled={!bulkText.trim()}>
              {parseBulkLines(bulkText).length > 0 ? `${parseBulkLines(bulkText).length} Video Ekle` : 'Ekle'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGlobalBulk(false)}>İptal</button>
          </div>
        </div>
      )}

      {/* Boş durum */}
      {lessons.length === 0 && total === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>▶</div>
          <p style={{ fontSize: 14 }}>Henüz ders veya video eklenmedi.</p>
          <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-light)' }}>
            "Ders Ekle" ile derslerini oluştur, sonra her derse video ekle.
          </p>
        </div>
      )}

      {/* Ders hızlı nav */}
      {lessons.length > 0 && (
        <div className="kpss-quick-nav">
          {lessons.map(lesson => {
            const c = getColor(lesson.color)
            const lvs = videosFor(lesson.id)
            const ld = lvs.filter(v => v.done).length
            return (
              <button
                key={lesson.id}
                className="kpss-nav-pill"
                style={{ borderColor: c.hex, color: c.hex }}
                onClick={() => blockRefs.current[lesson.id]?.openAndScroll()}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.hex, display: 'inline-block', flexShrink: 0 }} />
                {lesson.name}
                {lvs.length > 0 && (
                  <span style={{ fontSize: 10, opacity: 0.65, fontFamily: 'var(--font-mono)' }}>
                    {ld}/{lvs.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Ders blokları */}
      {lessons.map((lesson, idx) => (
        <LessonBlock
          key={lesson.id}
          ref={el => { blockRefs.current[lesson.id] = el }}
          lesson={lesson}
          videos={videosFor(lesson.id)}
          allLessons={lessons}
          searchQuery={search}
          onRename={renameLesson}
          onDelete={deleteLesson}
          onSetColor={setLessonColor}
          onToggle={toggleVideo}
          onDeleteVideo={deleteVideo}
          onUpdateVideo={updateVideo}
          onBulkAdd={bulkAdd}
          onAddVideo={addVideo}
          onMoveUp={idx > 0 ? () => moveLesson(lesson.id, -1) : null}
          onMoveDown={idx < lessons.length - 1 ? () => moveLesson(lesson.id, 1) : null}
        />
      ))}

      {/* Kategorisiz */}
      {uncategorized.length > 0 && (
        <div className="kpss-category" style={{ borderLeft: '3px solid var(--border-strong)', opacity: 0.85 }}>
          <div className="kpss-category-header" style={{ cursor: 'default' }}>
            <span className="kpss-category-name-static" style={{ color: 'var(--text-muted)' }}>Kategorisiz</span>
            <span className="badge badge-neutral">{uncategorized.length} video</span>
          </div>
          <div className="kpss-category-body">
            {(search ? uncategorized.filter(v => v.title.toLowerCase().includes(search.toLowerCase())) : uncategorized)
              .map(v => (
                <VideoRow key={v.id} video={v} lessons={lessons}
                  onToggle={toggleVideo} onDelete={deleteVideo} onUpdate={updateVideo} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
