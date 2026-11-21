import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { Readable } from 'node:stream';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface CloudinaryAsset {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export interface CloudinaryVideoAsset {
  publicId: string;
  url: string;
  width: number;
  height: number;
  resourceType: 'video';
  format: 'mp4';
  bytes: number;
  posterUrl: string;
}

export interface CloudinaryMediaLibraryPage {
  items: CloudinaryAsset[];
  nextCursor: string | null;
}

interface CloudinaryResourcePage {
  resources: Array<{
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  }>;
  next_cursor?: string;
}

export interface CloudinaryImageUrlOptions {
  width?: number;
  height?: number;
  crop?: 'fit' | 'fill' | 'limit' | 'thumb';
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly folder: string;
  private readonly maxUploadBytes: number;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.folder = this.config.get<string>('CLOUDINARY_FOLDER', 'interior-portfolio/');
    this.maxUploadBytes = this.config.get<number>('CLOUDINARY_MAX_UPLOAD_BYTES', 10 * 1024 * 1024);

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL')?.trim();
    if (!cloudinaryUrl)
      throw new Error(
        'Cloudinary is not configured. Set CLOUDINARY_URL in the backend environment.',
      );
    const credentials = this.parseCloudinaryUrl(cloudinaryUrl);
    cloudinary.config({ ...credentials, secure: true });
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async uploadImage(buffer: Buffer): Promise<CloudinaryAsset> {
    this.assertSize(buffer);

    const detectedType = await fileTypeFromBuffer(buffer);
    if (!detectedType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedType.mime)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and AVIF images are supported.');
    }
    this.assertConfigured();

    try {
      const result = await this.uploadStream(buffer);
      return this.toAsset(result);
    } catch {
      this.logger.error('Cloudinary upload failed.');
      throw new ServiceUnavailableException('Image storage is temporarily unavailable.');
    }
  }

  async uploadVideo(buffer: Buffer): Promise<CloudinaryVideoAsset> {
    this.assertVideoSize(buffer);

    const detectedType = await fileTypeFromBuffer(buffer);
    if (!detectedType || detectedType.mime !== 'video/mp4') {
      throw new BadRequestException('Only MP4 videos are supported.');
    }
    this.assertConfigured();

    try {
      const result = await this.uploadVideoStream(buffer);
      const posterUrl = cloudinary.url(result.public_id, {
        secure: true,
        resource_type: 'video',
        type: 'upload',
        format: 'jpg',
        transformation: [{ start_offset: 0 }],
      });
      return {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        resourceType: 'video',
        format: 'mp4',
        bytes: result.bytes,
        posterUrl,
      };
    } catch {
      this.logger.error('Cloudinary video upload failed.');
      throw new ServiceUnavailableException('Video storage is temporarily unavailable.');
    }
  }

  async listImages(nextCursor?: string): Promise<CloudinaryMediaLibraryPage> {
    this.assertConfigured();
    try {
      const page = (await cloudinary.api.resources({
        resource_type: 'image',
        type: 'upload',
        max_results: 48,
        prefix: this.folder,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      })) as unknown as CloudinaryResourcePage;
      const items = page.resources.map((resource) => ({
        publicId: resource.public_id,
        url: this.getImageUrl(resource.public_id),
        width: resource.width,
        height: resource.height,
        format: resource.format,
        bytes: resource.bytes,
      }));
      return { items, nextCursor: page.next_cursor ?? null };
    } catch {
      this.logger.error('Cloudinary media library request failed.');
      throw new ServiceUnavailableException('Image storage is temporarily unavailable.');
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    this.assertConfigured();

    if (!publicId.trim() || publicId.includes('..')) {
      throw new BadRequestException('A valid Cloudinary public ID is required.');
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: 'image',
      });
    } catch {
      this.logger.error('Cloudinary deletion failed.');
      throw new ServiceUnavailableException('Image storage is temporarily unavailable.');
    }
  }

  getImageUrl(publicId: string, options: CloudinaryImageUrlOptions = {}): string {
    this.assertConfigured();

    const { width, height, crop = 'limit' } = options;
    const resize = width || height ? [{ width, height, crop }] : [];

    return cloudinary.url(publicId, {
      secure: true,
      resource_type: 'image',
      type: 'upload',
      transformation: [...resize, { quality: 'auto', fetch_format: 'auto' }],
    });
  }

  private uploadVideoStream(buffer: Buffer): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          resource_type: 'video',
          allowed_formats: ['mp4'],
          unique_filename: true,
          overwrite: false,
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(new Error(error?.message ?? 'Cloudinary returned no upload result.'));
            return;
          }
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(upload);
    });
  }

  private uploadStream(buffer: Buffer): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
          unique_filename: true,
          overwrite: false,
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(new Error(error?.message ?? 'Cloudinary returned no upload result.'));
            return;
          }
          resolve(result);
        },
      );

      Readable.from(buffer).pipe(upload);
    });
  }

  private toAsset(result: UploadApiResponse): CloudinaryAsset {
    return {
      publicId: result.public_id,
      url: this.getImageUrl(result.public_id),
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('Cloudinary is not configured on this server.');
    }
  }

  private parseCloudinaryUrl(value: string): {
    cloud_name: string;
    api_key: string;
    api_secret: string;
  } {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(
        'Cloudinary configuration is invalid. CLOUDINARY_URL must be a valid cloudinary:// URL.',
      );
    }
    if (parsed.protocol !== 'cloudinary:')
      throw new Error(
        'Cloudinary configuration is invalid. CLOUDINARY_URL must use the cloudinary:// scheme.',
      );
    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);
    if (!cloudName || !apiKey || !apiSecret)
      throw new Error(
        'Cloudinary configuration is incomplete. CLOUDINARY_URL must include cloud name, API key, and API secret.',
      );
    return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
  }

  private assertVideoSize(buffer: Buffer): void {
    if (buffer.length === 0) {
      throw new BadRequestException('A video file is required.');
    }
    if (buffer.length > this.maxUploadBytes) {
      throw new BadRequestException(`Video exceeds the ${this.maxUploadBytes} byte upload limit.`);
    }
  }

  private assertSize(buffer: Buffer): void {
    if (buffer.length === 0) {
      throw new BadRequestException('An image file is required.');
    }
    if (buffer.length > this.maxUploadBytes) {
      throw new BadRequestException(`Image exceeds the ${this.maxUploadBytes} byte upload limit.`);
    }
  }
}
