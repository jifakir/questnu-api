import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/** Normalize service account private key from .env (Windows / quoted values). */
function normalizeFirebasePrivateKey(raw: string): string {
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  private initIfNeeded(): void {
    if (this.initialized) return;
    if (admin.apps.length) {
      this.initialized = true;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const clientEmail = this.config
      .get<string>('FIREBASE_CLIENT_EMAIL')
      ?.trim();
    const privateKeyRaw = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    const privateKey = privateKeyRaw
      ? normalizeFirebasePrivateKey(privateKeyRaw)
      : '';

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
      );
    }

    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      this.logger.warn(
        'FIREBASE_PRIVATE_KEY does not look like a PEM key after parsing; check .env escaping (use literal \\n, not real line breaks).',
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    this.logger.log(`Firebase Admin initialized (projectId=${projectId})`);
    this.initialized = true;
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    this.initIfNeeded();
    return admin.auth().verifyIdToken(idToken);
  }

  /** Sends a push notification to every device subscribed to `topic`. Returns the FCM message id. */
  async sendToTopic(
    topic: string,
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<string> {
    this.initIfNeeded();
    return admin.messaging().send({
      topic,
      notification,
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'questnu_notices', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  }

  /**
   * Sends the same push to each topic. Returns the first message id; throws
   * if every topic failed, and logs topics that failed when others worked.
   */
  async sendToTopics(
    topics: string[],
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<string> {
    if (topics.length === 1) {
      return this.sendToTopic(topics[0], notification, data);
    }
    this.initIfNeeded();
    const messages: admin.messaging.Message[] = topics.map((topic) => ({
      topic,
      notification,
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'questnu_notices', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    }));
    const ids: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < messages.length; i += 500) {
      const res = await admin.messaging().sendEach(messages.slice(i, i + 500));
      res.responses.forEach((r, j) => {
        if (r.success && r.messageId) ids.push(r.messageId);
        else errors.push(`${topics[i + j]}: ${r.error?.message ?? 'failed'}`);
      });
    }
    if (ids.length === 0) throw new Error(errors.join('; '));
    if (errors.length > 0) {
      this.logger.warn(`Push failed for some topics: ${errors.join('; ')}`);
    }
    return ids[0];
  }
}
