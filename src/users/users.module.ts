import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { College, CollegeSchema } from '../modules/academics/schemas/college.schema';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';
import { StudentsController } from './students.controller';
import { InstructorsController } from './instructors.controller';
import { ProfileController } from './profile.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: College.name, schema: CollegeSchema },
    ]),
  ],
  controllers: [StudentsController, InstructorsController, ProfileController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
