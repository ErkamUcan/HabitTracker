import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// ─── helpers ────────────────────────────────────────────────────────────────

function getTodayStr() { return new Date().toISOString().slice(0, 10) }

function computeNet(correct, wrong, negMark) {
  const c = Number(correct) || 0
  const w = Number(wrong) || 0
  return negMark ? +((c - w / 4).toFixed(2)) : c
}

function computeRate(correct, wrong, blank) {
  const c = Number(correct) || 0
  const w = Number(wrong) || 0
  const b = Number(blank) || 0
  const total = c + w + b
  return total > 0 ? +((c / total * 100).toFixed(1)) : 0
}

function sessionLabel(s) {
  if (s.topic_name) return s.topic_name
  if (s.topic_text) return s.topic_text
  if (s.category_name) return s.category_name
  return '—'
}

// ─── Category + Topic picker ─────────────────────────────────────────────────

function TopicPicker({ categories, value, onChange, disabled }) {
  const [topics, setTopics] = useState([])

  useEffect(() => {
    if (value.kpss_category_id) {
      window.api.kpss.listTopics(value.kpss_category_id).then(setTopics)
    } else {
      setTopics([])
    }
  }, [value.kpss_category_id])

  function handleCategory(rawId) {
    const id = rawId ? Number(rawId) : null
    onChange({ kpss_category_id: id, kpss_topic_id: null, topic_text: '' })
  }

  function handleTopic(text) {
    const matched = topics.find(t => t.text === text)
    onChange({ ...value, topic_text: text, kpss_topic_id: matched ? matched.id : null })
  }

  const listId = `tp-list-${value.kpss_category_id || 'x'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="study-field-label" style={{ width: 64, textAlign: 'right', marginBottom: 0 }}>Kategori</label>
        <select
          className="study-select"
          value={value.kpss_category_id || ''}
          onChange={e => handleCategory(e.target.value)}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <option value="">Kategori yok (serbest)</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="study-field-label" style={{ width: 64, textAlign: 'right', marginBottom: 0 }}>Konu</label>
        <input
          type="text"
          list={topics.length > 0 ? listId : undefined}
          placeholder={topics.length > 0 ? 'Seçin veya yazın…' : 'Konu (opsiyonel)'}
          value={value.topic_text}
          onChange={e => handleTopic(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        {topics.length > 0 && (
          <datalist id={listId}>
            {topics.map(t => <option key={t.id} value={t.text} />)}
          </datalist>
        )}
      </div>
    </div>
  )
}

// ─── Log Results ─────────────────────────────────────────────────────────────

const EMPTY = {
  date: getTodayStr(),
  kpss_category_id: null, kpss_topic_id: null, topic_text: '',
  total_questions: '', correct: '', wrong: '', blank: '',
  show_uncertain: false, uncertain_count: '', uncertain_correct_count: '',
  show_two_choice: false, two_choice_count: '', two_choice_correct_count: '',
  queue_id: null,
}

function LogResults({ categories, negativeMarking, prefill, onClearPrefill }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [sessions, setSessions] = useState([])
  const [editId, setEditId] = useState(null)
  const [saved, setSaved] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const load = useCallback(() =>
    window.api.practice.sessions.list().then(setSessions), [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!prefill) return
    setForm({
      ...EMPTY,
      kpss_category_id: prefill.kpss_category_id,
      kpss_topic_id: prefill.kpss_topic_id,
      topic_text: prefill.topic_name || prefill.topic_text || '',
      total_questions: String(prefill.target_count || ''),
      queue_id: prefill.id,
    })
    setEditId(null)
    onClearPrefill()
  }, [prefill])

  function sf(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const c = Number(form.correct) || 0
  const w = Number(form.wrong) || 0
  const b = Number(form.blank) || 0
  const total = Number(form.total_questions) || 0
  const net = computeNet(c, w, negativeMarking)
  const rate = computeRate(c, w, b)
  const mismatch = total > 0 && (c + w + b) !== total

  async function save() {
    const data = {
      date: form.date,
      kpss_category_id: form.kpss_category_id,
      kpss_topic_id: form.kpss_topic_id,
      topic_text: form.topic_text,
      total_questions: total, correct: c, wrong: w, blank: b,
      uncertain_count: form.show_uncertain ? (Number(form.uncertain_count) || 0) : 0,
      uncertain_correct_count: form.show_uncertain ? (Number(form.uncertain_correct_count) || 0) : 0,
      two_choice_count: form.show_two_choice ? (Number(form.two_choice_count) || 0) : 0,
      two_choice_correct_count: form.show_two_choice ? (Number(form.two_choice_correct_count) || 0) : 0,
      queue_id: form.queue_id,
    }
    if (editId) await window.api.practice.sessions.update(editId, data)
    else await window.api.practice.sessions.add(data)
    setForm({ ...EMPTY })
    setEditId(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    load()
  }

  function startEdit(s) {
    setEditId(s.id)
    setForm({
      date: s.date,
      kpss_category_id: s.kpss_category_id,
      kpss_topic_id: s.kpss_topic_id,
      topic_text: s.topic_name || s.topic_text || '',
      total_questions: String(s.total_questions),
      correct: String(s.correct),
      wrong: String(s.wrong),
      blank: String(s.blank),
      show_uncertain: s.uncertain_count > 0,
      uncertain_count: String(s.uncertain_count),
      uncertain_correct_count: String(s.uncertain_correct_count),
      show_two_choice: s.two_choice_count > 0,
      two_choice_count: String(s.two_choice_count),
      two_choice_correct_count: String(s.two_choice_correct_count),
      queue_id: s.queue_id,
    })
  }

  async function doDelete(id) {
    await window.api.practice.sessions.delete(id)
    setConfirmDeleteId(null)
    load()
  }

  return (
    <div>
      {/* ── Form ── */}
      <div className="card" style={{ marginBottom: 28, maxWidth: 620 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
          {editId ? 'Kaydı düzenle' : 'Yeni soru sonucu'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Date */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="study-field-label" style={{ width: 64, textAlign: 'right', marginBottom: 0 }}>Tarih</label>
            <input type="date" value={form.date} onChange={e => sf('date', e.target.value)} style={{ width: 'auto' }} />
          </div>

          {/* Category / Topic */}
          <TopicPicker
            categories={categories}
            value={{ kpss_category_id: form.kpss_category_id, kpss_topic_id: form.kpss_topic_id, topic_text: form.topic_text }}
            onChange={v => setForm(f => ({ ...f, ...v }))}
            disabled={false}
          />

          {/* D / Y / B row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="study-field-label" style={{ width: 64, textAlign: 'right', marginBottom: 0 }}>Toplam</label>
            <input type="number" min="0" value={form.total_questions} onChange={e => sf('total_questions', e.target.value)} style={{ width: 70 }} placeholder="0" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>=</span>
            <label className="study-field-label" style={{ marginBottom: 0, color: 'var(--success)' }}>D</label>
            <input type="number" min="0" value={form.correct} onChange={e => sf('correct', e.target.value)} style={{ width: 62 }} placeholder="0" />
            <label className="study-field-label" style={{ marginBottom: 0, color: 'var(--warn)' }}>Y</label>
            <input type="number" min="0" value={form.wrong} onChange={e => sf('wrong', e.target.value)} style={{ width: 62 }} placeholder="0" />
            <label className="study-field-label" style={{ marginBottom: 0 }}>B</label>
            <input type="number" min="0" value={form.blank} onChange={e => sf('blank', e.target.value)} style={{ width: 62 }} placeholder="0" />
          </div>

          {/* Mismatch warning */}
          {mismatch && (
            <div style={{ fontSize: 12, color: 'var(--gold)', background: 'var(--gold-bg)', border: '1px solid var(--gold-light)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
              Uyarı: D+Y+B = {c+w+b}, Toplam = {total} — eşleşmiyor.
            </div>
          )}

          {/* Live result */}
          {(c > 0 || w > 0) && (
            <div style={{ display: 'flex', gap: 16, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>NET</div>
                <div style={{ fontSize: 22, fontFamily: 'var(--font-heading)', color: net >= 0 ? 'var(--accent)' : 'var(--warn)' }}>{net}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>BAŞARI</div>
                <div style={{ fontSize: 22, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>%{rate}</div>
              </div>
            </div>
          )}

          {/* Sub-tags */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm${form.show_uncertain ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => sf('show_uncertain', !form.show_uncertain)}>
              {form.show_uncertain ? '✓' : '+'} Kararsız / Şans
            </button>
            <button className={`btn btn-sm${form.show_two_choice ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => sf('show_two_choice', !form.show_two_choice)}>
              {form.show_two_choice ? '✓' : '+'} İki şıkta kaldım
            </button>
          </div>

          {form.show_uncertain && (
            <div className="practice-subtag-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Kararsız / şansıma:</span>
              <input type="number" min="0" value={form.uncertain_count} onChange={e => sf('uncertain_count', e.target.value)} style={{ width: 56 }} placeholder="adet" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>soru, bunlardan</span>
              <input type="number" min="0" value={form.uncertain_correct_count} onChange={e => sf('uncertain_correct_count', e.target.value)} style={{ width: 56 }} placeholder="adet" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>doğru</span>
            </div>
          )}

          {form.show_two_choice && (
            <div className="practice-subtag-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>İki şıkta kaldım:</span>
              <input type="number" min="0" value={form.two_choice_count} onChange={e => sf('two_choice_count', e.target.value)} style={{ width: 56 }} placeholder="adet" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>soru, bunlardan</span>
              <input type="number" min="0" value={form.two_choice_correct_count} onChange={e => sf('two_choice_correct_count', e.target.value)} style={{ width: 56 }} placeholder="adet" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>doğru</span>
            </div>
          )}

          {/* Save */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save}>{editId ? 'Güncelle' : 'Kaydet'}</button>
            {editId && (
              <button className="btn btn-ghost" onClick={() => { setEditId(null); setForm({ ...EMPTY }) }}>İptal</button>
            )}
            {saved && <span style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓ Kaydedildi</span>}
          </div>
        </div>
      </div>

      {/* ── History ── */}
      <div className="study-section-title">Geçmiş Kayıtlar</div>
      {sessions.length === 0 ? (
        <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Henüz kayıt yok.</div>
      ) : (
        <div className="practice-table">
          <div className="practice-table-header">
            <div className="practice-col-date">Tarih</div>
            <div className="practice-col-topic">Konu</div>
            <div className="practice-col-dyb">D / Y / B</div>
            <div className="practice-col-net">Net</div>
            <div className="practice-col-rate">%</div>
            <div className="practice-col-actions" />
          </div>
          {sessions.map(s => {
            const sNet = computeNet(s.correct, s.wrong, negativeMarking)
            const sRate = computeRate(s.correct, s.wrong, s.blank)
            return (
              <div key={s.id} className="practice-table-row">
                <div className="practice-col-date mono">{s.date}</div>
                <div className="practice-col-topic">
                  <span style={{ fontSize: 13 }}>{sessionLabel(s)}</span>
                  {s.category_name && !s.topic_name && (
                    <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 5 }}>({s.category_name})</span>
                  )}
                </div>
                <div className="practice-col-dyb mono">
                  <span style={{ color: 'var(--success)' }}>{s.correct}</span>
                  {' / '}
                  <span style={{ color: 'var(--warn)' }}>{s.wrong}</span>
                  {' / '}
                  <span style={{ color: 'var(--text-light)' }}>{s.blank}</span>
                </div>
                <div className="practice-col-net mono" style={{ color: sNet >= 0 ? 'var(--accent)' : 'var(--warn)' }}>{sNet}</div>
                <div className="practice-col-rate mono" style={{ color: sRate < 50 ? 'var(--warn)' : sRate >= 70 ? 'var(--success)' : 'var(--text-muted)' }}>%{sRate}</div>
                <div className="practice-col-actions">
                  {confirmDeleteId === s.id ? (
                    <>
                      <button className="btn btn-danger btn-xs" onClick={() => doDelete(s.id)}>Sil</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteId(null)}>İptal</button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => startEdit(s)}>✎</button>
                      <button className="icon-btn danger" onClick={() => setConfirmDeleteId(s.id)}>✕</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Plan ─────────────────────────────────────────────────────────────────────

const EMPTY_QUEUE = { kpss_category_id: null, kpss_topic_id: null, topic_text: '', target_count: '20' }

function Plan({ categories, onMarkDone }) {
  const [queue, setQueue] = useState([])
  const [addForm, setAddForm] = useState({ ...EMPTY_QUEUE })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const load = useCallback(() =>
    window.api.practice.queue.list().then(setQueue), [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!addForm.topic_text && !addForm.kpss_category_id) return
    await window.api.practice.queue.add({
      kpss_category_id: addForm.kpss_category_id,
      kpss_topic_id: addForm.kpss_topic_id,
      topic_text: addForm.topic_text,
      target_count: Number(addForm.target_count) || 20,
    })
    setAddForm({ ...EMPTY_QUEUE })
    load()
  }

  async function handleToggle(item) {
    const updated = await window.api.practice.queue.markDone(item.id, !item.done)
    if (!item.done) onMarkDone(updated)
    load()
  }

  async function saveEdit() {
    await window.api.practice.queue.update(editId, {
      kpss_category_id: editForm.kpss_category_id,
      kpss_topic_id: editForm.kpss_topic_id,
      topic_text: editForm.topic_text,
      target_count: Number(editForm.target_count) || 20,
    })
    setEditId(null)
    setEditForm(null)
    load()
  }

  async function doDelete(id) {
    await window.api.practice.queue.delete(id)
    setConfirmDeleteId(null)
    load()
  }

  function getLabel(item) {
    if (item.topic_name) return item.topic_name
    if (item.topic_text) return item.topic_text
    if (item.category_name) return item.category_name
    return '—'
  }

  const pending = queue.filter(q => !q.done)
  const done = queue.filter(q => q.done)

  return (
    <div>
      {/* Add form */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 560 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Plana konu ekle</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TopicPicker
            categories={categories}
            value={{ kpss_category_id: addForm.kpss_category_id, kpss_topic_id: addForm.kpss_topic_id, topic_text: addForm.topic_text }}
            onChange={v => setAddForm(f => ({ ...f, ...v }))}
            disabled={false}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label className="study-field-label" style={{ width: 64, textAlign: 'right', marginBottom: 0 }}>Hedef</label>
            <input type="number" min="1" max="500" value={addForm.target_count}
              onChange={e => setAddForm(f => ({ ...f, target_count: e.target.value }))} style={{ width: 72 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>soru</span>
          </div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={handleAdd} disabled={!addForm.topic_text && !addForm.kpss_category_id}>
            Ekle
          </button>
        </div>
      </div>

      {/* Pending */}
      <div className="study-section-title">Bekleyenler ({pending.length})</div>
      {pending.length === 0 && (
        <div style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 24 }}>Plan boş.</div>
      )}
      <div className="practice-queue-list" style={{ marginBottom: 28 }}>
        {pending.map(item => (
          <div key={item.id} className="practice-queue-row">
            <div className="cb" onClick={() => handleToggle(item)} title="Tamamlandı — kayıt formunu aç" />
            {editId === item.id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TopicPicker
                  categories={categories}
                  value={{ kpss_category_id: editForm.kpss_category_id, kpss_topic_id: editForm.kpss_topic_id, topic_text: editForm.topic_text }}
                  onChange={v => setEditForm(f => ({ ...f, ...v }))}
                  disabled={false}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min="1" value={editForm.target_count}
                    onChange={e => setEditForm(f => ({ ...f, target_count: e.target.value }))} style={{ width: 64 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>soru</span>
                  <button className="btn btn-primary btn-xs" onClick={saveEdit}>Kaydet</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => { setEditId(null); setEditForm(null) }}>İptal</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{getLabel(item)}</div>
                  {item.category_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.category_name}</div>}
                </div>
                <div className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{item.target_count} soru</div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {confirmDeleteId === item.id ? (
                    <>
                      <button className="btn btn-danger btn-xs" onClick={() => doDelete(item.id)}>Sil</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteId(null)}>İptal</button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => { setEditId(item.id); setEditForm({ ...item, target_count: String(item.target_count) }) }}>✎</button>
                      <button className="icon-btn danger" onClick={() => setConfirmDeleteId(item.id)}>✕</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Done */}
      {done.length > 0 && (
        <>
          <div className="study-section-title" style={{ color: 'var(--text-muted)' }}>Tamamlananlar ({done.length})</div>
          <div className="practice-queue-list">
            {done.map(item => (
              <div key={item.id} className="practice-queue-row" style={{ opacity: 0.6 }}>
                <div className="cb checked" onClick={() => handleToggle(item)} title="Tamamlandı işaretini kaldır" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, textDecoration: 'line-through' }}>{getLabel(item)}</div>
                  {item.category_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.category_name}</div>}
                </div>
                <div className="badge badge-neutral">{item.target_count} soru</div>
                {confirmDeleteId === item.id ? (
                  <>
                    <button className="btn btn-danger btn-xs" onClick={() => doDelete(item.id)}>Sil</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteId(null)}>İptal</button>
                  </>
                ) : (
                  <button className="icon-btn danger" onClick={() => setConfirmDeleteId(item.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function PracticeStats({ negativeMarking }) {
  const [range, setRange] = useState('month')
  const [stats, setStats] = useState(null)
  const [netMode, setNetMode] = useState('rate')

  function rangeStart() {
    if (range === 'week')    { const d = new Date(); d.setDate(d.getDate()-6);  return d.toISOString().slice(0,10) }
    if (range === 'month')   { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) }
    if (range === 'quarter') { const d = new Date(); d.setDate(d.getDate()-89); return d.toISOString().slice(0,10) }
    return '2000-01-01'
  }

  const load = useCallback(() =>
    window.api.practice.stats.get(rangeStart()).then(setStats), [range])

  useEffect(() => { setStats(null); load() }, [load])

  if (!stats) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Yükleniyor…</div>

  const totalNet = computeNet(stats.totalCorrect, stats.totalWrong, negativeMarking)
  const totalRate = computeRate(stats.totalCorrect, stats.totalWrong, stats.totalBlank)

  const trendData = stats.dailyTrend.map(d => ({
    date: d.date.slice(5),
    net: computeNet(d.correct, d.wrong, negativeMarking),
    rate: computeRate(d.correct, d.wrong, d.blank),
  }))

  const donutData = [
    { name: 'Doğru', value: stats.totalCorrect, color: 'var(--accent)' },
    { name: 'Yanlış', value: stats.totalWrong, color: 'rgba(90,79,207,0.38)' },
    { name: 'Boş', value: stats.totalBlank, color: 'rgba(90,79,207,0.14)' },
  ].filter(d => d.value > 0)

  return (
    <div>
      {/* Overview cards */}
      <div className="study-stats-row4" style={{ marginBottom: 16 }}>
        <div className="study-stat-card accent">
          <div className="study-stat-value mono">{stats.totalQ}</div>
          <div className="study-stat-label">Toplam Soru</div>
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value" style={{ color: totalNet >= 0 ? 'var(--accent)' : 'var(--warn)' }}>{totalNet}</div>
          <div className="study-stat-label">Net</div>
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value">%{totalRate}</div>
          <div className="study-stat-label">Başarı Oranı</div>
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value mono">{stats.sessionCount}</div>
          <div className="study-stat-label">Oturum</div>
        </div>
      </div>

      {stats.guessedCorrect > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
          Not: {stats.guessedCorrect} doğrunuz tahmin / iki şıkta kaldım ile geldi — gerçek hakimiyetiniz biraz daha düşük olabilir.
        </div>
      )}

      <div className="divider" />

      {/* Range */}
      <div className="study-range-row">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Periyot:</span>
        {[['week','Hafta'],['month','Ay'],['quarter','3 Ay'],['all','Tümü']].map(([v,l]) => (
          <button key={v} className={`btn btn-sm${range===v?' btn-primary':' btn-ghost'}`} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>

      {/* Trend + Donut */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div className="study-section-title" style={{ marginBottom: 0 }}>Trend</div>
            <button className={`btn btn-xs${netMode==='rate'?' btn-primary':' btn-ghost'}`} onClick={() => setNetMode('rate')}>Başarı %</button>
            <button className={`btn btn-xs${netMode==='net'?' btn-primary':' btn-ghost'}`} onClick={() => setNetMode('net')}>Net</button>
          </div>
          {trendData.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Bu periyotta kayıt yok.</div>
          ) : (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                  <Tooltip
                    formatter={v => [netMode === 'rate' ? `%${v}` : String(v)]}
                    contentStyle={{ fontSize: 12, fontFamily: 'var(--font-body)', borderColor: 'var(--border)' }}
                  />
                  <Line dataKey={netMode} stroke="var(--accent)" strokeWidth={2} dot={trendData.length < 30} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="study-section-title">D / Y / B</div>
          {donutData.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Veri yok.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PieChart width={110} height={110}>
                <Pie data={donutData} cx={50} cy={50} innerRadius={28} outerRadius={50} dataKey="value" paddingAngle={2}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {donutData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0, border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: 12 }}>{d.name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 'auto', paddingLeft: 8 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weak topics */}
      <div className="divider" />
      <div className="study-section-title">Zayıf Konular</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Başarı oranı en düşükten yükseğe sıralı — tekrar çalışmanız gereken konular.
      </p>
      {stats.topicStats.length === 0 ? (
        <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Bu periyotta kayıt yok.</div>
      ) : (
        <div className="practice-table">
          <div className="practice-table-header">
            <div className="practice-col-topic">Konu</div>
            <div className="practice-col-dyb">D / Y / B</div>
            <div className="practice-col-net">Net</div>
            <div className="practice-col-rate">%</div>
          </div>
          {stats.topicStats.map((t, i) => {
            const tNet = computeNet(t.correct, t.wrong, negativeMarking)
            const tRate = computeRate(t.correct, t.wrong, t.blank)
            return (
              <div key={i} className="practice-table-row">
                <div className="practice-col-topic">
                  <span style={{ fontSize: 13 }}>{t.topic_label}</span>
                  {t.category_name && (
                    <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 5 }}>({t.category_name})</span>
                  )}
                </div>
                <div className="practice-col-dyb mono">
                  <span style={{ color: 'var(--success)' }}>{t.correct}</span>
                  {' / '}
                  <span style={{ color: 'var(--warn)' }}>{t.wrong}</span>
                  {' / '}
                  <span style={{ color: 'var(--text-light)' }}>{t.blank}</span>
                </div>
                <div className="practice-col-net mono" style={{ color: tNet >= 0 ? 'var(--accent)' : 'var(--warn)' }}>{tNet}</div>
                <div className="practice-col-rate mono" style={{ color: tRate < 50 ? 'var(--warn)' : tRate >= 70 ? 'var(--success)' : 'var(--text-muted)' }}>%{tRate}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Topic Checklist ──────────────────────────────────────────────────────────

function TopicChecklist({ negativeMarking }) {
  const [topicStats, setTopicStats] = useState([])
  const [filter, setFilter] = useState('all')
  const [collapsedCats, setCollapsedCats] = useState(new Set())
  const [addedMsg, setAddedMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await window.api.practice.topicStats.get()
    setTopicStats(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleDone(topic) {
    await window.api.kpss.toggleTopic(topic.id, topic.done ? 0 : 1)
    load()
  }

  async function addToQueue(topic) {
    await window.api.practice.queue.add({
      kpss_category_id: topic.category_id,
      kpss_topic_id: topic.id,
      topic_text: topic.text,
      target_count: 20,
    })
    setAddedMsg(`"${topic.text}" plana eklendi`)
    setTimeout(() => setAddedMsg(null), 2500)
  }

  const grouped = useMemo(() => {
    const map = {}
    for (const t of topicStats) {
      if (!map[t.category_id]) {
        map[t.category_id] = {
          id: t.category_id,
          name: t.category_name,
          order: t.category_order || 0,
          topics: [],
        }
      }
      map[t.category_id].topics.push(t)
    }
    return Object.values(map).sort((a, b) => a.order - b.order)
  }, [topicStats])

  function toggleCat(id) {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalTopics = topicStats.length
  const doneTopics  = topicStats.filter(t => t.done).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {doneTopics}/{totalTopics} tamamlandı
        </div>
        <div style={{ flex: 1 }} />
        {[['all','Tümü'], ['todo','Yapılmadı'], ['done','Yapıldı']].map(([v, l]) => (
          <button
            key={v}
            className={`btn btn-sm${filter === v ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => setFilter(v)}
          >{l}</button>
        ))}
      </div>

      {addedMsg && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-light)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', marginBottom: 10, fontSize: 12, color: 'var(--success)' }}>
          ✓ {addedMsg}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Yükleniyor…</div>
      ) : grouped.length === 0 ? (
        <div style={{ color: 'var(--text-light)', fontSize: 13 }}>KPSS kategorisi ve konusu yok. Önce KPSS sekmesinden ekle.</div>
      ) : (
        grouped.map(cat => {
          const filtered = cat.topics.filter(t =>
            filter === 'all' || (filter === 'done' ? t.done : !t.done)
          )
          if (filtered.length === 0) return null
          const catDone  = cat.topics.filter(t => t.done).length
          const isOpen   = !collapsedCats.has(cat.id)

          return (
            <div key={cat.id} className="kc-cat-group">
              <div className="kc-cat-header" onClick={() => toggleCat(cat.id)}>
                <span className="kc-cat-name">{cat.name}</span>
                <span className="kc-cat-progress">{catDone}/{cat.topics.length}</span>
                <span className="kc-expand">{isOpen ? '▼' : '▶'}</span>
              </div>
              {isOpen && filtered.map(topic => {
                const total = topic.correct + topic.wrong + topic.blank
                const net   = total > 0 ? computeNet(topic.correct, topic.wrong, negativeMarking) : null
                const rate  = total > 0 ? computeRate(topic.correct, topic.wrong, topic.blank) : null

                return (
                  <div key={topic.id} className={`kc-topic-row${topic.done ? ' done' : ''}`}>
                    <button
                      className={`kc-checkbox${topic.done ? ' checked' : ''}`}
                      onClick={() => toggleDone(topic)}
                    >{topic.done ? '✓' : ''}</button>
                    <div className="kc-topic-name">{topic.text}</div>
                    <div className="kc-topic-stats">
                      {total > 0 ? (
                        <>
                          <span className="kc-d">D:{topic.correct}</span>
                          <span className="kc-y">Y:{topic.wrong}</span>
                          <span className="kc-b">B:{topic.blank}</span>
                          <span className="kc-net">{net.toFixed(1)}</span>
                          <span className={`kc-rate${rate >= 70 ? ' good' : rate >= 50 ? '' : ' bad'}`}>{rate}%</span>
                        </>
                      ) : (
                        <span className="kc-no-data">soru yok</span>
                      )}
                    </div>
                    <button
                      className="btn btn-xs btn-ghost"
                      style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0 }}
                      onClick={() => addToQueue(topic)}
                      title="Yapılacaklara Ekle"
                    >+Plan</button>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'log',     label: 'Soru Kaydı' },
  { id: 'topics',  label: 'Konular' },
  { id: 'plan',    label: 'Yapılacaklar' },
  { id: 'stats',   label: 'İstatistikler' },
]

export default function Practice() {
  const [tab, setTab] = useState('log')
  const [categories, setCategories] = useState([])
  const [negativeMarking, setNegativeMarking] = useState(true)
  const [prefill, setPrefill] = useState(null)

  useEffect(() => {
    window.api.kpss.listCategories().then(setCategories)
    window.api.settings.get('negative_marking_enabled').then(val => {
      if (val !== null) setNegativeMarking(val !== 'false')
    })
  }, [])

  function handleMarkDone(queueItem) {
    setPrefill(queueItem)
    setTab('log')
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1>Soru Çözme Takibi</h1>
      </div>

      <div className="study-tab-nav">
        {TABS.map(t => (
          <button key={t.id}
            className={`study-tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 24 }}>
        {tab === 'log' && (
          <LogResults
            categories={categories}
            negativeMarking={negativeMarking}
            prefill={prefill}
            onClearPrefill={() => setPrefill(null)}
          />
        )}
        {tab === 'topics' && (
          <TopicChecklist negativeMarking={negativeMarking} />
        )}
        {tab === 'plan' && (
          <Plan categories={categories} onMarkDone={handleMarkDone} />
        )}
        {tab === 'stats' && (
          <PracticeStats negativeMarking={negativeMarking} />
        )}
      </div>
    </div>
  )
}
