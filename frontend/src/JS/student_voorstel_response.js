// Stepper configuratie per status
const STEPPER_CONFIG = {
  in_behandeling: {
    info_status: { text: "In behandeling", kleur: "#1A3C6E" },
    dots: ["active-blue", null, null, null, null],
    labels: ["active", null, null, null, null],
    badges: [{ text: "In proces", cls: "badge-in-proces" }, null, null, null, null],
  },
  goedgekeurd: {
    info_status: { text: "Goedgekeurd", kleur: "#27AE60" },
    dots: ["done", "active-green", null, null, null],
    labels: ["done", "active", null, null, null],
    badges: [
      { text: "Voltooid", cls: "badge-voltooid" },
      { text: "In proces", cls: "badge-in-proces" },
      null, null, null
    ],
  },
  afgekeurd: {
    info_status: { text: "Afgekeurd", kleur: "#8B2020" },
    dots: ["done", "active-red", null, null, null],
    labels: ["done", "active", null, null, null],
    badges: [
      { text: "Ingediend", cls: "badge-voltooid" },
      { text: "Afgekeurd", cls: "badge-afgekeurd" },
      { text: "Geblokkeerd", cls: "badge-geblokkeerd" },
      { text: "Geblokkeerd", cls: "badge-geblokkeerd" },
      { text: "Geblokkeerd", cls: "badge-geblokkeerd" },
    ],
  },
  onder_conditie: {
    info_status: { text: "Onder conditie", kleur: "#7A4F0A" },
    dots: ["active-orange", null, null, null, null],
    labels: ["active", null, null, null, null],
    badges: [
      { text: "Onder conditie", cls: "badge-onder-conditie" },
      null, null, null, null
    ],
  },
};

var STATUS = "in_behandeling";
var STEPPER_STEP = 1;

function formatDatum(d) {
  if (!d) return "-";
  var s = d.split("T")[0];
  var parts = s.split("-");
  if (parts.length === 3) return parts[2] + "/" + parts[1] + "/" + parts[0];
  return s;
}

function vulField(id, waarde) {
  var el = document.getElementById(id);
  if (el) el.textContent = waarde || "-";
}

function getStepperConfig() {
  if (STATUS !== "goedgekeurd") {
    return STEPPER_CONFIG[STATUS];
  }

  var config = {
    info_status: { text: "Goedgekeurd", kleur: "#27AE60" },
    dots: [],
    labels: [],
    badges: [],
  };

  for (var i = 1; i <= 5; i++) {
    if (i < STEPPER_STEP) {
      config.dots.push("done");
      config.labels.push("done");
      config.badges.push({ text: "Voltooid", cls: "badge-voltooid" });
    } else if (i === STEPPER_STEP) {
      config.dots.push("active-blue");
      config.labels.push("active");
      config.badges.push({ text: "In proces", cls: "badge-in-proces" });
    } else {
      config.dots.push(null);
      config.labels.push(null);
      config.badges.push(null);
    }
  }

  return config;
}

function render() {
  ["in_behandeling", "goedgekeurd", "afgekeurd", "onder_conditie"].forEach(function(s) {
    var block = document.getElementById("block-" + s);
    var banner = document.getElementById("banner-" + s);
    if (block) block.style.display = "none";
    if (banner) banner.style.display = "none";
  });

  var block = document.getElementById("block-" + STATUS);
  var banner = document.getElementById("banner-" + STATUS);
  if (block) block.style.display = "block";
  if (banner) banner.style.display = "inline-flex";

  var cfg = getStepperConfig();
  var infoStatus = document.getElementById("info-status");
  if (infoStatus) {
    infoStatus.textContent = cfg.info_status.text;
    infoStatus.style.color = cfg.info_status.kleur;
    infoStatus.style.fontWeight = "700";
  }

  for (var i = 1; i <= 5; i++) {
    var dot = document.getElementById("dot-" + i);
    var label = document.getElementById("label-" + i);
    var badge = document.getElementById("badge-" + i);
    if (!dot) continue;

    dot.className = "step-circle";
    label.className = "step-label";
    badge.textContent = "";
    badge.className = "step-badge";

    var dotCls = cfg.dots[i - 1];
    var labelCls = cfg.labels[i - 1];
    var badgeCfg = cfg.badges[i - 1];

    if (dotCls) dot.classList.add(dotCls);
    dot.textContent = (dotCls === "done") ? "\u2713" : String(i);
    if (labelCls) label.classList.add(labelCls);
    if (badgeCfg) {
      badge.textContent = badgeCfg.text;
      badge.classList.add(badgeCfg.cls);
    }
  }
}

