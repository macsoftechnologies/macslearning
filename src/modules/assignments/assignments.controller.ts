import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AssignmentsService } from './assignments.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAssignmentDto, GradeSubmissionDto } from './dto/assignments.dto';

const UPLOAD_MAX_SIZE_BYTES =
  (Number(process.env.UPLOAD_MAX_SIZE_MB) || 10) * 1024 * 1024;

@Controller('courses/:courseId/assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post()
  @Roles('ORG_USER', 'FACULTY')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads/assignments',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      limits: { fileSize: UPLOAD_MAX_SIZE_BYTES },
      fileFilter: (req, file, cb) => {
        const allowed = [
          '.pdf',
          '.doc',
          '.docx',
          '.zip',
          '.jpg',
          '.jpeg',
          '.png',
        ];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async createAssignment(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() assignmentData: CreateAssignmentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      assignmentData.fileUrl = `/uploads/assignments/${file.filename}`;
    }
    return this.assignmentsService.createAssignment(
      req.user.organizationId,
      courseId,
      req.user.userId,
      assignmentData,
    );
  }

  @Get()
  async getAssignments(
    @Request() req: any,
    @Param('courseId') courseId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        courseId,
      );
    }
    return this.assignmentsService.getAssignments(
      req.user.organizationId,
      courseId,
    );
  }

  @Post(':assignmentId/submit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads/submissions',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `submission-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: UPLOAD_MAX_SIZE_BYTES },
      fileFilter: (req, file, cb) => {
        const allowed = [
          '.pdf',
          '.doc',
          '.docx',
          '.zip',
          '.jpg',
          '.jpeg',
          '.png',
        ];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async submitAssignment(
    @Request() req: any,
    @Param('assignmentId') assignmentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (req.user.userType === 'STUDENT') {
      const assignment = await this.assignmentsService.findAssignmentById(
        req.user.organizationId,
        assignmentId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        assignment.courseId.toString(),
      );
    }
    const fileUrl = file ? String(`/uploads/submissions/${file.filename}`) : '';
    return this.assignmentsService.submitAssignment(
      req.user.organizationId,
      assignmentId,
      req.user.userId,
      fileUrl,
    );
  }

  @Get(':assignmentId/submissions')
  @Roles('ORG_USER', 'FACULTY')
  async getAssignmentSubmissions(
    @Request() req: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.assignmentsService.getAssignmentSubmissions(
      req.user.organizationId,
      assignmentId,
    );
  }

  @Patch('submissions/:submissionId/grade')
  @Roles('ORG_USER', 'FACULTY')
  async gradeSubmission(
    @Request() req: any,
    @Param('submissionId') submissionId: string,
    @Body() gradeData: GradeSubmissionDto,
  ) {
    return this.assignmentsService.gradeSubmission(
      req.user.organizationId,
      submissionId,
      req.user.userId,
      req.user.userType,
      gradeData,
    );
  }
}
