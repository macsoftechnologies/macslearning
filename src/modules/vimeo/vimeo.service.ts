import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VimeoService {
  private readonly logger = new Logger(VimeoService.name);
  private readonly baseUrl = 'https://api.vimeo.com';

  constructor(private configService: ConfigService) {}

  private get headers() {
    return {
      Authorization: `bearer ${this.configService.get<string>('VIMEO_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    };
  }

  async getOrCreateOrganizationFolder(orgName: string): Promise<string> {
    try {
      // Clean up org name for folder
      const folderName = `Org_${orgName.replace(/[^a-zA-Z0-9 ]/g, '')}`;

      // Search for existing folder
      const searchRes = await fetch(`${this.baseUrl}/me/projects?query=${encodeURIComponent(folderName)}`, {
        headers: this.headers,
      });

      if (!searchRes.ok) {
        throw new Error(`Failed to fetch Vimeo projects: ${searchRes.statusText}`);
      }

      const searchData = await searchRes.json();
      const existingFolder = searchData.data?.find((f: any) => f.name === folderName);

      if (existingFolder) {
        return existingFolder.uri;
      }

      // Create new folder
      const createRes = await fetch(`${this.baseUrl}/me/projects`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ name: folderName }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create Vimeo project: ${createRes.statusText}`);
      }

      const createData = await createRes.json();
      return createData.uri;
    } catch (error) {
      this.logger.error('Error managing Vimeo folder', error);
      throw new InternalServerErrorException('Failed to manage Vimeo organization folder');
    }
  }

  async createUploadTicket(fileSize: number, videoName: string, folderUri?: string) {
    try {
      const body: any = {
        upload: {
          approach: 'tus',
          size: fileSize,
        },
        name: videoName || 'Untitled Video',
        privacy: {
          view: 'anybody', // Allows it to be played
          embed: 'public', // Allows it to be embedded in your LMS
        },
      };

      if (folderUri) {
        body.folder_uri = folderUri;
      }

      const res = await fetch(`${this.baseUrl}/me/videos`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Failed to create upload ticket: ${res.status} - ${errorText}`);
        throw new Error(`Vimeo API returned ${res.status}`);
      }

      const data = await res.json();
      
      // Explicitly move the video to the folder if folderUri is provided
      if (folderUri && data.uri) {
        try {
          await fetch(`${this.baseUrl}${folderUri}${data.uri}`, {
            method: 'PUT',
            headers: this.headers,
          });
        } catch (folderErr) {
          this.logger.warn(`Failed to move video to folder: ${folderErr.message}`);
        }
      }

      return {
        uploadLink: data.upload.upload_link,
        videoUri: data.uri,
        link: data.link, // The actual video link
      };
    } catch (error) {
      this.logger.error('Error generating Vimeo upload ticket', error);
      throw new InternalServerErrorException('Failed to generate video upload ticket');
    }
  }

  async getOrganizationFolderStorage(orgName: string): Promise<number> {
    try {
      const folderName = `Org_${orgName.replace(/[^a-zA-Z0-9 ]/g, '')}`;

      // 1. Get folder URI
      const searchRes = await fetch(`${this.baseUrl}/me/projects?query=${encodeURIComponent(folderName)}`, {
        headers: this.headers,
      });

      if (!searchRes.ok) return 0;
      
      const searchData = await searchRes.json();
      const existingFolder = searchData.data?.find((f: any) => f.name === folderName);

      if (!existingFolder) return 0;

      // 2. Fetch all videos in folder and sum upload.size
      let totalBytes = 0;
      let nextUrl: string | null = `${this.baseUrl}${existingFolder.uri}/videos?fields=upload.size,size&per_page=100`;

      while (nextUrl) {
        const videosRes: any = await fetch(nextUrl, { headers: this.headers });
        if (!videosRes.ok) break;

        const videosData: any = await videosRes.json();
        
        for (const video of videosData.data) {
          if (video.upload && video.upload.size) {
            totalBytes += Number(video.upload.size);
          } else if (video.size) {
            totalBytes += Number(video.size);
          }
        }

        // Handle pagination
        if (videosData.paging && videosData.paging.next) {
          nextUrl = `${this.baseUrl}${videosData.paging.next}`;
        } else {
          nextUrl = null;
        }
      }

      return totalBytes;
    } catch (error) {
      this.logger.error(`Error calculating storage for ${orgName}`, error);
      return 0; // Don't crash if calculation fails
    }
  }
}
