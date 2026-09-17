import {
  Controller,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user.schema';
import { UsersService } from './users.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Instructor, UserRole.Admin)
export class StudentsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.listStudents();
  }

  @Get(':id/avatar')
  async avatar(@Param('id') id: string): Promise<StreamableFile> {
    const { stream, mime } = await this.usersService.getAvatarStreamForUser(id);
    return new StreamableFile(stream, { type: mime, disposition: 'inline' });
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const s = await this.usersService.getStudentById(id);
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }
}

