import { BlockList, isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../config/environment';

@Injectable()
export class ClientIdentityService {
  private readonly proxies = new BlockList();

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    for (const entry of config.get('TRUST_PROXY', { infer: true }).split(',')) {
      const [address, prefix] = entry.trim().split('/');
      if (!address || !isIP(address)) continue;
      // Preserve the configured family: an IPv4-mapped IPv6 /128 is not IPv4 /128.
      const family = isIP(address) === 4 ? 'ipv4' : 'ipv6';
      if (prefix === undefined) this.proxies.addAddress(address, family);
      else this.proxies.addSubnet(address, Number(prefix), family);
    }
  }

  getClientIp(request: FastifyRequest): string | null {
    if (this.isTrustedPeer(request)) {
      return (
        this.normalizeIp(request.headers['cf-connecting-ip']) ??
        this.normalizeIp(request.ip)
      );
    }
    // Never let headers or a forged forwarding chain override a direct peer.
    return this.normalizeIp(request.raw.socket.remoteAddress);
  }

  getCountry(request: FastifyRequest): string | null {
    if (
      !this.isTrustedPeer(request) ||
      !this.normalizeIp(request.headers['cf-connecting-ip'])
    ) {
      return null;
    }
    const value = request.headers['cf-ipcountry'];
    if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value)) return null;
    const country = value.toUpperCase();
    return country === 'XX' ? null : country;
  }

  private isTrustedPeer(request: FastifyRequest): boolean {
    const ip = this.normalizeIp(request.raw.socket.remoteAddress);
    return (
      ip !== null && this.proxies.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6')
    );
  }

  private normalizeIp(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const input = value.trim().replace(/^::ffff:(?=\d+\.)/i, '');
    const family = isIP(input);
    if (family === 4) return input;
    if (family === 6) {
      // URL canonicalizes equivalent IPv6 spellings, stabilizing visitor hashes.
      try {
        return new URL(`http://[${input}]`).hostname.slice(1, -1);
      } catch {
        return null;
      }
    }
    return null;
  }
}
