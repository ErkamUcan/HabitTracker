 # KPSS Habit Tracker

  KPSS sınavına hazırlık sürecini yönetmek için geliştirilmiş kapsamlı bir Windows masaüstü uygulaması. Alışkanlık takibi, çalışma zamanlayıcısı, deneme sınavı
  yönetimi, müfredat takibi ve detaylı istatistikler tek bir uygulamada.

  ---

  ## Özellikler

  ### Alışkanlık Takibi
  - Günlük alışkanlık oluşturma, yeniden adlandırma ve silme
  - Takvim tabanlı görsel işaretleme sistemi
  - Mevcut seri (streak) ve en iyi seri hesaplama
  - 52 haftalık aktivite ısı haritası
  - Haftalık örüntü analizi (en güçlü / en zayıf günler)
  - Momentum skoru ile son performans ağırlıklı değerlendirme

  ### Görev Yönetimi
  - Günlük ve haftalık görev listeleri
  - Alt görev hiyerarşisi (ebeveyn-çocuk yapısı)
  - Sürükle-bırak sıralama
  - Geçmiş gün görünümü

  ### Çalışma Zamanlayıcısı
  - Gerçek zamanlı zamanlayıcı ile çalışma seansı takibi
  - Ders ve konu bazlı kayıt
  - Seans duraklatma / devam ettirme
  - Uyku/uyanış tespiti — sistem uykudan döndüğünde uyarı
  - 8 dakika boşta kalma tespiti (yapılandırılabilir)
  - Uygulama kapanmadan kurtarma (checkpoint sistemi)
  - Sistem tepsisi entegrasyonu ve yüzen mini widget
  - Manuel geçmiş seans ekleme

  ### Deneme Sınavı Yönetimi
  - Bölüm sınavı (30 dk) ve genel sınav (130 dk) desteği
  - Geri sayım zamanlayıcısı ile duraklatma / devam / süre aşımı takibi
  - Bölüm bazlı doğru/yanlış/boş kaydı
  - Yanlış yapılan konuların kategori ve notlarla kaydı
  - Motivasyon mesajları (başlangıç, bitiş, erken bitiş, süre aşımı)

  ### Pratik Soru Takibi
  - Pratik soru hedefi kuyruğu oluşturma
  - Oturum bazlı doğru/yanlış/boş kaydı
  - Belirsiz soru ve iki seçenekli soru takibi
  - Net puan hesaplama (yapılandırılabilir eksi puan)
  - Konu ve kategori bazlı başarı oranı istatistikleri

  ### KPSS Müfredat Yönetimi
  - 8 yerleşik kategori (Tema 1–8)
  - Kategori renk özelleştirme
  - Kategori ve konu başlıkları ekleme, düzenleme, silme
  - Toplu konu yapıştırma (satır satır)
  - Konu tamamlama işaretleme
  - Tüm kategorilerde arama/filtreleme

  ### Video Ders Kütüphanesi
  - Ders grupları ve renklerle düzenleme
  - Başlık, süre ve bağlantı kaydı
  - İzlendi/izlenmedi işaretleme
  - 1x, 1.5x, 2x hızda tahmini tamamlama süresi
  - Toplu video yapıştırma (`Başlık | Süre | Bağlantı`)

  ### İstatistik ve Analitik
  - Çalışma: günlük toplam, hedef ilerleme, ders dağılımı, seri
  - Pratik: konu başarı oranı, güven analizi, trend grafikleri
  - Deneme: bölüm bazlı skor takibi, zayıf konu analizi
  - Alışkanlık: tamamlama ısı haritası, seri, haftalık örüntü

  ### Bildirim ve Motivasyon
  - Başlangıçta günlük özet bildirimi
  - Çalışma kilometre taşı bildirimleri (30, 60, 120 dk)
  - Risale-i Nur, Kuran ve Hadis günlük alıntı sistemi
  - Türkçe ve İngilizce dil desteği

  ### Veri Yönetimi
  - Otomatik günlük yedekleme (son 365 yedek)
  - JSON ve Excel (14 sayfa) dışa aktarma
  - Tüm veriler yerel SQLite veritabanında saklanır

  ---

  ## Teknoloji

  | Katman | Teknoloji |
  |---|---|
  | Uygulama çerçevesi | Electron 33 |
  | Arayüz | React 18, Recharts |
  | Veritabanı | SQLite (better-sqlite3) |
  | Build | Webpack 5, Babel 7 |
  | Dağıtım | Electron Builder / NSIS |

  ---

  ## Kurulum

  `dist/` klasöründeki `.exe` kurulum dosyasını çalıştır ve kurulumu tamamla.

  ---

  ## Geliştirme Ortamı

  ```bash
  npm install
  npm start        # geliştirme modunda başlat
  npm run build    # üretim build'i
  npm run dist     # kurulum paketi oluştur
