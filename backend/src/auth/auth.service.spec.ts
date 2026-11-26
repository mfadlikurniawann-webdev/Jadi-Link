import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { instanceToPlain } from 'class-transformer';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthService', () => {
  let service: AuthService;
  const publicUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const privateUser = { ...publicUser, passwordHash: 'stored-hash' };
  const credentials = {
    email: publicUser.email,
    password: 'strong-password-123',
  };
  const users = {
    create: jest.fn(),
    findForLogin: jest.fn(),
    getProfile: jest.fn(),
  };
  const passwords = { hash: jest.fn(), verify: jest.fn() };
  const jwt = { signAsync: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    users.create.mockResolvedValue(publicUser);
    users.findForLogin.mockResolvedValue(privateUser);
    passwords.hash.mockResolvedValue('new-password-hash');
    passwords.verify.mockResolvedValue(true);
    jwt.signAsync.mockResolvedValue('signed-access-token');
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PasswordService, useValue: passwords },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => 900 } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('hashes before persisting registration and signs only a subject', async () => {
    const response = await service.register(credentials);
    expect(passwords.hash).toHaveBeenCalledWith(credentials.password);
    expect(users.create).toHaveBeenCalledWith(
      credentials.email,
      'new-password-hash',
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: publicUser.id });
    expect(response).toMatchObject({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: publicUser,
    });
  });

  it('propagates registration conflicts and never signs a token', async () => {
    users.create.mockRejectedValue(new ConflictException());
    await expect(service.register(credentials)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('logs in without exposing the hash in the response or serialization', async () => {
    const response = await service.login(credentials);
    expect(passwords.verify).toHaveBeenCalledWith(
      credentials.password,
      privateUser.passwordHash,
    );
    expect(Object.keys(response.user).sort()).toEqual([
      'createdAt',
      'email',
      'id',
    ]);
    expect(JSON.stringify(instanceToPlain(response))).not.toContain(
      'passwordHash',
    );
  });

  it('rejects an incorrect password', async () => {
    passwords.verify.mockResolvedValue(false);
    await expect(service.login(credentials)).rejects.toEqual(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('runs a dummy comparison even for a nonexistent account', async () => {
    users.findForLogin.mockResolvedValue(null);
    // Even if the dummy password happened to match, a missing user cannot log in.
    passwords.verify.mockResolvedValue(true);
    await expect(service.login(credentials)).rejects.toEqual(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(passwords.verify).toHaveBeenCalledWith(
      credentials.password,
      expect.stringMatching(/^\$2b\$12\$/),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('gets the profile through UsersService', async () => {
    users.getProfile.mockResolvedValue(new UserResponseDto(publicUser));
    await expect(service.getProfile(publicUser.id)).resolves.toEqual(
      publicUser,
    );
    expect(users.getProfile).toHaveBeenCalledWith(publicUser.id);
  });
});
