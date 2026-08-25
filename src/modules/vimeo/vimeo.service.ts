import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private vimeoClient: any = null;

  constructor(private configService: ConfigService) {
    this.initVimeo();
  }

  private initVimeo() {
    try {
      const Vimeo = require('vimeo').Vimeo;
      const clientId = this.configService.get<string>('VIMEO_CLIENT_ID') || process.env.VIMEO_CLIENT_ID;
      const clientSecret = this.configService.get<string>('VIMEO_CLIENT_SECRET') || process.env.VIMEO_CLIENT_SECRET;
      const accessToken = this.configService.get<string>('VIMEO_ACCESS_TOKEN') || process.env.VIMEO_ACCESS_TOKEN;

      if (clientId && clientSecret && accessToken) {
        this.vimeoClient = new Vimeo(clientId, clientSecret, accessToken);
        this.logger.log('Vimeo SDK initialized successfully.');
      } else {
        this.logger.warn('Vimeo credentials missing. Vimeo integration will not work.');
      }
    } catch (e) {
      this.logger.error('Failed to initialize Vimeo SDK', e);
    }
  }

  private vimeoRequest(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.vimeoClient) return reject(new Error('Vimeo client not initialized'));
      this.vimeoClient.request(options, (error: any, body: any, statusCode: any, headers: any) => {
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

  async getOrCreateFolder(folderName: string): Promise<string> {
    try {
      const searchRes = await this.vimeoRequest({
        method: 'GET',
        path: '/me/projects',
        query: { query: folderName }
      });

      const projects = searchRes.body.data;
      const existing = projects.find((p: any) => p.name === folderName);

      if (existing) return existing.uri;

      const createRes = await this.vimeoRequest({
        method: 'POST',
        path: '/me/projects',
        query: { name: folderName }
      });

      return createRes.body.uri;
    } catch (err) {
      this.logger.error('Error managing Vimeo folder', err);
      throw new InternalServerErrorException('Failed to manage Vimeo folders');
    }
  }

  async generateUploadTicket(fileSize: number, videoName: string, orgName: string): Promise<{ uploadLink: string, link: string, vimeoId: string }> {
    if (!this.vimeoClient) {
      throw new InternalServerErrorException('Vimeo client not initialized. Check .env');
    }

    try {
      // 1. Get or create org folder
      const folderUri = await this.getOrCreateFolder(orgName);

      // 2. Create the video and get the tus upload link
      const res = await this.vimeoRequest({
        method: 'POST',
        path: '/me/videos',
        query: {
          upload: {
            approach: 'tus',
            size: String(fileSize)
          },
          name: videoName,
          folder_uri: folderUri,
          privacy: { view: 'unlisted', embed: 'public' }
        }
      });

      this.logger.log('Vimeo Response Body: ' + JSON.stringify(res.body));
      const uploadLink = res.body.upload?.upload_link;
      const link = res.body.link; // e.g. https://vimeo.com/123456789
      const vimeoId = res.body.uri.replace('/videos/', '');

      return { uploadLink, link, vimeoId };
    } catch (err) {
      this.logger.error('Failed to generate Vimeo upload ticket', err);
      throw new InternalServerErrorException('Failed to initialize Vimeo upload');
    }
  }

  async getOrganizationFolderStorage(orgName: string): Promise<number> { return 0; }
  async deleteLocalVideo(filename: string): Promise<{ deleted: boolean; filename: string }> { return { deleted: true, filename }; }

  extractVimeoId(input: string): string | null {
    if (!input) return null;
    const str = input.trim();
    if (/^\d+$/.test(str)) return str;
    const match = str.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    return match ? match[1] : null;
  }

  private parseTimestampToSeconds(ts: string): number {
    const parts = ts.trim().split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return Math.floor(hours * 3600 + minutes * 60 + seconds);
    } else if (parts.length === 2) {
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return Math.floor(minutes * 60 + seconds);
    }
    return 0;
  }

  private formatSecondsToDisplay(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      const remMins = mins % 60;
      return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseWebVTT(vttContent: string) {
    const lines = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cues: Array<{
      id: string;
      start: string;
      end: string;
      startSeconds: number;
      endSeconds: number;
      displayTime: string;
      text: string;
    }> = [];

    let i = 0;
    let cueIndex = 1;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const parts = line.split('-->');
        const startRaw = parts[0].trim().split(' ')[0];
        const endRaw = parts[1].trim().split(' ')[0];

        const startSeconds = this.parseTimestampToSeconds(startRaw);
        const endSeconds = this.parseTimestampToSeconds(endRaw);
        const displayTime = this.formatSecondsToDisplay(startSeconds);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
          const cleanLine = lines[i].replace(/<[^>]+>/g, '').trim();
          if (cleanLine) {
            textLines.push(cleanLine);
          }
          i++;
        }

        const rawText = textLines.join(' ');
        const text = this.decodeHtmlEntities(rawText);

        if (text) {
          cues.push({
            id: `cue-${cueIndex++}`,
            start: startRaw,
            end: endRaw,
            startSeconds,
            endSeconds,
            displayTime,
            text,
          });
        }
      } else {
        i++;
      }
    }

    // Group cues into complete paragraphs (matching Vimeo's transcript block view)
    const paragraphs: Array<{
      id: string;
      startSeconds: number;
      endSeconds: number;
      displayTime: string;
      text: string;
    }> = [];

    let currentPara = '';
    let paraStartSeconds = 0;
    let paraEndSeconds = 0;
    let paraIndex = 1;

    for (let j = 0; j < cues.length; j++) {
      const cue = cues[j];
      if (!currentPara) {
        paraStartSeconds = cue.startSeconds;
      }

      currentPara = currentPara ? `${currentPara} ${cue.text}` : cue.text;
      paraEndSeconds = cue.endSeconds;

      const wordsCount = currentPara.trim().split(/\s+/).length;
      const duration = paraEndSeconds - paraStartSeconds;
      const nextCue = cues[j + 1];
      const hasPauseAfter = nextCue ? (nextCue.startSeconds - cue.endSeconds > 1.8) : true;
      const isSentenceEnd = /[.?!]$/.test(cue.text.trim());

      // Vimeo-style paragraph grouping: combines short questions + following sentences until ~25-35 words or pause
      const shouldBreak = (isSentenceEnd && (wordsCount >= 22 || duration >= 14 || hasPauseAfter)) || (wordsCount >= 40) || j === cues.length - 1;

      if (shouldBreak) {
        paragraphs.push({
          id: `para-${paraIndex++}`,
          startSeconds: paraStartSeconds,
          endSeconds: paraEndSeconds,
          displayTime: this.formatSecondsToDisplay(paraStartSeconds),
          text: currentPara.trim(),
        });
        currentPara = '';
      }
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

  async getVideoTranscript(videoIdOrUrl: string) {
    const videoId = this.extractVimeoId(videoIdOrUrl);
    if (!videoId) {
      throw new NotFoundException('Invalid Vimeo video URL or ID provided.');
    }

    if (!this.vimeoClient) {
      throw new InternalServerErrorException('Vimeo client is not initialized. Check server .env settings.');
    }

    try {
      this.logger.log(`Fetching text tracks for Vimeo Video ID: ${videoId}`);
      const tracksRes = await this.vimeoRequest({
        method: 'GET',
        path: `/videos/${videoId}/texttracks`,
      });

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

