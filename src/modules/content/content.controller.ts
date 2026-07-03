import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ContentService } from './content.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateModuleDto, CreateLessonDto, UpdateModuleDto, UpdateLessonDto } from './dto/content.dto';

const UPLOAD_MAX_SIZE_BYTES = (Number(process.env.UPLOAD_MAX_SIZE_MB) || 10) * 1024 * 1024;

@Controller('courses/:courseId/content')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('modules')
  @Roles('ORG_USER', 'FACULTY')
  async createModule(@Request() req: any, @Param('courseId') courseId: string, @Body() moduleData: CreateModuleDto) {
    return this.contentService.createModule(req.user.organizationId, courseId, moduleData);
  }

  @Get('modules')
  @Roles('ORG_USER', 'FACULTY', 'STUDENT')
  async getModules(@Request() req: any, @Param('courseId') courseId: string) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, courseId);
    }
    return this.contentService.getModules(courseId, req.user.organizationId);
  }

  @Post('modules/:moduleId/lessons')
  @Roles('ORG_USER', 'FACULTY')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
      }
    }),
    limits: { fileSize: UPLOAD_MAX_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
      const allowed = ['.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.mp4', '.webm'];
      const ext = extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new BadRequestException('Unsupported file type'), false);
      }
      cb(null, true);
    },
  }))
  async createLesson(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() lessonData: CreateLessonDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (file) {
      lessonData.contentUrl = `/uploads/${file.filename}`;
    }
    return this.contentService.createLesson(req.user.organizationId, courseId, moduleId, lessonData);
  }

  @Get('modules/:moduleId/lessons')
  @Roles('ORG_USER', 'FACULTY', 'STUDENT')
  async getLessons(@Request() req: any, @Param('courseId') courseId: string, @Param('moduleId') moduleId: string) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(req.user.organizationId, req.user.userId, courseId);
    }
    return this.contentService.getLessons(courseId, moduleId, req.user.organizationId);
  }

  @Patch('modules/:moduleId')
  @Roles('ORG_USER', 'FACULTY')
  async updateModule(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() updateData: UpdateModuleDto
  ) {
    return this.contentService.updateModule(req.user.organizationId, courseId, moduleId, updateData);
  }

  @Delete('modules/:moduleId')
  @Roles('ORG_USER', 'FACULTY')
  async deleteModule(@Request() req: any, @Param('courseId') courseId: string, @Param('moduleId') moduleId: string) {
    return this.contentService.deleteModule(req.user.organizationId, courseId, moduleId);
  }

  @Patch('modules/:moduleId/lessons/:lessonId')
  @Roles('ORG_USER', 'FACULTY')
  async updateLesson(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Body() updateData: UpdateLessonDto
  ) {
    return this.contentService.updateLesson(req.user.organizationId, courseId, moduleId, lessonId, updateData);
  }

  @Delete('modules/:moduleId/lessons/:lessonId')
  @Roles('ORG_USER', 'FACULTY')
  async deleteLesson(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string
  ) {
    return this.contentService.deleteLesson(req.user.organizationId, courseId, moduleId, lessonId);
  }
}
