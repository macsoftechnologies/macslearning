import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { VimeoService } from './vimeo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const VIDEO_MAX_SIZE_BYTES =
  (Number(process.env.VIDEO_MAX_SIZE_MB) || 500) * 1024 * 1024;

@ApiTags('Vimeo')
@ApiBearerAuth()
@Controller('vimeo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VimeoController {
  constructor(private readonly vimeoService: VimeoService) {}

  /**
   * DEV-MODE: Upload a video file locally instead of going through Vimeo.
   * The file is saved to ./public/uploads/videos/ and a local URL is returned.
   * The response shape mirrors the old Vimeo ticket response so the frontend
   * can switch without breaking.
   */
  @Post('upload-ticket')
  @Roles('ORG_USER', 'FACULTY')
  @ApiOperation({ summary: 'Upload video locally (dev mode – no Vimeo)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: './public/uploads/videos',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `video-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      limits: { fileSize: VIDEO_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(
            new BadRequestException(
              `Unsupported video type: ${ext}. Allowed: ${allowed.join(', ')}`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadVideo(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { videoName?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No video file provided');
    }

    const videoUrl = `/uploads/videos/${file.filename}`;

    return {
      // Keep a similar shape to old Vimeo response for frontend compatibility
      uploadLink: null,          // Not applicable for local upload
      videoUri: videoUrl,        // Local path
      link: videoUrl,            // The URL to use in the player
      localFile: true,           // Flag so frontend knows this is local
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size,
    };
  }

  @Delete('videos/:filename')
  @Roles('ORG_USER', 'FACULTY')
  @ApiOperation({ summary: 'Delete a locally uploaded video (dev mode)' })
  async deleteVideo(@Param('filename') filename: string) {
    return this.vimeoService.deleteLocalVideo(filename);
  }
}
