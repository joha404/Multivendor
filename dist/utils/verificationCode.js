import { randomInt } from 'node:crypto';
export const VERIFICATION_CODE_LENGTH = 6;
export const createVerificationCode = () => randomInt(10 ** (VERIFICATION_CODE_LENGTH - 1), 10 ** VERIFICATION_CODE_LENGTH).toString();
//# sourceMappingURL=verificationCode.js.map