import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MembersAreaService } from '../../../core/services/members-area.service.js';
import { createToolHandler } from '../tool-handler.js';

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
      customization: z.object({}).passthrough().optional().describe('Customization settings (branding, theme, player, etc.)'),
      internalShop: z.object({}).passthrough().optional().describe('Internal shop config'),
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
      imageUrl: z.string().optional().describe('Module image URL'),
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
      thumbnailUrl: z.string().optional().describe('Section thumbnail URL'),
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
      videoUrl: z.string().optional().describe('Video URL (for video lessons)'),
      content: z.object({}).passthrough().optional().describe('Lesson content (varies by type)'),
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
