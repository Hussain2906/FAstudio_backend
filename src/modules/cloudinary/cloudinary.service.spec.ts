import { CloudinaryService } from './cloudinary.service.js';
import { v2 as cloudinary } from 'cloudinary';
import { PassThrough } from 'node:stream';

describe('CloudinaryService', () => {
  const service = new CloudinaryService({
    get: (key: string, defaultValue?: unknown) =>
      key === 'CLOUDINARY_URL' ? 'cloudinary://test-key:test-secret@test-cloud' : defaultValue,
  } as never);

  it('initializes from CLOUDINARY_URL without exposing credentials', () => {
    expect(service.isConfigured()).toBe(true);
  });

  it('fails clearly when Cloudinary credentials are missing', () => {
    expect(() => new CloudinaryService({ get: () => undefined } as never)).toThrow(
      'CLOUDINARY_URL',
    );
  });

  it('rejects content that is not a supported image', async () => {
    await expect(service.uploadImage(Buffer.from('not an image'))).rejects.toThrow(
      'Only JPEG, PNG, WebP, and AVIF images are supported.',
    );
  });

  it('rejects images over the configured maximum size', async () => {
    await expect(service.uploadImage(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow(
      'upload limit',
    );
  });

  it('rejects content that is not an MP4 video', async () => {
    await expect(service.uploadVideo(Buffer.from('not a video'))).rejects.toThrow(
      'Only MP4 videos are supported.',
    );
  });

  it('rejects videos over the configured maximum size', async () => {
    await expect(service.uploadVideo(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow(
      'upload limit',
    );
  });

  it('uploads MP4 videos with video options and returns a secure URL and frame-zero poster', async () => {
    const uploadResult = {
      public_id: 'interior-portfolio/background',
      secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/background.mp4',
      width: 1920,
      height: 1080,
      format: 'mp4',
      bytes: 500000,
    };
    const uploader = jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((
      options: unknown,
      callback: (error: undefined, result: typeof uploadResult) => void,
    ) => {
      setImmediate(() => callback(undefined, uploadResult));
      return new PassThrough();
    }) as never);
    const video = Buffer.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f,
      0x6d, 0x61, 0x76, 0x63, 0, 0,
    ]);
    try {
      const asset = await service.uploadVideo(video);
      expect(uploader).toHaveBeenCalledWith(
        expect.objectContaining({ resource_type: 'video', allowed_formats: ['mp4'] }),
        expect.any(Function),
      );
      expect(asset).toEqual({
        publicId: 'interior-portfolio/background',
        url: uploadResult.secure_url,
        width: 1920,
        height: 1080,
        resourceType: 'video',
        format: 'mp4',
        bytes: 500000,
        posterUrl: cloudinary.url(uploadResult.public_id, {
          secure: true,
          resource_type: 'video',
          type: 'upload',
          format: 'jpg',
          transformation: [{ start_offset: 0 }],
        }),
      });
      expect(new URL(asset.posterUrl).pathname.toLowerCase()).toMatch(/\.jpg$/);
    } finally {
      uploader.mockRestore();
    }
  });

  it('lists existing images from the configured Cloudinary folder with a pagination cursor', async () => {
    const resources = jest.spyOn(cloudinary.api, 'resources').mockResolvedValue({
      resources: [
        {
          public_id: 'interior-portfolio/workspace',
          width: 1600,
          height: 1000,
          format: 'jpg',
          bytes: 250000,
        },
      ],
      next_cursor: 'next-page',
    });
    try {
      const page = await service.listImages('current-page');
      expect(page.items).toEqual([
        expect.objectContaining({
          publicId: 'interior-portfolio/workspace',
          width: 1600,
          height: 1000,
          format: 'jpg',
          bytes: 250000,
        }),
      ]);
      expect(page.items[0]?.url).toContain('res.cloudinary.com/test-cloud/image/upload');
      expect(page.nextCursor).toBe('next-page');
      expect(resources).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'image',
          type: 'upload',
          prefix: 'interior-portfolio/',
          next_cursor: 'current-page',
        }),
      );
    } finally {
      resources.mockRestore();
    }
  });
});
