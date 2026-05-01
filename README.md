# 🏠 Gestion Appartements Meublés

Application web complète de gestion d'appartements meublés avec vérification journalière automatique, gestion des réservations, des clients, des employés et des rapports financiers.

---

## 🏗️ Architecture technique

```
appart-meuble/
├── backend/
│   ├── server.js               ← Point d'entrée Express
│   ├── config/
│   │   ├── db.js               ← Pool PostgreSQL
│   │   └── initDb.js           ← Script d'initialisation BDD
│   ├── middleware/
│   │   └── auth.js             ← JWT + gestion des rôles
│   ├── routes/
│   │   ├── auth.js             ← Inscription / Connexion
│   │   ├── appartements.js     ← CRUD appartements + bâtiments
│   │   ├── reservations.js     ← CRUD réservations
│   │   ├── clients.js          ← Gestion clients
│   │   ├── employes.js         ← Gestion employés
│   │   ├── paiements.js        ← Enregistrement paiements
│   │   └── rapports.js         ← Rapports + export CSV
│   ├── services/
│   │   └── emailService.js     ← Notifications email (Nodemailer)
│   └── cron/
│       └── verificationJournaliere.js  ← Tâche CRON 06h00
├── frontend/
│   ├── index.html              ← SPA principale
│   ├── css/style.css           ← Design complet
│   └── js/
│       ├── api.js              ← Couche API (fetch + JWT)
│       └── app.js              ← Logique SPA
├── database/
│   └── schema.sql              ← Tables, vues, triggers
├── docs/
│   └── appart-meuble.conf      ← Virtual Host Apache
├── .env.example                ← Variables d'environnement
├── package.json
└── deploy.sh                   ← Script d'installation
```

---

## 🗄️ Modèle de données

| Table               | Description                                      |
|---------------------|--------------------------------------------------|
| `batiment`          | Bâtiments (omnisport / eleveur)                  |
| `appartement`       | Appartements (standard / moyen / VIP)            |
| `users`             | Comptes de connexion (client / employe / gestionnaire) |
| `client`            | Profil complet des clients                       |
| `employee`          | Profil des employés                              |
| `reservation`       | Réservations (web, employé ou gestionnaire)      |
| `paiement`          | Historique des paiements                         |
| `journal_journalier`| Vérification CRON quotidienne par appartement    |
| `logs_activite`     | Journal d'audit de toutes les actions            |

### Vues PostgreSQL
- `vue_apparts_loues_jour` — Appartements loués avec calcul du montant cumulé
- `vue_historique_mensuel` — Résumé mensuel des réservations
- `vue_dashboard` — Statistiques temps réel pour le tableau de bord

---

## 👥 Rôles et permissions

| Fonctionnalité                        | Client | Employé | Gestionnaire |
|---------------------------------------|:------:|:-------:|:------------:|
| Voir les appartements disponibles     | ✅     | ✅      | ✅           |
| Créer un compte et se connecter       | ✅     | —       | —            |
| Réserver via le site                  | ✅     | ✅      | ✅           |
| Consulter ses propres réservations    | ✅     | ✅      | ✅           |
| Annuler une réservation (délai 24h)   | ✅     | ✅      | ✅           |
| Réserver pour un client               | ❌     | ✅      | ✅           |
| Voir la liste de tous les clients     | ❌     | ✅      | ✅           |
| Historique détaillé (J/S/M)          | ❌     | ✅      | ✅           |
| Tableau de bord avec statistiques     | ❌     | ✅      | ✅           |
| Export CSV                            | ❌     | ✅      | ✅           |
| Gérer les appartements (CRUD)         | ❌     | ❌      | ✅           |
| Gérer les employés (créer/activer)    | ❌     | ❌      | ✅           |
| Gérer les accès aux comptes           | ❌     | ❌      | ✅           |
| Lancer la vérification manuelle CRON  | ❌     | ❌      | ✅           |
| Consulter les logs d'audit            | ❌     | ❌      | ✅           |

---

## ⚙️ Installation

### Prérequis
- **Node.js** 18+
- **PostgreSQL** 14+
- **Apache2** (optionnel — pour la production)

### Installation rapide

```bash
# 1. Cloner / copier le projet
cd appart-meuble

# 2. Lancer le script d'installation
bash deploy.sh
```

### Installation manuelle

```bash
# 1. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 2. Créer la base de données
psql -U postgres -c "CREATE DATABASE appart_meuble;"

# 3. Installer les dépendances
npm install

# 4. Initialiser le schéma et les données de test
node backend/config/initDb.js

# 5. Démarrer le serveur
npm start          # production
npm run dev        # développement (avec nodemon)
```

---

## 🔒 Sécurité implémentée

- **JWT** avec expiration 8h + refresh token
- **Bcrypt** pour le hachage des mots de passe (rounds configurables)
- **Rate limiting** — 100 req/15 min global, 10 tentatives/15 min sur login
- **Helmet.js** — Headers HTTP sécurisés
- **CORS** configuré par domaine autorisé
- **Audit trail** — toutes les actions sont loggées dans `logs_activite`
- **Validation** des rôles à chaque route
- **Prévention injection SQL** — requêtes paramétrées uniquement

---

## ⏰ CRON — Vérification journalière

La tâche CRON s'exécute automatiquement **chaque jour à 06h00 (heure Cameroun)** :

1. Récupère toutes les réservations actives
2. Calcule le montant cumulé par appartement (jours × prix/jour)
3. Met à jour le solde restant de chaque client
4. Enregistre l'entrée dans `journal_journalier`
5. Clôture automatiquement les séjours dont la date de sortie est dépassée
6. Remet les appartements disponibles après départ
7. Alerte si le solde d'un client est négatif

Le gestionnaire peut aussi **déclencher la vérification manuellement** depuis le tableau de bord.

---

## 📡 API REST — Principales routes

```
POST   /api/auth/register          Créer un compte client
POST   /api/auth/login             Se connecter
GET    /api/auth/me                Profil utilisateur connecté

GET    /api/appartements           Liste (avec filtres)
GET    /api/appartements/:id       Détail d'un appartement
POST   /api/appartements           Créer (gestionnaire)
PUT    /api/appartements/:id       Modifier (gestionnaire)

GET    /api/reservations           Liste (filtrée selon rôle)
POST   /api/reservations           Créer une réservation
DELETE /api/reservations/:id       Annuler
GET    /api/reservations/historique Historique J/S/M (employé+)

GET    /api/clients                Liste des clients (employé+)
GET    /api/employes               Liste des employés (gestionnaire)
POST   /api/employes               Créer un employé (gestionnaire)
PATCH  /api/employes/:id/acces     Activer/Désactiver un compte

POST   /api/paiements              Enregistrer un paiement
GET    /api/rapports/journal       Journal journalier
GET    /api/rapports/resume        Résumé financier mensuel
GET    /api/rapports/export-csv    Export CSV

POST   /api/admin/cron/verif       Vérification manuelle (gestionnaire)
```

---

## 📧 Emails automatiques

L'application envoie des emails via Nodemailer (SMTP) :
- ✅ **Confirmation de réservation** au client
- ⚠️ **Alerte solde négatif** à l'administrateur
- 📅 **Rappel de fin de séjour** au client (J-1)
- 📊 **Rapport journalier** au gestionnaire (via CRON)

Configurez vos identifiants SMTP dans le fichier `.env`.

---

## 🚀 Production avec PM2

```bash
npm install -g pm2
pm2 start backend/server.js --name "appart-meuble" --env production
pm2 save && pm2 startup
pm2 monit   # Surveiller l'application
```
