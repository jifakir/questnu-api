import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../auth/decorators/current-user.decorator';
import { UserRole } from '../../../users/user.schema';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Instructor, UserRole.Admin)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  @Get()
  list() {
    return this.coursesService.findAllWithStats();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get(':id/curriculum')
  curriculum(@Param('id') id: string) {
    return this.coursesService.curriculum(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}
