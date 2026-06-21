const nodemailer = require('nodemailer');

let transporter;
nodemailer.createTestAccount().then(account => {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST && process.env.SMTP_HOST !== '127.0.0.1' ? process.env.SMTP_HOST : 'smtp.ethereal.email',
        port: process.env.SMTP_PORT && process.env.SMTP_HOST !== '127.0.0.1' ? Number(process.env.SMTP_PORT) : 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER || account.user,
            pass: process.env.SMTP_PASS || account.pass
        }
    });
    console.log('Nodemailer initialized. Using ' + (process.env.SMTP_HOST || 'Ethereal test mail'));
}).catch(console.error);

const stuurWachtwoordLink = async (naarEmail, link, type = 'account') => {
    console.log(`Verzenden wachtwoord link naar: ${naarEmail}`);
    try {
        if (!transporter) {
            console.warn('Transporter is nog niet geïnitialiseerd.');
            return;
        }

        let onderwerp, html;

        if (type === 'wachtwoord_vergeten') {
            onderwerp = 'Wachtwoord resetten — EhB StageTool';
            html = `
                <p>Hallo,</p>
                <p>Je hebt een verzoek ingediend om je wachtwoord te resetten.</p>
                <p>Klik op de onderstaande link om een nieuw wachtwoord in te stellen:</p>
                <p><a href="${link}">Wachtwoord resetten</a></p>
                <p>Deze link verloopt over 1 uur.</p>
                <p>Als je dit niet zelf was geweest, kan je deze e-mail negeren.</p>
                <p>Met vriendelijke groeten,<br>Erasmushogeschool Brussel</p>
            `;
        } else {
            onderwerp = 'Stel je wachtwoord in — EhB StageTool';
            html = `
                <p>Hallo,</p>
                <p>Er is een account voor je aangemaakt bij de EhB StageTool.</p>
                <p>Klik op de link om je wachtwoord in te stellen:</p>
                <p><a href="${link}">Wachtwoord instellen</a></p>
                <p>Deze link verloopt over 48 uur.</p>
                <p>Met vriendelijke groeten,<br>Erasmushogeschool Brussel</p>
            `;
        }

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EhB StageTool" <noreply@ehb.be>',
            to: naarEmail,
            subject: onderwerp,
            html
        });
        console.log('Wachtwoord mail succesvol verzonden.');
        console.log('Mail preview URL: ' + nodemailer.getTestMessageUrl(info));
    } catch (err) {
        console.error('Fout bij verzenden wachtwoord mail:', err);
    }
};
const stuurContractLink = async (naarEmail, link) => {
    console.log(`Verzenden contract link naar: ${naarEmail}`);
    try {
        if (!transporter) {
            console.warn('Transporter is nog niet geïnitialiseerd.');
            return;
        }
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"EhB StageTool" <noreply@ehb.be>',
            to: naarEmail,
            subject: 'Stagecontract Ondertekenen — EhB StageTool',
            html: `
                <p>Beste stagementor,</p>
                <p>Het stagecontract is goedgekeurd en ondertekend door de student en de school.</p>
                <p>Klik op de onderstaande link om het contract te bekijken en digitaal te ondertekenen:</p>
                <p><a href="${link}">Contract ondertekenen</a></p>
                <p>Met vriendelijke groeten,<br>Erasmushogeschool Brussel</p>
            `
        });
        console.log('Contract mail succesvol verzonden.');
        console.log('Mail preview URL: ' + nodemailer.getTestMessageUrl(info));
    } catch (err) {
        console.error('Fout bij verzenden contract mail:', err);
    }
};

module.exports = { stuurWachtwoordLink, stuurContractLink };
