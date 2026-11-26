import { getRounds } from 'bcrypt';
import { BCRYPT_ROUNDS, PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with cost 12, a random salt, and never stores plaintext', async () => {
    const password = 'a-strong-test-password';
    const first = await service.hash(password);
    const second = await service.hash(password);

    expect(first).not.toBe(password);
    expect(first).not.toBe(second);
    expect(getRounds(first)).toBe(BCRYPT_ROUNDS);
    await expect(service.verify(password, first)).resolves.toBe(true);
    await expect(service.verify('incorrect-password', first)).resolves.toBe(
      false,
    );
  });
});