async function init() {
  try {
    if (typeof requireAuth === "function") requireAuth("student");

    var data = await apiFetch("/stage/my-stage?_t=" + Date.now());

    if (!data || !data.stage) {
      STATUS = "in_behandeling";
      render();
      return;
    }

    var s = data.stage;

    // Info-kaart bovenaan
    vulField("info-bedrijf", s.bedrijfsnaam);
    vulField("info-datum", formatDatum(s.startdatum));

    // Gemeenschappelijke velden voor alle blokken
    var periode = s.startdatum && s.einddatum
      ? formatDatum(s.startdatum) + " \u2013 " + formatDatum(s.einddatum)
      : "-";
    var mentorNaam = s.mentorNaam || s.mentor_naam || "-";

    // In behandeling blok
    vulField("ib-bedrijf", s.bedrijfsnaam);
    vulField("ib-mentor", mentorNaam);
    vulField("ib-periode", periode);
    vulField("ib-opdracht", s.omschrijving ? s.omschrijving.substring(0, 80) + (s.omschrijving.length > 80 ? "..." : "") : "-");
    vulField("ib-datum", formatDatum(s.startdatum));

    // Goedgekeurd blok
    vulField("gk-bedrijf", s.bedrijfsnaam);
    vulField("gk-mentor", mentorNaam);
    vulField("gk-periode", periode);
    vulField("gk-opdracht", s.omschrijving || "-");
    vulField("gk-datum", formatDatum(s.startdatum));
    // Docent/begeleider ophalen via apiFetch (optioneel - kan ontbreken in stage response)
    try {
      var contractData = await apiFetch("/contracten/mijn");
      if (contractData && contractData.docent_naam) {
        vulField("gk-docent", contractData.docent_naam);
      }
    } catch (e) {}

    // Bepaal STATUS op basis van stage.status
    var st = s.status;
    if (st === "geweigerd") {
      STATUS = "afgekeurd";
      if (s.reden_weigering) {
        vulField("info-reden-afgekeurd", "");
        var el = document.getElementById("info-reden-afgekeurd");
        if (el) el.innerHTML = "<strong>Reden afkeuring:</strong><br>" + s.reden_weigering;
      }
      vulField("afg-datum", formatDatum(s.startdatum));
    } else if (st === "conditie") {
      STATUS = "onder_conditie";
      if (s.reden_weigering) {
        var el2 = document.getElementById("info-reden-conditie");
        if (el2) el2.innerHTML = "<strong>Conditie(s):</strong><br>" + s.reden_weigering;
      }
    } else if (st === "goedgekeurd" || st === "actief") {
      STATUS = "goedgekeurd";

      // Bepaal STEPPER_STEP op basis van contract- en evaluatiestatus
      STEPPER_STEP = 3;

      try {
        var contractInfo = await apiFetch("/contracten/mijn");
        var alleGetekend = contractInfo && contractInfo.student_getekend && contractInfo.mentor_getekend && contractInfo.docent_getekend;

        if (!alleGetekend) {
          STEPPER_STEP = 3;
        } else {
          STEPPER_STEP = 4;
          try {
            var evalTussentijds = await apiFetch("/evaluatie/concept?stage_id=" + s.stage_id + "&type=tussentijds");
            if (evalTussentijds && evalTussentijds.evaluatie && evalTussentijds.evaluatie.definitief) {
              STEPPER_STEP = 5;
              try {
                var evalFinaal = await apiFetch("/evaluatie/concept?stage_id=" + s.stage_id + "&type=finaal");
                if (evalFinaal && evalFinaal.evaluatie && evalFinaal.evaluatie.definitief) {
                  STEPPER_STEP = 5;
                }
              } catch (e2) {}
            }
          } catch (e) {}
        }
      } catch (e) {
        STEPPER_STEP = 3;
      }
    } else {
      STATUS = "in_behandeling";
    }

    render();

    // Volgende stap-balk tonen op basis van STEPPER_STEP
    var nextContract = document.getElementById("gk-next-contract");
    var nextEvaluatie = document.getElementById("gk-next-evaluatie");
    if (nextContract && nextEvaluatie) {
      if (STATUS === "goedgekeurd" && STEPPER_STEP >= 4) {
        nextContract.style.display = "none";
        nextEvaluatie.style.display = "flex";
      } else if (STATUS === "goedgekeurd") {
        nextContract.style.display = "flex";
        nextEvaluatie.style.display = "none";
      }
    }
  } catch (error) {
    console.error(error);
    render();
  }
}

init();
