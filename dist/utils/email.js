import nodemailer from 'nodemailer';
const getTransporter = () => {
    const user = process.env.SMTP_USER ?? process.env.GMAIL_USERNAME;
    const password = process.env.SMTP_PASSWORD ?? process.env.GMAIL_PASSWORD;
    if (!user || !password) {
        throw new Error('Email service is not configured');
    }
    if (process.env.SMTP_HOST) {
        const port = Number(process.env.SMTP_PORT ?? 587);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('SMTP_PORT must be a valid port number');
        }
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user, pass: password },
        });
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass: password },
    });
};
export const sendEmail = async ({ to, subject, text, html }) => {
    const from = process.env.SMTP_FROM ?? process.env.GMAIL_FROM ?? process.env.SMTP_USER ?? process.env.GMAIL_USERNAME;
    if (!from) {
        throw new Error('Email sender is not configured');
    }
    await getTransporter().sendMail({
        from,
        to,
        subject,
        text,
        ...(html !== undefined ? { html } : {}),
    });
};
//# sourceMappingURL=email.js.map