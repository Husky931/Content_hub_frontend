/**
 * Tests for lib/llm.ts
 * Verifies LLM wrappers: openQuestion, evaluateReply, generateWelcome, generateCongrats.
 */

// Define mock inside factory (jest.mock is hoisted, so const outside won't work)
let mockCreate: jest.Mock;

jest.mock("openai", () => {
  const create = jest.fn();
  // Expose via a property on the class for test access
  class MockOpenAI {
    chat = { completions: { create } };
    static _create = create;
  }
  return { __esModule: true, default: MockOpenAI };
});

import OpenAI from "openai";
import {
  openQuestion,
  evaluateReply,
  generateWelcome,
  generateCongrats,
} from "@/lib/llm";

beforeEach(() => {
  mockCreate = (OpenAI as any)._create;
  mockCreate.mockReset();
});

/** Helper to build a mock completion response */
function mockCompletion(content: string | null) {
  return {
    choices: [{ message: { content } }],
  };
}

// ────────────────────────────────────────────────
// openQuestion
// ────────────────────────────────────────────────

describe("openQuestion", () => {
  it("returns LLM content", async () => {
    mockCreate.mockResolvedValue(mockCompletion("Welcome to the lesson!"));

    const result = await openQuestion("Teach about hooks");
    expect(result).toBe("Welcome to the lesson!");
  });

  it("returns fallback when LLM returns empty", async () => {
    mockCreate.mockResolvedValue(mockCompletion(null));

    const result = await openQuestion("Teach about hooks");
    expect(result).toBe("Alright, let's dive in!");
  });

  it("includes transition note when previousResult provided", async () => {
    mockCreate.mockResolvedValue(mockCompletion("Great job on that last one!"));

    await openQuestion("Teach about hooks", { correct: true, questionNumber: 3 });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toMatch(/correctly answered question 3/);
  });

  it("includes struggling note when previousResult.correct is false", async () => {
    mockCreate.mockResolvedValue(mockCompletion("Let's try something new!"));

    await openQuestion("Teach about hooks", { correct: false, questionNumber: 2 });

    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toMatch(/struggled with question 2/);
  });
});

// ────────────────────────────────────────────────
// evaluateReply
// ────────────────────────────────────────────────

describe("evaluateReply", () => {
  const conversation = [
    { role: "teacher" as const, content: "What is a hook?" },
    { role: "student" as const, content: "A way to use state in functional components" },
  ];

  it("returns parsed JSON result", async () => {
    const llmResponse = JSON.stringify({
      student_is_just_random_guessing: false,
      student_is_attempting_cheating: false,
      last_attempt_correct: true,
      teacher_response: "That's correct!",
    });
    mockCreate.mockResolvedValue(mockCompletion(llmResponse));

    const result = await evaluateReply("Hooks are...", conversation, 1);

    expect(result.last_attempt_correct).toBe(true);
    expect(result.teacher_response).toBe("That's correct!");
    expect(result.student_previous_attempts).toBe(1);
    expect(result.student_is_just_random_guessing).toBe(false);
    expect(result.student_is_attempting_cheating).toBe(false);
  });

  it("returns defaults when LLM returns invalid JSON", async () => {
    mockCreate.mockResolvedValue(mockCompletion("I cannot parse this"));

    const result = await evaluateReply("Hooks are...", conversation, 2);

    expect(result.last_attempt_correct).toBe(false);
    expect(result.student_is_just_random_guessing).toBe(false);
    expect(result.student_is_attempting_cheating).toBe(false);
    expect(result.teacher_response).toBe("Hmm, let me think about that with you...");
    expect(result.student_previous_attempts).toBe(2);
  });

  it("includes reveal rule when attempts >= 5", async () => {
    const llmResponse = JSON.stringify({
      last_attempt_correct: false,
      teacher_response: "Here is the answer...",
    });
    mockCreate.mockResolvedValue(mockCompletion(llmResponse));

    await evaluateReply("Hooks are...", conversation, 5);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find((m: any) => m.role === "system");
    expect(systemMsg.content).toMatch(/CRITICAL OVERRIDE/);
    expect(systemMsg.content).toMatch(/reveal the correct answer/);
  });

  it("includes hint rule when attempts < 5", async () => {
    const llmResponse = JSON.stringify({
      last_attempt_correct: false,
      teacher_response: "Try again!",
    });
    mockCreate.mockResolvedValue(mockCompletion(llmResponse));

    await evaluateReply("Hooks are...", conversation, 2);

    const callArgs = mockCreate.mock.calls[0][0];
    const systemMsg = callArgs.messages.find((m: any) => m.role === "system");
    expect(systemMsg.content).toMatch(/HARD RULE/);
    expect(systemMsg.content).toMatch(/Do NOT reveal the answer/);
  });
});

// ────────────────────────────────────────────────
// generateWelcome
// ────────────────────────────────────────────────

describe("generateWelcome", () => {
  it("returns LLM content", async () => {
    mockCreate.mockResolvedValue(mockCompletion("Hey Alice, welcome back!"));

    const result = await generateWelcome("Alice", ["Lesson 1"], ["Lesson 2", "Lesson 3"]);
    expect(result).toBe("Hey Alice, welcome back!");
  });

  it("returns fallback when LLM returns null", async () => {
    mockCreate.mockResolvedValue(mockCompletion(null));

    const result = await generateWelcome("Bob", [], ["Lesson 1"]);
    expect(result).toBe("Welcome, Bob! Ready to start your training?");
  });
});

// ────────────────────────────────────────────────
// generateCongrats
// ────────────────────────────────────────────────

describe("generateCongrats", () => {
  it("returns LLM content", async () => {
    mockCreate.mockResolvedValue(mockCompletion("Amazing job, Carol!"));

    const result = await generateCongrats("Carol", "Video Editing 101", 95, "Editor Pro");
    expect(result).toBe("Amazing job, Carol!");
  });

  it("returns fallback when LLM returns null", async () => {
    mockCreate.mockResolvedValue(mockCompletion(null));

    const result = await generateCongrats("Dave", "Storytelling", 80, "Storyteller");
    expect(result).toBe("Congratulations, Dave! You've earned the Storyteller tag!");
  });
});
