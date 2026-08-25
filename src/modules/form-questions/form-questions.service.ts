import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormQuestion } from './entities/form-question.entity';

@Injectable()
export class FormQuestionsService {
  constructor(
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
  ) {}

  async create(organizationId: string, data: Partial<FormQuestion>): Promise<FormQuestion> {
    const newQuestion = this.questionRepository.create({ ...data, organizationId });
    return await this.questionRepository.save(newQuestion);
  }

  async findAll(organizationId: string): Promise<FormQuestion[]> {
    const questions = await this.questionRepository.find({
      where: { organizationId },
      order: { order: 'ASC' },
    });

    return questions.map(q => {
      if (q.key === 'gender') {
        return {
          ...q,
          options: ['Male', 'Female']
        };
      }
      return q;
    });
  }

  async update(id: string, organizationId: string, data: Partial<FormQuestion>): Promise<FormQuestion> {
    const question = await this.questionRepository.findOne({ where: { id, organizationId } });
    if (!question) throw new NotFoundException('Question not found');
    
    Object.assign(question, data);
    return await this.questionRepository.save(question);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const question = await this.questionRepository.findOne({ where: { id, organizationId } });
    if (!question) throw new NotFoundException('Question not found');
    await this.questionRepository.remove(question);
  }
}
