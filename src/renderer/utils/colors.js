// 24 colors — 6 columns × 4 rows, ordered warm→cool
export const COLORS = [
  // Row 1: Neutrals
  { id: 'black',    label: 'Siyah',       hex: '#1a1a2e', bg: 'rgba(26,26,46,0.07)'     },
  { id: 'darkgray', label: 'Koyu Gri',    hex: '#374151', bg: 'rgba(55,65,81,0.07)'     },
  { id: 'gray',     label: 'Gri',         hex: '#6b7280', bg: 'rgba(107,114,128,0.07)'  },
  { id: 'lightgray',label: 'Açık Gri',    hex: '#9ca3af', bg: 'rgba(156,163,175,0.07)'  },
  { id: 'silver',   label: 'Gümüş',       hex: '#d1d5db', bg: 'rgba(209,213,219,0.15)'  },
  { id: 'white',    label: 'Beyaz',       hex: '#f3f4f6', bg: 'rgba(243,244,246,0.5)'   },

  // Row 2: Warm
  { id: 'yellow',   label: 'Sarı',        hex: '#eab308', bg: 'rgba(234,179,8,0.08)'    },
  { id: 'amber',    label: 'Kehribar',    hex: '#f59e0b', bg: 'rgba(245,158,11,0.08)'   },
  { id: 'orange',   label: 'Turuncu',     hex: '#f97316', bg: 'rgba(249,115,22,0.08)'   },
  { id: 'red',      label: 'Kırmızı',     hex: '#ef4444', bg: 'rgba(239,68,68,0.08)'    },
  { id: 'crimson',  label: 'Koyu Kırmızı',hex: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
  { id: 'rose',     label: 'Gül',         hex: '#f43f5e', bg: 'rgba(244,63,94,0.08)'    },

  // Row 3: Purples & Pinks
  { id: 'pink',     label: 'Pembe',       hex: '#ec4899', bg: 'rgba(236,72,153,0.08)'   },
  { id: 'fuchsia',  label: 'Fuşya',       hex: '#d946ef', bg: 'rgba(217,70,239,0.08)'   },
  { id: 'purple',   label: 'Mor',         hex: '#a855f7', bg: 'rgba(168,85,247,0.08)'   },
  { id: 'violet',   label: 'Menekşe',     hex: '#7c3aed', bg: 'rgba(124,58,237,0.08)'   },
  { id: 'indigo',   label: 'İndigo',      hex: '#4f46e5', bg: 'rgba(79,70,229,0.08)'    },
  { id: 'blue',     label: 'Mavi',        hex: '#2563eb', bg: 'rgba(37,99,235,0.08)'    },

  // Row 4: Blues & Greens
  { id: 'sky',      label: 'Gökyüzü',     hex: '#0284c7', bg: 'rgba(2,132,199,0.08)'    },
  { id: 'cyan',     label: 'Cam Göbeği',  hex: '#0891b2', bg: 'rgba(8,145,178,0.08)'    },
  { id: 'teal',     label: 'Turkuaz',     hex: '#0d9488', bg: 'rgba(13,148,136,0.08)'   },
  { id: 'emerald',  label: 'Zümrüt',      hex: '#059669', bg: 'rgba(5,150,105,0.08)'    },
  { id: 'green',    label: 'Yeşil',       hex: '#16a34a', bg: 'rgba(22,163,74,0.08)'    },
  { id: 'lime',     label: 'Limon',       hex: '#65a30d', bg: 'rgba(101,163,13,0.08)'   },
]

export function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[15] // fallback: indigo
}
