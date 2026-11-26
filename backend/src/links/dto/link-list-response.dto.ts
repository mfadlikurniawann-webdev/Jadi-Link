import { ApiProperty } from '@nestjs/swagger';
import { LinkResponseDto } from './link-response.dto';

export class LinkListResponseDto {
  @ApiProperty({ type: () => [LinkResponseDto] })
  readonly items: LinkResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 1 })
  readonly page: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  readonly limit: number;

  @ApiProperty()
  readonly hasNextPage: boolean;

  constructor(
    items: LinkResponseDto[],
    page: number,
    limit: number,
    hasNextPage: boolean,
  ) {
    this.items = items;
    this.page = page;
    this.limit = limit;
    this.hasNextPage = hasNextPage;
  }
}
