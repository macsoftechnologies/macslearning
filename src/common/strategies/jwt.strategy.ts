import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/entities/org.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }

    if (payload.organizationId) {
      const org = await this.orgRepository.findOne({
        where: { id: payload.organizationId },
      });
      if (!org || org.status !== 'ACTIVE' || org.isDeleted) {
        throw new UnauthorizedException('Organization is disabled');
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
