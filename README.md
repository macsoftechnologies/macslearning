# OnlineLMS Backend API

A comprehensive NestJS-based backend API for an Online Learning Management System with role-based access control, assignments, courses, exams, and payments integration.

## Features

- 🔐 **Role-Based Access Control** (Admin, Instructor, Student, SuperAdmin)
- 📚 **Course Management** with assignments, lessons, and content
- 📊 **Exams & Grading System** with checkpoints
- 💳 **Payment Integration** (Stripe)
- 📧 **Email Notifications**
- 📈 **Progress Tracking** & Analytics
- 🔍 **Audit Logging**
- ⚡ **Rate Limiting & Security** 
- 🗄️ **MongoDB** for data persistence
- 🚀 **Redis** for caching
- 📝 **Comprehensive API Documentation** (Postman collections included)

## Prerequisites

- **Node.js** v18+ 
- **MongoDB** (local or cloud - MongoDB Atlas)
- **Redis** (local or cloud)
- **npm** or **yarn**

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/lms-backend.git
cd lms-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```
Edit `.env` with your actual values:
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lms_db
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_key
```

## Running the Application

```bash
# Development mode (with auto-reload)
npm run start:dev

# Production build
npm run build

# Production mode
npm run start:prod
```

The API will be available at `http://localhost:5000`

## API Documentation

Import the Postman collection for API testing:
- `OnlineLMS_API_RoleBased.postman_collection.json` - Complete API with role-based examples
- `postman_collection.json` - Additional endpoints

## Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## Project Structure

```
src/
├── common/          # Shared decorators, guards, filters, strategies
├── modules/         # Feature modules (courses, auth, assignments, etc.)
├── app.module.ts    # Root module
├── app.service.ts   # App service
└── main.ts          # Application entry point
```

## Key Modules

- **Auth** - JWT authentication & refresh tokens
- **Users** - User management with role-based access
- **Courses** - Course creation & management
- **Assignments** - Assignment creation & submission
- **Exams** - Exam management & grading
- **Enrollment** - Course enrollment & subscriptions
- **Progress** - Student progress tracking
- **Certificates** - Certificate generation
- **Reports** - Analytics & reports
- **Payment** - Payment processing & subscriptions
- **Notifications** - Email & in-app notifications

## Deployment

### Heroku

```bash
heroku create your-app-name
heroku addons:create mongolab:sandbox
heroku addons:create heroku-redis:premium-0
git push heroku main
```

### Docker

```bash
docker build -t lms-backend .
docker run -p 5000:5000 --env-file .env lms-backend
```

### AWS / Azure / DigitalOcean

1. Build the project: `npm run build`
2. Set environment variables on your platform
3. Run: `node dist/main.js`

## Database Setup

Ensure MongoDB is running and initialized with required collections/indexes:

```bash
npm run build
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start application
- `npm run format` - Format code with Prettier
- `npm run lint` - Run ESLint with fixes
- `npm run test` - Run unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
