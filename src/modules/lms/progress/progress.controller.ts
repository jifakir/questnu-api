import {
  Body,
  Controller,
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
import { ProgressService } from './progress.service';
import { SetProgressDto } from './dto/set-progress.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Student)
@Controller()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('lessons/:lessonId/progress')
  setForLesson(
    @CurrentUser() user: JwtPayloadUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: SetProgressDto,
  ) {
    return this.progressService.setForLesson(user, lessonId, dto.status);
  }

  @Get('courses/:courseId/progress/me')
  myProgress(
    @CurrentUser() user: JwtPayloadUser,
    @Param('courseId') courseId: string,
  ) {
    return this.progressService.listForCourse(user, courseId);
  }
}
