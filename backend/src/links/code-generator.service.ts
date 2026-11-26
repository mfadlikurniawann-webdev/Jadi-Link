import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from './links.constants';

@Injectable()
export class CodeGeneratorService {
  private readonly generateCode = customAlphabet(
    SHORT_CODE_ALPHABET,
    SHORT_CODE_LENGTH,
  );

  generate(): string {
    // nanoid uses crypto randomness, not Math.random.
    return this.generateCode();
  }
}
