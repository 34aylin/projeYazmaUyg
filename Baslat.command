#!/usr/bin/env bash
# Çift tıklayınca uygulamayı başlatır ve tarayıcıda açar. Kapatmak için bu pencereyi kapatın.
cd "$(dirname "$0")"

if [ ! -x .venv/bin/streamlit ]; then
  echo "Kurulum yapılmamış. Önce terminalde ./kur.sh çalıştırın."
  read -r -p "Kapatmak için Enter'a basın..."
  exit 1
fi

# Git deposundan kurulduysa en son sürümü al (internet yoksa veya yerel değişiklik varsa atlanır)
if [ -d .git ]; then
  echo "Güncellemeler kontrol ediliyor..."
  if git pull --ff-only -q 2>/dev/null; then
    .venv/bin/pip install -q -r requirements.txt
  else
    echo "Güncelleme alınamadı; mevcut sürümle devam ediliyor."
  fi
fi

export PATH="$HOME/.local/bin:$PATH"
echo "Uygulama açılıyor: http://localhost:8501  (kapatmak için bu pencereyi kapatın)"
exec .venv/bin/streamlit run app.py --server.headless=false --browser.gatherUsageStats=false
