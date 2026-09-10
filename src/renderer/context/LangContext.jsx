import React, { createContext, useContext, useState, useEffect } from 'react'
import { strings } from '../utils/i18n'

const LangContext = createContext({ lang: 'tr', t: k => k, setLanguage: () => {} })

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('tr')

  useEffect(() => {
    window.api.settings.get('language').then(v => {
      if (v === 'en') setLangState('en')
    })
  }, [])

  async function setLanguage(l) {
    setLangState(l)
    await window.api.settings.set('language', l)
  }

  function t(key, vars = {}) {
    let str = strings[lang]?.[key] ?? strings.tr?.[key] ?? key
    Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v) })
    return str
  }

  return (
    <LangContext.Provider value={{ lang, t, setLanguage }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
