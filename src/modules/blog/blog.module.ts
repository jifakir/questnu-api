import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogPost, BlogPostSchema } from './blog-post.schema';
import { AdminBlogController, BlogController } from './blog.controller';
import { BlogRevalidatorService } from './blog-revalidator.service';
import { BlogService } from './blog.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlogPost.name, schema: BlogPostSchema },
    ]),
  ],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService, BlogRevalidatorService],
})
export class BlogModule {}
