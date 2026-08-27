import { Injectable, InternalServerErrorException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organizations/entities/org.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseModule } from '../content/entities/courseModule.entity';

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private defaultVimeoClient: any = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(Course)
    private courseRepo: Repository<Course>,
    @InjectRepository(CourseModule)
    private moduleRepo: Repository<CourseModule>,
  ) {
    this.initDefaultVimeo();
  }

  private initDefaultVimeo() {
    try {
      const Vimeo = require('vimeo').Vimeo;
      const clientId = this.configService.get<string>('VIMEO_CLIENT_ID') || process.env.VIMEO_CLIENT_ID;
      const clientSecret = this.configService.get<string>('VIMEO_CLIENT_SECRET') || process.env.VIMEO_CLIENT_SECRET;
      const accessToken = this.configService.get<string>('VIMEO_ACCESS_TOKEN') || process.env.VIMEO_ACCESS_TOKEN;

      if (clientId && clientSecret && accessToken) {
        this.defaultVimeoClient = new Vimeo(clientId, clientSecret, accessToken);
        this.logger.log('Default System Vimeo SDK initialized successfully.');
      } else {
        this.logger.warn('Default Vimeo credentials missing in .env. Organizations must provide their own in Settings.');
      }
    } catch (e) {
      this.logger.error('Failed to initialize default Vimeo SDK', e);
    }
  }

  /**
   * Resolves the appropriate Vimeo client for a given organization.
   * If the organization has configured its own Vimeo credentials in Settings, uses those.
   * Otherwise, falls back to the system-wide default credentials.
   */
  async getVimeoClientForOrg(organizationId?: string): Promise<{ client: any; org: Organization | null }> {
    let org: Organization | null = null;

    if (organizationId) {
      try {
        org = await this.orgRepository.findOne({ where: { id: organizationId } });
        if (
          org?.vimeoConfig?.clientId?.trim() &&
          org?.vimeoConfig?.clientSecret?.trim() &&
          org?.vimeoConfig?.accessToken?.trim()
        ) {
          const Vimeo = require('vimeo').Vimeo;
          const customClient = new Vimeo(
            org.vimeoConfig.clientId.trim(),
            org.vimeoConfig.clientSecret.trim(),
            org.vimeoConfig.accessToken.trim(),
          );
          this.logger.log(`Using custom Vimeo credentials for organization: ${org.name || organizationId}`);
          return { client: customClient, org };
        }
      } catch (err) {
        this.logger.warn(`Could not load Vimeo settings for org ${organizationId}: ${err.message}`);
      }
    }

    if (this.defaultVimeoClient) {
      return { client: this.defaultVimeoClient, org };
    }

    throw new InternalServerErrorException(
      'Vimeo credentials not configured. Please enter your Vimeo Client ID, Secret, and Access Token in Organization Settings.',
    );
  }

  private vimeoRequest(options: any, client: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!client) return reject(new Error('Vimeo client not initialized'));
      client.request(options, (error: any, body: any, statusCode: any, headers: any) => {
        if (error) {
          this.logger.error('Vimeo API Failure: Status ' + statusCode + ' Headers: ' + JSON.stringify(headers));
          return reject(new Error('Vimeo HTTP ' + statusCode + ': ' + error.message));
        }
        if (statusCode >= 400) {
          this.logger.error('Vimeo API Error: Status ' + statusCode, JSON.stringify(body));
          return reject(new Error('Vimeo API Error ' + statusCode + ': ' + JSON.stringify(body)));
        }
        resolve({ body, statusCode, headers });
      });
    });
  }

  async getOrCreateFolder(folderName: string, client: any): Promise<string | null> {
    try {
      const searchRes = await this.vimeoRequest({
        method: 'GET',
        path: '/me/projects',
        query: { query: folderName }
      }, client);

      const existing = (searchRes.body?.data || []).find(
        (p: any) => p.name.toLowerCase().trim() === folderName.toLowerCase().trim()
      );

      if (existing) {
        return existing.uri.split('/').pop();
      }

      const createRes = await this.vimeoRequest({
        method: 'POST',
        path: '/me/projects',
        data: { name: folderName }
      }, client);

      return createRes.body?.uri?.split('/').pop();
    } catch (err: any) {
      this.logger.warn(`Folder creation failed for ${folderName}: ${err.message}`);
      return null;
    }
  }

  async getOrganizationFolderStorage(folderName: string, organizationId?: string): Promise<number> {
    try {
      const { client } = await this.getVimeoClientForOrg(organizationId);
      const folderId = await this.getOrCreateFolder(folderName, client);
      if (!folderId) return 0;

      const res = await this.vimeoRequest({
        method: 'GET',
        path: `/me/projects/${folderId}/videos`,
        query: { per_page: 100 }
      }, client);

      const videos = res.body?.data || [];
      return videos.reduce((acc: number, v: any) => acc + (v.upload?.size || v.size || 0), 0);
    } catch (err: any) {
      this.logger.warn(`Storage check failed: ${err.message}`);
      return 0;
    }
  }

  async moveVideoToFolder(videoId: string, folderId: string, client: any) {
    if (!folderId || !videoId) return;
    try {
      await this.vimeoRequest({
        method: 'PUT',
        path: `/me/projects/${folderId}/videos/${videoId}`
      }, client);
      this.logger.log(`Assigned video ${videoId} to Vimeo folder ${folderId}`);
    } catch (err) {
      this.logger.warn(`Failed moving video ${videoId} to folder ${folderId}: ${err.message}`);
    }
  }

  async generateUploadTicket(
    fileSize: number,
    videoName: string,
    organizationId?: string
  ): Promise<{ uploadLink: string; videoUri: string; videoId: string }> {
    const { client, org } = await this.getVimeoClientForOrg(organizationId);

    const folderName = (org?.name || 'Default Organization')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim();

    return new Promise((resolve, reject) => {
      client.request(
        {
          method: 'POST',
          path: '/me/videos',
          data: {
            upload: {
              approach: 'tus',
              size: fileSize,
            },
            name: videoName || 'Untitled Lesson Video',
            privacy: {
              view: 'anybody',
              embed: 'public',
            },
          },
        },
        async (error: any, body: any, statusCode: number) => {
          if (error || statusCode >= 400) {
            this.logger.error('Failed to create Vimeo upload ticket', error || body);
            return reject(
              new InternalServerErrorException(
                `Vimeo ticket error (${statusCode}): ${error?.message || JSON.stringify(body)}`
              )
            );
          }

          const uploadLink = body.upload?.upload_link;
          const videoUri = body.uri;
          const videoId = videoUri ? videoUri.split('/').pop() : null;

          if (!uploadLink || !videoUri) {
            return reject(
              new InternalServerErrorException('Vimeo did not return a valid TUS upload link.')
            );
          }

          if (folderName && videoId) {
            this.getOrCreateFolder(folderName, client)
              .then((folderId) => {
                if (folderId) {
                  return this.moveVideoToFolder(videoId, folderId, client);
                }
              })
              .catch((err) =>
                this.logger.warn(`Async folder sorting failed: ${err.message}`)
              );
          }

          resolve({ uploadLink, videoUri, videoId });
        }
      );
    });
  }

  /**
   * Helper to extract numerical Vimeo ID from full URLs or ID strings
   */
  private extractVimeoId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();
    // Check if directly a number
    if (/^\d+$/.test(clean)) return clean;

    // Handle vimeo.com/123456789 or player.vimeo.com/video/123456789 or vimeo.com/123456789/hash
    const match = clean.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    if (match && match[1]) return match[1];

    // Fallback: extract first digit sequence of length >= 6
    const digitMatch = clean.match(/(\d{6,})/);
    return digitMatch ? digitMatch[1] : null;
  }

  /**
   * Helper to parse WebVTT text into structured cues, paragraphs and full text
   */
  private parseWebVTT(vttContent: string): {
    totalParagraphs: number;
    totalCues: number;
    fullText: string;
    paragraphs: Array<{
      startSeconds: number;
      endSeconds: number;
      displayTime: string;
      text: string;
    }>;
    sentences: Array<{
      startSeconds: number;
      endSeconds: number;
      displayTime: string;
      text: string;
    }>;
    cues: Array<{
      startSeconds: number;
      endSeconds: number;
      displayTime: string;
      text: string;
    }>;
  } {
    const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cues: Array<{ startSeconds: number; endSeconds: number; displayTime: string; text: string }> = [];
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Look for timestamp line: 00:00:01.000 --> 00:00:04.000
      const timeMatch = line.match(/((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{2,3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{2,3})/);
      if (timeMatch) {
        const startSec = this.parseVttTimeToSeconds(timeMatch[1]);
        const endSec = this.parseVttTimeToSeconds(timeMatch[2]);
        const displayTime = this.formatSecondsToDisplay(startSec);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          // Strip any VTT tags like <v Voice> or <b>
          const cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
          if (cleaned) textLines.push(cleaned);
          i++;
        }

        const cueText = textLines.join(' ');
        if (cueText) {
          cues.push({
            startSeconds: startSec,
            endSeconds: endSec,
            displayTime,
            text: cueText,
          });
        }
      } else {
        i++;
      }
    }

    // Group cues into natural readable paragraphs (every ~30-45 seconds or 3-4 cues)
    const paragraphs: Array<{ startSeconds: number; endSeconds: number; displayTime: string; text: string }> = [];
    let currentPara = '';
    let paraStartSeconds = 0;
    let paraEndSeconds = 0;
    let cueCountInPara = 0;

    for (let c = 0; c < cues.length; c++) {
      const cue = cues[c];
      if (cueCountInPara === 0) {
        paraStartSeconds = cue.startSeconds;
      }
      currentPara += (currentPara ? ' ' : '') + cue.text;
      paraEndSeconds = cue.endSeconds;
      cueCountInPara++;

      const isLongEnough = (paraEndSeconds - paraStartSeconds) >= 30 || cueCountInPara >= 4;
      const endsWithSentence = /[.!?]$/.test(cue.text.trim());

      if ((isLongEnough && endsWithSentence) || c === cues.length - 1) {
        paragraphs.push({
          startSeconds: paraStartSeconds,
          endSeconds: paraEndSeconds,
          displayTime: this.formatSecondsToDisplay(paraStartSeconds),
          text: currentPara.trim(),
        });
        currentPara = '';
        cueCountInPara = 0;
      }
    }

    if (currentPara.trim()) {
      paragraphs.push({
        startSeconds: paraStartSeconds,
        endSeconds: paraEndSeconds,
        displayTime: this.formatSecondsToDisplay(paraStartSeconds),
        text: currentPara.trim(),
      });
    }

    const fullText = cues.map(c => c.text).join(' ');
    return {
      totalParagraphs: paragraphs.length,
      totalCues: cues.length,
      fullText,
      paragraphs,
      sentences: paragraphs,
      cues,
    };
  }

  private parseVttTimeToSeconds(timeStr: string): number {
    const parts = timeStr.replace(',', '.').split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr) || 0;
  }

  private formatSecondsToDisplay(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  /**
   * Batch fetch all lesson transcripts for an entire course in one single call.
   */
  async getCourseTranscripts(courseId: string, organizationId?: string) {
    if (!courseId) {
      throw new BadRequestException('courseId query parameter is required.');
    }

    const course = await this.courseRepo.findOne({
      where: organizationId ? { id: courseId, organizationId } : { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    const modules = await this.moduleRepo.find({
      where: organizationId ? { courseId, organizationId } : { courseId },
      order: { orderIndex: 'ASC' },
    });
    const moduleMap = new Map(modules.map((m) => [m.id, m.title]));

    const lessons = await this.lessonRepo.find({
      where: organizationId
        ? { courseId, organizationId, isDeleted: false }
        : { courseId, isDeleted: false },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    const resolvedOrgId = organizationId || course.organizationId;

    const results = [];
    for (const lesson of lessons) {
      const vUrl = lesson.videoUrl || lesson.contentUrl || '';
      const vimeoId = this.extractVimeoId(vUrl);

      let transcriptData: any = null;
      let hasTranscript = false;

      if (vimeoId) {
        try {
          const res = await this.getVideoTranscript(vUrl, resolvedOrgId);
          if (res && res.available) {
            hasTranscript = true;
            transcriptData = res;
          } else {
            transcriptData = { available: false, message: res?.message || 'Transcript not available' };
          }
        } catch (e: any) {
          transcriptData = { available: false, message: e.message };
        }
      } else {
        transcriptData = { available: false, message: 'No Vimeo video attached to this lesson' };
      }

      results.push({
        lessonId: lesson.id,
        moduleId: lesson.moduleId,
        moduleTitle: moduleMap.get(lesson.moduleId) || 'Module',
        lessonTitle: lesson.title,
        orderIndex: lesson.orderIndex || 0,
        durationMinutes: lesson.durationMinutes || 0,
        videoUrl: vUrl,
        vimeoId: vimeoId || null,
        hasTranscript,
        transcript: transcriptData,
      });
    }

    return {
      success: true,
      courseId: course.id,
      courseTitle: course.title,
      totalLessons: results.length,
      totalWithTranscripts: results.filter((r) => r.hasTranscript).length,
      lessons: results,
    };
  }

  async getVideoTranscript(videoIdOrUrl: string, organizationId?: string) {
    let target = videoIdOrUrl;
    if (target && !target.includes('vimeo.com') && isNaN(Number(target))) {
      try {
        const lesson = await this.lessonRepo.findOne({ where: { id: target } });
        if (lesson && (lesson.videoUrl || lesson.contentUrl)) {
          target = lesson.videoUrl || lesson.contentUrl;
          if (!organizationId) organizationId = lesson.organizationId;
        }
      } catch (e) {}
    }

    const videoId = this.extractVimeoId(target);
    if (!videoId) {
      throw new NotFoundException('Invalid Vimeo video URL or ID provided.');
    }

    const { client } = await this.getVimeoClientForOrg(organizationId);

    try {
      this.logger.log(`Fetching text tracks for Vimeo Video ID: ${videoId}`);
      const tracksRes = await this.vimeoRequest({
        method: 'GET',
        path: `/videos/${videoId}/texttracks`,
      }, client);

      const tracks = tracksRes?.body?.data || [];
      this.logger.log(`Found ${tracks.length} text tracks for video ${videoId}`);

      if (tracks.length === 0) {
        return {
          available: false,
          message: 'No transcript or captions found for this Vimeo video yet. (Vimeo may still be processing auto-transcription).',
          videoId,
          cues: [],
          fullText: '',
          totalCues: 0,
        };
      }

      // Pick the best track (prioritize active, captions, or english)
      const primaryTrack = tracks.find((t: any) => t.active && (t.type === 'captions' || t.type === 'subtitles')) ||
        tracks.find((t: any) => t.type === 'captions' || t.type === 'subtitles') ||
        tracks[0];

      if (!primaryTrack || !primaryTrack.link) {
        return {
          available: false,
          message: 'Transcript track found but download link is unavailable.',
          videoId,
          cues: [],
          fullText: '',
          totalCues: 0,
        };
      }

      // Download the WebVTT file content
      const response = await fetch(primaryTrack.link);
      if (!response.ok) {
        throw new Error(`Failed to download transcript file: HTTP ${response.status}`);
      }

      const vttContent = await response.text();
      const parsed = this.parseWebVTT(vttContent);

      return {
        available: true,
        videoId,
        trackInfo: {
          id: primaryTrack.id || primaryTrack.uri,
          language: primaryTrack.language,
          name: primaryTrack.name,
          type: primaryTrack.type,
        },
        ...parsed,
      };
    } catch (err: any) {
      this.logger.error(`Error fetching transcript for video ${videoId}:`, err);
      throw new InternalServerErrorException(err.message || 'Failed to retrieve Vimeo transcript.');
    }
  }
}
