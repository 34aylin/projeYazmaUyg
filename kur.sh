#!/usr/bin/env bash
# Teknopark Başvuru Asistanı - tek seferlik kurulum (macOS)
# Kullanım: ./kur.sh
set -euo pipefail
cd "$(dirname "$0")"

yesil() { printf "\033[32m%s\033[0m\n" "$1"; }
kirmizi() { printf "\033[31m%s\033[0m\n" "$1"; }

echo "1/4 Python kontrol ediliyor..."
PY=""
for aday in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$aday" >/dev/null && "$aday" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    PY="$aday"; break
  fi
done
if [ -z "$PY" ]; then
  kirmizi "Python 3.10 veya üstü bulunamadı."
  echo "Kurmak için: https://www.python.org/downloads/ adresinden indirin (veya 'brew install python')."
  exit 1
fi
yesil "   $("$PY" --version) bulundu."

echo "2/4 Python paketleri kuruluyor (birkaç dakika sürebilir)..."
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
yesil "   Paketler kuruldu."
[ -f .env ] || cp .env.example .env
mkdir -p data

echo "3/4 Claude Code kontrol ediliyor..."
if ! command -v claude >/dev/null; then
  echo "   Claude Code kuruluyor..."
  curl -fsSL https://claude.ai/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v claude >/dev/null; then
  kirmizi "Claude Code kurulamadı. Terminali kapatıp açın ve ./kur.sh komutunu tekrar çalıştırın."
  exit 1
fi
yesil "   Claude Code $(claude --version | head -1) bulundu."

echo "4/4 Claude hesabı kontrol ediliyor..."
if ! env -u ANTHROPIC_API_KEY claude auth status --json 2>/dev/null | grep -q '"loggedIn": *true'; then
  echo "   Tarayıcı açılacak; Claude (Pro/Max) hesabınızla giriş yapın."
  env -u ANTHROPIC_API_KEY claude auth login
fi
HESAP=$(env -u ANTHROPIC_API_KEY claude auth status --json 2>/dev/null | grep -o '"email": *"[^"]*"' | cut -d'"' -f4 || true)
yesil "   Giriş yapıldı: ${HESAP:-?}"

chmod +x Baslat.command
echo
yesil "Kurulum tamam. Uygulamayı açmak için Finder'da 'Baslat.command' dosyasına çift tıklayın."
