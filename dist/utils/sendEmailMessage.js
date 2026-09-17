import { sendEmail } from './email.js';
const createVerificationEmail = (verificationCode) => ({
    text: `Your email verification code is ${verificationCode}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `
    <div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;color:#222">
      <h2>Email verification</h2>
      <p>Use this code to finish creating your account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px">${verificationCode}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>`,
});
export const sendEmailMessage = async ({ to, subject, message, html, verificationCode, }) => {
    const verificationEmail = verificationCode ? createVerificationEmail(verificationCode) : undefined;
    await sendEmail({
        to,
        subject,
        text: message ?? verificationEmail?.text ?? '',
        html: html ?? verificationEmail?.html,
    });
};
//# sourceMappingURL=sendEmailMessage.js.map