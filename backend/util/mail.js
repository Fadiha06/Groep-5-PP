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

async function stuurContractLink(naar, link) {
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: naar,
        subject: 'Stagecontract ondertekenen — EhB StageTool',
        html: `
            <p>Beste,</p>
            <p>De student heeft het stagecontract ondertekend. Gelieve het na te lezen en digitaal te ondertekenen via onderstaande link:</p>
            <p><a href="${link}">Contract ondertekenen</a></p>
            <p>Deze link is 48 uur geldig.</p>
            <p>Met vriendelijke groeten,<br>EhB StageTool</p>
        `
    });
}

module.exports = { stuurContractLink };