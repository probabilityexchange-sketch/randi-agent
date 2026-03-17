import { NextResponse } from "next/server";
import { SelfMaintenanceService, AnalysisResult } from "@/lib/self-maintenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { targetPath, autoFix } = await request.json();
    
    const service = new SelfMaintenanceService();
    const result = await service.runCycle({
      targetPath: targetPath || 'src',
      autoFix: autoFix || false,
      interactive: false
    });
    
    return NextResponse.json({
      success: true,
      analysis: {
        filesAnalyzed: result.analysis.length,
        totalIssues: result.analysis.reduce((sum: number, file: AnalysisResult) => sum + file.issues.length, 0),
        filesWithIssues: result.analysis.filter((f: AnalysisResult) => f.issues.length > 0).length
      },
      plan: {
        totalImprovements: result.plan.improvements.length,
        highPriority: result.plan.summary.highPriority,
        automatable: result.plan.summary.automatable,
        estimatedEffort: result.plan.summary.estimatedTotalEffort,
        recommendations: result.plan.recommendations
      },
      executionResults: result.executionResults
    });
  } catch (error) {
    console.error("Self-maintenance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const service = new SelfMaintenanceService();
    // Return service info
    return NextResponse.json({
      service: "self-maintenance",
      version: "1.0.0",
      description: "Self-maintenance and code quality improvement system",
      endpoints: {
        POST: "/api/self-maintenance - Run self-maintenance analysis and optional auto-fix"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}