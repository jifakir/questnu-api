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
import { UserRole } from '../../../users/user.schema';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Instructor, UserRole.Admin)
@Controller()
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Post('courses/:courseId/modules')
  create(@Param('courseId') courseId: string, @Body() dto: CreateModuleDto) {
    return this.modulesService.create(courseId, dto);
  }

  @Get('courses/:courseId/modules')
  list(@Param('courseId') courseId: string) {
    return this.modulesService.listForCourse(courseId);
  }

  @Post('courses/:courseId/modules/reorder')
  reorder(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderModulesDto,
  ) {
    return this.modulesService.reorder(courseId, dto.moduleIds);
  }

  @Get('modules/:id')
  getOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  @Patch('modules/:id')
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(id, dto);
  }

  @Delete('modules/:id')
  remove(@Param('id') id: string) {
    return this.modulesService.remove(id);
  }
}
