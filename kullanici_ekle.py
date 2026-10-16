"""Kullanıcı yönetimi CLI aracı. Giriş e-posta ile yapılır.

Kullanım:
  python3 kullanici_ekle.py ekle <ad_soyad> <email>
  python3 kullanici_ekle.py sifre <email>
  python3 kullanici_ekle.py sil <email>
  python3 kullanici_ekle.py listele
"""

import sys
from pathlib import Path

import bcrypt
import yaml

DOSYA = Path(__file__).parent / "data" / "kullanicilar.yaml"


def _yukle() -> dict:
    return yaml.safe_load(DOSYA.read_text(encoding="utf-8"))


def _kaydet(config: dict) -> None:
    DOSYA.write_text(yaml.dump(config, allow_unicode=True, default_flow_style=False), encoding="utf-8")


def _hash(sifre: str) -> str:
    return bcrypt.hashpw(sifre.encode(), bcrypt.gensalt(12)).decode()


def ekle(ad: str, email: str) -> None:
    config = _yukle()
    if email in config["credentials"]["usernames"]:
        print(f"Hata: '{email}' zaten kayıtlı.")
        sys.exit(1)
    sifre = input("İlk şifre: ").strip()
    if len(sifre) < 6:
        print("Şifre en az 6 karakter olmalı.")
        sys.exit(1)
    config["credentials"]["usernames"][email] = {
        "email": email,
        "name": ad,
        "password": _hash(sifre),
    }
    _kaydet(config)
    print(f"Kullanıcı eklendi: {ad} <{email}>")


def sifre_sifirla(email: str) -> None:
    config = _yukle()
    if email not in config["credentials"]["usernames"]:
        print(f"Hata: '{email}' bulunamadı.")
        sys.exit(1)
    sifre = input("Yeni şifre: ").strip()
    if len(sifre) < 6:
        print("Şifre en az 6 karakter olmalı.")
        sys.exit(1)
    config["credentials"]["usernames"][email]["password"] = _hash(sifre)
    _kaydet(config)
    print(f"Şifre güncellendi: {email}")


def sil(email: str) -> None:
    config = _yukle()
    if email not in config["credentials"]["usernames"]:
        print(f"Hata: '{email}' bulunamadı.")
        sys.exit(1)
    onay = input(f"'{email}' silinecek. Onaylıyor musunuz? (evet): ").strip()
    if onay != "evet":
        print("İptal edildi.")
        sys.exit(0)
    del config["credentials"]["usernames"][email]
    _kaydet(config)
    print(f"Kullanıcı silindi: {email}")


def listele() -> None:
    config = _yukle()
    kullanicilar = config["credentials"]["usernames"]
    print(f"{'Kullanıcı adı':<20} {'Ad':<20} {'E-posta'}")
    print("-" * 60)
    for k, v in kullanicilar.items():
        print(f"{k:<20} {v.get('name',''):<20} {v.get('email','')}")


if __name__ == "__main__":
    komutlar = {"ekle": ekle, "sifre": sifre_sifirla, "sil": sil, "listele": listele}
    if len(sys.argv) < 2 or sys.argv[1] not in komutlar:
        print(__doc__)
        sys.exit(1)
    komut = sys.argv[1]
    if komut == "ekle":
        if len(sys.argv) != 4:
            print("Kullanım: python3 kullanici_ekle.py ekle <ad_soyad> <email>")
            sys.exit(1)
        ekle(sys.argv[2], sys.argv[3])
    elif komut == "sifre":
        if len(sys.argv) != 3:
            print("Kullanım: python3 kullanici_ekle.py sifre <kullanici_adi>")
            sys.exit(1)
        sifre_sifirla(sys.argv[2])
    elif komut == "sil":
        if len(sys.argv) != 3:
            print("Kullanım: python3 kullanici_ekle.py sil <kullanici_adi>")
            sys.exit(1)
        sil(sys.argv[2])
    elif komut == "listele":
        listele()
