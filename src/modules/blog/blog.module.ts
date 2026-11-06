import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogAuthor, BlogAuthorSchema } from './blog-author.schema';
import { BlogPost, BlogPostSchema } from './blog-post.schema';
import { AdminBlogController, BlogController } from './blog.controller';
import { BlogAuthorsService } from './blog-authors.service';
import { BlogRevalidatorService } from './blog-revalidator.service';
import { BlogService } from './blog.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlogPost.name, schema: BlogPostSchema },
      { name: BlogAuthor.name, schema: BlogAuthorSchema },
    ]),
  ],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService, BlogAuthorsService, BlogRevalidatorService],
})
export class BlogModule {}
