import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles('ORG_USER', 'FACULTY')
  async createCategory(
    @Request() req: any,
    @Body() categoryData: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(
      req.user.organizationId,
      categoryData,
    );
  }

  @Get()
  async getCategories(@Request() req: any) {
    return this.categoryService.getCategories(req.user.organizationId);
  }

  @Get(':id')
  async getCategoryById(@Request() req: any, @Param('id') categoryId: string) {
    return this.categoryService.getCategoryById(
      req.user.organizationId,
      categoryId,
    );
  }

  @Patch(':id')
  @Roles('ORG_USER', 'FACULTY')
  async updateCategory(
    @Request() req: any,
    @Param('id') categoryId: string,
    @Body() updateData: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(
      req.user.organizationId,
      categoryId,
      updateData,
    );
  }

  @Delete(':id')
  @Roles('ORG_USER', 'FACULTY')
  async deleteCategory(@Request() req: any, @Param('id') categoryId: string) {
    return this.categoryService.deleteCategory(
      req.user.organizationId,
      categoryId,
    );
  }
}
