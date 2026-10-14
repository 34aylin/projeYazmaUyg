# Teknopark Ar-Ge Proje Başvuru Asistanı

Proje PDF'i, firma web sitesi ve kullanıcının girdiği bilgilerden teknopark Ar-Ge proje başvuru formunun alanlarını Claude (claude-opus-5-5) veya ücretsiz Google Gemini ile dolduran Streamlit uygulaması.

**Ücretsiz kullanım:** https://aistudio.google.com/apikey adresinden Gemini API anahtarı alıp `.env` içine `GEMINI_API_KEY` olarak yazın ve kenar çubuğunda "Gemini (ücretsiz)" seçin. Varsayılan model `gemini-flash-latest`; `GEMINI_MODEL` ile değiştirilebilir. Ücretsiz katmanda gönderilen içerik Google tarafından modeli geliştirmek için kullanılabilir, gizli belgelerde dikkat edin.

**Claude aboneliğiyle kullanım:** Kenar çubuğunda "Claude (abonelik)" seçilirse istek API'ye doğrudan gitmez; her formda bilgisayarda kurulu Claude Code CLI (`claude -p`) ayrı bir süreç olarak başlatılır ve Claude Pro/Max aboneliğinizle çalışır (API anahtarı gerekmez, kullanım abonelik limitlerinden düşer). Önce terminalde `claude` yazıp bir kez giriş yapın. Varsayılan model `opus`; `CLAUDE_CLI_MODEL` ile değiştirilebilir. Bu seçenek yalnızca uygulama doğrudan bilgisayarınızda çalışırken kullanılabilir; Docker içinde `claude` komutu yoktur. Abonelik kişisel kullanım içindir; uygulamayı başkalarına açacaksanız API seçeneğini kullanın.

## Kurulum

**Ekip üyeleri için:** [KURULUM.md](KURULUM.md) (tek komutla kurulum, Claude aboneliğiyle kullanım).

Geliştirici kurulumu:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY değerini girin
streamlit run app.py
```

### Docker ile

```bash
cp .env.example .env   # ANTHROPIC_API_KEY değerini girin
docker compose up -d --build
```

Uygulama http://localhost:8501 adresinde açılır. Yüklenen NACE listesi `./data` klasöründe kalıcı olarak saklanır. Durdurmak için `docker compose down`, kayıtları görmek için `docker compose logs -f`.

İlk açılışta kenar çubuğundan NACE Rev.2.1 kod listesini (.txt/.csv, satır başına "kod açıklama") yükleyin; `data/nace.txt` olarak saklanır.

## Dosyalar

| Dosya | Görev |
|---|---|
| `app.py` | Arayüz: kaynak girişi, sonuçların düzenlenmesi, dışa aktarma |
| `istem.py` | Sistem istemi (önbelleğe alınır) ve kaynakları içeren kullanıcı mesajı |
| `form_alanlari.py` | Alan sınırları, seçenek listeleri, structured outputs JSON şeması |
| `kaynaklar.py` | Web sitesi metni toplama (ana sayfa + ilgili alt sayfalar), NACE kodu ayrıştırma |
| `doldurucu.py` | API çağrısı ve kod tarafı doğrulamalar |
| `gemini.py` | Gemini API çağrıları |
| `claude_cli.py` | Claude Code CLI (`claude -p`) üzerinden abonelikle çağrı |

## Nasıl çalışır

1. PDF, Claude'a doğrudan `document` bloğu olarak gönderilir (tablolar ve görseller de okunur).
2. Web sitesinden ana sayfa ve "hakkımızda / ürünler / çözümler" gibi en fazla 6 alt sayfanın metni alınır.
3. Tek bir akışlı (streaming) istekle tüm form, JSON şemasına bağlı olarak üretilir. Seçmeli alanlar şemada enum olduğundan listede olmayan değer gelemez.
4. Kod tarafında şunlar kontrol edilir: karakter sınırı (aşan alan modelle otomatik kısaltılır), Markdown işaretlerinin temizlenmesi, proje kodu biçimi, NACE kodlarının listede olması, tarih biçimi ve süresi, çelişkili seçimler, en fazla 5 soru.

Model reddederse aynı istek sunucu tarafında yedek modelle yeniden denenir (`fallbacks: "default"`).
