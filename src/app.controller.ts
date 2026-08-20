import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import * as fs from 'fs';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const folder = (req.query.folder as string)?.replace(/[^a-zA-Z0-9_-]/g, '') || 'thumbnails';
    const uploadPath = `./public/uploads/${folder}`;
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const folder = (req.query.folder as string)?.replace(/[^a-zA-Z0-9_-]/g, '') || 'thumbnails';
    const prefix = folder === 'thumbnails' ? 'thumb' : 'file';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${prefix}-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORG_USER', 'FACULTY')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowed = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.webp',
          '.pdf',
          '.doc',
          '.docx',
          '.zip',
        ];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folderQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const folder = (folderQuery as string)?.replace(/[^a-zA-Z0-9_-]/g, '') || 'thumbnails';
    return { url: `/uploads/${folder}/${file.filename}` };
  }

  @Post('upload/public')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowed = [
          '.jpg',
          '.jpeg',
          '.png',
          '.gif',
          '.webp',
          '.pdf',
          '.doc',
          '.docx',
          '.zip',
        ];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadPublicFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folderQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const folder = (folderQuery as string)?.replace(/[^a-zA-Z0-9_-]/g, '') || 'public';
    return { url: `/uploads/${folder}/${file.filename}` };
  }
}
