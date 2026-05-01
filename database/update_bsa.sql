-- ============================================================
-- MISE À JOUR BSA — Beautiful Stay by Alliance
-- Données réelles du catalogue Omnisport
-- ============================================================

-- Mettre à jour le bâtiment omnisport avec les vraies infos
UPDATE batiment SET
    email = 'bsasarl49@gmail.com',
    telephone = '+237 675 992 561',
    categorie_batiment = 'Résidentiel Premium',
    adresse = 'Yaoundé - Omnisport derrière le stade'
WHERE nom_batiment = 'omnisport';

-- Supprimer les appartements de test
DELETE FROM appartement;

-- ============================================================
-- APPARTEMENTS RÉELS DU CATALOGUE BSA OMNISPORT
-- ============================================================

INSERT INTO appartement (id_batiment, numero_appart, categorie, prix_unitaire, capacite, accomodation, restriction, disponible) VALUES

-- Appartement 201 — 50 000f/nuit (sans clim)
(1, '201', 'standard', 50000, 'double',
 'Salon avec balcon, 02 chambres (sans clim), 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 'Sans climatisation', TRUE),

-- Appartement 202 — 80 000f/nuit
(1, '202', 'VIP', 80000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 204 — 40 000f/nuit (2e chambre sans clim)
(1, '204', 'standard', 40000, 'double',
 'Salon avec balcon, 02 chambres (2e sans clim), 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 '2e chambre sans climatisation', TRUE),

-- Appartement 301 — 60 000f/nuit
(1, '301', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 303 — 70 000f/nuit
(1, '303', 'moyen', 70000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 304 — 60 000f/nuit
(1, '304', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 402 — 80 000f/nuit
(1, '402', 'VIP', 80000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 403 — 60 000f/nuit
(1, '403', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 501 — 38 000f/nuit (salon sans clim, 1 clim sur 2)
(1, '501', 'standard', 38000, 'simple',
 'Salon (sans clim) avec balcon, 02 chambres (une clim sur 2), 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 'Salon sans clim, 1 chambre sur 2 avec clim', TRUE),

-- Appartement 502 — 70 000f/nuit
(1, '502', 'moyen', 70000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 503 — 70 000f/nuit
(1, '503', 'moyen', 70000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 504 — 60 000f/nuit
(1, '504', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 602 — 60 000f/nuit
(1, '602', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 603 — 60 000f/nuit
(1, '603', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE),

-- Appartement 604 — 60 000f/nuit
(1, '604', 'moyen', 60000, 'double',
 'Salon avec balcon, 02 chambres, 01 cuisine, 02 douches, WiFi gratuit illimité, TV, Climatisation, Groupe électrogène, Vidéo surveillance, Service de ménage, Petit-déjeuner inclus, Eau chaude/froide',
 NULL, TRUE);

-- ============================================================
-- TABLE SERVICES ADDITIONNELS (accueil aéroport, tourisme)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_additionnel (
    id_service      SERIAL PRIMARY KEY,
    id_reservation  INT REFERENCES reservation(id_reservation) ON DELETE CASCADE,
    id_client       INT REFERENCES client(id_client) ON DELETE CASCADE,
    type_service    VARCHAR(50) NOT NULL CHECK (type_service IN ('accueil_aeroport','tourisme','location_voiture','visite_guidee','excursion')),
    description     TEXT,
    date_service    DATE,
    heure_arrivee   TIME,
    vol             VARCHAR(50),
    nombre_personnes INT DEFAULT 1,
    destination     TEXT,
    montant         DECIMAL(12,2) DEFAULT 0,
    statut          VARCHAR(20) DEFAULT 'demande' CHECK (statut IN ('demande','confirme','termine','annule')),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PRIX STUDIOS (option studio dans chaque appartement)
-- Colonne prix_studio ajoutée
-- ============================================================
ALTER TABLE appartement ADD COLUMN IF NOT EXISTS prix_studio DECIMAL(10,2);

UPDATE appartement SET prix_studio = CASE
    WHEN numero_appart = '201' THEN 40000
    WHEN numero_appart = '202' THEN 70000
    WHEN numero_appart = '204' THEN 30000
    WHEN numero_appart = '301' THEN 50000
    WHEN numero_appart = '303' THEN 60000
    WHEN numero_appart = '304' THEN 50000
    WHEN numero_appart = '402' THEN 70000
    WHEN numero_appart = '403' THEN 50000
    WHEN numero_appart = '501' THEN 25000
    WHEN numero_appart = '502' THEN 60000
    WHEN numero_appart = '503' THEN 60000
    WHEN numero_appart = '504' THEN 50000
    WHEN numero_appart = '602' THEN 50000
    WHEN numero_appart = '603' THEN 50000
    WHEN numero_appart = '604' THEN 50000
END;

SELECT 'Mise à jour BSA terminée avec succès !' AS resultat;
