# Ekip Kurulum Rehberi

Uygulama herkesin kendi bilgisayarında çalışır ve herkesin kendi Claude (Pro/Max) aboneliğini kullanır. API anahtarı gerekmez, sunucu yoktur.

Gereken: macOS, Claude Pro veya Max aboneliği, internet bağlantısı.

## İlk kurulum (bir kez, ~10 dakika)

1. **Terminal**'i açın (Cmd + Boşluk → "Terminal" yazın → Enter).

2. Projeyi indirin:
   ```
   cd ~/Documents
   git clone <DEPO_ADRESİ> basvuru-asistani
   cd basvuru-asistani
   ```
   `git` ilk kez kullanılıyorsa macOS "Komut satırı geliştirici araçlarını yükle" penceresi açabilir; **Yükle**'ye basın, bitince komutu tekrar çalıştırın.

3. Kurulum betiğini çalıştırın:
   ```
   ./kur.sh
   ```
   Betik Python paketlerini kurar, Claude Code yoksa kurar ve giriş yapmanız için tarayıcıyı açar. **Kendi Claude hesabınızla** giriş yapın.

   "Python bulunamadı" derse https://www.python.org/downloads/ adresinden Python'u kurup `./kur.sh` komutunu tekrar çalıştırın.

## Her gün kullanım

Finder'da proje klasörünü açıp **`Baslat.command`** dosyasına çift tıklayın. Tarayıcıda uygulama açılır. İşiniz bitince açılan Terminal penceresini kapatın.

İlk açılışta macOS "geliştiricisi doğrulanamadı" derse: dosyaya **sağ tıklayın → Aç → Aç**. Bu yalnızca bir kez sorulur.

`Baslat.command` her açılışta en son sürümü otomatik indirir; ayrıca güncelleme yapmanıza gerek yok.

## Uygulamada

- Kenar çubuğunda **"Claude (abonelik)"** seçili olmalı ve altında kendi e-posta adresiniz görünmeli.
- İlk açılışta NACE kod listesini kenar çubuğundan yükleyin (bir kez yeterli).
- Bir form yaklaşık 5 dakika sürer ve aboneliğinizin kullanım limitinden düşer. Limit dolarsa birkaç saat sonra tekrar deneyin.

## Sorunlar

| Mesaj | Çözüm |
|---|---|
| "Claude'a giriş yapılmamış" | Terminalde `claude auth login` çalıştırın, sayfayı yenileyin |
| "'claude' komutu bulunamadı" | Proje klasöründe `./kur.sh` komutunu tekrar çalıştırın |
| "Kurulum yapılmamış" | Proje klasöründe `./kur.sh` çalıştırın |
| Kullanım limiti / rate limit | Aboneliğinizin limiti dolmuştur; birkaç saat sonra deneyin |
| Sayfa açılmıyor | Başka bir `Baslat.command` penceresi açık olabilir; hepsini kapatıp tekrar deneyin |

Çözülmeyen sorunlarda ekrandaki hata mesajının ekran görüntüsünü paylaşın.

## Önemli

- Herkes **kendi** hesabıyla giriş yapmalı; hesap veya oturum paylaşmayın.
- `.env` dosyasını (API anahtarları) kimseyle paylaşmayın; Git'e gönderilmez.
- Çıktı bir taslaktır. Göndermeden önce her alanı okuyun, [EKSİK] yerleri tamamlayın ve özellikle yüzde ve tutar içeren cümleleri kaynaklarla karşılaştırın.
