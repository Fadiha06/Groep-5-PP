let goedgekeurdeDossiers = [];
let huidigeIndex = -1;

const fallbackDossiers = [
    {
        id: "1",
        studentnaam: "Kevin Janssens",
        studentNummer: "r0812345",
        bedrijfsnaam: "Inetum-Realdolmen",
        titel: "Ontwikkeling van een Cloud Native Microservices Platform",
        periode: "Academiejaar 2025-2026 (Semester 2)",
        beoordelaar: "Lars de Wilde",
        beoordelingsDatum: "15 Mei 2026",
        opmerking: "Uitstekend dossier."
    },
    {
        id: "2",
        studentnaam: "Annelies Devos",
        studentNummer: "r0745612",
        bedrijfsnaam: "Cronos Groep",
        titel: "Integratie van AI chatbots in klantendatabases",
        periode: "Academiejaar 2025-2026 (Semester 2)",
        beoordelaar: "Sofie Peeters",
        beoordelingsDatum: "28 Mei 2026",
        opmerking: "Goed onderbouwd voorstel."
    },
    {
        id: "3",
        studentnaam: "Mohamed El Amri",
        studentNummer: "r0911223",
        bedrijfsnaam: "Cegeka",
        titel: "Security Audit van een Enterprise ERP Systeem",
        periode: "Academiejaar 2025-2026 (Semester 2)",
        beoordelaar: "Lars de Wilde",
        beoordelingsDatum: "02 Juni 2026",
        opmerking: "Sterk risico-analyse plan."
    }
];

function extracteerDossierData(dossier) {
    console.log("📦 Ruwe dossier-data van API/fallback:", JSON.stringify(dossier, null, 2));

    const kies = (...waarden) => waarden.find(v => v !== undefined && v !== null && v !== '') ?? null;

    const s = dossier.student || dossier.Student || {};

    return {
        id: kies(dossier.stage_id, dossier.id, dossier.ID, dossier.stageId) ?? "onbekend",

        studentNaam: kies(
            dossier.studentnaam,        // ← jouw database gebruikt dit
            dossier.studentNaam,
            dossier.student_naam,
            dossier.naam,
            dossier.name,
            s.voornaam && s.achternaam ? `${s.voornaam} ${s.achternaam}` : null,
            s.naam,
            s.name,
            typeof dossier.student === 'string' ? dossier.student : null
        ) ?? "Onbekende student",

        studentNummer: kies(
            dossier.studentnummer,      // ← lowercase variant eerst
            dossier.studentNummer,
            dossier.student_nummer,
            dossier.studentId,
            dossier.student_id,
            s.nummer,
            s.id
        ) ?? "—",

        bedrijfNaam: kies(
            dossier.bedrijfsnaam,       // ← jouw database gebruikt dit
            dossier.bedrijfNaam,
            dossier.bedrijf_naam,
            dossier.bedrijf,
            dossier.company,
            dossier.companyName,
            (dossier.bedrijf && typeof dossier.bedrijf === 'object')
                ? (dossier.bedrijf.naam || dossier.bedrijf.name) : null
        ) ?? "—",

        opdrachtTitel: kies(
            dossier.titel,              // ← jouw database gebruikt dit
            dossier.opdrachtTitel,
            dossier.opdracht_titel,
            dossier.title,
            dossier.opdracht,
            dossier.assignment
        ) ?? "—",

        periode: kies(
            dossier.startdatum && dossier.einddatum
                ? `${dossier.startdatum.substring(0,10)} — ${dossier.einddatum.substring(0,10)}`
                : null,                 // ← jouw database heeft startdatum/einddatum
            dossier.periode,
            dossier.stageperiode,
            dossier.semester,
            dossier.schooljaar
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
            dossier.goedgekeurd_op,
            dossier.reviewDate
        ) ?? "—",

        opmerking: kies(
            dossier.opmerking,
            dossier.feedback,
            dossier.commentaar,
            dossier.comment
        ) ?? "Geen opmerkingen geplaatst."
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    await laadAlleGoedgekeurdeDossiers();
    bepaalHuidigDossier();
    stelKnoppenIn();
});

