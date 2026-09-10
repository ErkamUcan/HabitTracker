import React, { useState, useEffect, useRef } from 'react'

export default function QuoteWidget() {
  const [quote, setQuote]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [fading, setFading]     = useState(false)
  const [entering, setEntering] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadQuote(false)
    return () => { mounted.current = false }
  }, [])

  async function loadQuote(forceRefresh) {
    if (!mounted.current) return
    if (forceRefresh) {
      setFading(true)
      await delay(280)
    }
    if (!mounted.current) return
    setLoading(true)
    setFading(false)
    try {
      const q = forceRefresh
        ? await window.api.quotes.refresh()
        : await window.api.quotes.get()
      if (!mounted.current) return
      setQuote(q)
      setEntering(true)
      setTimeout(() => { if (mounted.current) setEntering(false) }, 400)
    } catch (e) {
      console.error('Quote load error:', e)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  const delay = ms => new Promise(r => setTimeout(r, ms))

  return (
    <div className="quote-widget">
      <div className="quote-header">
        <span className="quote-label">
          {quote ? quote.label : 'Günün Düşüncesi'}
        </span>
        <button
          className="quote-refresh-btn"
          onClick={() => loadQuote(true)}
          disabled={loading}
        >
          ↺ Başka bir tane
        </button>
      </div>

      <div className="quote-body">
        {loading && !quote ? (
          <p className="quote-loading">Günün düşüncesi yükleniyor…</p>
        ) : quote ? (
          <div className={`quote-content${fading ? ' fading' : ''}${entering ? ' entering' : ''}`}>
            {quote.arabic && (
              <p className="quote-arabic">{quote.arabic}</p>
            )}
            <p className="quote-text">{quote.text}</p>
            <p className="quote-citation">{quote.citation}</p>
          </div>
        ) : (
          <p className="quote-loading">Düşünce bulunamadı.</p>
        )}
      </div>
    </div>
  )
}
