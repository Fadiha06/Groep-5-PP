-- Database: Stagebeheer
-- Gebaseerd op het ERD

CREATE TABLE GEBRUIKER (
    id INT AUTO_INCREMENT PRIMARY KEY,
    naam VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    wachtwoord VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL
);

CREATE TABLE BEDRIJF (
    bedrijf_id INT AUTO_INCREMENT PRIMARY KEY,
    naam VARCHAR(255) NOT NULL,
    adres VARCHAR(255),
    stad VARCHAR(100),
    btw_nummer VARCHAR(50),
    telefoon VARCHAR(50),
    email VARCHAR(255),
    sector VARCHAR(100)
);

CREATE TABLE COMPETENTIE (
    competentie_id INT AUTO_INCREMENT PRIMARY KEY,
    naam VARCHAR(255) NOT NULL,
    omschrijving TEXT
);

CREATE TABLE STUDENT (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    studentnummer VARCHAR(50) UNIQUE,
    opleiding VARCHAR(100),
    FOREIGN KEY (gebruiker_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
);

CREATE TABLE DOCENT (
    docent_id INT AUTO_INCREMENT PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    afdeling VARCHAR(100),
    FOREIGN KEY (gebruiker_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
);

CREATE TABLE STAGECOMMISSIE (
    lid_id INT AUTO_INCREMENT PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    FOREIGN KEY (gebruiker_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
);

CREATE TABLE ADMINISTRATIE (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    bevoegdheidsniveau VARCHAR(50),
    FOREIGN KEY (gebruiker_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
);

CREATE TABLE STAGEMENTOR (
    mentor_id INT AUTO_INCREMENT PRIMARY KEY,
    bedrijf_id INT NOT NULL,
    afdeling VARCHAR(100),
    telefoonnummer VARCHAR(50),
    FOREIGN KEY (bedrijf_id) REFERENCES BEDRIJF(bedrijf_id) ON DELETE CASCADE
);

CREATE TABLE RUBRIEK (
    rubriek_id INT AUTO_INCREMENT PRIMARY KEY,
    competentie_id INT NOT NULL,
    punten INT,
    omschrijving TEXT,
    FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
);

CREATE TABLE STAGE (
    stage_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    leerkracht_id INT,
    mentor_id INT,
    bedrijf_id INT,
    lid_id INT,
    titel VARCHAR(255),
    omschrijving TEXT,
    startdatum DATE,
    einddatum DATE,
    status VARCHAR(50) DEFAULT 'in_aanvraag',
    reden_weigering TEXT,
    goedkeuringsdatum DATE,
    FOREIGN KEY (student_id) REFERENCES STUDENT(student_id),
    FOREIGN KEY (leerkracht_id) REFERENCES DOCENT(docent_id),
    FOREIGN KEY (mentor_id) REFERENCES STAGEMENTOR(mentor_id),
    FOREIGN KEY (bedrijf_id) REFERENCES BEDRIJF(bedrijf_id),
    FOREIGN KEY (lid_id) REFERENCES STAGECOMMISSIE(lid_id)
);

CREATE TABLE NOTIFICATIE (
    notificatie_id INT AUTO_INCREMENT PRIMARY KEY,
    gebruiker_id INT NOT NULL,
    stage_id INT,
    titel VARCHAR(255),
    bericht TEXT,
    type VARCHAR(50),
    FOREIGN KEY (gebruiker_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
);

CREATE TABLE LOGBOEK_WEEK (
    week_id INT AUTO_INCREMENT PRIMARY KEY,
    stage_id INT NOT NULL,
    weeknummer INT NOT NULL,
    ingediend_op DATETIME,
    totaal_uren DECIMAL(5,2),
    status VARCHAR(50),
    FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
);

CREATE TABLE LOGBOEK_DAG (
    dag_id INT AUTO_INCREMENT PRIMARY KEY,
    week_id INT NOT NULL,
    stage_id INT NOT NULL,
    datum DATE NOT NULL,
    uren DECIMAL(5,2),
    taken_beschrijving TEXT,
    reflectie TEXT,
    leerpunten TEXT,
    FOREIGN KEY (week_id) REFERENCES LOGBOEK_WEEK(week_id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
);

CREATE TABLE CONTRACT (
    contract_id INT AUTO_INCREMENT PRIMARY KEY,
    stage_id INT NOT NULL,
    aangemaakt_op DATETIME DEFAULT CURRENT_TIMESTAMP,
    inhoud TEXT,
    student_getekend BOOLEAN DEFAULT FALSE,
    mentor_getekend BOOLEAN DEFAULT FALSE,
    leerkracht_getekend BOOLEAN DEFAULT FALSE,
    getekend_op DATETIME,
    FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
);

CREATE TABLE EVALUATIE (
    evaluatie_id INT AUTO_INCREMENT PRIMARY KEY,
    stage_id INT NOT NULL,
    beoordelaar_id INT NOT NULL,
    type VARCHAR(50),
    beoordelaar_rol VARCHAR(50),
    datum DATE,
    feedback TEXT,
    FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE,
    FOREIGN KEY (beoordelaar_id) REFERENCES GEBRUIKER(id)
);

CREATE TABLE LOGBOEK_COMPETENTIE (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dag_id INT NOT NULL,
    student_id INT NOT NULL,
    competentie_id INT NOT NULL,
    commentaar TEXT,
    FOREIGN KEY (dag_id) REFERENCES LOGBOEK_DAG(dag_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
    FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
);

CREATE TABLE EVALUATIE_COMPETENTIE (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluatie_id INT NOT NULL,
    competentie_id INT NOT NULL,
    score INT,
    commentaar TEXT,
    FOREIGN KEY (evaluatie_id) REFERENCES EVALUATIE(evaluatie_id) ON DELETE CASCADE,
    FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
);