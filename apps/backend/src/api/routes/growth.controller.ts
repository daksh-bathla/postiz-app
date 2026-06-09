import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GrowthEngineService } from '@gitroom/backend/services/growth/growth-engine.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';

@ApiTags('Growth')
@Controller('/growth')
export class GrowthController {
  constructor(private growthEngine: GrowthEngineService) {}

  @Post('/generate-opportunities')
  async generateOpportunities(
    @GetOrgFromRequest() org: any,
    @Body() body: any
  ) {
    try {
      const { product, targetTopic, modelConfig } = body;
      const opportunities = await this.growthEngine.generateOpportunities(
        org.id,
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

  @Post('/create-draft')
  async createDraft(
    @GetOrgFromRequest() org: any,
    @Body() body: any
  ) {
    try {
      const { opportunity, integrationIds } = body;
      const post = await this.growthEngine.createDraftFromOpportunity(
        org.id,
        opportunity,
        integrationIds
      );
      return { success: true, post };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  @Post('/schedule-post')
  async schedulePost(
    @GetOrgFromRequest() org: any,
    @Body() body: any
  ) {
    try {
      const { opportunity, integrationIds, scheduleDate } = body;
      const post = await this.growthEngine.scheduleOpportunityPost(
        org.id,
        opportunity,
        integrationIds,
        scheduleDate
      );
      return { success: true, post };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  @Post('/post-now')
  async postNow(
    @GetOrgFromRequest() org: any,
    @Body() body: any
  ) {
    try {
      const { opportunity, integrationIds } = body;
      const post = await this.growthEngine.postOpportunityNow(
        org.id,
        opportunity,
        integrationIds
      );
      return { success: true, post };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
