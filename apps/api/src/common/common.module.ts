import { Global, Module } from '@nestjs/common';
import { PlaceholderService } from './placeholder.service';

@Global()
@Module({
  providers: [PlaceholderService],
  exports: [PlaceholderService],
})
export class CommonModule {}
