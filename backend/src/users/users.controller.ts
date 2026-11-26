import { Controller, Get, Header } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import type { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.usersService.getProfile(user.id);
  }
}
