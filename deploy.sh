#!/bin/bash
# ============================================================
# deploy.sh — Script d'installation et déploiement
# Gestion Appartements Meublés
# Usage : bash deploy.sh
# ============================================================

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${YELLOW}ℹ  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Installation — Gestion Appartements Meublés  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Vérifier Node.js ──────────────────────────────────────
if ! command -v node &>/dev/null; then
    err "Node.js non trouvé. Installez Node.js 18+ : https://nodejs.org"
fi
NODE_VER=$(node -v | cut -c 2- | cut -d. -f1)
[ "$NODE_VER" -lt 18 ] && err "Node.js 18+ requis (version actuelle : $(node -v))"
ok "Node.js $(node -v)"

# ── 2. Vérifier PostgreSQL ───────────────────────────────────
if ! command -v psql &>/dev/null; then
    err "PostgreSQL non trouvé. Installez PostgreSQL 14+"
fi
ok "PostgreSQL $(psql --version | awk '{print $3}')"

# ── 3. Vérifier Apache ───────────────────────────────────────
if command -v apache2 &>/dev/null; then
    ok "Apache2 détecté"
    APACHE=true
else
    info "Apache2 non trouvé — l'app sera accessible directement via Node.js"
    APACHE=false
fi

# ── 4. Créer le fichier .env ─────────────────────────────────
if [ ! -f .env ]; then
    info "Création du fichier .env..."
    cp .env.example .env

    # Demander les infos BDD
    echo ""
    read -p "Nom de la base PostgreSQL [appart_meuble] : " DB_NAME
    DB_NAME=${DB_NAME:-appart_meuble}
    read -p "Utilisateur PostgreSQL [postgres] : "   DB_USER
    DB_USER=${DB_USER:-postgres}
    read -s -p "Mot de passe PostgreSQL : "           DB_PASS
    echo ""

    # Générer un secret JWT aléatoire
    JWT_SEC=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

    sed -i "s/VotreMotDePassePG/$DB_PASS/"         .env
    sed -i "s/appart_meuble/$DB_NAME/"             .env
    sed -i "s/postgres/$DB_USER/"                  .env
    sed -i "s/votre_secret_jwt_tres_long_et_complexe_changez_ceci/$JWT_SEC/" .env

    ok "Fichier .env créé"
else
    info "Fichier .env déjà existant — conservé"
fi

# ── 5. Créer la base de données ──────────────────────────────
source .env
info "Création de la base de données '$DB_NAME'..."
psql -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8';"
ok "Base de données '$DB_NAME' prête"

# ── 6. Installer les dépendances npm ────────────────────────
info "Installation des dépendances npm..."
npm install --production
ok "Dépendances installées"

# ── 7. Initialiser le schéma et les données de test ─────────
info "Initialisation du schéma PostgreSQL..."
node backend/config/initDb.js
ok "Schéma et données de test créés"

# ── 8. Configurer Apache (si disponible) ────────────────────
if [ "$APACHE" = true ]; then
    info "Configuration d'Apache..."
    SITE_CONF="/etc/apache2/sites-available/appart-meuble.conf"
    sudo cp docs/appart-meuble.conf "$SITE_CONF"

    # Lien symbolique du frontend
    sudo mkdir -p /var/www/appart-meuble
    sudo ln -sfn "$(pwd)/frontend" /var/www/appart-meuble/frontend

    # Activer les modules et le site
    sudo a2enmod proxy proxy_http rewrite headers 2>/dev/null || true
    sudo a2ensite appart-meuble 2>/dev/null || true
    sudo systemctl reload apache2 2>/dev/null || true
    ok "Apache configuré"
fi

# ── 9. Configurer PM2 (process manager) ──────────────────────
if command -v pm2 &>/dev/null; then
    info "Démarrage avec PM2..."
    pm2 start backend/server.js --name "appart-meuble" --env production
    pm2 save
    pm2 startup
    ok "Application démarrée avec PM2"
else
    info "PM2 non installé. Pour la production, installez-le : npm install -g pm2"
    info "Démarrage direct avec Node.js..."
    node backend/server.js &
    ok "Application démarrée sur http://localhost:$PORT"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Installation terminée !                   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  🌐 Application  : http://localhost:${PORT:-3000}"
[ "$APACHE" = true ] && echo "  🌐 Via Apache   : http://appart-meuble.cm"
echo ""
echo "  🔑 Comptes de test :"
echo "  Gestionnaire : gestionnaire@appart.com / Gestionnaire@123"
echo "  Employé      : employe1@appart.com     / Employe@123"
echo "  Client       : client1@test.com        / Client@123"
echo ""
