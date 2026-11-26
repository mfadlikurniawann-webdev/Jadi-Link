import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { CreateLinkDto } from './dto/create-link.dto';
import type { LinkListResponseDto } from './dto/link-list-response.dto';
import type { LinkResponseDto } from './dto/link-response.dto';
import { ListLinksQueryDto } from './dto/list-links-query.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { LinksService } from './links.service';

// No @Public(): the global JWT guard protects every endpoint in this controller.
@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLinkDto,
  ): Promise<LinkResponseDto> {
    return this.linksService.create(user.id, dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLinksQueryDto,
  ): Promise<LinkListResponseDto> {
    return this.linksService.findAll(user.id, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<LinkResponseDto> {
    return this.linksService.findOne(user.id, id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLinkDto,
  ): Promise<LinkResponseDto> {
    return this.linksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.linksService.remove(user.id, id);
  }
}
