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
import { ExamsService } from './exams.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateExamDto,
  GradeShortAnswerDto,
  QuestionDto,
  SaveAnswerDto,
  SubmitAttemptDto,
  UpdateQuestionDto,
} from './dto/exams.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('courses/:courseId/exams')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async createExam(
    @Request() req: any,
    @Param('courseId') courseId: string,
    @Body() examData: CreateExamDto,
  ) {
    return this.examsService.createExam(
      req.user.organizationId,
      courseId,
      req.user.userId,
      examData,
    );
  }

  @Get('courses/:courseId/exams')
  async getExams(@Request() req: any, @Param('courseId') courseId: string) {
    return this.examsService.getExams(req.user.organizationId, courseId);
  }

  @Get('exams/:examId')
  async getExamById(@Request() req: any, @Param('examId') examId: string) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
      return exam;
    }
    return this.examsService.getExamById(req.user.organizationId, examId);
  }

  @Patch('exams/:examId/publish')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async publishExam(@Request() req: any, @Param('examId') examId: string) {
    return this.examsService.publishExam(req.user.organizationId, examId);
  }

  @Patch('exams/:examId/approve')
  @Roles('ORG_USER')
  async approveExam(@Request() req: any, @Param('examId') examId: string) {
    return this.examsService.approveExam(req.user.organizationId, examId);
  }

  @Patch('exams/:examId/reject')
  @Roles('ORG_USER')
  async rejectExam(@Request() req: any, @Param('examId') examId: string, @Body('reason') reason: string) {
    return this.examsService.rejectExam(req.user.organizationId, examId, reason);
  }

  @Post('exams/:examId/questions')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async addQuestion(
    @Request() req: any,
    @Param('examId') examId: string,
    @Body() questionData: QuestionDto,
  ) {
    return this.examsService.addQuestion(
      req.user.organizationId,
      examId,
      questionData,
    );
  }

  @Get('exams/:examId/questions')
  async getQuestions(@Request() req: any, @Param('examId') examId: string) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.getQuestions(
      req.user.organizationId,
      examId,
      req.user.userType,
    );
  }

  @Patch('exams/:examId/answers')
  async saveAnswer(
    @Request() req: any,
    @Param('examId') examId: string,
    @Body() answerDto: SaveAnswerDto,
  ) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.saveAnswer(
      req.user.organizationId,
      req.user.userId,
      examId,
      answerDto,
    );
  }

  @Patch('exams/:examId/questions/:questionId')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async updateQuestion(
    @Request() req: any,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @Body() updateData: UpdateQuestionDto,
  ) {
    return this.examsService.updateQuestion(
      req.user.organizationId,
      examId,
      questionId,
      updateData,
    );
  }

  @Delete('exams/:examId/questions/:questionId')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async deleteQuestion(
    @Request() req: any,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.examsService.deleteQuestion(
      req.user.organizationId,
      examId,
      questionId,
    );
  }

  @Post('exams/:examId/start')
  async startAttempt(@Request() req: any, @Param('examId') examId: string) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.startAttempt(
      req.user.organizationId,
      req.user.userId,
      examId,
    );
  }

  @Get('exams/:examId/attempts')
  async getAttemptHistory(
    @Request() req: any,
    @Param('examId') examId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.getAttemptHistory(
      req.user.organizationId,
      req.user.userId,
      examId,
    );
  }

  @Get('exams/:examId/attempts/:attemptId/review')
  async getAttemptReview(
    @Request() req: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
  ) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
      return this.examsService.getAttemptReview(
        req.user.organizationId,
        req.user.userId,
        examId,
        attemptId,
      );
    }
    return this.examsService.getAttemptReviewForFaculty(
      req.user.organizationId,
      examId,
      attemptId,
    );
  }

  @Get('exams/:examId/attempts/:attemptId/shortanswers')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async getShortAnswers(
    @Request() req: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
  ) {
    return this.examsService.getShortAnswers(
      req.user.organizationId,
      examId,
      attemptId,
    );
  }

  @Patch('exams/:examId/attempts/:attemptId/grade-answer')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async gradeShortAnswer(
    @Request() req: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
    @Body() body: GradeShortAnswerDto,
  ) {
    return this.examsService.gradeShortAnswer(
      req.user.organizationId,
      req.user.userId,
      examId,
      attemptId,
      body.questionId,
      body.marks,
    );
  }

  @Post('exams/:examId/submit')
  async submitAttempt(
    @Request() req: any,
    @Param('examId') examId: string,
    @Body() submitDto: SubmitAttemptDto,
  ) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.submitAttempt(
      req.user.organizationId,
      req.user.userId,
      examId,
      submitDto.answers,
    );
  }

  @Get('exams/:examId/my-result')
  async getMyResult(@Request() req: any, @Param('examId') examId: string) {
    if (req.user.userType === 'STUDENT') {
      const exam = await this.examsService.getExamById(
        req.user.organizationId,
        examId,
      );
      await this.enrollmentService.verifyActiveEnrollment(
        req.user.organizationId,
        req.user.userId,
        exam.courseId.toString(),
      );
    }
    return this.examsService.getMyResult(
      req.user.organizationId,
      req.user.userId,
      examId,
    );
  }

  @Get('exams/:examId/results')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async getExamResults(@Request() req: any, @Param('examId') examId: string) {
    return this.examsService.getExamResults(req.user.organizationId, examId);
  }

  @Patch('results/:resultId/publish')
  @Roles('SUPER_ADMIN', 'ORG_USER', 'FACULTY')
  async publishResult(
    @Request() req: any,
    @Param('resultId') resultId: string,
  ) {
    return this.examsService.publishResult(
      req.user.organizationId,
      resultId,
      req.user.userId,
    );
  }
}
