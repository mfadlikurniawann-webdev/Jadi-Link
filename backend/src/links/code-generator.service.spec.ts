import { CodeGeneratorService } from './code-generator.service';
import { SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from './links.constants';

describe('CodeGeneratorService', () => {
  it('always generates 7 characters from the safe alphabet', () => {
    const generator = new CodeGeneratorService();
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = generator.generate();
      expect(code).toHaveLength(SHORT_CODE_LENGTH);
      expect(
        [...code].every((character) => SHORT_CODE_ALPHABET.includes(character)),
      ).toBe(true);
      expect(code).not.toMatch(/[01iloILO]/);
    }
  });
});
