let conditieDossiers = [];
let huidigeIndex = -1;

const fallbackDossiers = [
    {
        id: "1",
        studentnaam: "Remi Jacobs",
        studentnummer: "r0812345",
        bedrijfsnaam: "IBM Belgium",
        titel: "Data-analyse stage",
        startdatum: "2025-09-02T00:00:00.000Z",
        einddatum: "2025-12-01T00:00:00.000Z",
        beoordelaar: "Prof. An Vermeersch",
        beoordelingsDatum: "5 juni 2025",
        deadline: "12 juni 2025",
        opmerking: "De omschrijving van de stageopdracht is te vaag. Gelieve concreet te vermelden welke Python-bibliotheken gebruikt worden, welke datasets geanalyseerd worden en wat het eindresultaat van de analyse moet zijn."
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
            dossier.reviewDate
        ) ?? "—",

        deadline: kies(
            dossier.deadline,
            dossier.aanpassingsdeadline,
            dossier.aanpassing_deadline,
            dossier.conditie_deadline
        ) ?? "—",

        opmerking: kies(
            dossier.opmerking,
            dossier.feedback,
            dossier.aanpassing,
            dossier.gevraagde_aanpassing,
            dossier.conditie,
            dossier.commentaar,
            dossier.comment
        ) ?? "Geen aanpassing opgegeven."
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    await laadAlleConditieDossiers();
    bepaalHuidigDossier();
    stelKnoppenIn();
});

async function laadAlleConditieDossiers() {
    try {
        if (typeof apiFetch === 'function') {
            const stages = await apiFetch('/stage/all');
            console.log("✅ API-response ontvangen:", stages);

            if (stages && Array.isArray(stages) && stages.length > 0) {
                const gefilterd = stages.filter(dossier => {
                    const status = String(dossier.status || dossier.Status || '').toLowerCase().trim();
                    return status === 'onder conditie' ||
                           status === 'conditie' ||
                           status === 'aanvaard onder conditie' ||
                           status === 'conditional' ||
                           status === 'onder_conditie';
                });

                if (gefilterd.length > 0) {
                    conditieDossiers = gefilterd;
                    console.log(`✅ ${gefilterd.length} conditie-dossier(s) geladen.`);
                    return;
                } else {
                    console.warn("⚠️ Geen conditie-dossiers. Statussen:",
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
    conditieDossiers = fallbackDossiers;
}

function bepaalHuidigDossier() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (urlId) {
        huidigeIndex = conditieDossiers.findIndex(d =>
            String(d.stage_id || d.id) === String(urlId)
        );
    }

    if (huidigeIndex === -1) {
        huidigeIndex = 0;
        const eerste = conditieDossiers[0];
        if (eerste) {
            history.replaceState(null, '', `?id=${eerste.stage_id || eerste.id}`);
        }
    }

    const actueel = conditieDossiers[huidigeIndex];
    if (actueel) {
        toonDossierDetails(actueel);
    } else {
        alert("Er zijn momenteel geen dossiers onder conditie beschikbaar.");
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
    vul('page-subtitle', `Beslissing genomen op ${d.beoordelingsDatum} door ${d.beoordelaar}.`);
    vul('banner-title', 'Aanvaard onder conditie');
    vul('banner-desc', `${d.studentNaam} moet het dossier aanpassen. Deadline: ${d.deadline}.`);
    vul('info-student', d.studentNaam);
    vul('info-company', d.bedrijfNaam);
    vul('info-assignment', d.opdrachtTitel);
    vul('info-period', d.periode);
    vul('info-reviewer', d.beoordelaar);
    vul('info-deadline', d.deadline);
    vul('commission-comment', d.opmerking);
    vul('timeline-meegedeeld', `Student verwittigd op ${d.beoordelingsDatum}.`);
    vul('timeline-deadline', `Deadline: ${d.deadline} — wachtend`);

    const statusTag = document.getElementById('status-tag');
    if (statusTag) {
        statusTag.textContent = 'Onder conditie';
        statusTag.className = 'status-badge-inline status-badge-inline--conditie';
    }

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.textContent = huidigeIndex === conditieDossiers.length - 1
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
            if (huidigeIndex < conditieDossiers.length - 1) {
                huidigeIndex++;
                const volgend = conditieDossiers[huidigeIndex];
                history.pushState(null, '', `?id=${volgend.stage_id || volgend.id}`);
                toonDossierDetails(volgend);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert("Je hebt alle conditie-dossiers bekeken!");
                window.location.href = 'commissie_dashboard.html';
            }
        });
    }
}