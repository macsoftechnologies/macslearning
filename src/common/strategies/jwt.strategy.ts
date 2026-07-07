import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../../modules/organizations/schemas/org.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>
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
      const org = await this.orgModel.findById(payload.organizationId);
      if (!org || org.status !== 'ACTIVE' || org.isDeleted) {
        throw new UnauthorizedException('Organization is disabled');
      }
    }
    return {
      userId: payload.userId,
      email: payload.email,
      userType: payload.userType,
      organizationId: payload.organizationId,
      permissions: payload.permissions || [],
    };
  }
}