async function laadAlleGoedgekeurdeDossiers() {
    try {
        if (typeof apiFetch === 'function') {
            const stages = await apiFetch('/stage/all');
            console.log("✅ API-response ontvangen:", stages);

            if (stages && Array.isArray(stages) && stages.length > 0) {
                const gefilterd = stages.filter(dossier => {
                    const status = String(dossier.status || dossier.Status || '').toLowerCase().trim();
                    return status === 'goedgekeurd' || status === 'approved';
                });

                if (gefilterd.length > 0) {
                    goedgekeurdeDossiers = gefilterd;
                    console.log(`✅ ${gefilterd.length} goedgekeurd(e) dossier(s) geladen uit database.`);
                    return;
                } else {
                    console.warn("⚠️ Geen goedgekeurde dossiers. Statussen in database:",
                        [...new Set(stages.map(d => d.status || 'geen status'))]);
                }
            } else {
                console.warn("⚠️ API gaf een lege array terug.");
            }
        } else {
            console.warn("⚠️ apiFetch is niet beschikbaar.");
        }
    } catch (error) {
        console.error("❌ Fout bij ophalen API-data:", error);
    }

    console.log("ℹ️ Fallback-data ingeladen.");
    goedgekeurdeDossiers = fallbackDossiers;
}

function bepaalHuidigDossier() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (urlId) {
        huidigeIndex = goedgekeurdeDossiers.findIndex(d =>
            String(d.stage_id || d.id) === String(urlId)
        );
    }

    if (huidigeIndex === -1) {
        huidigeIndex = 0;
        const eerste = goedgekeurdeDossiers[0];
        if (eerste) {
            history.replaceState(null, '', `?id=${eerste.stage_id || eerste.id}`);
        }
    }

    const actueel = goedgekeurdeDossiers[huidigeIndex];
    if (actueel) {
        toonDossierDetails(actueel);
    } else {
        alert("Er zijn momenteel geen goedgekeurde dossiers beschikbaar.");
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
    vul('page-subtitle', 'Dit dossier is succesvol verwerkt en goedgekeurd.');

    const statusTag = document.getElementById('status-tag');
    if (statusTag) {
        statusTag.textContent = 'Goedgekeurd';
        statusTag.className = 'status-badge-inline status-badge-inline--goedgekeurd';
    }

    const banner = document.getElementById('status-banner');
    if (banner) banner.className = 'status-banner status-banner--success';
    vul('banner-icon', '✓');
    vul('banner-title', 'Aanvraag Goedgekeurd');
    vul('banner-meta', `Beoordeeld op ${d.beoordelingsDatum}`);

    vul('student-naam', d.studentNaam);
    vul('student-nummer', d.studentNummer);

    vul('info-student', d.studentNaam);
    vul('info-company', d.bedrijfNaam);
    vul('info-assignment', d.opdrachtTitel);
    vul('info-period', d.periode);
    vul('info-reviewer', d.beoordelaar);

    const infoStatus = document.getElementById('info-status');
    if (infoStatus) {
        infoStatus.textContent = 'Goedgekeurd';
        infoStatus.className = 'badge badge--success';
    }

    vul('commission-comment', d.opmerking);

    const timeline = document.getElementById('timeline');
    if (timeline) {
        timeline.innerHTML = `
            <div class="timeline-item timeline-item--completed">
                <div class="timeline-badge">✓</div>
                <div class="timeline-panel">
                    <h4>Dossier Ingediend</h4>
                    <p>Student heeft het voorstel vervolledigd.</p>
                </div>
            </div>
            <div class="timeline-item timeline-item--completed">
                <div class="timeline-badge">✓</div>
                <div class="timeline-panel">
                    <h4>Goedgekeurd door Commissie</h4>
                    <p>Beoordeeld door ${d.beoordelaar}.</p>
                </div>
            </div>
            <div class="timeline-item timeline-item--current">
                <div class="timeline-badge">→</div>
                <div class="timeline-panel">
                    <h4>Contract Genereren</h4>
                    <p>De administratie start de opmaak van de stageovereenkomst.</p>
                </div>
            </div>
        `;
    }

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
        nextBtn.textContent = huidigeIndex === goedgekeurdeDossiers.length - 1
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
            if (huidigeIndex < goedgekeurdeDossiers.length - 1) {
                huidigeIndex++;
                const volgend = goedgekeurdeDossiers[huidigeIndex];
                history.pushState(null, '', `?id=${volgend.stage_id || volgend.id}`);
                toonDossierDetails(volgend);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                alert("Je hebt alle goedgekeurde dossiers bekeken!");
                window.location.href = 'commissie_dashboard.html';
            }
        });
    }
}