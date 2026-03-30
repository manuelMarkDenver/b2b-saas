import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import type { RequestWithUser } from '../common/auth/auth.types';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.branchesService.list(req.tenant!.id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(req.tenant!.id, req.membership!.role, dto);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(req.tenant!.id, req.membership!.role, id, dto);
  }
}
