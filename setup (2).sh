#!/bin/bash
# CourseAI — Script de setup automático
# Uso: bash setup.sh
# Requisitos: git, node, npm instalados

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CourseAI — Setup automático    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

# ── Verificar dependencias ────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Verificando dependencias...${NC}"
for cmd in git node npm; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}✗ '$cmd' no está instalado. Instalalo antes de continuar.${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✓ git, node y npm disponibles${NC}"
echo ""

# ── Instalar dependencias del proyecto ───────────────────────────────────────
echo -e "${YELLOW}▸ Instalando dependencias npm...${NC}"
npm install
echo -e "${GREEN}✓ Dependencias instaladas${NC}"
echo ""

# ── Crear .env si no existe ───────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo -e "${YELLOW}▸ Creando archivo .env desde .env.example...${NC}"
  cp .env.example .env
  echo -e "${GREEN}✓ .env creado — completá los valores antes de continuar${NC}"
  echo ""
  echo -e "${YELLOW}  Abrí el archivo .env y completá al menos:${NC}"
  echo "  • MP_ACCESS_TOKEN  (mercadopago.com.ar/developers)"
  echo "  • ANTHROPIC_API_KEY (console.anthropic.com)"
  echo "  • SMTP_USER + SMTP_PASS (App Password de Gmail)"
  echo "  • ADMIN_PASSWORD (la contraseña que quieras)"
  echo "  • JWT_SECRET (cualquier string largo y aleatorio)"
  echo ""
  echo -e "${YELLOW}  Una vez completado el .env, volvé a correr: bash setup.sh${NC}"
  exit 0
fi

# ── Verificar .env completado ─────────────────────────────────────────────────
echo -e "${YELLOW}▸ Verificando .env...${NC}"
source .env 2>/dev/null || true
MISSING=()
[ -z "$MP_ACCESS_TOKEN" ]    && MISSING+=("MP_ACCESS_TOKEN")
[ -z "$ANTHROPIC_API_KEY" ]  && MISSING+=("ANTHROPIC_API_KEY")
[ -z "$SMTP_USER" ]          && MISSING+=("SMTP_USER")
[ -z "$SMTP_PASS" ]          && MISSING+=("SMTP_PASS")
[ -z "$ADMIN_PASSWORD" ]     && MISSING+=("ADMIN_PASSWORD")
[ -z "$JWT_SECRET" ]         && MISSING+=("JWT_SECRET")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}✗ Faltan estas variables en .env:${NC}"
  for v in "${MISSING[@]}"; do echo "  • $v"; done
  echo ""
  echo "  Completá el .env y volvé a correr: bash setup.sh"
  exit 1
fi
echo -e "${GREEN}✓ .env configurado correctamente${NC}"
echo ""

# ── Inicializar git si no está ────────────────────────────────────────────────
if [ ! -d .git ]; then
  echo -e "${YELLOW}▸ Inicializando repositorio git...${NC}"
  git init
  git add .
  git commit -m "CourseAI v1.0 — initial commit"
  echo -e "${GREEN}✓ Repositorio git inicializado${NC}"
  echo ""
fi

# ── Test local ────────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Testeando servidor localmente (5 segundos)...${NC}"
node server.js &
SERVER_PID=$!
sleep 3
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null || echo '{}')
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ Servidor local funcionando correctamente${NC}"
  MP_OK=$(echo "$HEALTH" | grep -o '"mp":true' | head -1)
  EMAIL_OK=$(echo "$HEALTH" | grep -o '"email":true' | head -1)
  [ -n "$MP_OK" ]    && echo -e "${GREEN}  ✓ Mercado Pago configurado${NC}" || echo -e "${YELLOW}  ⚠ Mercado Pago: verificar MP_ACCESS_TOKEN${NC}"
  [ -n "$EMAIL_OK" ] && echo -e "${GREEN}  ✓ Email SMTP configurado${NC}"   || echo -e "${YELLOW}  ⚠ Email: verificar SMTP_USER y SMTP_PASS${NC}"
else
  echo -e "${YELLOW}⚠ No se pudo verificar el servidor (puede ser normal si el puerto está ocupado)${NC}"
fi
echo ""

# ── Instrucciones Railway ─────────────────────────────────────────────────────
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✓ Setup local completo. Pasos finales para Railway  ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}1. Subí el código a GitHub:${NC}"
echo "   git remote add origin https://github.com/TU_USUARIO/courseai.git"
echo "   git branch -M main && git push -u origin main"
echo ""
echo -e "${YELLOW}2. En railway.app → New Project → Deploy from GitHub → courseai${NC}"
echo ""
echo -e "${YELLOW}3. Agregá estas variables en Railway → Variables:${NC}"
echo ""
# Mostrar variables sin valores sensibles
vars=(MP_ACCESS_TOKEN ANTHROPIC_API_KEY ADMIN_PASSWORD JWT_SECRET SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS FROM_NAME BASE_URL COURSE_ACCESS_URL)
for v in "${vars[@]}"; do
  val="${!v}"
  if [[ "$v" == *"PASS"* ]] || [[ "$v" == *"SECRET"* ]] || [[ "$v" == *"TOKEN"* ]] || [[ "$v" == *"KEY"* ]]; then
    display="[tu valor de .env — no mostrado por seguridad]"
  else
    display="${val:-[completar]}"
  fi
  printf "   %-30s = %s\n" "$v" "$display"
done
echo ""
echo -e "${YELLOW}4. Railway te da una URL → actualizá BASE_URL con esa URL${NC}"
echo ""
echo -e "${YELLOW}5. Webhook MP: mercadopago.com.ar/developers → Webhooks${NC}"
echo "   URL: https://TU-APP.up.railway.app/api/webhook"
echo "   Evento: payment"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 ¡CourseAI listo para producción!  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
