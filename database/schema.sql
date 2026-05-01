-- ============================================================
-- SCHÉMA POSTGRESQL - Gestion Appartements Meublés
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : batiment
-- ============================================================
CREATE TABLE IF NOT EXISTS batiment (
    id_batiment     SERIAL PRIMARY KEY,
    nom_batiment    VARCHAR(100) NOT NULL CHECK (nom_batiment IN ('omnisport','eleveur')),
    email           VARCHAR(150) UNIQUE,
    telephone       VARCHAR(20),
    categorie_batiment VARCHAR(80),
    adresse         TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : appartement
-- ============================================================
CREATE TABLE IF NOT EXISTS appartement (
    id_appart       SERIAL PRIMARY KEY,
    id_batiment     INT REFERENCES batiment(id_batiment) ON DELETE SET NULL,
    categorie       VARCHAR(20) NOT NULL CHECK (categorie IN ('standard','moyen','VIP')),
    prix_unitaire   DECIMAL(10,2) NOT NULL,
    capacite        VARCHAR(20) NOT NULL CHECK (capacite IN ('simple','double','Queen','King')),
    telephone_appart VARCHAR(20),
    accomodation    TEXT,
    restriction     TEXT,
    disponible      BOOLEAN DEFAULT TRUE,
    etage           INT DEFAULT 0,
    numero_appart   VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : users (comptes de connexion)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id_user         SERIAL PRIMARY KEY,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client','employe','gestionnaire')),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP,
    reset_token     VARCHAR(255),
    reset_expires   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : client
-- ============================================================
CREATE TABLE IF NOT EXISTS client (
    id_client       SERIAL PRIMARY KEY,
    id_user         INT REFERENCES users(id_user) ON DELETE SET NULL,
    nom_client      VARCHAR(150) NOT NULL,
    numero_cni      VARCHAR(50) UNIQUE NOT NULL,
    adresse_client  TEXT,
    telephone       VARCHAR(20),
    email           VARCHAR(150),
    id_appartement  INT REFERENCES appartement(id_appart) ON DELETE SET NULL,
    date_entree     DATE,
    date_sortie     DATE,
    prix_unitaire   DECIMAL(10,2),
    montant_total   DECIMAL(12,2) DEFAULT 0,
    avance_paye     DECIMAL(12,2) DEFAULT 0,
    solde_restant   DECIMAL(12,2) DEFAULT 0,
    statut          VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif','sorti','en_attente')),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : employee
-- ============================================================
CREATE TABLE IF NOT EXISTS employee (
    id_employee     SERIAL PRIMARY KEY,
    id_user         INT REFERENCES users(id_user) ON DELETE SET NULL,
    nom_employee    VARCHAR(150) NOT NULL,
    adresse_employee TEXT,
    telephone       VARCHAR(20),
    poste           VARCHAR(80),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : reservation
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation (
    id_reservation  SERIAL PRIMARY KEY,
    id_client       INT REFERENCES client(id_client) ON DELETE CASCADE,
    id_appartement  INT REFERENCES appartement(id_appart) ON DELETE CASCADE,
    id_employee     INT REFERENCES employee(id_employee) ON DELETE SET NULL,
    numero_appart   VARCHAR(20),
    prix_unitaire   DECIMAL(10,2) NOT NULL,
    montant_total   DECIMAL(12,2) DEFAULT 0,
    date_entree     DATE NOT NULL,
    date_sortie     DATE,
    nombre_jours    INT DEFAULT 0,
    nom_batiment    VARCHAR(100) CHECK (nom_batiment IN ('omnisport','eleveur')),
    numero_batiment VARCHAR(20),
    statut          VARCHAR(20) DEFAULT 'en_cours' CHECK (statut IN ('en_cours','terminee','annulee','confirmee')),
    source          VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web','employe','gestionnaire')),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : paiement
-- ============================================================
CREATE TABLE IF NOT EXISTS paiement (
    id_paiement     SERIAL PRIMARY KEY,
    id_reservation  INT REFERENCES reservation(id_reservation) ON DELETE CASCADE,
    id_client       INT REFERENCES client(id_client) ON DELETE CASCADE,
    montant         DECIMAL(12,2) NOT NULL,
    type_paiement   VARCHAR(30) DEFAULT 'avance' CHECK (type_paiement IN ('avance','solde','remboursement')),
    mode_paiement   VARCHAR(30) DEFAULT 'especes' CHECK (mode_paiement IN ('especes','virement','mobile_money','carte')),
    reference       VARCHAR(100),
    date_paiement   TIMESTAMP DEFAULT NOW(),
    notes           TEXT
);

-- ============================================================
-- TABLE : journal_journalier (vérification quotidienne CRON)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_journalier (
    id_journal      SERIAL PRIMARY KEY,
    id_appartement  INT REFERENCES appartement(id_appart) ON DELETE SET NULL,
    id_client       INT REFERENCES client(id_client) ON DELETE SET NULL,
    id_reservation  INT REFERENCES reservation(id_reservation) ON DELETE SET NULL,
    date_verif      DATE DEFAULT CURRENT_DATE,
    montant_jour    DECIMAL(10,2),
    jours_ecoules   INT,
    montant_cumule  DECIMAL(12,2),
    avance_initiale DECIMAL(12,2),
    solde_restant   DECIMAL(12,2),
    statut_appart   VARCHAR(30),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE : logs_activite
-- ============================================================
CREATE TABLE IF NOT EXISTS logs_activite (
    id_log          SERIAL PRIMARY KEY,
    id_user         INT REFERENCES users(id_user) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    table_cible     VARCHAR(50),
    id_cible        INT,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VUES UTILES
-- ============================================================

-- Vue : appartements loués aujourd'hui
CREATE OR REPLACE VIEW vue_apparts_loues_jour AS
SELECT 
    a.id_appart,
    a.numero_appart,
    a.categorie,
    a.prix_unitaire,
    b.nom_batiment,
    c.nom_client,
    c.telephone AS tel_client,
    r.date_entree,
    r.date_sortie,
    CURRENT_DATE - r.date_entree AS jours_ecoules,
    a.prix_unitaire * (CURRENT_DATE - r.date_entree) AS montant_cumule,
    r.montant_total AS montant_prevu,
    c.avance_paye,
    c.avance_paye - (a.prix_unitaire * (CURRENT_DATE - r.date_entree)) AS solde_avance,
    r.statut
FROM appartement a
JOIN reservation r ON r.id_appartement = a.id_appart
JOIN client c ON c.id_client = r.id_client
LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
WHERE r.statut = 'en_cours'
  AND r.date_entree <= CURRENT_DATE
  AND (r.date_sortie IS NULL OR r.date_sortie >= CURRENT_DATE);

-- Vue : historique mensuel des réservations
CREATE OR REPLACE VIEW vue_historique_mensuel AS
SELECT 
    DATE_TRUNC('month', r.date_entree) AS mois,
    COUNT(r.id_reservation) AS nb_reservations,
    SUM(r.montant_total) AS revenu_total,
    AVG(r.nombre_jours) AS duree_moyenne,
    b.nom_batiment
FROM reservation r
LEFT JOIN appartement a ON a.id_appart = r.id_appartement
LEFT JOIN batiment b ON b.id_batiment = a.id_batiment
WHERE r.statut != 'annulee'
GROUP BY DATE_TRUNC('month', r.date_entree), b.nom_batiment
ORDER BY mois DESC;

-- Vue : tableau de bord gestionnaire
CREATE OR REPLACE VIEW vue_dashboard AS
SELECT
    (SELECT COUNT(*) FROM appartement WHERE disponible = TRUE) AS apparts_disponibles,
    (SELECT COUNT(*) FROM reservation WHERE statut = 'en_cours') AS reservations_actives,
    (SELECT COUNT(*) FROM reservation WHERE DATE(created_at) = CURRENT_DATE) AS reservations_aujourd_hui,
    (SELECT COALESCE(SUM(montant),0) FROM paiement WHERE DATE(date_paiement) = CURRENT_DATE) AS recettes_jour,
    (SELECT COALESCE(SUM(montant),0) FROM paiement 
     WHERE DATE_TRUNC('month',date_paiement) = DATE_TRUNC('month',NOW())) AS recettes_mois,
    (SELECT COUNT(*) FROM client WHERE statut = 'actif') AS clients_actifs;

-- ============================================================
-- TRIGGERS : mise à jour automatique
-- ============================================================

-- Trigger : recalculer le montant total reservation
CREATE OR REPLACE FUNCTION calc_montant_reservation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_sortie IS NOT NULL AND NEW.date_entree IS NOT NULL THEN
        NEW.nombre_jours := NEW.date_sortie - NEW.date_entree;
        NEW.montant_total := NEW.nombre_jours * NEW.prix_unitaire;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_calc_montant
    BEFORE INSERT OR UPDATE ON reservation
    FOR EACH ROW EXECUTE FUNCTION calc_montant_reservation();

-- Trigger : mettre à jour solde client
CREATE OR REPLACE FUNCTION update_solde_client()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE client SET
        solde_restant = montant_total - avance_paye,
        updated_at = NOW()
    WHERE id_client = NEW.id_client;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_update_solde
    AFTER INSERT OR UPDATE ON paiement
    FOR EACH ROW EXECUTE FUNCTION update_solde_client();

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================

-- Bâtiments
INSERT INTO batiment (nom_batiment, email, telephone, categorie_batiment, adresse) VALUES
('omnisport', 'omnisport@appart.com', '+237600000001', 'Résidentiel', 'Quartier Omnisport, Yaoundé'),
('eleveur', 'eleveur@appart.com', '+237600000002', 'Résidentiel', 'Quartier Éleveur, Yaoundé');

-- Appartements
INSERT INTO appartement (id_batiment, categorie, prix_unitaire, capacite, telephone_appart, numero_appart, accomodation) VALUES
(1, 'standard', 15000, 'simple', '+237600000010', 'A101', 'WiFi, TV, Climatisation'),
(1, 'moyen', 25000, 'double', '+237600000011', 'A102', 'WiFi, TV, Climatisation, Cuisine équipée'),
(1, 'VIP', 45000, 'King', '+237600000012', 'A201', 'WiFi, TV, Clim, Cuisine, Jacuzzi, Parking'),
(2, 'standard', 12000, 'simple', '+237600000013', 'B101', 'WiFi, TV'),
(2, 'moyen', 22000, 'double', '+237600000014', 'B102', 'WiFi, TV, Climatisation'),
(2, 'VIP', 40000, 'Queen', '+237600000015', 'B201', 'WiFi, TV, Clim, Cuisine, Parking');

-- Utilisateurs (mot de passe: Admin@123 hashé)
INSERT INTO users (email, password_hash, role) VALUES
('gestionnaire@appart.com', '$2b$12$hash_gestionnaire_placeholder', 'gestionnaire'),
('employe1@appart.com', '$2b$12$hash_employe_placeholder', 'employe'),
('client1@test.com', '$2b$12$hash_client_placeholder', 'client');
