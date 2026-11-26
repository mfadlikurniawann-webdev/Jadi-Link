import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../common/config/environment';
import type {
  PublicUser,
  UserResponseDto,
} from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';

// Valid cost-12 hash for timing equalization; it is not an account credential.
const DUMMY_PASSWORD_HASH =
  '$2b$12$dxP7MXnKKTIdeRNj6BKcWe01vPLZ74TzyPHxMuSODEq/8pNSHVwp2';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.usersService.create(dto.email, passwordHash);
    return this.issueAccessToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findForLogin(dto.email);
    // Always run bcrypt, including when the email does not exist.
    const validPassword = await this.passwordService.verify(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueAccessToken(user);
  }

  getProfile(userId: string): Promise<UserResponseDto> {
    return this.usersService.getProfile(userId);
  }

  private async issueAccessToken(user: PublicUser): Promise<AuthResponseDto> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return new AuthResponseDto(
      accessToken,
      this.config.get('JWT_EXPIRES_IN_SECONDS'),
      user,
    );
  }
}
