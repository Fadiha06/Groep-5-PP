const nodemailer = require('nodemailer');

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
    console.log(`[MAIL UITGESCHAKELD] E-mail zou verzonden worden naar: ${naarEmail}`);
    console.log(`[MAIL UITGESCHAKELD] Inhoud (Wachtwoord link): ${link}`);
    /*
    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"EhB StageTool" <noreply@ehb.be>',
        to: naarEmail,
        subject: 'Stel je wachtwoord in — EhB StageTool',
        html: `
            <p>Hallo,</p>
            <p>Er is een account voor je aangemaakt bij de EhB StageTool.</p>
            <p>Klik op de link om je wachtwoord in te stellen:</p>
            <p><a href="${link}">Wachtwoord instellen</a></p>
            <p>Deze link verloopt over 10 minuten.</p>
        `
    });
    */
};

const stuurContractLink = async (naarEmail, link) => {
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