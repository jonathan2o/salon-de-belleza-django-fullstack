#!/usr/bin/env bash
# ============================================================
# Script de despliegue - Salon Belleza en Hostinger VPS (Ubuntu)
#
# Requisitos previos:
#   - Dominio apuntando (DNS A record) a la IP del VPS
#   - Proyecto subido a /home/salonbelleza/salonbelleza
#     (SIN las carpetas venv/ y node_modules/)
#   - Si usas Ubuntu 22.04, instala Node.js 20 antes
#     (el de los repositorios es demasiado viejo para react-scripts 5)
#
# Uso (como root o con sudo):
#   DOMINIO=tu-dominio.com bash deploy/deploy.sh
# ============================================================
set -euo pipefail

DOMINIO="${DOMINIO:-}"
APP_DIR="/home/salonbelleza/salonbelleza"
APP_USER="salonbelleza"

if [ -z "$DOMINIO" ]; then
  echo "ERROR: define el dominio. Ejemplo:"
  echo "  DOMINIO=tu-dominio.com bash deploy/deploy.sh"
  exit 1
fi

echo "==> [1/8] Instalando dependencias del sistema"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 python3-venv python3-pip python3-dev \
  postgresql postgresql-contrib \
  nginx \
  nodejs npm \
  certbot python3-certbot-nginx \
  fail2ban ufw

echo "==> [2/8] Creando usuario de la aplicacion"
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

echo "==> [3/8] Creando base de datos y usuario PostgreSQL"
DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
sudo -u postgres psql <<SQL
CREATE USER salonbelleza_user WITH PASSWORD '${DB_PASS}';
CREATE DATABASE salonbelleza_db OWNER salonbelleza_user;
SQL

echo "==> [4/8] Configurando archivo .env (produccion)"
SECRET_KEY="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 64)"
cat > "${APP_DIR}/.env" <<ENV
DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMINIO},www.${DOMINIO}
CSRF_TRUSTED_ORIGINS=https://${DOMINIO},https://www.${DOMINIO}
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=
DB_NAME=salonbelleza_db
DB_USER=salonbelleza_user
DB_PASSWORD=${DB_PASS}
DB_HOST=localhost
DB_PORT=5432
ENV
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"

echo "==> [5/8] Creando entorno virtual e instalando dependencias Python"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR} && python3 -m venv venv && venv/bin/pip install --upgrade pip && venv/bin/pip install -r requirements.txt"

echo "==> [6/8] Migraciones, superusuario y archivos estaticos"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR} && set -a && . ./.env && set +a && venv/bin/python manage.py migrate"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR} && set -a && . ./.env && set +a && venv/bin/python manage.py collectstatic --noinput"
echo "--> Crea un superusuario para /admin (te pedira usuario y correo)"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR} && set -a && . ./.env && set +a && venv/bin/python manage.py createsuperuser"

echo "==> [7/8] Compilando el frontend React"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/frontend"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR}/frontend && npm ci && npm run build"

echo "==> [8/8] Configurando Gunicorn y Nginx"
install -m 644 "${APP_DIR}/deploy/gunicorn.service" /etc/systemd/system/gunicorn.service
systemctl daemon-reload
systemctl enable --now gunicorn

cp "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/salonbelleza
sed -i "s/TU_DOMINIO/${DOMINIO}/g" /etc/nginx/sites-available/salonbelleza
ln -sf /etc/nginx/sites-available/salonbelleza /etc/nginx/sites-enabled/salonbelleza
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> HTTPS con Let's Encrypt (certbot)"
certbot --nginx -d "${DOMINIO}" -d "www.${DOMINIO}" --non-interactive --agree-tos -m "admin@${DOMINIO}" --redirect

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "==> DESPLIEGUE COMPLETADO. Verifica:"
echo "  systemctl status gunicorn"
echo "  curl -I https://${DOMINIO}/api/servicios/"
echo "  https://${DOMINIO}/admin/"
echo "  https://${DOMINIO}/"
echo ""
echo "Recuerda: los datos de la BD local (db.sqlite3 / backup_sqlite_data.json)"
echo "NO se han migrado automaticamente. Si los necesitas en produccion, pidemelo."
