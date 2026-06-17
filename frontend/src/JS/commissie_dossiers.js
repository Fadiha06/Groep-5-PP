// Alle geladen dossiers bijhouden voor zoeken/filteren
let alleDossiers = [];

document.addEventListener('DOMContentLoaded', () => {
    laadAlleDossiers();

    // Zoekbalk live filteren
    document.getElementById('search-input').addEventListener('input', filterEnToonDossiers);

    // Status dropdown filteren
    document.getElementById('status-filter').addEventListener('change', filterEnToonDossiers);
});

async function laadAlleDossiers() {
    try {
        if (typeof apiFetch !== 'function') {
            console.warn("⚠️ apiFetch niet beschikbaar, fallback wordt gebruikt.");
            alleDossiers = fallbackDossiers();
            filterEnToonDossiers();
            return;
        }

        const stages = await apiFetch('/stage/all');
        console.log("✅ Dossiers ontvangen:", stages);

        // Sidebar badge bijwerken
        const aantalNieuw = stages.filter(s =>
            String(s.status || '').toLowerCase() === 'in_aanvraag'
        ).length;
        document.getElementById('badge-pending').textContent = aantalNieuw;

        alleDossiers = stages;
        filterEnToonDossiers();

    } catch (err) {
        console.error('❌ Fout bij ophalen dossiers:', err);
        alleDossiers = fallbackDossiers();
        filterEnToonDossiers();
    }
}

function filterEnToonDossiers() {
    const zoekterm = document.getElementById('search-input').value.toLowerCase().trim();
    const statusFilter = document.getElementById('status-filter').value.toLowerCase();

    const gefilterd = alleDossiers.filter(dossier => {
        const naam = String(dossier.studentnaam || dossier.studentNaam || '').toLowerCase();
        const bedrijf = String(dossier.bedrijfsnaam || dossier.bedrijfNaam || '').toLowerCase();
        const titel = String(dossier.titel || dossier.opdrachtTitel || '').toLowerCase();
        const status = String(dossier.status || '').toLowerCase();

        const zoekMatch = !zoekterm ||
            naam.includes(zoekterm) ||
            bedrijf.includes(zoekterm) ||
            titel.includes(zoekterm);

        const statusMatch = !statusFilter || status === statusFilter;

        return zoekMatch && statusMatch;
    });

    toonDossiers(gefilterd);
    document.getElementById('counter').textContent = `${gefilterd.length} dossier${gefilterd.length !== 1 ? 's' : ''}`;
}

function toonDossiers(dossiers) {
    const tbody = document.getElementById('dossiers-table-body');

    if (dossiers.length === 0) {
        tbody.innerHTML = '<div class="empty-state">Geen dossiers gevonden.</div>';
        return;
    }

    tbody.innerHTML = '';

    dossiers.forEach(dossier => {
        const id = dossier.stage_id || dossier.id || '';
        const naam = dossier.studentnaam || dossier.studentNaam || '—';
        const bedrijf = dossier.bedrijfsnaam || dossier.bedrijfNaam || '—';
        const titel = dossier.titel || dossier.opdrachtTitel || '—';
        const status = String(dossier.status || '').toLowerCase();

        // Bepaal badge + link naar juiste detailpagina
        let badgeHtml = '';
        let detailPagina = '';

        if (status === 'in_aanvraag') {
            badgeHtml = `<span class="badge badge--pending">Nieuw</span>`;
            detailPagina = `commissie_aanvraag.html?id=${id}`;
        } else if (status === 'goedgekeurd') {
            badgeHtml = `<span class="badge badge--approved">Goedgekeurd</span>`;
            detailPagina = `commissie_goedgekeurd.html?id=${id}`;
        } else if (status === 'geweigerd') {
            badgeHtml = `<span class="badge badge--rejected">Geweigerd</span>`;
            detailPagina = `commissie_geweigerd.html?id=${id}`;
        } else if (status === 'conditie' || status === 'onder conditie' || status === 'aanvaard onder conditie') {
            badgeHtml = `<span class="badge badge--condition">Onder conditie</span>`;
            detailPagina = `commissie_conditie.html?id=${id}`;
        } else if (status === 'actief') {
            badgeHtml = `<span class="badge badge--active">Actief</span>`;
            detailPagina = `commissie_aanvraag.html?id=${id}`;
        } else {
            badgeHtml = `<span class="badge badge--pending">${status || 'Onbekend'}</span>`;
            detailPagina = `commissie_aanvraag.html?id=${id}`;
        }

        const rij = document.createElement('div');
        rij.className = 'table-grid table-row';
        rij.innerHTML = `
            <div class="table-cell">
                <strong>${naam}</strong>
            </div>
            <div class="table-cell">${bedrijf}</div>
            <div class="table-cell">${titel}</div>
            <div class="table-cell">${badgeHtml}</div>
            <div class="table-cell">
                <a href="${detailPagina}" class="btn-view-dossier">Openen →</a>
            </div>
        `;

        tbody.appendChild(rij);
    });
}

// Fallback als de API niet beschikbaar is
function fallbackDossiers() {
    return [
        {
            stage_id: "1",
            studentnaam: "Kevin Janssens",
            bedrijfsnaam: "Inetum-Realdolmen",
            titel: "Cloud Native Microservices Platform",
            status: "goedgekeurd"
        },
        {
            stage_id: "2",
            studentnaam: "Annelies Devos",
            bedrijfsnaam: "Cronos Groep",
            titel: "Integratie van AI chatbots",
            status: "in_aanvraag"
        },
        {
            stage_id: "3",
            studentnaam: "Mohamed El Amri",
            bedrijfsnaam: "Cegeka",
            titel: "Security Audit ERP Systeem",
            status: "geweigerd"
        },
        {
            stage_id: "4",
            studentnaam: "Remi Jacobs",
            bedrijfsnaam: "IBM Belgium",
            titel: "Data-analyse stage",
            status: "conditie"
        }
    ];
}