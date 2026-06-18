const nodemailer = require('nodemailer');

const smtpGeconfigureerd = !!process.env.SMTP_HOST;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const stuurWachtwoordLink = async (naarEmail, link) => {
    // Geen SMTP ingesteld? Log de link zodat je lokaal kunt testen.
    if (!smtpGeconfigureerd) {
        console.log(`[MAIL DEV] Wachtwoord-resetlink voor ${naarEmail}: ${link}`);
        return;
    }
    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"EhB StageTool" <noreply@ehb.be>',
        to: naarEmail,
        subject: 'Stel je wachtwoord in — EhB StageTool',
        html: `
            <p>Hallo,</p>
            <p>Er is een verzoek om je wachtwoord opnieuw in te stellen.</p>
            <p>Klik op de link om een nieuw wachtwoord te kiezen:</p>
            <p><a href="${link}">Wachtwoord instellen</a></p>
            <p>Deze link verloopt over 15 minuten.</p>
        `
    });
};

const stuurContractLink = async (naarEmail, link) => {
    if (!smtpGeconfigureerd) {
        console.log(`[MAIL DEV] Contract-tekenlink voor ${naarEmail}: ${link}`);
        return;
    }
    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"EhB StageTool" <noreply@ehb.be>',
        to: naarEmail,
        subject: 'Onderteken het stagecontract — EhB StageTool',
        html: `
            <p>Beste,</p>
            <p>De student heeft het stagecontract ondertekend.</p>
            <p>Klik op de onderstaande link om het contract te bekijken en als mentor te ondertekenen:</p>
            <p><a href="${link}">Contract ondertekenen</a></p>
            <p>Deze link verloopt over 48 uur.</p>
        `
    });
};

module.exports = { stuurWachtwoordLink, stuurContractLink };