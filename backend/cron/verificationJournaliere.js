const cron = require('node-cron');
const { query } = require('../config/db');

const lancerVerificationJournaliere = async () => {
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n[CRON] ${new Date().toLocaleString('fr-FR')} — Vérification journalière lancée`);
    try {
        const reservationsActives = await query(`
            SELECT
                r.id_reservation, r.id_client, r.id_appartement,
                r.date_entree, r.date_sortie, r.prix_unitaire, r.montant_total,
                c.avance_paye, c.nom_client,
                a.numero_appart, a.categorie,
                CURRENT_DATE - r.date_entree AS jours_ecoules
            FROM reservation r
            JOIN client c      ON c.id_client  = r.id_client
            JOIN appartement a ON a.id_appart  = r.id_appartement
            WHERE r.statut IN ('en_cours', 'confirmee')
              AND r.date_entree <= CURRENT_DATE`);

        console.log(`[CRON] ${reservationsActives.rows.length} réservation(s) active(s)`);
        let journauxCrees = 0, apportsExpires = 0;

        for (const res of reservationsActives.rows) {
            const joursEcoules  = parseInt(res.jours_ecoules) || 0;
            const montantCumule = joursEcoules * parseFloat(res.prix_unitaire);
            const soldeRestant  = parseFloat(res.avance_paye) - montantCumule;

            await query(`
                INSERT INTO journal_journalier
                    (id_appartement, id_client, id_reservation, date_verif,
                     montant_jour, jours_ecoules, montant_cumule,
                     avance_initiale, solde_restant, statut_appart, notes)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [res.id_appartement, res.id_client, res.id_reservation, today,
                 parseFloat(res.prix_unitaire), joursEcoules, montantCumule,
                 parseFloat(res.avance_paye), soldeRestant, 'loue',
                 `Vérif auto — ${joursEcoules}j à ${res.prix_unitaire} FCFA/j`]
            );
            journauxCrees++;

            await query(`
                UPDATE client SET solde_restant = $1, updated_at = NOW()
                WHERE id_client = $2`, [soldeRestant, res.id_client]);

            if (res.date_sortie && new Date(res.date_sortie) < new Date(today)) {
                await query(`UPDATE reservation SET statut = 'terminee', updated_at = NOW() WHERE id_reservation = $1`, [res.id_reservation]);
                await query(`UPDATE client SET statut = 'sorti', updated_at = NOW() WHERE id_client = $1`, [res.id_client]);
                await query(`UPDATE appartement SET disponible = TRUE WHERE id_appart = $1`, [res.id_appartement]);
                apportsExpires++;
                console.log(`[CRON] Appart ${res.numero_appart} — ${res.nom_client} : séjour terminé`);
            }

            if (soldeRestant < 0) {
                console.warn(`[CRON] ALERTE — ${res.nom_client} (appart ${res.numero_appart}) : solde négatif (${soldeRestant} FCFA)`);
            }
        }

        console.log(`[CRON] Terminé — ${journauxCrees} journal(ux) créé(s), ${apportsExpires} séjour(s) clôturé(s)\n`);
        return { success: true, journauxCrees, apportsExpires };
    } catch (err) {
        console.error('[CRON] ERREUR:', err.message);
        return { success: false, error: err.message };
    }
};

const planifier = () => {
    cron.schedule('0 6 * * *', async () => {
        await lancerVerificationJournaliere();
    }, { timezone: 'Africa/Douala' });
    console.log('[CRON] Vérification journalière planifiée à 06:00 (Africa/Douala)');
};

module.exports = { planifier, lancerVerificationJournaliere };
