import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { AdminEnrollDto } from './dto/admin-enroll.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Student)
  enroll(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.enrollStudent(user, dto.courseId);
  }

  @Post('enrollments/admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  adminEnroll(@Body() dto: AdminEnrollDto) {
    return this.enrollmentsService.adminEnroll(dto.studentId, dto.courseId);
  }

  @Get('enrollments/me')
  mine(@CurrentUser() user: JwtPayloadUser) {
    return this.enrollmentsService.findMine(user);
  }

  @Get('courses/:courseId/enrollment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Student)
  myEnrollment(
    @CurrentUser() user: JwtPayloadUser,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.studentEnrollmentForCourse(user, courseId);
  }

  @Get('courses/:courseId/enrollments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Instructor, UserRole.Admin)
  forCourse(@Param('courseId') courseId: string) {
    return this.enrollmentsService.findForCourse(courseId);
  }

  @Delete('enrollments/:id')
  remove(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.enrollmentsService.removeMine(user, id);
  }
}
