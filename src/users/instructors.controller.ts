import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user.schema';
import { UsersService } from './users.service';

@Controller('instructors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class InstructorsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.listInstructors();
  }
}
