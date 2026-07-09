import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Course } from '../courses/entities/course.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async createCategory(organizationId: string, categoryData: any) {
    const category = this.categoryRepository.create({
      ...categoryData,
      organizationId,
    });
    return this.categoryRepository.save(category);
  }

  async getCategories(organizationId: string) {
    const categories = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin(
        Course,
        'course',
        'course.categoryId = category.id AND course.isDeleted = false',
      )
      .select([
        'category.id AS id',
        'category.name AS name',
        'category.description AS description',
        'category.organizationId AS organizationId',
        'category.isDeleted AS isDeleted',
        'category.createdAt AS createdAt',
        'category.updatedAt AS updatedAt',
      ])
      .addSelect('COUNT(course.id)', 'courseCount')
      .where('category.organizationId = :organizationId', { organizationId })
      .andWhere('category.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('category.id')
      .orderBy('category.name', 'ASC')
      .getRawMany();

    // In TypeORM getRawMany returns courseCount as a string sometimes, ensure it's a number
    return categories.map((c) => ({
      ...c,
      courseCount: parseInt(c.courseCount, 10) || 0,
    }));
  }

  async getCategoryById(organizationId: string, categoryId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, organizationId, isDeleted: false },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    updateData: any,
  ) {
    await this.categoryRepository.update(
      { id: categoryId, organizationId, isDeleted: false },
      updateData,
    );
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, organizationId, isDeleted: false },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async deleteCategory(organizationId: string, categoryId: string) {
    await this.categoryRepository.update(
      { id: categoryId, organizationId, isDeleted: false },
      { isDeleted: true },
    );
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, organizationId, isDeleted: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return { message: 'Category deleted successfully' };
  }
}
