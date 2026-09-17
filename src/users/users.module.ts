import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';
import { StudentsController } from './students.controller';
import { InstructorsController } from './instructors.controller';
import { ProfileController } from './profile.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [StudentsController, InstructorsController, ProfileController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
