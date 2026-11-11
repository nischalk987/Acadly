import { describe, expect, it } from "vitest";
import {
  buildStudyAnalytics,
  formatDuration,
  getRangeForPreset,
  getUtcRangeForLocalDates,
  shiftDateKey,
} from "./studyAnalytics.js";

const base = {
  sessions: [],
  tasks: [],
  subjects: [{ id: "cn", name: "Computer Networks", color: "#7255c8" }],
  chapters: [
    { id: "c1", subject_id: "cn", status: "completed" },
    { id: "c2", subject_id: "cn", status: "in_progress" },
  ],
  timeZone: "Asia/Kolkata",
  start: "2026-11-05",
  end: "2026-11-11",
  todayKey: "2026-11-11",
};

describe("study analytics", () => {
  it("counts each completed positive focus session once and keeps task totals separate", () => {
    const result = buildStudyAnalytics({
      ...base,
      sessions: [
        { id: "s1", session_type: "focus", completed: true, duration_seconds: 1500, started_at: "2026-11-11T03:00:00Z", subject_id: "cn" },
        { id: "s2", session_type: "short_break", completed: true, duration_seconds: 300, started_at: "2026-11-11T03:30:00Z", subject_id: "cn" },
        { id: "s3", session_type: "focus", completed: false, duration_seconds: 1500, started_at: "2026-11-11T04:00:00Z", subject_id: "cn" },
        { id: "s4", session_type: "focus", completed: true, duration_seconds: 0, started_at: "2026-11-11T04:30:00Z", subject_id: "cn" },
      ],
      tasks: [
        { id: "t1", status: "completed", completed_at: "2026-11-11T05:00:00Z" },
        { id: "t2", status: "pending", completed_at: null },
      ],
    });
    expect(result.totalSeconds).toBe(1500);
    expect(result.totalSessions).toBe(1);
    expect(result.completedTasks).toBe(1);
    expect(result.studyDays).toBe(1);
    expect(result.subjectProgress[0]).toMatchObject({ seconds: 1500, sessions: 1, progress: 50 });
  });

  it("assigns sessions and tasks to the profile-local calendar day", () => {
    const result = buildStudyAnalytics({
      ...base,
      sessions: [{ id: "s", session_type: "focus", completed: true, duration_seconds: 60, started_at: "2026-11-10T19:00:00Z" }],
      tasks: [{ id: "t", status: "completed", completed_at: "2026-11-10T19:00:00Z" }],
      start: "2026-11-11",
      end: "2026-11-11",
    });
    expect(result.days[0].date).toBe("2026-11-11");
    expect(result.days[0].seconds).toBe(60);
    expect(result.days[0].tasks).toBe(1);
  });

  it("keeps a streak alive through yesterday but resets after a gap", () => {
    const sessions = ["2026-11-08", "2026-11-09", "2026-11-10"].map((date, index) => ({
      id: String(index), session_type: "focus", completed: true, duration_seconds: 60,
      started_at: date + "T04:00:00Z",
    }));
    expect(buildStudyAnalytics({ ...base, sessions }).currentStreak).toBe(3);
    expect(buildStudyAnalytics({ ...base, sessions: [sessions[0], sessions[2]] }).currentStreak).toBe(0);
  });

  it("computes the best streak in the selected period and chapter summary", () => {
    const sessions = ["2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"].map((date, index) => ({
      id: String(index), session_type: "focus", completed: true, duration_seconds: 60,
      started_at: date + "T04:00:00Z",
    }));
    const result = buildStudyAnalytics({ ...base, sessions });
    expect(result.bestStreak).toBe(3);
    expect(result.completedChapters).toBe(1);
    expect(result.totalChapters).toBe(2);
  });

  it("produces inclusive preset date ranges", () => {
    expect(getRangeForPreset("7d", "2026-11-11")).toEqual({ start: "2026-11-05", end: "2026-11-11" });
    expect(getRangeForPreset("30d", "2026-11-11").start).toBe("2026-10-13");
    expect(shiftDateKey("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("converts local date boundaries using timezone offsets", () => {
    const kolkata = getUtcRangeForLocalDates("2026-11-11", "2026-11-11", "Asia/Kolkata");
    expect(kolkata.startIso).toBe("2026-11-10T18:30:00.000Z");
    expect(kolkata.endExclusiveIso).toBe("2026-11-11T18:30:00.000Z");
  });

  it("formats accumulated minutes without adding planned task time", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(1500)).toBe("25m");
  });
});
