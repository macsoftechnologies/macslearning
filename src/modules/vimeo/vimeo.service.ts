import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

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
        if (error) return reject(error);
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
      const projectId = folderUri.split('/').pop();

      // 2. Create the video in the specific folder and get the tus upload link
      const res = await this.vimeoRequest({
        method: 'POST',
        path: `/me/projects/${projectId}/videos`,
        query: {
          upload: {
            approach: 'tus',
            size: fileSize
          },
          name: videoName,
          privacy: { view: 'unlisted', embed: 'public' }
        }
      });

      const uploadLink = res.body.upload.upload_link;
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
}