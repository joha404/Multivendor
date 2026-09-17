import { randomInt } from 'node:crypto';

export const VERIFICATION_CODE_LENGTH = 6;

export const createVerificationCode = (): string =>
  randomInt(10 ** (VERIFICATION_CODE_LENGTH - 1), 10 ** VERIFICATION_CODE_LENGTH).toString();
