import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/entities/org.entity';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({ where: { id: payload.userId } });
    if (!user || user.status !== 'ACTIVE' || user.isDeleted) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    if (payload.organizationId) {
      const org = await this.orgRepository.findOne({
        where: { id: payload.organizationId },
      });
      if (!org || org.status !== 'ACTIVE' || org.isDeleted) {
        throw new UnauthorizedException('Organization is disabled');
      }
      if (org.subscriptionConfig?.expiresAt && new Date(org.subscriptionConfig.expiresAt) < new Date()) {
        if (payload.userType === 'ORG_ADMIN' || payload.userType === 'ORG_USER') {
          throw new UnauthorizedException('Organization subscription has expired');
        } else {
          throw new UnauthorizedException('Please contact your Organization Administrator to restore access');
        }
      }
    }
    return {
      userId: payload.userId,
      _id: payload.userId,
      id: payload.userId,
      email: payload.email,
      fullName: payload.fullName,
      userType: payload.userType,
      organizationId: payload.organizationId,
      regionId: payload.regionId,
      permissions: payload.permissions || [],
    };
  }
}
