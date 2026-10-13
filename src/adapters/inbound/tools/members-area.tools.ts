import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MembersAreaService } from '../../../core/services/members-area.service.js';
import { createToolHandler } from '../tool-handler.js';
import { acceptedExtensions } from '../../../shared/local-file.js';

/** When a module or section unlocks for a student, counted from the reference date. */
const dripSettingsSchema = z.object({
  enabled: z.boolean(),
  daysAfterPurchase: z.number().int().min(0).max(365).describe('Days after the reference date'),
  referenceDate: z.enum(['purchase', 'enrollment', 'first_access']),
});

/** A lesson's `content`, whose fields depend on its type (video, text, file/pdf, quiz). */
const lessonContentSchema = z.object({
  videoUrl: z.string().optional().describe('Video URL (for video lessons)'),
  videoProvider: z.enum(['youtube', 'vimeo', 'bunny', 'cloudflare', 's3']).optional(),
  videoSourceType: z.string().optional(),
  videoId: z.string().optional(),
  videoDuration: z.number().optional(),
  videoThumbnail: z.string().optional(),
  videoQualities: z.array(z.string()).optional(),
  textHtml: z.string().max(500000).optional().describe('HTML content (for text lessons)'),
  textMarkdown: z.string().max(500000).optional().describe('Markdown content (for text lessons)'),
  estimatedReadTime: z.number().optional(),
  fileUrl: z.string().optional()
    .describe('File URL (for file/pdf lessons): the `url` of upload_members_area_file with kind "file"'),
  fileName: z.string().max(500).optional(),
  fileSize: z.number().optional(),
  fileType: z.string().max(100).optional(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string().max(2000),
    options: z.array(z.object({
      id: z.string(),
      text: z.string().max(1000),
      isCorrect: z.boolean().optional(),
    })).max(20).optional(),
    type: z.string().optional(),
  })).max(100).optional().describe('Quiz questions (for quiz lessons)'),
  minScore: z.number().optional(),
  allowRetry: z.boolean().optional(),
});

