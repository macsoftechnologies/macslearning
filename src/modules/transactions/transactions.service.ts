import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  async createTransaction(data: Partial<Transaction>) {
    const transaction = this.transactionRepository.create(data);
    return this.transactionRepository.save(transaction);
  }

  async getTransactions(queryDto: PaginationQueryDto & { organizationId?: string }) {
    const { page = 1, limit = 10, search, organizationId } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.organization', 'organization')
      .orderBy('transaction.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (organizationId) {
      queryBuilder.andWhere('transaction.organizationId = :organizationId', { organizationId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(organization.name LIKE :search OR transaction.referenceId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, totalItems] = await queryBuilder.getManyAndCount();

    return createPaginatedResponse(data, totalItems, page, limit);
  }
}
