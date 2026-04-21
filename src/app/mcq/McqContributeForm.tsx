"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

type SubmitState = "idle" | "submitting" | "success" | "error";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const CORRECT_OPTIONS = ["A", "B", "C", "D"] as const;

type McqContributeFormProps = {
  topicSuggestions: string[];
  isAuthenticated: boolean;
};

export default function McqContributeForm({ topicSuggestions, isAuthenticated }: McqContributeFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    topic: "",
    difficulty: "beginner",
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    explanation: "",
    tags: "",
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/mcq/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setSubmitState("error");
        if (response.status === 401) {
          setMessage("Please sign in first to publish MCQ.");
          return;
        }
        setMessage(payload.error || "Failed to save MCQ question.");
        return;
      }

      setSubmitState("success");
      setMessage(payload.message || "MCQ question saved successfully.");
      router.refresh();
      setForm({
        topic: "",
        difficulty: "beginner",
        question: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctOption: "A",
        explanation: "",
        tags: "",
      });
    } catch {
      setSubmitState("error");
      setMessage("Something went wrong while saving MCQ question.");
    }
  };

  return (
    <div className={styles.formWrap}>
      <button
        type="button"
        className={styles.formToggleBtn}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Hide Form" : "Open MCQ Contributor"}
      </button>

      {open ? (
        <form className={styles.formPanel} onSubmit={handleSubmit}>
          <div className={styles.formIntro}>
            <h3 className={styles.formTitle}>Add a question to MCQ Quiz Bank</h3>
            <p className={styles.formText}>
              Choose an existing topic or type a new one. After save, the topic board refreshes
              automatically.
            </p>
          </div>

          {!isAuthenticated ? (
            <div className={styles.authNotice}>
              <p className={styles.authNoticeText}>
                Sign in is required to publish MCQs.
              </p>
              <Link href="/login?callbackUrl=%2Fmcq" className={styles.authNoticeBtn}>
                Sign In to Continue
              </Link>
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <label className={styles.formField}>
              <span>Topic</span>
              <input
                value={form.topic}
                onChange={(event) => updateField("topic", event.target.value)}
                placeholder="e.g. JavaScript Basics"
                list="mcq-topic-suggestions"
                disabled={!isAuthenticated || submitState === "submitting"}
                required
              />
              <datalist id="mcq-topic-suggestions">
                {topicSuggestions.map((topic) => (
                  <option key={topic} value={topic} />
                ))}
              </datalist>
            </label>

            <label className={styles.formField}>
              <span>Difficulty</span>
              <select
                value={form.difficulty}
                onChange={(event) => updateField("difficulty", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Question</span>
              <textarea
                value={form.question}
                onChange={(event) => updateField("question", event.target.value)}
                rows={3}
                disabled={!isAuthenticated || submitState === "submitting"}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Option A</span>
              <input
                value={form.optionA}
                onChange={(event) => updateField("optionA", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Option B</span>
              <input
                value={form.optionB}
                onChange={(event) => updateField("optionB", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
                required
              />
            </label>

            <label className={styles.formField}>
              <span>Option C</span>
              <input
                value={form.optionC}
                onChange={(event) => updateField("optionC", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
              />
            </label>

            <label className={styles.formField}>
              <span>Option D</span>
              <input
                value={form.optionD}
                onChange={(event) => updateField("optionD", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
              />
            </label>

            <label className={styles.formField}>
              <span>Correct Option</span>
              <select
                value={form.correctOption}
                onChange={(event) => updateField("correctOption", event.target.value)}
                disabled={!isAuthenticated || submitState === "submitting"}
              >
                {CORRECT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.formField}>
              <span>Tags</span>
              <input
                value={form.tags}
                onChange={(event) => updateField("tags", event.target.value)}
                placeholder="js, arrays, basics"
                disabled={!isAuthenticated || submitState === "submitting"}
              />
            </label>

            <label className={`${styles.formField} ${styles.formFieldFull}`}>
              <span>Explanation</span>
              <textarea
                value={form.explanation}
                onChange={(event) => updateField("explanation", event.target.value)}
                rows={3}
                disabled={!isAuthenticated || submitState === "submitting"}
              />
            </label>
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!isAuthenticated || submitState === "submitting"}
            >
              {!isAuthenticated
                ? "Sign In Required"
                : submitState === "submitting"
                  ? "Saving..."
                  : "Publish to Quiz Bank"}
            </button>
            {message ? (
              <p className={submitState === "error" ? styles.formError : styles.formSuccess}>{message}</p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
