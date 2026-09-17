export interface SendEmailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string | undefined;
}
export declare const sendEmail: ({ to, subject, text, html }: SendEmailOptions) => Promise<void>;
//# sourceMappingURL=email.d.ts.map