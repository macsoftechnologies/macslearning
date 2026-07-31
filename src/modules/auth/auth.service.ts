import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/org.entity';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password, organizationCode } = loginDto;

    let organizationId: string | undefined;
    let organizationSlug: string | undefined;
    let organizationLoginUrl: string | undefined;
    let organizationName: string | undefined;

    let organization: Organization | null = null;
    if (organizationCode) {
      organization = await this.organizationRepository.findOne({
        where: { code: organizationCode.toUpperCase(), isDeleted: false },
      });
      if (!organization) {
        throw new UnauthorizedException('Invalid organization code');
      }
      if (
        organization.subscriptionConfig?.expiresAt &&
        new Date(organization.subscriptionConfig.expiresAt) < new Date()
      ) {
        throw new UnauthorizedException(
          'Organization subscription has expired',
        );
      }
      organizationId = organization.id;
      organizationSlug = organization.slug;
      organizationLoginUrl = organization.loginUrl;
      organizationName = organization.name;
    }

    if (!organizationId) {
      throw new BadRequestException(
        'organizationCode is required for non-super-admin login',
      );
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokens')
      .where('user.email = :email', { email })
      .andWhere('user.organizationId = :organizationId', { organizationId })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.userType === 'SUPER_ADMIN') {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is locked until ${user.lockUntil.toISOString()}`,
      );
    }

    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined as unknown as Date;
      await this.userRepository.save(user);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const maxFailedAttempts =
        this.configService.get<number>('AUTH_MAX_FAILED_ATTEMPTS') || 5;
      const lockDurationMinutes =
        this.configService.get<number>('AUTH_LOCK_DURATION_MINUTES') || 30;

      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= maxFailedAttempts) {
        user.lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined as unknown as Date;
    await this.userRepository.save(user);

    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      organizationId: user.organizationId,
      orgExpiresAt: organization?.subscriptionConfig?.expiresAt,
      regionId: user.regionId,
      permissions: user.modulePermissions,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const refreshDurationMs = this.parseDuration(refreshExpires);

    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { secret: refreshSecret, expiresIn: refreshExpires as any },
    );

    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(refreshToken, salt);

    this.pruneRefreshTokens(user);

    const tokenDoc = {
      tokenId: new Date().getTime().toString(),
      tokenHash,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshDurationMs),
    };

    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    user.refreshTokens.push(tokenDoc);
    await this.userRepository.save(user);

    // Send login notification silently (no await necessary for user flow)
    this.notificationsService
      .createNotification(
        user.organizationId,
        user.id,
        'New Login Detected',
        `Your account was logged in to at ${new Date().toLocaleString()}.`,
        'SYSTEM',
      )
      .catch((e) => console.error('Error sending login notification:', e));

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      organization: {
        code: organizationCode?.toUpperCase(),
        slug: organizationSlug,
        loginUrl: organizationLoginUrl,
        name: organizationName,
      },
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        organizationId: user.organizationId,
        regionId: user.regionId,
        organizationCode: organizationCode?.toUpperCase(),
        organizationSlug,
        organizationLoginUrl,
        organizationName,
        permissions: user.modulePermissions,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.refreshTokens')
        .where('user.id = :id', { id: decoded.userId })
        .getOne();

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User is inactive or not found');
      }

      const previousCount = user.refreshTokens?.length || 0;
      this.pruneRefreshTokens(user);
      if ((user.refreshTokens?.length || 0) !== previousCount) {
        await this.userRepository.save(user);
      }

      let isValidToken = false;
      if (user.refreshTokens?.length) {
        for (const token of user.refreshTokens) {
          if (token.revokedAt) {
            continue;
          }
          const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
          if (isMatch) {
            isValidToken = true;
            break;
          }
        }
      }

      if (!isValidToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      let orgExpiresAt = undefined;
      if (user.organizationId) {
        const org = await this.organizationRepository.findOne({
          where: { id: user.organizationId }
        });
        orgExpiresAt = org?.subscriptionConfig?.expiresAt;
      }

      const payload = {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType,
        organizationId: user.organizationId,
        orgExpiresAt: orgExpiresAt,
        regionId: user.regionId,
        permissions: user.modulePermissions,
      };

      const accessToken = this.jwtService.sign(payload);
      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.refreshTokens')
        .where('user.id = :id', { id: decoded.userId })
        .getOne();

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      let revoked = false;
      if (user.refreshTokens?.length) {
        for (const token of user.refreshTokens) {
          if (token.revokedAt) {
            continue;
          }
          const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);
          if (isMatch) {
            token.revokedAt = new Date();
            revoked = true;
            break;
          }
        }
      }

      if (!revoked) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.pruneRefreshTokens(user);
      await this.userRepository.save(user);
      return { message: 'Logout successful' };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private parseDuration(duration: string): number {
    const matches = /^\s*(\d+)\s*([smhdwMy])\s*$/.exec(duration);
    if (!matches) {
      throw new Error(
        'Invalid duration format for JWT refresh token expiration',
      );
    }

    const value = parseInt(matches[1], 10);
    const unit = matches[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'w':
        return value * 7 * 24 * 60 * 60 * 1000;
      case 'M':
        return value * 30 * 24 * 60 * 60 * 1000;
      case 'y':
      case 'Y':
        return value * 365 * 24 * 60 * 60 * 1000;
      default:
        throw new Error(
          'Unsupported duration unit for JWT refresh token expiration',
        );
    }
  }

  private pruneRefreshTokens(user: User) {
    const now = new Date();
    const maxTokens =
      this.configService.get<number>('JWT_REFRESH_TOKEN_MAX_COUNT') || 10;

    if (!user.refreshTokens?.length) {
      user.refreshTokens = [];
      return;
    }

    user.refreshTokens = user.refreshTokens
      .filter((token: any) => {
        if (token.revokedAt) {
          return false;
        }
        if (!token.expiresAt) {
          return true;
        }
        return new Date(token.expiresAt) > now;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      )
      .slice(0, maxTokens);
  }

  async superAdminLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokens')
      .where('user.email = :email', { email })
      .andWhere('user.userType = :userType', { userType: 'SUPER_ADMIN' })
      .andWhere('user.isDeleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid Super Admin credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid Super Admin credentials');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      organizationId: user.organizationId,
      permissions: user.modulePermissions,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const refreshDurationMs = this.parseDuration(refreshExpires);

    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { secret: refreshSecret, expiresIn: refreshExpires as any },
    );

    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(refreshToken, salt);

    this.pruneRefreshTokens(user);

    const tokenDoc = {
      tokenId: new Date().getTime().toString(),
      tokenHash,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshDurationMs),
    };

    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    user.refreshTokens.push(tokenDoc);
    await this.userRepository.save(user);

    return {
      message: 'Super Admin login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        permissions: user.modulePermissions,
      },
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { old_password, new_password } = changePasswordDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(old_password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Incorrect old password');
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(new_password, salt);
    // Invalidate refresh tokens
    user.refreshTokens = [];

    await this.userRepository.save(user);

    this.notificationsService
      .createNotification(
        user.organizationId,
        user.id,
        'Password Changed',
        'Your password was successfully updated.',
        'SYSTEM',
      )
      .catch((e) =>
        console.error('Error sending password change notification:', e),
      );

    return { message: 'Password changed successfully' };
  }

  async register(registerDto: any) {
    const { email, password, fullName, mobile, organizationCode, regionId } =
      registerDto;
    let { organizationId } = registerDto;

    if (organizationCode && !organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { code: organizationCode.toUpperCase(), isDeleted: false },
      });
      if (!organization) {
        throw new BadRequestException('Invalid organization code');
      }
      organizationId = organization.id;
    }

    if (organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId, isDeleted: false },
      });
      if (!organization) {
        throw new BadRequestException('Invalid organization');
      }
      if (
        organization.subscriptionConfig?.expiresAt &&
        new Date(organization.subscriptionConfig.expiresAt) < new Date()
      ) {
        throw new BadRequestException('Organization subscription has expired');
      }
      if (organization.subscriptionConfig?.maxStudents) {
        const studentCount = await this.userRepository.count({
          where: {
            organizationId: organization.id,
            userType: 'STUDENT',
            isDeleted: false,
          },
        });
        if (studentCount >= organization.subscriptionConfig.maxStudents) {
          throw new BadRequestException('Organization student limit reached');
        }
      }
    }

    if (!organizationId) {
      throw new BadRequestException(
        'Organization is required for registration',
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: { email, organizationId },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      mobile,
      userType: 'STUDENT',
      status: 'PENDING',
      organizationId,
      regionId,
    });

    await this.userRepository.save(user);

    return { message: 'Registration successful. Awaiting admin approval.' };
  }
}
