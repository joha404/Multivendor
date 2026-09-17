export interface SendEmailMessageOptions {
    to: string;
    subject: string;
    message?: string;
    html?: string;
    verificationCode?: string;
}
export declare const sendEmailMessage: ({ to, subject, message, html, verificationCode, }: SendEmailMessageOptions) => Promise<void>;
//# sourceMappingURL=sendEmailMessage.d.ts.map