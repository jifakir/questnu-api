import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../users/user.schema';
import { CgpaService } from './cgpa.service';
import {
  DeleteCourseGradeDto,
  UpdateTargetCgpaDto,
  UpsertCourseGradesDto,
} from './dto/cgpa.dto';

@Controller('users/me/cgpa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Student)
export class CgpaController {
  constructor(private readonly cgpaService: CgpaService) {}

  @Get()
  overview(@CurrentUser() user: JwtPayloadUser) {
    return this.cgpaService.getOverview(user.id);
  }

  @Put('grades')
  upsertGrades(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpsertCourseGradesDto,
  ) {
    return this.cgpaService.upsertGrades(user.id, dto.grades);
  }

  @Delete('grades')
  deleteGrade(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: DeleteCourseGradeDto,
  ) {
    return this.cgpaService.deleteGrade(user.id, dto);
  }

  @Put('target')
  setTarget(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateTargetCgpaDto,
  ) {
    return this.cgpaService.setTargetCgpa(user.id, dto.targetCgpa);
  }

  @Get(':departmentId/:yearId')
  yearDetail(
    @CurrentUser() user: JwtPayloadUser,
    @Param('departmentId') departmentId: string,
    @Param('yearId') yearId: string,
  ) {
    return this.cgpaService.getYearDetail(user.id, departmentId, yearId);
  }
}
