import type { LinkResponseDto } from './link-response.dto';

export class LinkListResponseDto {
  constructor(
    readonly items: LinkResponseDto[],
    readonly page: number,
    readonly limit: number,
    readonly hasNextPage: boolean,
  ) {}
}
