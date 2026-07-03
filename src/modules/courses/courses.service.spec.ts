import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let courseModel: any;

  beforeEach(() => {
    courseModel = jest.fn().mockImplementation((data: any) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data }),
    }));
    courseModel.findOne = jest.fn();

    service = new CoursesService(courseModel as any);
  });

  it('generates a non-empty slug for a new course', async () => {
    courseModel.findOne.mockResolvedValue(null);

    const created = await service.createCourse('org1', 'user1', {
      title: 'Course2',
      description: 'Course2',
      categoryId: 'cat1',
    });

    expect(created.slug).toBe('course2');
  });
});
