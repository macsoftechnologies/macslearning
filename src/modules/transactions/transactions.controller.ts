import { Controller, Get, UseGuards, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @RequirePermissions(PERMISSIONS.TRACK_FINANCE)
  @ApiOperation({ summary: 'Get all transactions' })
  async getAllTransactions(@Query() query: PaginationQueryDto) {
    return this.transactionsService.getTransactions(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORG_USER', 'FINANCE')
  @ApiOperation({ summary: 'Get organization transactions' })
  async getMyTransactions(@Request() req: any, @Query() query: PaginationQueryDto) {
    return this.transactionsService.getTransactions({
      ...query,
      organizationId: req.user.organizationId,
    });
  }
}
