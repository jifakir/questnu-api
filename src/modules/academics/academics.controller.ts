import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/user.schema';
import {
  CreateCollegeDto,
  CreateDepartmentDto,
  CreateQuestionDto,
  CreateSubjectDto,
  CreateYearDto,
  LinkAcademicCourseDto,
  UpdateAcademicCourseDto,
  UpdateCollegeDto,
  UpdateDepartmentDto,
  UpdateQuestionDto,
  UpdateSubjectDto,
  UpdateYearDto,
} from './dto/academic.dto';
import { AcademicDraftStatus } from './academic.constants';
import { CoursesService } from './courses.service';
import { QuestionsService } from './questions.service';
import { CatalogSeedService } from './seed/catalog-seed.service';
import { StructureService } from './structure.service';
import { SubjectsService } from './subjects.service';

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AcademicsController {
  constructor(
    private readonly structure: StructureService,
    private readonly subjects: SubjectsService,
    private readonly courses: CoursesService,
    private readonly questions: QuestionsService,
    private readonly catalogSeed: CatalogSeedService,
  ) {}

  @Get('overview')
  overview() {
    return this.structure.overview();
  }

  @Post('bootstrap')
  bootstrap() {
    return this.structure.bootstrap();
  }

  @Post('sync-app-catalog')
  syncAppCatalog() {
    return this.catalogSeed.syncAppCatalog();
  }

  @Get('colleges')
  listColleges() {
    return this.structure.listColleges();
  }

  @Post('colleges')
  createCollege(@Body() dto: CreateCollegeDto) {
    return this.structure.createCollege(dto);
  }

  @Patch('colleges/:slug')
  updateCollege(@Param('slug') slug: string, @Body() dto: UpdateCollegeDto) {
    return this.structure.updateCollege(slug, dto);
  }

  @Delete('colleges/:slug')
  removeCollege(@Param('slug') slug: string) {
    return this.structure.removeCollege(slug);
  }

  @Get('departments')
  listDepartments() {
    return this.structure.listDepartments();
  }

  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.structure.createDepartment(dto);
  }

  @Patch('departments/:slug')
  updateDepartment(
    @Param('slug') slug: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.structure.updateDepartment(slug, dto);
  }

  @Delete('departments/:slug')
  removeDepartment(@Param('slug') slug: string) {
    return this.structure.removeDepartment(slug);
  }

  @Get('years')
  listYears() {
    return this.structure.listYears();
  }

  @Post('years')
  createYear(@Body() dto: CreateYearDto) {
    return this.structure.createYear(dto);
  }

  @Patch('years/:slug')
  updateYear(@Param('slug') slug: string, @Body() dto: UpdateYearDto) {
    return this.structure.updateYear(slug, dto);
  }

  @Delete('years/:slug')
  removeYear(@Param('slug') slug: string) {
    return this.structure.removeYear(slug);
  }

  @Get('courses')
  listCourses() {
    return this.courses.list();
  }

  @Post('courses/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  uploadCourse(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('yearId') yearId?: string,
    @Body('departmentIds') departmentIds?: string,
    @Body('status') status?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a JSON course file');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('File is not valid JSON');
    }
    let ids: string[] = [];
    try {
      const raw = departmentIds ? JSON.parse(departmentIds) : [];
      ids = Array.isArray(raw) ? raw.map((id) => String(id)) : [];
    } catch {
      throw new BadRequestException('Choose at least one department');
    }
    return this.subjects.publishUpload(parsed, {
      yearId: yearId ?? '',
      departmentIds: ids,
      status:
        status === AcademicDraftStatus.Draft
          ? AcademicDraftStatus.Draft
          : AcademicDraftStatus.Ready,
    });
  }

  @Delete('courses/:code')
  removeCourse(@Param('code') code: string) {
    return this.subjects.removeByCode(code);
  }

  @Post('courses/:code/link')
  linkCourse(@Param('code') code: string, @Body() dto: LinkAcademicCourseDto) {
    return this.subjects.linkStoredCourse(code, dto);
  }

  @Get('courses/:code')
  async courseByCode(@Param('code') code: string) {
    const course = await this.courses.findByCode(code);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  @Patch('courses/:code')
  async updateCourse(
    @Param('code') code: string,
    @Body() dto: UpdateAcademicCourseDto,
  ) {
    const course = await this.courses.updateByCode(code, dto);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  @Get('subjects')
  listSubjects(
    @Query('departmentId') departmentId?: string,
    @Query('yearId') yearId?: string,
    @Query('status') status?: string,
  ) {
    return this.subjects.list({ departmentId, yearId, status });
  }

  @Post('subjects/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  importSubjects(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('createMissingStructure') createMissingStructure?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a JSON syllabus file');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('File is not valid JSON');
    }
    return this.subjects.importJson(parsed, {
      createMissingStructure: createMissingStructure !== 'false',
    });
  }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.subjects.create(dto);
  }

  @Get('subjects/:slug')
  getSubject(@Param('slug') slug: string) {
    return this.subjects.findOne(slug);
  }

  @Patch('subjects/:slug')
  updateSubject(@Param('slug') slug: string, @Body() dto: UpdateSubjectDto) {
    return this.subjects.update(slug, dto);
  }

  @Delete('subjects/:slug')
  removeSubject(@Param('slug') slug: string) {
    return this.subjects.remove(slug);
  }

  @Get('questions')
  listQuestions(
    @Query('departmentId') departmentId?: string,
    @Query('yearId') yearId?: string,
    @Query('subjectSlug') subjectSlug?: string,
  ) {
    return this.questions.list({ departmentId, yearId, subjectSlug });
  }

  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questions.create(dto);
  }

  @Get('questions/:slug')
  getQuestion(@Param('slug') slug: string) {
    return this.questions.findOne(slug);
  }

  @Patch('questions/:slug')
  updateQuestion(@Param('slug') slug: string, @Body() dto: UpdateQuestionDto) {
    return this.questions.update(slug, dto);
  }

  @Delete('questions/:slug')
  removeQuestion(@Param('slug') slug: string) {
    return this.questions.remove(slug);
  }
}
