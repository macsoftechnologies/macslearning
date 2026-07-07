import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>
  ) {}

  async createCategory(organizationId: string, categoryData: any) {
    const category = new this.categoryModel({
      ...categoryData,
      organizationId,
    });
    return category.save();
  }

  async getCategories(organizationId: string) {
    return this.categoryModel.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), isDeleted: false } },
      {
        $lookup: {
          from: 'courses',
          let: { catIdStr: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$categoryId', '$$catIdStr'] } } }
          ],
          as: 'courses',
        },
      },
      {
        $addFields: {
          courseCount: {
            $size: {
              $filter: {
                input: '$courses',
                as: 'c',
                cond: { $eq: ['$$c.isDeleted', false] },
              },
            },
          },
          id: '$_id',
        },
      },
      { $project: { courses: 0 } },
      { $sort: { name: 1 } },
    ]);
  }

  async getCategoryById(organizationId: string, categoryId: string) {
    const category = await this.categoryModel.findOne({ _id: categoryId, organizationId, isDeleted: false });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(organizationId: string, categoryId: string, updateData: any) {
    const category = await this.categoryModel.findOneAndUpdate(
      { _id: categoryId, organizationId, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async deleteCategory(organizationId: string, categoryId: string) {
    const category = await this.categoryModel.findOneAndUpdate(
      { _id: categoryId, organizationId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!category) throw new NotFoundException('Category not found');
    return { message: 'Category deleted successfully' };
  }
}
