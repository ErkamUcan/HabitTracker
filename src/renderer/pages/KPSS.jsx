import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import ProgressBar from '../components/ProgressBar'
import ColorPicker from '../components/ColorPicker'
import { getColor } from '../utils/colors'

const CategoryBlock = React.forwardRef(function CategoryBlock({
  cat, topics, onRename, onAddTopic, onAddTopicsBulk,
  onUpdateTopic, onDeleteTopic, onDeleteTopics, onToggleTopic, onDeleteCategory,
  onSetColor, onMoveUp, onMoveDown, searchQuery
}, ref) {
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef(null)

  useImperativeHandle(ref, () => ({
    openAndScroll() {
      setOpen(true)
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }))
  const [renaming, setRenaming] = useState(false)
  const [catName, setCatName]   = useState(cat.name)
  const [addText, setAddText]   = useState('')
  const [editId, setEditId]     = useState(null)
  const [editText, setEditText] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected]   = useState(new Set())
  const [showBulk, setShowBulk]   = useState(false)
  const [bulkText, setBulkText]   = useState('')
  const nameRef = useRef(null)
  const addRef  = useRef(null)

  const color = getColor(cat.color)

  const filteredTopics = searchQuery
    ? topics.filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : topics

  function commitRename() {
    const t = catName.trim()
    if (t && t !== cat.name) onRename(cat.id, t)
    else setCatName(cat.name)
    setRenaming(false)
  }

  function commitAdd() {
    const t = addText.trim()
    if (t) onAddTopic(cat.id, t)
    setAddText('')
  }

  function commitEdit() {
    const t = editText.trim()
    if (t) onUpdateTopic(editId, t)
    setEditId(null)
    setEditText('')
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === filteredTopics.length) setSelected(new Set())
    else setSelected(new Set(filteredTopics.map(t => t.id)))
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!window.confirm(`${selected.size} konu silinsin mi?`)) return
    await onDeleteTopics([...selected])
    setSelected(new Set())
    setSelecting(false)
  }

  async function handleBulkAdd() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    await onAddTopicsBulk(cat.id, lines)
    setBulkText('')
    setShowBulk(false)
  }

  async function handleDeleteCategory() {
    if (!window.confirm(`"${cat.name}" kategorisi ve tüm konuları silinsin mi?`)) return
    onDeleteCategory(cat.id)
  }

  const done  = topics.filter(t => t.done).length
  const total = topics.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  const allSelectedInFiltered = filteredTopics.length > 0 && filteredTopics.every(t => selected.has(t.id))

  return (
    <div ref={containerRef} className="kpss-category" style={{ borderLeft: `3px solid ${color.hex}` }}>
      <div className="kpss-category-header" style={{ background: color.bg }}
        onClick={() => !renaming && setOpen(o => !o)}>

        <ColorPicker color={cat.color || 'indigo'}
          onChange={c => { onSetColor(cat.id, c) }} />

        {renaming ? (
          <input
            ref={nameRef}
            className="kpss-category-name-input"
            value={catName}
            onChange={e => setCatName(e.target.value)}
            onClick={e => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setCatName(cat.name); setRenaming(false) }
            }}
          />
        ) : (
          <span
            className="kpss-category-name-static"
            onDoubleClick={e => { e.stopPropagation(); setRenaming(true); setTimeout(() => nameRef.current?.focus(), 0) }}
          >
            {cat.name}
          </span>
        )}

        <span className={`badge ${pct === 100 ? 'badge-success' : total > 0 ? 'badge-neutral' : 'badge-neutral'}`}>
          {done}/{total}
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }} onClick={e => e.stopPropagation()}>
          {onMoveUp && (
            <button className="icon-btn" title="Yukarı taşı" style={{ fontSize: 12 }} onClick={onMoveUp}>↑</button>
          )}
          {onMoveDown && (
            <button className="icon-btn" title="Aşağı taşı" style={{ fontSize: 12 }} onClick={onMoveDown}>↓</button>
          )}
          <button
            className={`icon-btn${showBulk ? ' active' : ''}`}
            title="Toplu konu ekle"
            style={{ fontSize: 12 }}
            onClick={() => { setShowBulk(p => !p); setOpen(true) }}
          >
            ⇥
          </button>
          <button
            className={`icon-btn${selecting ? ' active' : ''}`}
            title="Seçim modu"
            style={{ fontSize: 12 }}
            onClick={() => { setSelecting(p => !p); setSelected(new Set()); setOpen(true) }}
          >
            ☑
          </button>
          <button
            className="icon-btn danger"
            title="Kategoriyi sil"
            style={{ fontSize: 13 }}
            onClick={handleDeleteCategory}
          >
            ✕
          </button>
        </div>

        <span className={`kpss-chevron${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>›</span>
      </div>

      {/* Progress bar */}
      {total > 0 && (() => {
        const remaining = total - done
        const per15 = remaining > 0 ? Math.ceil(remaining / 15) : 0
        const per20 = remaining > 0 ? Math.ceil(remaining / 20) : 0
        return (
          <div className="kpss-progress">
            <div className="kpss-progress-label">
              <span>{pct}% tamamlandı</span>
              <span>{done} / {total} konu</span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill${pct === 100 ? ' full' : ''}`}
                style={{
                  width: `${pct}%`,
                  background: pct === 100
                    ? 'var(--success)'
                    : pct >= 70 ? color.hex
                    : pct >= 30 ? 'var(--gold)'
                    : 'var(--warn)'
                }}
              />
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

          {/* Bulk add */}
          {showBulk && (
            <div className="kpss-bulk-area">
              <textarea
                rows={4}
                placeholder={'Her satıra bir konu:\nAnayasa Hukuku\nİdare Hukuku\nMedeni Hukuku'}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 6 }}
                autoFocus
              />
              <div className="kpss-bulk-hint">Her satır = 1 konu</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={handleBulkAdd}
                  disabled={!bulkText.trim()}
                >
                  {bulkText.split('\n').filter(l => l.trim()).length > 0
                    ? `${bulkText.split('\n').filter(l => l.trim()).length} Konu Ekle`
                    : 'Ekle'}
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowBulk(false)}>İptal</button>
              </div>
            </div>
          )}

          {/* Selection bar */}
          {selecting && filteredTopics.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 4px', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)' }}>
              <input
                type="checkbox"
                checked={allSelectedInFiltered}
                onChange={selectAll}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {selected.size > 0 ? `${selected.size} seçildi` : 'Tümünü seç'}
              </span>
              {selected.size > 0 && (
                <button className="btn btn-danger btn-xs" onClick={deleteSelected} style={{ marginLeft: 'auto' }}>
                  {selected.size} Konu Sil
                </button>
              )}
            </div>
          )}

          {/* Topic list */}
          {filteredTopics.map(topic => (
            <div
              key={topic.id}
              className={`kpss-topic-row${topic.done ? ' done' : ''}${selected.has(topic.id) ? ' selected' : ''}`}
            >
              {selecting && (
                <input
                  type="checkbox"
                  checked={selected.has(topic.id)}
                  onChange={() => toggleSelect(topic.id)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
              )}
              <div
                className={`cb${topic.done ? ' checked' : ''}`}
                onClick={() => onToggleTopic(topic.id, !topic.done)}
              />
              {editId === topic.id ? (
                <input
                  className="kpss-topic-input"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditId(null)
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="kpss-topic-text"
                  onDoubleClick={() => { setEditId(topic.id); setEditText(topic.text) }}
                >
                  {topic.text}
                </span>
              )}
              <div className="kpss-topic-actions">
                <button className="icon-btn" onClick={() => { setEditId(topic.id); setEditText(topic.text) }} title="Düzenle">✎</button>
                <button className="icon-btn danger" onClick={() => onDeleteTopic(topic.id)} title="Sil">✕</button>
              </div>
            </div>
          ))}

          {searchQuery && filteredTopics.length === 0 && (
            <div style={{ padding: '8px 4px', color: 'var(--text-light)', fontSize: 13 }}>
              Arama sonucu yok
            </div>
          )}

          {/* Add row */}
          <div className="kpss-add-row">
            <input
              ref={addRef}
              type="text"
              placeholder="Konu ekle…"
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAdd() }}
            />
            <button className="btn btn-primary btn-sm" onClick={commitAdd}>Ekle</button>
          </div>
        </div>
      )}
    </div>
  )
})

