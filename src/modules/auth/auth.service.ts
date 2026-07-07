import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Organization, OrganizationDocument } from '../organizations/schemas/org.schema';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
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

    let organization: OrganizationDocument | null = null;
    if (organizationCode) {
      organization = await this.organizationModel.findOne({ code: organizationCode.toUpperCase(), isDeleted: false }).lean();
      if (!organization) {
        throw new UnauthorizedException('Invalid organization code');
      }
      if (organization.subscriptionConfig?.expiresAt && new Date(organization.subscriptionConfig.expiresAt) < new Date()) {
        throw new UnauthorizedException('Organization subscription has expired');
      }
      organizationId = organization._id.toString();
      organizationSlug = organization.slug;
      organizationLoginUrl = organization.loginUrl;
      organizationName = organization.name;
    }

    if (!organizationId) {
      throw new BadRequestException('organizationCode is required for non-super-admin login');
    }

    const user = await this.userModel.findOne({ email, organizationId, isDeleted: false }).select('+passwordHash +refreshTokens');

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
      throw new UnauthorizedException(`Account is locked until ${user.lockUntil.toISOString()}`);
    }

    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.failedLoginAttempts = 0;
      user.set('lockUntil', undefined);
      await user.save();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const maxFailedAttempts = this.configService.get<number>('AUTH_MAX_FAILED_ATTEMPTS') || 5;
      const lockDurationMinutes = this.configService.get<number>('AUTH_LOCK_DURATION_MINUTES') || 30;

      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= maxFailedAttempts) {
        user.lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
      }
      await user.save();
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.set('lockUntil', undefined);
    await user.save();

    const payload = {
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      organizationId: user.organizationId,
      regionId: user.regionId,
      permissions: user.modulePermissions,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const refreshDurationMs = this.parseDuration(refreshExpires);

    const refreshToken = this.jwtService.sign(
      { userId: user._id },
      { secret: refreshSecret, expiresIn: refreshExpires as any }
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

    user.refreshTokens.push(tokenDoc);
    await user.save();

    // Send login notification silently (no await necessary for user flow)
    this.notificationsService.createNotification(
      user.organizationId.toString(),
      user._id.toString(),
      'New Login Detected',
      `Your account was logged in to at ${new Date().toLocaleString()}.`,
      'SYSTEM'
    ).catch(e => console.error('Error sending login notification:', e));

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
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        organizationId: user.organizationId,
        organizationCode: organizationCode?.toUpperCase(),
        organizationSlug,
        organizationLoginUrl,
        organizationName,
        permissions: user.modulePermissions,
      }
    };
  }

  async refreshToken(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    try {
      const decoded = this.jwtService.verify(refreshToken, { secret: refreshSecret });
      const user = await this.userModel.findById(decoded.userId).select('+refreshTokens');
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User is inactive or not found');
      }

      const previousCount = user.refreshTokens?.length || 0;
      this.pruneRefreshTokens(user);
      if (user.refreshTokens.length !== previousCount) {
        await user.save();
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

      const payload = {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        userType: user.userType,
        organizationId: user.organizationId,
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
      const decoded = this.jwtService.verify(refreshToken, { secret: refreshSecret });
      const user = await this.userModel.findById(decoded.userId).select('+refreshTokens');
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
      await user.save();
      return { message: 'Logout successful' };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private parseDuration(duration: string): number {
    const matches = /^\s*(\d+)\s*([smhdwMy])\s*$/.exec(duration);
    if (!matches) {
      throw new Error('Invalid duration format for JWT refresh token expiration');
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
        throw new Error('Unsupported duration unit for JWT refresh token expiration');
    }
  }

  private pruneRefreshTokens(user: UserDocument) {
    const now = new Date();
    const maxTokens = this.configService.get<number>('JWT_REFRESH_TOKEN_MAX_COUNT') || 10;

    if (!user.refreshTokens?.length) {
      user.refreshTokens = [];
      return;
    }

    user.refreshTokens = user.refreshTokens
      .filter(token => {
        if (token.revokedAt) {
          return false;
        }
        if (!token.expiresAt) {
          return true;
        }
        return new Date(token.expiresAt) > now;
      })
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
      .slice(0, maxTokens);
  }

  async superAdminLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({
      email,
      userType: 'SUPER_ADMIN',
      isDeleted: false,
    }).select('+passwordHash +refreshTokens');

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
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      userType: user.userType,
      organizationId: user.organizationId,
      permissions: user.modulePermissions,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const refreshDurationMs = this.parseDuration(refreshExpires);

    const refreshToken = this.jwtService.sign(
      { userId: user._id },
      { secret: refreshSecret, expiresIn: refreshExpires as any }
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

    user.refreshTokens.push(tokenDoc);
    await user.save();

    return {
      message: 'Super Admin login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        permissions: user.modulePermissions,
      }
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { old_password, new_password } = changePasswordDto;

    const user = await this.userModel.findById(userId).select('+passwordHash');
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
    
    await user.save();

    this.notificationsService.createNotification(
      user.organizationId.toString(),
      user._id.toString(),
      'Password Changed',
      'Your password was successfully updated.',
      'SYSTEM'
    ).catch(e => console.error('Error sending password change notification:', e));

    return { message: 'Password changed successfully' };
  }

  async register(registerDto: any) {
    const { email, password, fullName, mobile, organizationCode, regionId } = registerDto;
    let { organizationId } = registerDto;

    if (organizationCode && !organizationId) {
      const organization = await this.organizationModel.findOne({ code: organizationCode.toUpperCase(), isDeleted: false }).lean();
      if (!organization) {
        throw new BadRequestException('Invalid organization code');
      }
      organizationId = organization._id.toString();
    }

    if (organizationId) {
      const organization = await this.organizationModel.findOne({ _id: organizationId, isDeleted: false }).lean();
      if (!organization) {
        throw new BadRequestException('Invalid organization');
      }
      if (organization.subscriptionConfig?.expiresAt && new Date(organization.subscriptionConfig.expiresAt) < new Date()) {
        throw new BadRequestException('Organization subscription has expired');
      }
      if (organization.subscriptionConfig?.maxStudents) {
        const studentCount = await this.userModel.countDocuments({ organizationId: organization._id.toString(), userType: 'STUDENT', isDeleted: false });
        if (studentCount >= organization.subscriptionConfig.maxStudents) {
          throw new BadRequestException('Organization student limit reached');
        }
      }
    }

    if (!organizationId) {
      throw new BadRequestException('Organization is required for registration');
    }

    const existingUser = await this.userModel.findOne({ email, organizationId });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new this.userModel({
      email,
      passwordHash,
      fullName,
      mobile,
      userType: 'STUDENT',
      status: 'PENDING',
      organizationId,
      regionId,
    });

    await user.save();

    return { message: 'Registration successful. Awaiting admin approval.' };
  }
}
