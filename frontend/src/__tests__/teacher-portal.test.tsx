import { render, screen } from "@testing-library/react";
import {
  announcementSchema,
  createAssignmentSchema,
  createLessonSchema,
  teacherObservationSchema,
} from "@/lib/validation";

describe("Teacher Portal validation schemas", () => {
  it("validates lesson creation and requires slide content", () => {
    expect(
      createLessonSchema.safeParse({
        title: "Letter C Discovery",
        subject_id: "subj-1",
        summary: "Explore words starting with C.",
        age_group: "4-5",
        estimated_minutes: 10,
        status: "published",
        slide_title: "Meet C",
        slide_text: "C is for Cat!",
        slide_emoji: "🐱",
      }).success
    ).toBe(true);

    expect(
      createLessonSchema.safeParse({
        title: "X",
        subject_id: "",
        summary: "",
        age_group: "4-5",
        estimated_minutes: 10,
        status: "draft",
        slide_title: "",
        slide_text: "",
        slide_emoji: "🐱",
      }).success
    ).toBe(false);
  });

  it("enforces assignment targets, content, observations, and announcements", () => {
    expect(
      createAssignmentSchema.safeParse({
        title: "Practice Shapes",
        class_id: "cls-1",
        lesson_id: "les-1",
      }).success
    ).toBe(true);

    // Missing class/child target -> fails
    expect(
      createAssignmentSchema.safeParse({
        title: "Practice Shapes",
        lesson_id: "les-1",
      }).success
    ).toBe(false);

    expect(
      teacherObservationSchema.safeParse({
        child_id: "child-1",
        category: "curiosity",
        observation_text: "Mia enjoyed counting colorful blocks.",
      }).success
    ).toBe(true);

    expect(
      announcementSchema.safeParse({
        title: "Storybook Friday",
        body: "Bring your favorite picture book!",
      }).success
    ).toBe(true);
  });

  it("renders supportive teacher guidance without punitive terminology", () => {
    render(
      <section aria-label="Guidance Support">
        <h3>Learners Ready for Gentle Guidance</h3>
        <p>Mia — Gentle extra practice in Counting 1-10 (72%)</p>
      </section>
    );

    expect(
      screen.getByText("Learners Ready for Gentle Guidance")
    ).toBeInTheDocument();
    expect(screen.queryByText(/failed|behind|worst/i)).toBeNull();
  });
});
