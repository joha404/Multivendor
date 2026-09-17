import nodemailer from "nodemailer";
export const sendEmailMessage = async ({ to, subject, message, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USERNAME,
                pass: process.env.GMAIL_PASSWORD,
            },
        });
        const mailOptions = {
            from: process.env.GMAIL_FROM || process.env.GMAIL_USERNAME,
            to,
            subject,
            text: message,
            html,
        };
        const res = await transporter.sendMail(mailOptions);
        console.log(res);
    }
    catch (err) {
        console.error("Email sending error:", err);
        throw new Error("There was an error sending the email. Try again later!");
    }
};
//# sourceMappingURL=nodemilar.js.map