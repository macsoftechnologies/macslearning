import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('super-admin')
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_FINANCE)
  async getSuperAdminPayments(@Query() query: PaginationQueryDto) {
    return this.paymentService.getSuperAdminPayments(query);
  }

  @Get()
  @Roles('ORG_USER', 'FINANCE')
  async getAllPayments(
    @Request() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.paymentService.getAllPayments(req.user.organizationId, query);
  }

  @Get('my-payments')
  @Roles('STUDENT')
  async getMyPayments(@Request() req: any, @Query() query: PaginationQueryDto) {
    return this.paymentService.getMyPayments(
      req.user.organizationId,
      req.user.userId,
      query,
    );
  }

  @Post(':id/generate-invoice')
  @Roles('STUDENT', 'ORG_USER', 'FINANCE', 'SUPER_ADMIN')
  async generateInvoice(@Request() req: any, @Param('id') paymentId: string) {
    return this.paymentService.generateInvoice(
      req.user.organizationId,
      req.user.userId,
      paymentId,
      req.user.userType,
    );
  }
}
