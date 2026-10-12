import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { UsersService } from '../users/users.service';
import { UserDocument, UserRole } from '../users/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const avatar =
      dto.avatarBase64 && dto.avatarMime
        ? { base64: dto.avatarBase64, mime: dto.avatarMime }
        : undefined;
    const user = await this.usersService.createUser(
      dto.email,
      dto.password,
      UserRole.Student,
      dto.name,
      avatar,
      dto.whatsappNumber,
    );
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await this.usersService.validatePassword(user, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  async firebaseMobileLogin(
    firebaseIdToken: string,
    opts?: { displayName?: string; photoUrl?: string },
  ) {
    let decoded: { uid?: string; email?: string; email_verified?: boolean };
    try {
      decoded = await this.firebaseAdmin.verifyIdToken(firebaseIdToken);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        typeof e === 'object' && e !== null && 'code' in e
          ? String((e as { code: unknown }).code)
          : '';
      this.logger.warn(
        `verifyIdToken failed${code ? ` [${code}]` : ''}: ${msg}`,
      );
      throw new UnauthorizedException(
        'Invalid Firebase token (check API service account and same Firebase project as the app).',
      );
    }

    const email = decoded.email;
    const uid = decoded.uid;
    const emailVerified = decoded.email_verified;

    if (!email || !uid) {
      throw new UnauthorizedException(
        'Google sign-in did not return an email or user id; try another account or re-link Google.',
      );
    }
    if (!emailVerified) {
      throw new UnauthorizedException(
        'Google account email is not verified; verify it in Google Account settings and try again.',
      );
    }

    const user = await this.usersService.findOrCreateGoogleStudent({
      email,
      googleSub: uid,
      displayName: opts?.displayName,
      photoUrl: opts?.photoUrl,
    });

    return this.issueTokens(user);
  }

  private async issueTokens(user: UserDocument) {
    const sub = user._id.toString();
    const payload = { sub, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: await this.usersService.summarizeUser(user),
    };
  }
}
