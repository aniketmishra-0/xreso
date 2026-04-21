import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { appendMcqQuestionToExcel } from "@/lib/excel";

const ALLOWED_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);
const ALLOWED_OPTIONS = new Set(["A", "B", "C", "D"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    const topic = normalizeText(body.topic);
    const question = normalizeText(body.question);
    const optionA = normalizeText(body.optionA);
    const optionB = normalizeText(body.optionB);
    const optionC = normalizeText(body.optionC);
    const optionD = normalizeText(body.optionD);
    const correctOption = normalizeText(body.correctOption).toUpperCase();
    const difficulty = normalizeText(body.difficulty).toLowerCase() || "beginner";
    const explanation = normalizeText(body.explanation);
    const tags = normalizeText(body.tags);

    if (!topic || !question || !optionA || !optionB) {
      return NextResponse.json(
        { error: "topic, question, optionA, and optionB are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
      return NextResponse.json(
        { error: "difficulty must be beginner, intermediate, or advanced" },
        { status: 400 }
      );
    }

    if (!ALLOWED_OPTIONS.has(correctOption)) {
      return NextResponse.json(
        { error: "correctOption must be one of A, B, C, or D" },
        { status: 400 }
      );
    }

    const questionId = normalizeText(body.questionId) || uuidv4();

    await appendMcqQuestionToExcel({
      questionId,
      topic,
      difficulty: difficulty as "beginner" | "intermediate" | "advanced",
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: correctOption as "A" | "B" | "C" | "D",
      explanation,
      tags,
      status: "published",
      author: session.user.name || "MCQ Team",
      authorEmail: session.user.email || "",
    });

    revalidatePath("/mcq");

    return NextResponse.json({
      ok: true,
      questionId,
      message: "MCQ question saved to MCQ Quiz Bank workbook",
    });
  } catch (error) {
    console.error("POST /api/mcq/create error:", error);
    return NextResponse.json({ error: "Failed to create MCQ question" }, { status: 500 });
  }
}
