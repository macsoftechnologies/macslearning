import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

@Injectable()
export class FacultyService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async getDashboardStats(organizationId: string, facultyId: string) {
    const orgId = new Types.ObjectId(organizationId);
    const facId = new Types.ObjectId(facultyId);

    // 1. Get courses taught by this faculty
    const courses = await this.connection.collection('courses').find({
      organizationId: orgId,
      instructorIds: facId,
      isDeleted: false
    }).toArray();

    const courseIds = courses.map(c => c._id);

    // 2. Get total students (unique active enrollments for these courses)
    const enrollments = await this.connection.collection('enrollments').aggregate([
      { $match: { organizationId: orgId, courseId: { $in: courseIds }, status: 'ACTIVE' } },
      { $group: { _id: '$studentId' } }
    ]).toArray();
    const totalStudents = enrollments.length;

    const courseEnrollments = await this.connection.collection('enrollments').aggregate([
      { $match: { organizationId: orgId, courseId: { $in: courseIds }, status: 'ACTIVE' } },
      { $group: { _id: '$courseId', count: { $sum: 1 } } }
    ]).toArray();
    const enrollmentMap = new Map(courseEnrollments.map(e => [e._id.toString(), e.count]));

    // 3. Get pending grading (assignments and exams)
    const assignments = await this.connection.collection('assignments').find({
      organizationId: orgId,
      courseId: { $in: courseIds }
    }).toArray();
    const assignmentIds = assignments.map(a => a._id);

    const pendingSubmissionsCount = await this.connection.collection('submissions').countDocuments({
      organizationId: orgId,
      assignmentId: { $in: assignmentIds },
      status: 'PENDING'
    });

    const exams = await this.connection.collection('exams').find({
      organizationId: orgId,
      courseId: { $in: courseIds }
    }).toArray();
    const examIds = exams.map(e => e._id);

    const pendingAttemptsCount = await this.connection.collection('examattempts').countDocuments({
      organizationId: orgId,
      examId: { $in: examIds },
      status: 'PENDING_REVIEW' // Assuming PENDING_REVIEW is the status
    });

    // 4. Upcoming Deadlines
    const upcomingDeadlines = await this.connection.collection('assignments').find({
      organizationId: orgId,
      courseId: { $in: courseIds },
      dueDate: { $gte: new Date() }
    }).sort({ dueDate: 1 }).limit(5).toArray();

    // 5. Unanswered Questions (discussions)
    const unansweredQuestions = await this.connection.collection('discussions').countDocuments({
      organizationId: orgId,
      courseId: { $in: courseIds },
      replies: { $size: 0 } // Or however discussions work.
    });

    return {
      courses: courses.map(c => ({
        _id: c._id,
        title: c.title,
        status: c.status,
        enrolledCount: enrollmentMap.get(c._id.toString()) || 0,
      })),
      totalStudents,
      pendingGrading: pendingSubmissionsCount + (pendingAttemptsCount || 0),
      publishedCourses: courses.filter(c => c.status === 'PUBLISHED').length,
      upcomingDeadlines: upcomingDeadlines.map(a => ({ _id: a._id, title: a.title, dueDate: a.dueDate, courseId: a.courseId })),
      unansweredQuestions
    };
  }

  async getGradingQueue(organizationId: string, facultyId: string) {
    const orgId = new Types.ObjectId(organizationId);
    const facId = new Types.ObjectId(facultyId);

    const courses = await this.connection.collection('courses').find({
      organizationId: orgId,
      instructorIds: facId,
      isDeleted: false
    }).toArray();
    const courseIds = courses.map(c => c._id);
    const courseMap: Record<string, string> = {};
    courses.forEach(c => courseMap[c._id.toString()] = c.title);

    const assignments = await this.connection.collection('assignments').find({
      organizationId: orgId,
      courseId: { $in: courseIds }
    }).toArray();
    const assignmentMap: Record<string, any> = {};
    assignments.forEach(a => assignmentMap[a._id.toString()] = a);

    const submissions = await this.connection.collection('submissions').aggregate([
      { $match: { organizationId: orgId, assignmentId: { $in: assignments.map(a => a._id) }, status: 'PENDING' } },
      { $sort: { createdAt: 1 } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' }
    ]).toArray();

    const exams = await this.connection.collection('exams').find({
      organizationId: orgId,
      courseId: { $in: courseIds }
    }).toArray();
    const examMap: Record<string, any> = {};
    exams.forEach(e => examMap[e._id.toString()] = e);

    const attempts = await this.connection.collection('examattempts').aggregate([
      { $match: { organizationId: orgId, examId: { $in: exams.map(e => e._id) }, status: 'PENDING_REVIEW' } }, // Guessing status
      { $sort: { createdAt: 1 } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const queue = [
      ...submissions.map(s => ({
        _id: s._id,
        type: 'assignment',
        title: assignmentMap[s.assignmentId.toString()]?.title,
        courseName: courseMap[assignmentMap[s.assignmentId.toString()]?.courseId.toString()],
        studentName: s.student ? (`${s.student.firstName || ''} ${s.student.lastName || ''}`.trim() || s.student.fullName) : 'Unknown',
        submittedAt: s.createdAt,
        assignmentId: s.assignmentId
      })),
      ...attempts.map(a => ({
        _id: a._id,
        type: 'exam',
        title: examMap[a.examId.toString()]?.title,
        courseName: courseMap[examMap[a.examId.toString()]?.courseId.toString()],
        studentName: a.student ? (`${a.student.firstName || ''} ${a.student.lastName || ''}`.trim() || a.student.fullName) : 'Unknown',
        submittedAt: a.createdAt,
        examId: a.examId
      }))
    ].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    return queue;
  }
}