export function registerMembersAreaTools(server: McpServer, service: MembersAreaService) {
  // --- Areas ---
  server.tool(
    'list_members_areas',
    'List all members areas for the authenticated seller',
    createToolHandler('list_members_areas', async () => {
      const areas = await service.list();
      return { areas };
    }),
  );

  server.registerTool('get_members_area', {
    description: 'Get full details of a members area (settings, stats, customization)',
    inputSchema: { areaId: z.string().describe('Members area ID') },
  }, createToolHandler('get_members_area', async ({ areaId }) => {
    const area = await service.getById(areaId);
    return { area };
  }));

  server.registerTool('create_members_area', {
    description: 'Create a new members area linked to a product',
    inputSchema: {
      name: z.string().describe('Members area name'),
      productId: z.string().describe('Product ID to link'),
    },
  }, createToolHandler('create_members_area', async (args) => {
    const area = await service.create(args);
    return { success: true, area };
  }));

  server.registerTool('update_members_area', {
    description: 'Update members area customization or internal shop settings',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      customization: z.object({
        branding: z.object({
          logoUrl: z.string().optional(), logoPosition: z.string().optional(), logoSize: z.string().optional(),
          favicon: z.string().optional(), siteName: z.string().max(200).optional(), tagline: z.string().max(500).optional(),
          sidebarLogoUrl: z.string().optional(), sidebarText: z.string().max(200).optional(),
          sidebarDisplayMode: z.string().optional(),
          heroBannerUrl: z.string().optional(), heroText: z.string().max(500).optional(), heroDisplayMode: z.string().optional(),
        }).optional(),
        theme: z.object({
          preset: z.enum(['dark-purple', 'modern-dark', 'clean-light', 'vibrant-gradient', 'ocean-blue', 'forest-green', 'dark-red', 'dark-orange', 'custom']).optional(),
          colors: z.record(z.string(), z.string()).optional(),
          typography: z.record(z.string(), z.unknown()).optional(),
          layout: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
        player: z.object({
          video: z.object({
            primaryColor: z.string().optional(), progressColor: z.string().optional(),
            controlsPosition: z.string().optional(), autoplay: z.boolean().optional(),
            showPlaybackSpeed: z.boolean().optional(), showQuality: z.boolean().optional(),
            showTheaterMode: z.boolean().optional(), showPictureInPicture: z.boolean().optional(),
            watermark: z.record(z.string(), z.unknown()).optional(),
          }).optional(),
          sidebar: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
        components: z.record(z.string(), z.unknown()).optional().describe('Component customizations (moduleCard, heroBanner, etc.)'),
        navigation: z.record(z.string(), z.unknown()).optional().describe('Navigation menu and breadcrumb settings'),
        pages: z.record(z.string(), z.unknown()).optional().describe('Page layout settings (dashboard, course, watch)'),
        seo: z.object({
          metaTitle: z.string().max(200).optional(), metaDescription: z.string().max(500).optional(),
          ogImage: z.string().optional(), twitterCard: z.string().optional(),
        }).optional(),
        advanced: z.object({
          customCss: z.string().max(50000).optional(), customScripts: z.string().max(10000).optional(),
          analytics: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
      }).optional().describe('Customization settings (branding, theme, player, SEO, etc.)'),
      internalShop: z.object({
        enabled: z.boolean(),
        selectedProducts: z.array(z.string()).max(100),
        productLinks: z.record(z.string(), z.string()).optional(),
        productOriginalPrices: z.record(z.string(), z.number()).optional(),
        productButtonTexts: z.record(z.string(), z.string()).optional(),
        bannerUrl: z.string().optional(),
        buttonText: z.string().max(100).optional(),
        carouselTitle: z.string().max(200).optional(),
        displayMode: z.enum(['button', 'carousel']).optional(),
      }).optional().describe('Internal shop config'),
    },
  }, createToolHandler('update_members_area', async ({ areaId, ...payload }) => {
    await service.update(areaId, payload);
    return { success: true, message: `Members area ${areaId} updated` };
  }));

  server.registerTool('duplicate_members_area', {
    description: 'Duplicate a members area to a new product (copies modules, sections, lessons)',
    inputSchema: {
      sourceAreaId: z.string().describe('Source members area ID'),
      newProductId: z.string().describe('Product ID for the new area'),
      newName: z.string().optional().describe('Name for the duplicated area'),
    },
  }, createToolHandler('duplicate_members_area', async ({ sourceAreaId, newProductId, newName }) => {
    const result = await service.duplicate(sourceAreaId, newProductId, newName);
    return { success: true, ...result };
  }));

  // --- Modules ---
  server.registerTool('list_modules', {
    description: 'List all modules in a members area',
    inputSchema: { areaId: z.string().describe('Members area ID') },
  }, createToolHandler('list_modules', async ({ areaId }) => {
    const modules = await service.listModules(areaId);
    return { modules };
  }));

  server.registerTool('create_module', {
    description: 'Create a new module in a members area',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      title: z.string().describe('Module title'),
      description: z.string().optional().describe('Module description'),
      imageUrl: z.string().optional().describe('Module image URL (upload_members_area_file with kind "image")'),
      dripSettings: dripSettingsSchema.optional()
        .describe('Release the module only N days after purchase, enrollment or first access'),
    },
  }, createToolHandler('create_module', async ({ areaId, ...input }) => {
    const result = await service.createModule(areaId, input);
    return { success: true, moduleId: result.id };
  }));

  server.registerTool('reorder_modules', {
    description: 'Reorder modules in a members area',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleIds: z.array(z.string()).describe('Module IDs in desired order'),
    },
  }, createToolHandler('reorder_modules', async ({ areaId, moduleIds }) => {
    const result = await service.reorderModules(areaId, moduleIds);
    return { success: true, updated: result.updated };
  }));

  // --- Sections ---
  server.registerTool('list_sections', {
    description: 'List all sections in a module',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
    },
  }, createToolHandler('list_sections', async ({ areaId, moduleId }) => {
    const sections = await service.listSections(areaId, moduleId);
    return { sections };
  }));

  server.registerTool('create_section', {
    description: 'Create a new section in a module',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      title: z.string().describe('Section title'),
      description: z.string().optional().describe('Section description'),
      thumbnailUrl: z.string().optional().describe('Section thumbnail URL (upload_members_area_file with kind "image")'),
      showTitleOverlay: z.boolean().optional().describe('Show the title over the thumbnail'),
      showImageOnly: z.boolean().optional().describe('Show only the thumbnail, without the title'),
      order: z.number().int().min(0).optional().describe('Position in the module (default: at the end)'),
      dripSettings: dripSettingsSchema.optional()
        .describe('Release the section only N days after purchase, enrollment or first access'),
    },
  }, createToolHandler('create_section', async ({ areaId, moduleId, ...input }) => {
    const result = await service.createSection(areaId, moduleId, input);
    return { success: true, ...result };
  }));

  server.registerTool('reorder_sections', {
    description: 'Reorder sections in a module',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionIds: z.array(z.string()).describe('Section IDs in desired order'),
    },
  }, createToolHandler('reorder_sections', async ({ areaId, moduleId, sectionIds }) => {
    const result = await service.reorderSections(areaId, moduleId, sectionIds);
    return { success: true, updated: result.updated };
  }));

  // --- Lessons ---
  server.registerTool('list_lessons', {
    description: 'List all lessons in a section',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
    },
  }, createToolHandler('list_lessons', async ({ areaId, moduleId, sectionId }) => {
    const lessons = await service.listLessons(areaId, moduleId, sectionId);
    return { lessons };
  }));

  server.registerTool('create_lesson', {
    description: 'Create a new lesson in a section',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      title: z.string().describe('Lesson title'),
      description: z.string().optional().describe('Lesson description'),
      type: z.enum(['video', 'text', 'pdf', 'quiz', 'file']).describe('Lesson type'),
      duration: z.number().optional().describe('Duration in seconds'),
      order: z.number().int().min(0).optional().describe('Position in the section (default: at the end)'),
      thumbnailUrl: z.string().optional().describe('Lesson cover image URL (upload_members_area_file with kind "image")'),
      showTitleOverlay: z.boolean().optional().describe('Show the title over the cover'),
      showImageOnly: z.boolean().optional().describe('Show only the cover, without the title'),
      videoUrl: z.string().optional()
        .describe('Video URL. For a video uploaded with upload_members_area_file, pass its `url` here and in '
          + '`content.videoUrl`, with `content.videoSourceType: "upload"`'),
      content: lessonContentSchema.optional()
        .describe('Lesson content (fields depend on lesson type: video, text, file, quiz)'),
    },
  }, createToolHandler('create_lesson', async ({ areaId, moduleId, sectionId, ...input }) => {
    const result = await service.createLesson(areaId, moduleId, sectionId, input);
    return { success: true, ...result };
  }));

  server.registerTool('reorder_lessons', {
    description: 'Reorder lessons in a section',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonIds: z.array(z.string()).describe('Lesson IDs in desired order'),
    },
  }, createToolHandler('reorder_lessons', async ({ areaId, moduleId, sectionId, lessonIds }) => {
    const result = await service.reorderLessons(areaId, moduleId, sectionId, lessonIds);
    return { success: true, updated: result.updated };
  }));

  server.registerTool('create_pdf_lessons', {
    description:
      'Create several PDF lessons in a section at once, appended in order: the same route as the dashboard\'s '
      + 'PDF import. Upload each PDF first with upload_members_area_file (kind "file") and pass its `url`.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessons: z.array(z.object({
        title: z.string().trim().min(1).max(200).describe('Lesson title'),
        description: z.string().max(2000).optional(),
        fileUrl: z.string().url().max(2048)
          .refine((value) => value.toLowerCase().startsWith('https://'), 'must be an https URL')
          .describe('The `url` returned by upload_members_area_file'),
        fileName: z.string().trim().min(1).max(300),
        fileSize: z.number().int().min(0).optional().describe('Bytes'),
      })).min(1).max(100),
    },
  }, createToolHandler('create_pdf_lessons', async ({ areaId, moduleId, sectionId, lessons }) => {
    const result = await service.createPdfLessons(areaId, moduleId, sectionId, lessons);
    return { success: true, ...result };
  }));

  // --- Editing and deleting the course structure ---
  server.registerTool('update_module', {
    description: 'Edit a module. Only the fields sent change; `dripSettings: null` removes the release rule '
      + 'and `imageUrl: ""` removes the image.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      imageUrl: z.string().optional().describe('Module image URL; "" removes it'),
      locked: z.boolean().optional().describe('Lock the module for students'),
      dripSettings: dripSettingsSchema.nullable().optional(),
    },
  }, createToolHandler('update_module', async ({ areaId, moduleId, ...input }) => {
    await service.updateModule(areaId, moduleId, input);
    return { success: true, message: `Module ${moduleId} updated` };
  }));

  server.registerTool('delete_module', {
    description: 'Delete a module WITH ALL ITS SECTIONS AND LESSONS. Irreversible: confirm with the seller first.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
    },
  }, createToolHandler('delete_module', async ({ areaId, moduleId }) => {
    const result = await service.deleteModule(areaId, moduleId);
    return { success: true, ...result };
  }));

  server.registerTool('update_section', {
    description: 'Edit a section. Only the fields sent change; `dripSettings: null` removes the release rule '
      + 'and `thumbnailUrl: ""` removes the cover.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      thumbnailUrl: z.string().optional().describe('Section cover URL; "" removes it'),
      showTitleOverlay: z.boolean().optional(),
      showImageOnly: z.boolean().optional(),
      dripSettings: dripSettingsSchema.nullable().optional(),
    },
  }, createToolHandler('update_section', async ({ areaId, moduleId, sectionId, ...input }) => {
    await service.updateSection(areaId, moduleId, sectionId, input);
    return { success: true, message: `Section ${sectionId} updated` };
  }));

  server.registerTool('delete_section', {
    description: 'Delete a section WITH ALL ITS LESSONS. Irreversible: confirm with the seller first.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
    },
  }, createToolHandler('delete_section', async ({ areaId, moduleId, sectionId }) => {
    const result = await service.deleteSection(areaId, moduleId, sectionId);
    return { success: true, ...result };
  }));

  server.registerTool('update_lesson', {
    description: 'Edit a lesson. Only the fields sent change. A new `content` is merged by lesson type the way '
      + 'the dashboard does it (a new PDF keeps the stored file name when none is sent; a video URL is '
      + 'matched to its provider).',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonId: z.string().describe('Lesson ID'),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      type: z.enum(['video', 'text', 'pdf', 'quiz', 'file']).optional(),
      duration: z.number().int().min(0).optional().describe('Duration in seconds'),
      order: z.number().int().min(0).optional(),
      thumbnailUrl: z.string().optional(),
      showTitleOverlay: z.boolean().optional(),
      showImageOnly: z.boolean().optional(),
      isPublished: z.boolean().optional(),
      videoUrl: z.string().optional().describe('Video URL; "" removes the video'),
      content: lessonContentSchema.optional(),
    },
  }, createToolHandler('update_lesson', async ({ areaId, moduleId, sectionId, lessonId, ...input }) => {
    const result = await service.updateLesson(areaId, moduleId, sectionId, lessonId, input);
    return { success: true, ...result };
  }));

  server.registerTool('delete_lesson', {
    description: 'Delete a lesson with its attachments. Irreversible: confirm with the seller first.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonId: z.string().describe('Lesson ID'),
    },
  }, createToolHandler('delete_lesson', async ({ areaId, moduleId, sectionId, lessonId }) => {
    const result = await service.deleteLesson(areaId, moduleId, sectionId, lessonId);
    return { success: true, ...result };
  }));

  // --- Lesson attachments (complementary material) ---
  server.registerTool('list_lesson_attachments', {
    description: 'List the complementary files of a lesson',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonId: z.string().describe('Lesson ID'),
    },
  }, createToolHandler('list_lesson_attachments', async ({ areaId, moduleId, sectionId, lessonId }) => {
    const attachments = await service.listLessonAttachments(areaId, moduleId, sectionId, lessonId);
    return { attachments };
  }));

  server.registerTool('add_lesson_attachment', {
    description:
      'Attach a complementary file to a lesson (shown to students under the lesson). Upload it first with '
      + 'upload_members_area_file (kind "file") and pass its `url`, `filePath`, `fileType` as `mime` and '
      + '`fileSize` as `sizeBytes`; with `filePath` the student\'s download link is signed afresh on each click.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonId: z.string().describe('Lesson ID'),
      name: z.string().min(1).max(200).describe('Name shown to students'),
      url: z.string().url().max(2048)
        .refine((value) => value.toLowerCase().startsWith('https://'), 'must be an https URL'),
      mime: z.string().min(1).max(200).describe('MIME type, e.g. application/pdf'),
      sizeBytes: z.number().int().min(0).max(100 * 1024 * 1024),
      filePath: z.string().min(1).max(1024).optional()
        .describe('The storage key from upload_members_area_file; omit for an external link'),
    },
  }, createToolHandler('add_lesson_attachment', async ({ areaId, moduleId, sectionId, lessonId, ...input }) => {
    const attachment = await service.addLessonAttachment(areaId, moduleId, sectionId, lessonId, input);
    return { success: true, attachment };
  }));

  server.registerTool('delete_lesson_attachment', {
    description: 'Remove a complementary file from a lesson; an uploaded file is deleted from storage too',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      moduleId: z.string().describe('Module ID'),
      sectionId: z.string().describe('Section ID'),
      lessonId: z.string().describe('Lesson ID'),
      attachmentId: z.string().describe('Attachment ID, from list_lesson_attachments'),
    },
  }, createToolHandler('delete_lesson_attachment', async ({ areaId, moduleId, sectionId, lessonId, attachmentId }) => {
    await service.deleteLessonAttachment(areaId, moduleId, sectionId, lessonId, attachmentId);
    return { success: true, message: `Attachment ${attachmentId} removed` };
  }));

  // --- Uploads ---
  server.registerTool('upload_members_area_file', {
    description:
      'Upload a file from the machine running this MCP server for a members area. The file must already be '
      + 'on disk (the seller sends it; nothing is downloaded from another platform). Returns `url` (and '
      + '`filePath` for video and file) to pass on:\n'
      + '- kind "image" (' + acceptedExtensions('image').join(' ') + '): update_members_area branding '
      + '(logoUrl, heroBannerUrl, favicon…), create_module imageUrl, create_section / create_lesson thumbnailUrl. '
      + 'Use preset "banner" for tall banners so they are not cropped.\n'
      + '- kind "video" (' + acceptedExtensions('video').join(' ') + ', up to 500 MB): create_lesson type '
      + '"video" with videoUrl = url and content { videoUrl: url, videoSourceType: "upload" }.\n'
      + '- kind "file" (' + acceptedExtensions('file').join(' ') + ', up to 100 MB, needs areaId): '
      + 'create_pdf_lessons / create_lesson content.fileUrl, or add_lesson_attachment.',
    inputSchema: {
      localPath: z.string().min(1).describe('Absolute path of the file on the machine running this server'),
      kind: z.enum(['image', 'video', 'file']).describe('What the file is for'),
      areaId: z.string().optional().describe('Members area ID; required for kind "file"'),
      preset: z.enum(['banner']).optional().describe('Image processing preset for tall banners (kind "image")'),
    },
  }, createToolHandler('upload_members_area_file', async (args) => {
    const upload = await service.uploadFile(args);
    return { success: true, upload };
  }));

  // --- Classes ---
  server.registerTool('list_classes', {
    description: 'List all classes in a members area',
    inputSchema: { areaId: z.string().describe('Members area ID') },
  }, createToolHandler('list_classes', async ({ areaId }) => {
    const classes = await service.listClasses(areaId);
    return { classes };
  }));

  server.registerTool('create_class', {
    description: 'Create a new class in a members area',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      name: z.string().describe('Class name'),
      description: z.string().optional().describe('Class description'),
      startDate: z.string().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      capacityMax: z.number().optional().describe('Maximum student capacity'),
      isDefault: z.boolean().optional().describe('Set as default class'),
    },
  }, createToolHandler('create_class', async ({ areaId, ...input }) => {
    const classData = await service.createClass(areaId, input);
    return { success: true, class: classData };
  }));

  // --- Students ---
  server.registerTool('list_students', {
    description: 'List all students in a members area',
    inputSchema: { areaId: z.string().describe('Members area ID') },
  }, createToolHandler('list_students', async ({ areaId }) => {
    const students = await service.listStudents(areaId);
    return { students };
  }));

  server.registerTool('get_student', {
    description: 'Get details of a specific student',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      studentId: z.string().describe('Student ID'),
    },
  }, createToolHandler('get_student', async ({ areaId, studentId }) => {
    const student = await service.getStudent(areaId, studentId);
    return { student };
  }));

  server.registerTool('add_student', {
    description: 'Add a student to a members area (creates auth account and optionally sends welcome email)',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      name: z.string().describe('Student name'),
      email: z.string().describe('Student email'),
      classId: z.string().optional().describe('Class ID to enroll in'),
      sendWelcomeEmail: z.boolean().optional().describe('Send welcome email (default: true)'),
    },
  }, createToolHandler('add_student', async ({ areaId, ...input }) => {
    const result = await service.addStudent(areaId, input);
    return { success: true, ...result };
  }));

  server.registerTool('update_student', {
    description: 'Update a student (name, email, class, status, avatar)',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      studentId: z.string().describe('Student ID'),
      name: z.string().optional().describe('Student name'),
      email: z.string().optional().describe('Student email'),
      classId: z.string().optional().describe('Class ID'),
      status: z.enum(['active', 'inactive', 'blocked']).optional().describe('Student status'),
      avatarUrl: z.string().optional().describe('Avatar URL'),
    },
  }, createToolHandler('update_student', async ({ areaId, studentId, ...input }) => {
    await service.updateStudent(areaId, studentId, input);
    return { success: true, message: `Student ${studentId} updated` };
  }));

  server.registerTool('import_students', {
    description: 'Import students in bulk (max 100 per request). Creates accounts and sends welcome emails.',
    inputSchema: {
      areaId: z.string().describe('Members area ID'),
      students: z.array(z.object({
        name: z.string().optional().describe('Student name'),
        email: z.string().describe('Student email'),
        phone: z.string().optional().describe('Student phone'),
      })).describe('List of students to import (max 100)'),
      classId: z.string().optional().describe('Class ID to enroll all imported students'),
    },
  }, createToolHandler('import_students', async ({ areaId, ...input }) => {
    const result = await service.importStudents(areaId, input);
    return { success: true, ...result };
  }));
}
