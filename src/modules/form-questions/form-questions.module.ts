import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormQuestionsService } from './form-questions.service';
import { FormQuestionsController } from './form-questions.controller';
import { FormQuestion } from './entities/form-question.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormQuestion])],
  controllers: [FormQuestionsController],
  providers: [FormQuestionsService],
  exports: [FormQuestionsService],
})
export class FormQuestionsModule {}
