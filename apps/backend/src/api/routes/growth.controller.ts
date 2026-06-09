import { Body, Controller, Post, Req, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GrowthEngineService } from '@gitroom/backend/services/growth/growth-engine.service';

@ApiTags('Growth')
@Controller('/growth')
export class GrowthController {
  constructor(private growthEngine: GrowthEngineService) {}

  @Post('/generate-opportunities')
  async generateOpportunities(@Req() req: Request, @Body() body: any) {
    try {
      const { product, targetTopic, modelConfig } = body;
      const opportunities = await this.growthEngine.generateOpportunities(
        (req.user as any)?.organizationId,
        product,
        targetTopic,
        modelConfig
      );
      return { opportunities, hasRealSearch: true };
    } catch (e: any) {
      return { error: e.message, opportunities: [] };
    }
  }

  @Post('/auto-fill')
  async autoFill(@Body() body: any) {
    try {
      const { url, modelConfig } = body;
      const productContext = await this.growthEngine.extractProductContext(url, modelConfig);
      return { productContext };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
