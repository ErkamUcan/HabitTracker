import React, { useState, useRef, useEffect } from 'react'

function Checkbox({ checked, onChange }) {
  return (
    <div
      className={`cb${checked ? ' checked' : ''}`}
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
    />
  )
}

function AutoTextarea({ value, onChange, onKeyDown, onBlur, placeholder, autoFocus, className, style }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      className={className}
      style={{ ...style, overflowY: 'hidden' }}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={1}
      autoFocus={autoFocus}
    />
  )
}

function TaskItem({ task, subtasks, onToggle, onUpdate, onDelete, onAddSub }) {
  const [editing, setEditing]     = useState(false)
  const [editText, setEditText]   = useState(task.text)
  const [addingSub, setAddingSub] = useState(false)
  const [subText, setSubText]     = useState('')
  const subRef = useRef(null)

  function commitEdit() {
    const t = editText.trim()
    if (t && t !== task.text) onUpdate(task.id, t)
    else setEditText(task.text)
    setEditing(false)
  }

  function startEdit() {
    setEditText(task.text)
    setEditing(true)
  }

  function commitSub() {
    const t = subText.trim()
    if (t) onAddSub(t, task.id)
    setSubText('')
    setAddingSub(false)
  }

  return (
    <div>
      <div className={`task-item${task.done ? ' done' : ''}`}>
        <Checkbox checked={!!task.done} onChange={d => onToggle(task.id, d)} />
        {editing ? (
          <AutoTextarea
            className="task-text-input"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
              if (e.key === 'Escape') { setEditText(task.text); setEditing(false) }
            }}
            autoFocus
          />
        ) : (
          <span className="task-text" onDoubleClick={startEdit}>{task.text}</span>
        )}
        <div className="task-actions">
          <button className="icon-btn" title="Düzenle" onClick={startEdit}>✎</button>
          {onAddSub && (
            <button
              className="icon-btn"
              title="Alt görev ekle"
              onClick={() => { setAddingSub(true); setTimeout(() => subRef.current?.focus(), 0) }}
            >
              +
            </button>
          )}
          <button className="icon-btn danger" title="Sil" onClick={() => onDelete(task.id)}>✕</button>
        </div>
      </div>

      {subtasks && subtasks.length > 0 && (
        <div className="subtasks">
          {subtasks.map(sub => (
            <div key={sub.id} className={`task-item${sub.done ? ' done' : ''}`} style={{ paddingLeft: 0 }}>
              <Checkbox checked={!!sub.done} onChange={d => onToggle(sub.id, d)} />
              <SubtaskText sub={sub} onUpdate={onUpdate} onDelete={onDelete} />
            </div>
          ))}
        </div>
      )}

      {addingSub && (
        <div className="subtasks">
          <div className="add-task-row">
            <textarea
              ref={subRef}
              placeholder="Alt görev… (Enter ekle, Shift+Enter yeni satır)"
              value={subText}
              rows={1}
              onChange={e => setSubText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitSub() }
                if (e.key === 'Escape') { setSubText(''); setAddingSub(false) }
              }}
              onBlur={() => { if (!subText.trim()) setAddingSub(false) }}
              style={{ fontSize: 13, resize: 'none', overflowY: 'hidden' }}
            />
            <button className="btn btn-primary btn-sm" onClick={commitSub}>Ekle</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SubtaskText({ sub, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [text, setText]       = useState(sub.text)

  function commit() {
    const t = text.trim()
    if (t && t !== sub.text) onUpdate(sub.id, t)
    else setText(sub.text)
    setEditing(false)
  }

  return (
    <>
      {editing ? (
        <AutoTextarea
          className="task-text-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setText(sub.text); setEditing(false) }
          }}
          autoFocus
        />
      ) : (
        <span className="task-text" onDoubleClick={() => { setText(sub.text); setEditing(true) }}>
          {sub.text}
        </span>
      )}
      <div className="task-actions">
        <button className="icon-btn" onClick={() => { setText(sub.text); setEditing(true) }}>✎</button>
        <button className="icon-btn danger" onClick={() => onDelete(sub.id)}>✕</button>
      </div>
    </>
  )
}

export default function TaskList({ tasks, onAdd, onAddSub, onUpdate, onDelete, onToggle }) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const textareaRef = useRef(null)

  const topLevel   = tasks.filter(t => t.parent_id === null)
  const subtasksOf = id => tasks.filter(t => t.parent_id === id)

  function commitAdd() {
    const t = newText.trim()
    if (t) onAdd(t)
    setNewText('')
    setAdding(false)
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitAdd()
    }
    if (e.key === 'Escape') {
      setNewText('')
      setAdding(false)
    }
  }

  useEffect(() => {
    if (adding && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [adding, newText])

  return (
    <div className="task-list">
      {topLevel.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          subtasks={subtasksOf(task.id)}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddSub={onAddSub}
        />
      ))}

      {adding ? (
        <div className="add-task-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <textarea
            ref={textareaRef}
            placeholder="Görev yaz… (Enter ekle · Shift+Enter yeni satır)"
            value={newText}
            rows={1}
            onChange={e => {
              setNewText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={handleAddKeyDown}
            onBlur={() => { if (!newText.trim()) setAdding(false) }}
            style={{ fontSize: 13, resize: 'none', overflowY: 'hidden', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={commitAdd}>Ekle</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNewText(''); setAdding(false) }}>İptal</button>
            <span className="add-task-hint">Shift+Enter yeni satır</span>
          </div>
        </div>
      ) : (
        <div className="add-task-placeholder" onClick={() => setAdding(true)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Görev ekle
        </div>
      )}
    </div>
  )
}
