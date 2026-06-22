# Stage Management Applicatie - Evaluatiemodule

## Projectomschrijving
Dit project omvat de ontwikkeling van een wendbare applicatie voor het opvolgen en evalueren van stages (Fase 5: Evaluatie). De kern van de applicatie is een flexibel competentie-gebaseerd evaluatiesysteem. 

Belangrijke functionaliteiten zijn onder andere:
* Dynamisch beheer van competenties (aanpasbaar in aantal, inhoud en gewicht).
* Registratie van tussentijdse besprekingen (feedback en optionele scoring).
* Uitvoeren van finale evaluaties inclusief eindoverzicht per student.
* Grote wendbaarheid om snel te kunnen inspelen op beleidswijzigingen.

## Mappenstructuur
* /src - Bevat de broncode van de applicatie.
* /documentatie - Bevat ondersteunende documenten, waaronder het ERD (Entity Relationship Diagram) en ontwerpschema's.

## Gebruikte Bronnen en Tools
* AI
* FileZilla voor SFTP
* PuTTy voor SSH connectie

### Projectmanagement
* Trello, GitHub, MS Teams

### Frontend, Backend & Database
* Frontend: Vite
* Backend: JavaScript
* API Framework: ExpressJS
* Database: MySQL

### Beveiliging & Authenticatie
* Wachtwoord hashing: Argon2 (https://argon2.online/)
* Anti SQL injection: Web Application Firewall (WAF)
* API Handshakes: Zelfgecodeerde JWT (JSON Web Tokens - RFC 7519)
* Firewall: Handmatig ingestelde firewall

### Hosting & Infrastructuur
* Hosting: Schoolservers VPS