export default function KPSS() {
  const [categories, setCategories] = useState([])
  const [topicsMap, setTopicsMap]   = useState({})
  const [search, setSearch]         = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat]   = useState(false)
  const catInputRef  = useRef(null)
  const blockRefs    = useRef({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const cats = await window.api.kpss.listCategories()
    setCategories(cats)
    const entries = await Promise.all(
      cats.map(async c => [c.id, await window.api.kpss.listTopics(c.id)])
    )
    setTopicsMap(Object.fromEntries(entries))
  }

  async function addCategory() {
    const name = newCatName.trim()
    if (!name) return
    const cat = await window.api.kpss.addCategory(name)
    setCategories(prev => [...prev, cat])
    setTopicsMap(prev => ({ ...prev, [cat.id]: [] }))
    setNewCatName('')
    setAddingCat(false)
  }

  async function deleteCategory(id) {
    await window.api.kpss.deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setTopicsMap(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function renameCategory(id, name) {
    await window.api.kpss.renameCategory(id, name)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  }

  async function setCategoryColor(id, color) {
    await window.api.kpss.setCategoryColor(id, color)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, color } : c))
  }

  async function moveCategory(id, dir) {
    setCategories(prev => {
      const arr = [...prev]
      const i = arr.findIndex(c => c.id === id)
      const j = i + dir
      if (j < 0 || j >= arr.length) return prev
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      const updates = arr.map((c, idx) => ({ id: c.id, sort_order: idx }))
      window.api.kpss.reorderCategories(updates)
      return arr.map((c, idx) => ({ ...c, sort_order: idx }))
    })
  }

  async function addTopic(categoryId, text) {
    const topic = await window.api.kpss.addTopic(categoryId, text)
    setTopicsMap(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), topic] }))
  }

  async function addTopicsBulk(categoryId, texts) {
    const added = await window.api.kpss.addTopicsBulk(categoryId, texts)
    setTopicsMap(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), ...added] }))
  }

  async function updateTopic(id, text) {
    await window.api.kpss.updateTopic(id, text)
    setTopicsMap(prev => {
      const next = { ...prev }
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].map(t => t.id === id ? { ...t, text } : t)
      }
      return next
    })
  }

  async function deleteTopic(id) {
    await window.api.kpss.deleteTopic(id)
    setTopicsMap(prev => {
      const next = { ...prev }
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].filter(t => t.id !== id)
      }
      return next
    })
  }

  async function deleteTopics(ids) {
    await window.api.kpss.deleteTopics(ids)
    const idSet = new Set(ids)
    setTopicsMap(prev => {
      const next = { ...prev }
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].filter(t => !idSet.has(t.id))
      }
      return next
    })
  }

  async function toggleTopic(id, done) {
    await window.api.kpss.toggleTopic(id, done)
    setTopicsMap(prev => {
      const next = { ...prev }
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].map(t => t.id === id ? { ...t, done: done ? 1 : 0 } : t)
      }
      return next
    })
  }

  const allTopics = Object.values(topicsMap).flat()
  const totalAll  = allTopics.length
  const doneAll   = allTopics.filter(t => t.done).length
  const pctAll    = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>KPSS Konu Takibi</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Kategori adına çift tıkla düzenle · ⇥ ile toplu konu ekle · ☑ ile çoklu seçim
        </p>
      </div>

      {totalAll > 0 && (() => {
        const remaining = totalAll - doneAll
        const per15 = remaining > 0 ? Math.ceil(remaining / 15) : 0
        const per20 = remaining > 0 ? Math.ceil(remaining / 20) : 0
        return (
          <div className="kpss-overall">
            <ProgressBar value={pctAll} label={`Genel ilerleme — ${doneAll} / ${totalAll} konu`} />
            {remaining > 0 && (
              <div style={{
                display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap',
              }}>
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', paddingRight: 12,
                  borderRight: '1px solid var(--border)',
                }}>
                  Kalan <strong style={{ color: 'var(--text)' }}>{remaining}</strong> konu
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    padding: '2px 10px', borderRadius: 99,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#ef4444',
                  }}>
                    15 gün → günde <strong>{per15}</strong> konu
                  </span>
                  <span style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    padding: '2px 10px', borderRadius: 99,
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
                    color: '#b45309',
                  }}>
                    20 gün → günde <strong>{per20}</strong> konu
                  </span>
                </div>
              </div>
            )}
            {remaining === 0 && (
              <div style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
                ✓ Tüm konular tamamlandı
              </div>
            )}
          </div>
        )
      })()}

      <div className="kpss-toolbar">
        <input
          type="text"
          className="kpss-search"
          placeholder="Konu ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setAddingCat(true); setTimeout(() => catInputRef.current?.focus(), 0) }}
        >
          + Kategori Ekle
        </button>
      </div>

      {addingCat && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            ref={catInputRef}
            type="text"
            placeholder="Kategori adı…"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addCategory()
              if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') }
            }}
            style={{ maxWidth: 280 }}
          />
          <button className="btn btn-primary btn-sm" onClick={addCategory}>Ekle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAddingCat(false); setNewCatName('') }}>İptal</button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="kpss-quick-nav">
          {categories.map(cat => {
            const c = getColor(cat.color)
            const topics = topicsMap[cat.id] || []
            const done = topics.filter(t => t.done).length
            return (
              <button
                key={cat.id}
                className="kpss-nav-pill"
                style={{ borderColor: c.hex, color: c.hex }}
                onClick={() => blockRefs.current[cat.id]?.openAndScroll()}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.hex, display: 'inline-block', flexShrink: 0 }} />
                {cat.name}
                {topics.length > 0 && (
                  <span style={{ fontSize: 10, opacity: 0.65, fontFamily: 'var(--font-mono)' }}>
                    {done}/{topics.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {categories.map((cat, idx) => (
        <CategoryBlock
          key={cat.id}
          ref={el => { blockRefs.current[cat.id] = el }}
          cat={cat}
          topics={topicsMap[cat.id] || []}
          searchQuery={search}
          onRename={renameCategory}
          onSetColor={setCategoryColor}
          onAddTopic={addTopic}
          onAddTopicsBulk={addTopicsBulk}
          onUpdateTopic={updateTopic}
          onDeleteTopic={deleteTopic}
          onDeleteTopics={deleteTopics}
          onToggleTopic={toggleTopic}
          onDeleteCategory={deleteCategory}
          onMoveUp={idx > 0 ? () => moveCategory(cat.id, -1) : null}
          onMoveDown={idx < categories.length - 1 ? () => moveCategory(cat.id, 1) : null}
        />
      ))}

      {categories.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
          <p>Henüz kategori yok. "Kategori Ekle" ile başla.</p>
        </div>
      )}
    </div>
  )
}
