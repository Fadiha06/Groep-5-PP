let geweigerdeDossiers = [];
let huidigeIndex = -1;

const fallbackDossiers = [
    {
        id: "1",
        studentnaam: "Ali Hassan",
        studentnummer: "r0812345",
        bedrijfsnaam: "Freelance opdracht",
        titel: "Algemene IT-ondersteuning",
        startdatum: "2025-09-01T00:00:00.000Z",
        einddatum: "2025-11-28T00:00:00.000Z",
        beoordelaar: "Prof. An Vermeersch",
        beoordelingsDatum: "5 juni 2025",
        opmerking: "Het dossier voldoet niet aan de minimumvereisten voor een erkende stage. De opdracht is te vaag en toont geen link met de leerdoelen van de opleiding."
    }
];

function extracteerDossierData(dossier) {
    console.log("📦 Ruwe dossier-data:", JSON.stringify(dossier, null, 2));

    const kies = (...waarden) => waarden.find(v => v !== undefined && v !== null && v !== '') ?? null;
    const s = dossier.student || dossier.Student || {};

    return {
        id: kies(dossier.stage_id, dossier.id, dossier.ID) ?? "onbekend",

        studentNaam: kies(
            dossier.studentnaam,
            dossier.studentNaam,
            dossier.student_naam,
            s.voornaam && s.achternaam ? `${s.voornaam} ${s.achternaam}` : null,
            s.naam,
            s.name,
            typeof dossier.student === 'string' ? dossier.student : null
        ) ?? "Onbekende student",

        studentNummer: kies(
            dossier.studentnummer,
            dossier.studentNummer,
            dossier.student_nummer,
            s.nummer,
            s.id
        ) ?? "—",

        bedrijfNaam: kies(
            dossier.bedrijfsnaam,
            dossier.bedrijfNaam,
            dossier.bedrijf_naam,
            dossier.bedrijf,
            dossier.company,
            (dossier.bedrijf && typeof dossier.bedrijf === 'object')
                ? (dossier.bedrijf.naam || dossier.bedrijf.name) : null
        ) ?? "—",

        opdrachtTitel: kies(
            dossier.titel,
            dossier.opdrachtTitel,
            dossier.opdracht_titel,
            dossier.title,
            dossier.opdracht
        ) ?? "—",

        periode: kies(
            dossier.startdatum && dossier.einddatum
                ? `${dossier.startdatum.substring(0, 10)} — ${dossier.einddatum.substring(0, 10)}`
                : null,
            dossier.periode,
            dossier.stageperiode,
            dossier.semester
        ) ?? "—",

        beoordelaar: kies(
            dossier.beoordelaar,
            dossier.docent,
            dossier.reviewer,
            dossier.promotor,
            (dossier.docent && typeof dossier.docent === 'object')
                ? (dossier.docent.naam || dossier.docent.name) : null
        ) ?? "Niet toegewezen",

        beoordelingsDatum: kies(
            dossier.beoordelingsDatum,
            dossier.datum,
            dossier.geweigerd_op,
            dossier.reviewDate
        ) ?? "—",

        opmerking: kies(
            dossier.opmerking,
            dossier.feedback,
            dossier.reden,
            dossier.weigeringsreden,
            dossier.commentaar,
            dossier.comment
        ) ?? "Geen reden opgegeven."
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    await laadAlleGeweigerdeDossiers();
    bepaalHuidigDossier();
    stelKnoppenIn();
});

async function laadAlleGeweigerdeDossiers() {
    try {
        if (typeof apiFetch === 'function') {
            const stages = await apiFetch('/stage/all');
            console.log("✅ API-response ontvangen:", stages);

            if (stages && Array.isArray(stages) && stages.length > 0) {
                const gefilterd = stages.filter(dossier => {
                    const status = String(dossier.status || dossier.Status || '').toLowerCase().trim();
                    return status === 'geweigerd' || status === 'rejected' || status === 'afgekeurd';
                });

                if (gefilterd.length > 0) {
                    geweigerdeDossiers = gefilterd;
                    console.log(`✅ ${gefilterd.length} geweigerd(e) dossier(s) geladen.`);
                    return;
                } else {
                    console.warn("⚠️ Geen geweigerde dossiers. Statussen:",
                        [...new Set(stages.map(d => d.status || 'geen status'))]);
                }
            }
        } else {
            console.warn("⚠️ apiFetch niet beschikbaar.");
        }
    } catch (error) {
        console.error("❌ API-fout:", error);
    }

    console.log("ℹ️ Fallback-data ingeladen.");
    geweigerdeDossiers = fallbackDossiers;
}

function bepaalHuidigDossier() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (urlId) {
        huidigeIndex = geweigerdeDossiers.findIndex(d =>
            String(d.stage_id || d.id) === String(urlId)
        );
    }

    if (huidigeIndex === -1) {
        huidigeIndex = 0;
        const eerste = geweigerdeDossiers[0];
        if (eerste) {
            history.replaceState(null, '', `?id=${eerste.stage_id || eerste.id}`);
        }
    }

    const actueel = geweigerdeDossiers[huidigeIndex];
    if (actueel) {
        toonDossierDetails(actueel);
    } else {
        alert("Er zijn momenteel geen geweigerde dossiers beschikbaar.");
        window.location.href = 'commissie_dashboard.html';
    }
}

function toonDossierDetails(ruwDossier) {
    if (!ruwDossier) return;

    const d = extracteerDossierData(ruwDossier);

    const vul = (id, tekst) => {
        const el = document.getElementById(id);
        if (el) el.textContent = tekst;
    };

    vul('student-name', d.studentNaam);
    vul('page-title', `Dossier van ${d.studentNaam}`);
    vul('page-subtitle', 'Dit dossier is geweigerd door de stagecommissie.');
    vul('banner-title', 'Dossier geweigerd');
    vul('banner-desc', `${d.studentNaam} is op de hoogte gesteld met de reden van weigering.`);
    vul('banner-meta', `Geweigerd op ${d.beoordelingsDatum}`);
    vul('info-student', d.studentNaam);
    vul('info-company', d.bedrijfNaam);
    vul('info-assignment', d.opdrachtTitel);
    vul('info-period', d.periode);
    vul('info-reviewer', d.beoordelaar);
    vul('commission-comment', d.opmerking);
    vul('timeline-reden-datum', `Reden verstuurd naar student op ${d.beoordelingsDatum}.`);

    const statusTag = document.getElementById('status-tag');
    if (statusTag) {
        statusTag.textContent = 'Geweigerd';
        statusTag.className = 'status-badge-inline status-badge-inline--geweigerd';
    }

    const infoStatus = document.getElementById('info-status');
    if (infoStatus) {
        infoStatus.textContent = 'Definitief geweigerd';
        infoStatus.className = 'badge badge--danger';
    }

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.textContent = huidigeIndex === geweigerdeDossiers.length - 1
            ? 'Terug naar Dashboard ↩'
            : 'Volgend dossier →';
    }
}

function stelKnoppenIn() {
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'commissie_dashboard.html';
        });
    }

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (huidigeIndex < geweigerdeDossiers.length - 1) {
                huidigeIndex++;
                const volgend = geweigerdeDossiers[huidigeIndex];
                history.pushState(null, '', `?id=${volgend.stage_id || volgend.id}`);
                toonDossierDetails(volgend);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert("Je hebt alle geweigerde dossiers bekeken!");
                window.location.href = 'commissie_dashboard.html';
            }
        });
    }
}