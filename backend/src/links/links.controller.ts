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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { CreateLinkDto } from './dto/create-link.dto';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { LinkListResponseDto } from './dto/link-list-response.dto';
import { LinkResponseDto } from './dto/link-response.dto';
import { ListLinksQueryDto } from './dto/list-links-query.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { LinksService } from './links.service';

// No @Public(): the global JWT guard protects every endpoint in this controller.
@Controller('links')
@ApiTags('Links')
@ApiBearerAuth('access-token')
@ApiErrors(401, 429, 500)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a short link',
    description:
      'Optional immutable alias; otherwise a 7-character code. Codes retry up to five collisions.',
  })
  @ApiCreatedResponse({ type: LinkResponseDto })
  @ApiErrors(400, 409, 503)
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLinkDto,
  ): Promise<LinkResponseDto> {
    return this.linksService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List your links',
    description:
      'Newest first. Reads at most limit + 1 rows; no total-count query.',
  })
  @ApiOkResponse({ type: LinkListResponseDto })
  @ApiErrors(400)
  @Header('Cache-Control', 'no-store')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLinksQueryDto,
  ): Promise<LinkListResponseDto> {
    return this.linksService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an owned link',
    description: 'Another owner and a nonexistent UUID both return 404.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Link UUID, not the short code.',
  })
  @ApiOkResponse({ type: LinkResponseDto })
  @ApiErrors(400, 404)
  @Header('Cache-Control', 'no-store')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<LinkResponseDto> {
    return this.linksService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an owned link',
    description:
      'At least one field required. Code/alias and owner are immutable. Null expiresAt removes expiration.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LinkResponseDto })
  @ApiErrors(400, 404)
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLinkDto,
  ): Promise<LinkResponseDto> {
    return this.linksService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an owned link',
    description: 'Associated clicks are deleted by database cascade.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted; empty response body.' })
  @ApiErrors(400, 404)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.linksService.remove(user.id, id);
  }
}
