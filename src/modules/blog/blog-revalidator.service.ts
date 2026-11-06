import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Tells the public Next.js site to refresh its cached blog pages.
 * Set FRONT_REVALIDATE_URL (e.g. https://questnu.bd/api/revalidate) and
 * FRONT_REVALIDATE_SECRET (same value as REVALIDATE_SECRET on the site).
 * Failures are only logged; the site also refreshes on its own every hour.
 */
@Injectable()
export class BlogRevalidatorService {
  private readonly logger = new Logger(BlogRevalidatorService.name);

  constructor(private readonly config: ConfigService) {}

  trigger(): void {
    const url = this.config.get<string>('FRONT_REVALIDATE_URL');
    const secret = this.config.get<string>('FRONT_REVALIDATE_SECRET');
    if (!url || !secret) return;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags: ['blog'] }),
      signal: AbortSignal.timeout(8000),
    })
      .then((res) => {
        if (!res.ok) this.logger.warn(`Site revalidate returned ${res.status}`);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Site revalidate failed: ${msg}`);
      });
  }
}
