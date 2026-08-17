import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'videos');

  constructor(private configService: ConfigService) {
    // Ensure the videos upload directory exists at startup
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`Created video uploads directory: ${this.uploadsDir}`);
    }
  }

  /**
   * Calculate total storage used by an organization's videos locally.
   * Scans the local uploads/videos directory and sums file sizes.
   * In dev mode we don't have per-org folders, so this returns total local video storage.
   */
  async getOrganizationFolderStorage(orgName: string): Promise<number> {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return 0;
      }

      const files = fs.readdirSync(this.uploadsDir);
      let totalBytes = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          totalBytes += stat.size;
        }
      }

      return totalBytes;
    } catch (error) {
      this.logger.error(`Error calculating local storage for ${orgName}`, error);
      return 0;
    }
  }

  /**
   * Delete a locally uploaded video file.
   */
  async deleteLocalVideo(filename: string): Promise<{ deleted: boolean; filename: string }> {
    try {
      // Sanitize filename to prevent directory traversal
      const safeFilename = path.basename(filename);
      const filePath = path.join(this.uploadsDir, safeFilename);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Video file not found: ${safeFilename}`);
      }

      fs.unlinkSync(filePath);
      this.logger.log(`Deleted local video: ${safeFilename}`);

      return { deleted: true, filename: safeFilename };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting local video: ${filename}`, error);
      throw new InternalServerErrorException('Failed to delete video file');
    }
  }
}
