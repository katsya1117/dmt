#!/usr/bin/env bash
# 顧客PHPサーバーのモック(mock/php-server)を PHP組み込みサーバーで :8080 に起動する。
# Docker が使えない環境（v0サンドボックス等）向け。Docker が使える環境では
# `docker compose up` でも同じ URL で動く。
#
# concurrently -k で起動しているため、このプロセスが終了すると client/server も
# 道連れで落ちる。PHP が用意できない場合も終了せず待機し続ける。
set -u

PORT="${PHP_MOCK_PORT:-8080}"
ROOT="$(cd "$(dirname "$0")/../mock/php-server" && pwd)"

if ! command -v php >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    echo "php not found. Installing php-cli / pdo_sqlite via dnf..."
    sudo dnf install -y -q php8.4-cli php8.4-pdo >/dev/null 2>&1 \
      || sudo dnf install -y -q php-cli php-pdo >/dev/null 2>&1
  fi
fi

if ! command -v php >/dev/null 2>&1; then
  echo "WARNING: php が見つかりません。PHPモック(:${PORT})なしで続行します（docker compose up で代替可）"
  exec tail -f /dev/null
fi

if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
  echo "port ${PORT} は既に使用中です（docker compose 等で起動済みとみなします）"
  exec tail -f /dev/null
fi

mkdir -p "${ROOT}/uploads" "${ROOT}/data"
echo "PHP mock: http://localhost:${PORT} (docroot: ${ROOT})"
exec php -S "0.0.0.0:${PORT}" -t "${ROOT}"
