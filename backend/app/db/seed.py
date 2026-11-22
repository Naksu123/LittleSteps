import copy
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.content_catalog import GAME_CONFIGS, LESSON_CONTENT
from app.models import (
    Activity,
    ActivityAttempt,
    AdminProfile,
    Announcement,
    Assignment,
    AuditLog,
    Child,
    ChildReward,
    ClassEnrollment,
    Game,
    HomeActivity,
    HomeActivityProgress,
    LearningGoal,
    LearningObjective,
    Lesson,
    LessonProgress,
    Notification,
    ParentChildRelationship,
    ParentGuide,
    ParentProfile,
    ParentReflection,
    PlatformSetting,
    Quiz,
    QuizQuestion,
    Role,
    SchoolClass,
    SkillProgress,
    Subject,
    TeacherClassAssignment,
    TeacherFeedback,
    TeacherObservation,
    TeacherProfile,
    Theme,
    User,
    UserRole,
    Worksheet,
)


def _seed_id(kind: str, key: str) -> str:
    """Generate a deterministic UUIDv5 so serverless instances share identical seeded IDs."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"littlesteps.edu:{kind}:{key}"))


def _get_or_create_role(db: Session, name: str, description: str) -> Role:
    role = db.scalar(select(Role).where(Role.name == name))
    if not role:
        role = Role(id=_seed_id("role", name), name=name, description=description)
        db.add(role)
        db.flush()
    return role


def _get_or_create_user(
    db: Session,
    email: str,
    full_name: str,
    password_hash: str,
    role: Role,
    sync_existing: bool = False,
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            id=_seed_id("user", email.lower().strip()),
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            is_active=True,
            privacy_consent_accepted_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.flush()
    elif sync_existing:
        user.full_name = full_name
        user.password_hash = password_hash
        db.flush()
    link = db.scalar(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id)
    )
    if not link:
        db.add(UserRole(user_id=user.id, role_id=role.id))
        db.flush()
    return user


def _get_or_create_child(
    db: Session,
    parent: User,
    display_name: str,
    birth_year: int,
    age_group: str,
    avatar_key: str,
    favorite_color: str,
    streak_days: int,
    total_stars: int,
) -> Child:
    child = db.scalar(
        select(Child)
        .join(ParentChildRelationship, ParentChildRelationship.child_id == Child.id)
        .where(
            ParentChildRelationship.parent_user_id == parent.id,
            Child.display_name == display_name,
        )
    )
    if not child:
        child = Child(
            id=_seed_id("child", f"{parent.email}:{display_name.lower()}"),
            display_name=display_name,
            birth_year=birth_year,
            age_group=age_group,
            avatar_key=avatar_key,
            favorite_color=favorite_color,
            mascot_name="Pip",
            daily_goal_minutes=20,
            streak_days=streak_days,
            total_stars=total_stars,
            is_active=True,
        )
        db.add(child)
        db.flush()
        db.add(
            ParentChildRelationship(
                parent_user_id=parent.id,
                child_id=child.id,
                relationship_type="parent",
                is_primary=True,
            )
        )
        db.flush()
    return child


def seed_database(db: Session, sync_existing_users: bool = False) -> dict[str, int]:
    """Populate development and demonstration data idempotently."""
    now = datetime.now(timezone.utc)
    admin_hash = hash_password(settings.SEED_ADMIN_PASSWORD)
    teacher_hash = hash_password(settings.SEED_TEACHER_PASSWORD)
    parent_hash = hash_password(settings.SEED_PARENT_PASSWORD)

    # 1. Roles
    admin_role = _get_or_create_role(db, "admin", "School administrator with full platform governance")
    teacher_role = _get_or_create_role(db, "teacher", "Kindergarten educator managing assigned classes")
    parent_role = _get_or_create_role(db, "parent", "Parent or guardian facilitating home learning")

    # 2. Users & Role Profiles
    admin_user = _get_or_create_user(
        db,
        "admin@littlesteps.edu",
        "Principal Lemuel Ballaran",
        admin_hash,
        admin_role,
        sync_existing=sync_existing_users,
    )
    if not db.scalar(select(AdminProfile).where(AdminProfile.user_id == admin_user.id)):
        db.add(AdminProfile(user_id=admin_user.id, department="Early Childhood", title="School Principal"))

    teacher_user = _get_or_create_user(
        db,
        "teacher@littlesteps.edu",
        "Teacher Ricarte Florenz Montaner III",
        teacher_hash,
        teacher_role,
        sync_existing=sync_existing_users,
    )
    if not db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == teacher_user.id)):
        db.add(
            TeacherProfile(
                user_id=teacher_user.id,
                employee_code="TCH-2026-01",
                specialization="Kindergarten Play-Based Learning",
                bio="Dedicated early childhood educator helping ages 4-6 thrive through play.",
            )
        )

    parent1 = _get_or_create_user(
        db,
        "parent@littlesteps.edu",
        "Maria Reyes",
        parent_hash,
        parent_role,
        sync_existing=sync_existing_users,
    )
    if not db.scalar(select(ParentProfile).where(ParentProfile.user_id == parent1.id)):
        db.add(ParentProfile(user_id=parent1.id, preferred_language="en", daily_screen_limit_mins=30))

    parent2 = _get_or_create_user(
        db,
        "parent2@littlesteps.edu",
        "Carlos Mendoza",
        parent_hash,
        parent_role,
        sync_existing=sync_existing_users,
    )
    if not db.scalar(select(ParentProfile).where(ParentProfile.user_id == parent2.id)):
        db.add(ParentProfile(user_id=parent2.id, preferred_language="en", daily_screen_limit_mins=25))

    db.flush()

    # 3. Children
    mia = _get_or_create_child(db, parent1, "Mia", 2021, "4-5", "bunny", "#FF9C8C", 4, 18)
    leo = _get_or_create_child(db, parent1, "Leo", 2020, "5-6", "dino", "#78C8F5", 2, 12)
    sofia = _get_or_create_child(db, parent2, "Sofia", 2022, "4-5", "fox", "#B8A5F5", 3, 9)

    # 4. Classes, Teacher Assignments & Enrollments
    sunshine = db.scalar(select(SchoolClass).where(SchoolClass.name == "Sunshine Kinders (Ages 4-5)"))
    if not sunshine:
        sunshine = SchoolClass(
            id=_seed_id("class", "sunshine-kinders"),
            name="Sunshine Kinders (Ages 4-5)",
            age_group="4-5",
            academic_year="2026-2027",
            room_label="Room Sunbeam 101",
        )
        db.add(sunshine)
        db.flush()

    rainbow = db.scalar(select(SchoolClass).where(SchoolClass.name == "Rainbow Explorers (Ages 5-6)"))
    if not rainbow:
        rainbow = SchoolClass(
            id=_seed_id("class", "rainbow-explorers"),
            name="Rainbow Explorers (Ages 5-6)",
            age_group="5-6",
            academic_year="2026-2027",
            room_label="Room Rainbow 102",
        )
        db.add(rainbow)
        db.flush()

    for cls in (sunshine, rainbow):
        if not db.scalar(
            select(TeacherClassAssignment).where(
                TeacherClassAssignment.teacher_user_id == teacher_user.id,
                TeacherClassAssignment.class_id == cls.id,
            )
        ):
            db.add(TeacherClassAssignment(teacher_user_id=teacher_user.id, class_id=cls.id, is_lead=True))

    for cls, child in ((sunshine, mia), (sunshine, sofia), (rainbow, leo)):
        if not db.scalar(
            select(ClassEnrollment).where(
                ClassEnrollment.class_id == cls.id, ClassEnrollment.child_id == child.id
            )
        ):
            db.add(ClassEnrollment(class_id=cls.id, child_id=child.id, status="active"))

    # 5. Six Learning Subjects
    subjects_data = [
        ("alphabet-language", "Alphabet & Language", "Phonics, letters, playful reading, and storytelling.", "book-open", "#78C8F5", 1),
        ("mathematics", "Mathematics", "Counting, shapes, patterns, and friendly visual math.", "calculator", "#FFE58A", 2),
        ("science-discovery", "Science & Discovery", "Animals, plants, weather, space, and curiosity.", "sparkles", "#9BE7C4", 3),
        ("social-emotional", "Social & Emotional Learning", "Kindness, sharing, feelings, and friendship.", "heart", "#B8A5F5", 4),
        ("arts-creativity", "Arts & Creativity", "Coloring, music, shapes art, and imagination.", "palette", "#FF9C8C", 5),
        ("life-skills", "Life Skills", "Healthy routines, tidying up, and everyday independence.", "sun", "#78C8F5", 6),
    ]
    subject_map: dict[str, Subject] = {}
    for slug, name, desc, icon, color, order in subjects_data:
        subj = db.scalar(select(Subject).where(Subject.slug == slug))
        if not subj:
            subj = Subject(
                id=_seed_id("subject", slug),
                slug=slug,
                name=name,
                description=desc,
                icon_key=icon,
                color_hex=color,
                sort_order=order,
            )
            db.add(subj)
            db.flush()
        subject_map[slug] = subj

    # 6. Twelve Weekly Themes + Objectives + Parent Guides + Home Activities
    themes_data = [
        (
            1,
            "colors-around-us",
            "Colors Around Us",
            "Discover primary and everyday colors in nature, food, and toys through joyful observation.",
            "#FF9C8C",
            "alphabet-language",
            [
                "Identify primary colors (red, yellow, blue) and secondary colors",
                "Recognize colors in everyday household and classroom objects",
                "Sort familiar items into groups by color",
            ],
            {
                "what": "Your child is exploring primary colors and learning to spot and group colorful objects in daily life.",
                "why": "Color recognition strengthens visual discrimination, descriptive vocabulary, and early classification skills.",
                "materials": ["Colored paper or crayons", "3–5 household toys", "Fresh fruit or safe kitchen items"],
                "prompts": [
                    "What color is this?",
                    "Can you find another object with the same color?",
                    "Which color do you like the most today?",
                ],
                "tip": "Let your child explore and answer independently before offering gentle hints.",
                "duration": 15,
                "teacher_notes": "Week 1 focuses on playful verbal description rather than memorization.",
                "activities": [
                    (
                        "Activity 1: Color Hunt",
                        [
                            "Ask your child to find three red objects safely in the room.",
                            "Let them point to or bring each object to a cozy spot.",
                            "Ask them to name and describe each item together.",
                            "Repeat with yellow or blue and celebrate every discovery!",
                        ],
                        ["Household toys", "Fruit", "Colored cushions or books"],
                        12,
                    ),
                    (
                        "Activity 2: Rainbow Snack Sorting",
                        [
                            "Place colorful fruit slices or healthy snacks on a clean plate.",
                            "Invite your child to group items that share the same color.",
                            "Count how many pieces are in each color group together.",
                        ],
                        ["Safe colorful fruit or snacks", "Clean plate"],
                        10,
                    ),
                ],
            },
        ),
        (2, "my-alphabet-adventure", "My Alphabet Adventure", "Meet friendly letter sounds from A to Z with stories and everyday objects.", "#78C8F5", "alphabet-language",
         ["Recognize initial letter shapes", "Match familiar objects to starting letter sounds"],
         {"what": "Your child is connecting letter shapes with playful sounds in everyday words.",
          "why": "Phonemic awareness builds the joyful foundation for early reading readiness.",
          "materials": ["Picture books", "Paper and chunky crayons"],
          "prompts": ["What sound does your name start with?", "Can we spot a B item in the kitchen?"],
          "tip": "Emphasize the letter sound (e.g., /b/ for ball) more than just the letter name.",
          "duration": 15,
          "teacher_notes": "Focus on letters in your child's own name first!",
          "activities": [("Letter Detective Walk", ["Pick one letter of the day.", "Look around the room for items starting with that sound.", "Draw one discovery together."], ["Paper", "Crayons"], 12)]}),
        (3, "counting-everyday-objects", "Counting Everyday Objects", "Count 1 to 20 using toys, snacks, steps, and playful stories.", "#FFE58A", "mathematics",
         ["Count up to 10–20 with one-to-one correspondence", "Compare small groups using more and fewer"],
         {"what": "Your child is practicing counting real objects one by one instead of rushing through numbers.",
          "why": "One-to-one correspondence helps children connect spoken numbers with real quantities.",
          "materials": ["Wooden blocks or spoons", "Small bowl"],
          "prompts": ["How many spoons are on the table?", "Which pile has more?"],
          "tip": "Touch each object gently as you count aloud together.",
          "duration": 10,
          "teacher_notes": "Keep counting playful during snack time and cleanup.",
          "activities": [("Toy Block Tower Count", ["Stack 5 to 10 blocks together.", "Count each block aloud as it goes on top."], ["Blocks or cups"], 10)]}),
        (4, "shapes-at-home", "Shapes at Home", "Spot circles, squares, triangles, and rectangles hidden in our homes.", "#78C8F5", "mathematics",
         ["Name basic 2D shapes", "Notice shapes in doors, plates, clocks, and windows"],
         {"what": "Your child is learning to spot geometric shapes inside real-world objects.",
          "why": "Shape recognition supports early geometry, spatial reasoning, and drawing confidence.",
          "materials": ["Round plate", "Square napkin", "Folded paper triangle"],
          "prompts": ["How many corners does this window have?", "Is the clock a circle or square?"],
          "tip": "Trace the edges of objects with a finger while naming the shape.",
          "duration": 12,
          "teacher_notes": "Encourage noticing how two triangles can make a square.",
          "activities": [("Kitchen Shape Safari", ["Walk through the kitchen or living room.", "Find one circle, one square, and one rectangle."], ["Household objects"], 12)]}),
        (5, "animals-and-their-homes", "Animals and Their Homes", "Explore where birds, fish, bunnies, and forest friends live and stay cozy.", "#9BE7C4", "science-discovery",
         ["Match familiar animals to their habitats", "Imitate gentle animal sounds and movements"],
         {"what": "Your child is discovering how animals live in nests, burrows, ponds, and forests.",
          "why": "Learning about habitats sparks empathy for living things and scientific curiosity.",
          "materials": ["Animal picture cards or plush toys", "Blanket for a cozy den"],
          "prompts": ["Where does a bird sleep?", "How does a bunny hop?"],
          "tip": "Act out animal movements together for joyful kinesthetic learning.",
          "duration": 15,
          "teacher_notes": "Great week to read animal storybooks before bedtime.",
          "activities": [("Cozy Blanket Habitat", ["Build a pretend nest or burrow with pillows.", "Pick a plush animal and tell a short story about its day."], ["Pillows", "Plush toys"], 15)]}),
        (6, "healthy-food", "Healthy Food", "Celebrate colorful fruits, vegetables, and water that help our bodies grow strong.", "#9BE7C4", "life-skills",
         ["Identify nutritious colorful foods", "Practice making balanced snack choices"],
         {"what": "Your child is learning how colorful fruits, veggies, and water give us energy to play.",
          "why": "Positive food conversations encourage healthy lifelong eating habits.",
          "materials": ["2–3 fruits or vegetables", "Cup of water"],
          "prompts": ["Which crunchy food helps give us energy?", "What colors are on our plate?"],
          "tip": "Invite your child to wash fruit or arrange snacks to build pride.",
          "duration": 12,
          "teacher_notes": "Frame all foods kindly without shame or strict labels.",
          "activities": [("Build a Rainbow Plate", ["Choose three colorful healthy snacks.", "Arrange them like a smiley face or rainbow before eating."], ["Fruits or veggies"], 12)]}),
        (7, "my-five-senses", "My Five Senses", "Use eyes, ears, nose, hands, and taste buds to explore the wonderful world.", "#FFE58A", "science-discovery",
         ["Name the five senses", "Describe textures, sounds, and scents using gentle words"],
         {"what": "Your child is naming sight, hearing, smell, touch, and taste through sensory play.",
          "why": "Sensory observation sharpens mindfulness, descriptive language, and science inquiry.",
          "materials": ["Soft cloth", "Wooden spoon", "Aromatic fruit like orange peel"],
          "prompts": ["How does this towel feel?", "What quiet sounds can we hear right now?"],
          "tip": "Try a 30-second quiet listening moment together by a window.",
          "duration": 10,
          "teacher_notes": "Keep mystery touch items soft and completely safe.",
          "activities": [("Mystery Feel Bag", ["Place a soft sock and a smooth spoon in a cloth bag.", "Let your child guess each item by touch alone."], ["Cloth bag", "Safe soft/smooth objects"], 10)]}),
        (8, "understanding-emotions", "Understanding Emotions", "Name happy, sad, excited, calm, and frustrated feelings with kindness.", "#B8A5F5", "social-emotional",
         ["Recognize facial expressions for core emotions", "Practice calm breathing strategies"],
         {"what": "Your child is learning words for big and small feelings and gentle ways to calm down.",
          "why": "Emotional literacy helps young learners express needs safely and build empathy.",
          "materials": ["Small mirror", "Picture book"],
          "prompts": ["What does a calm face look like?", "What helps when you feel frustrated?"],
          "tip": "Validate every emotion first ('It is okay to feel upset') before problem-solving.",
          "duration": 12,
          "teacher_notes": "Practice 'smell the flower, blow the candle' slow breathing.",
          "activities": [("Mirror Feelings Game", ["Make happy, surprised, and sleepy faces in a mirror together.", "Talk about a time you felt each way."], ["Mirror"], 10)]}),
        (9, "plants-and-gardening", "Plants and Gardening", "Observe seeds, leaves, sunlight, and water helping tiny plants grow.", "#9BE7C4", "science-discovery",
         ["Identify roots, stem, leaves, and flowers", "Understand that plants need water and sunlight"],
         {"what": "Your child is discovering how seeds sprout and what plants need to grow.",
          "why": "Caring for plants fosters patience, responsibility, and wonder about nature.",
          "materials": ["Damp cotton ball or cup", "Dry bean seed", "Water"],
          "prompts": ["What do plants drink?", "Where are the leaves on this plant?"],
          "tip": "Check your sprouted seed at the same time each morning to build routine.",
          "duration": 15,
          "teacher_notes": "Mongo/mung bean seeds sprout quickly in 2–3 days for exciting observation!",
          "activities": [("Cup Sprout Buddy", ["Place a damp paper towel in a clear cup with a bean seed.", "Set it near gentle sunlight and check it daily."], ["Clear cup", "Paper towel", "Bean seed"], 15)]}),
        (10, "community-helpers", "Community Helpers", "Thank doctors, teachers, firefighters, bakers, and neighbors who help us.", "#78C8F5", "social-emotional",
         ["Identify community helpers and their tools", "Practice polite words like thank you and please"],
         {"what": "Your child is learning about helpful roles in our neighborhood and community.",
          "why": "Recognizing helpers builds gratitude, social awareness, and imaginative play.",
          "materials": ["Paper and crayons", "Pretend play props"],
          "prompts": ["Who helps keep us healthy?", "How can we help at home today?"],
          "tip": "Draw a thank-you card together for a family helper or neighbor.",
          "duration": 15,
          "teacher_notes": "Connect helpers to small responsibilities your child can do too.",
          "activities": [("Thank You Card Studio", ["Fold a sheet of paper in half.", "Help your child draw a picture thanking someone helpful."], ["Paper", "Crayons"], 15)]}),
        (11, "weather-and-nature", "Weather and Nature", "Notice sunny skies, fluffy clouds, gentle rain, and breezy days.", "#78C8F5", "science-discovery",
         ["Describe daily weather patterns", "Choose appropriate clothing for sunny or rainy weather"],
         {"what": "Your child is observing daily weather changes and matching clothes to the forecast.",
          "why": "Weather tracking builds observation habits and independent dressing decisions.",
          "materials": ["Window view", "Paper for a simple weather drawing"],
          "prompts": ["What does the sky look like this morning?", "What should we wear if it rains?"],
          "tip": "Make looking outside part of your morning breakfast routine.",
          "duration": 10,
          "teacher_notes": "Celebrate cloudy and rainy days as helpful for plants and trees.",
          "activities": [("Morning Weather Reporter", ["Look out the window together.", "Draw a sun, cloud, or raindrop and pick an outfit to match."], ["Paper", "Crayons"], 10)]}),
        (12, "friendship-and-kindness", "Friendship and Kindness", "Practice sharing, taking turns, gentle hands, and welcoming friends.", "#FF9C8C", "social-emotional",
         ["Demonstrate taking turns during play", "Use kind words to include others"],
         {"what": "Your child is practicing sharing, turn-taking, and kind words with family and classmates.",
          "why": "Social kindness helps children form warm friendships and feel safe at school.",
          "materials": ["Simple ball or board game", "2 plush toys"],
          "prompts": ["How can we take turns with this toy?", "What kind thing can we say to a friend?"],
          "tip": "Praise specific kind actions ('You waited so patiently for your turn!').",
          "duration": 12,
          "teacher_notes": "Celebrate end-of-quarter growth with lots of encouragement.",
          "activities": [("Kindness Roll & Share", ["Sit across from your child and roll a soft ball back and forth.", "Each time you catch it, share one nice thing about someone."], ["Soft ball"], 12)]}),
    ]

    theme_map: dict[int, Theme] = {}
    first_home_activities: list[HomeActivity] = []
    for week, slug, title, summary, color, _subj_slug, objectives, guide_cfg in themes_data:
        theme = db.scalar(select(Theme).where(Theme.week_number == week))
        if not theme:
            theme = Theme(
                id=_seed_id("theme", slug),
                week_number=week,
                slug=slug,
                title=title,
                summary=summary,
                color_hex=color,
                status="published",
                published_at=now,
                created_by=teacher_user.id,
            )
            db.add(theme)
            db.flush()
        theme_map[week] = theme

        if not db.scalar(select(LearningObjective).where(LearningObjective.theme_id == theme.id)):
            for idx, stmt in enumerate(objectives, start=1):
                db.add(
                    LearningObjective(
                        id=_seed_id("objective", f"{slug}:{idx}"),
                        theme_id=theme.id,
                        subject_id=subject_map[_subj_slug].id,
                        statement=stmt,
                        sort_order=idx,
                    )
                )

        if not db.scalar(select(ParentGuide).where(ParentGuide.theme_id == theme.id)):
            db.add(
                ParentGuide(
                    id=_seed_id("parent_guide", slug),
                    theme_id=theme.id,
                    what_child_learns=guide_cfg["what"],
                    why_it_matters=guide_cfg["why"],
                    materials_needed_json=guide_cfg["materials"],
                    conversation_prompts_json=guide_cfg["prompts"],
                    learning_tip=guide_cfg["tip"],
                    estimated_duration_mins=guide_cfg["duration"],
                    teacher_notes=guide_cfg["teacher_notes"],
                )
            )

        if not db.scalar(select(HomeActivity).where(HomeActivity.theme_id == theme.id)):
            for idx, (act_title, steps, mats, mins) in enumerate(guide_cfg["activities"], start=1):
                ha = HomeActivity(
                    id=_seed_id("home_activity", f"{slug}:{idx}"),
                    theme_id=theme.id,
                    title=act_title,
                    instructions_json=steps,
                    materials_json=mats,
                    estimated_minutes=mins,
                    sort_order=idx,
                )
                db.add(ha)
                db.flush()
                if week == 1:
                    first_home_activities.append(ha)
        elif week == 1 and not first_home_activities:
            first_home_activities = list(
                db.scalars(select(HomeActivity).where(HomeActivity.theme_id == theme.id)).all()
            )

    # 7. Lessons (6 lessons covering all 6 subjects) + Activities
    lessons_data = [
        ("alphabet-letter-b", "Find the Letter B", "alphabet-language", 2, "Meet Benny the Bear and find objects that start with the /b/ sound!", 10,
         "Hello explorer! Let's tap every friendly picture that starts with the B sound, like ball and bear."),
        ("counting-fruits-1-10", "Counting Sweet Fruits 1–10", "mathematics", 3, "Count shiny apples, bananas, and oranges alongside Pip the Owl.", 10,
         "Let's count the colorful fruits together! Tap each fruit one by one."),
        ("animal-habitats-explorer", "Where Animals Live", "science-discovery", 5, "Peek inside cozy nests, sunny ponds, and leafy treetops.", 12,
         "Every animal has a special cozy home. Let's match each animal friend to where it lives!"),
        ("feelings-rainbow", "My Feelings Rainbow", "social-emotional", 8, "Discover how happy, calm, excited, and gentle feelings look and feel.", 10,
         "All feelings are welcome here! Let's learn friendly ways to share how we feel."),
        ("primary-colors-studio", "Splash & Mix Primary Colors", "arts-creativity", 1, "Explore red, yellow, and blue paint splashes to brighten our studio.", 12,
         "Tap the red, yellow, and blue paint jars to create cheerful art!"),
        ("sunny-morning-routine", "Happy Morning Helper", "life-skills", 6, "Brush teeth, wash hands, and pick healthy breakfast foods.", 8,
         "Let's follow our happy morning steps together and earn a shiny star!"),
    ]
    lesson_map: dict[str, Lesson] = {}
    for slug, title, subj_slug, week_num, summary, mins, narration in lessons_data:
        lc = LESSON_CONTENT[slug]
        content_payload = {
            "skill": lc["skill"],
            "slides": copy.deepcopy(lc["slides"]),
            "encouragement": "Wonderful effort!",
        }
        activity_payload = copy.deepcopy(lc["activity"])

        lesson = db.scalar(select(Lesson).where(Lesson.slug == slug))
        if not lesson:
            lesson = Lesson(
                id=_seed_id("lesson", slug),
                subject_id=subject_map[subj_slug].id,
                theme_id=theme_map[week_num].id,
                slug=slug,
                title=title,
                summary=summary,
                content_json=content_payload,
                age_group="4-6",
                estimated_minutes=mins,
                audio_narration_text=narration,
                status="published",
                created_by=teacher_user.id,
            )
            db.add(lesson)
            db.flush()
        else:
            lesson.content_json = content_payload
            lesson.audio_narration_text = narration

        activity = db.scalar(
            select(Activity).where(
                Activity.lesson_id == lesson.id,
                Activity.sort_order == 1,
            )
        )
        if not activity:
            db.add(
                Activity(
                    id=_seed_id("activity", f"{slug}:1"),
                    lesson_id=lesson.id,
                    title=f"{title} Practice",
                    activity_type="choice",
                    instructions=activity_payload["rounds"][0]["prompt"],
                    payload_json=activity_payload,
                    sort_order=1,
                )
            )
        else:
            activity.activity_type = "choice"
            activity.instructions = activity_payload["rounds"][0]["prompt"]
            activity.payload_json = activity_payload

        lesson_map[slug] = lesson

    # 8. All 16 Playable Educational Games
    games_data = [
        ("letter-matching", "Letter Matching Adventure", "letter_matching", "alphabet-language", 2, "Match big uppercase letters to friendly lowercase partners."),
        ("number-counting", "Number Counting Basket", "number_counting", "mathematics", 3, "Count the smiling fruits and tap the matching number."),
        ("shape-sorting", "Shape Sorting Train", "shape_sorting", "mathematics", 4, "Place circles, squares, and triangles onto matching train cars."),
        ("memory-matching", "Cozy Memory Flip", "memory_matching", "science-discovery", 1, "Flip colorful cards two at a time to find cheerful pairs."),
        ("animal-sounds", "Animal Sound Guessing", "animal_sounds", "science-discovery", 5, "Listen carefully and tap the animal friend making the sound."),
        ("picture-vocabulary", "Picture Word Garden", "picture_vocabulary", "alphabet-language", 2, "Tap the picture that matches the spoken everyday word."),
        ("puzzle-assembly", "Sunny Puzzle Builder", "puzzle_assembly", "arts-creativity", 4, "Snap four big colorful pieces together to reveal a surprise picture."),
        ("color-recognition", "Color Pop Balloon", "color_recognition", "arts-creativity", 1, "Pop only the balloons that match Pip's favorite color prompt."),
        ("pattern-completion", "Pattern Caterpillar", "pattern_completion", "mathematics", 3, "Choose which friendly shape or color comes next in line."),
        ("object-sorting", "Tidy Toy Sorter", "object_sorting", "life-skills", 6, "Sort toys, books, and snacks into their cozy baskets."),
        ("fruit-addition", "Sunny Fruit Addition", "fruit_addition", "mathematics", 3, "Count both groups of cheerful fruits to find the friendly total!"),
        ("feelings-detective", "Feelings Detective", "feelings_detective", "social-emotional", 8, "Spot happy, calm, surprised, and caring choices with gentle stories."),
        ("healthy-snack-sorter", "Healthy Plate Sorter", "healthy_snack_sorter", "life-skills", 6, "Sort sweet fruits, crunchy veggies, and healthy drinks into colorful bowls."),
        ("weather-dress-up", "Weather & Outfit Match", "weather_dress_up", "science-discovery", 11, "Look at today's sky and pick what helps us stay cozy, dry, or cool!"),
        ("ocean-friends-memory", "Ocean Friends Memory", "ocean_friends_memory", "science-discovery", 5, "Flip ocean bubbles two at a time to match friendly sea creatures."),
        ("space-explorer-puzzle", "Space Explorer Puzzle", "space_explorer_puzzle", "arts-creativity", 7, "Snap four big space puzzle pieces together to blast off!"),
    ]
    for slug, title, gtype, subj_slug, week_num, instructions in games_data:
        game = db.scalar(select(Game).where(Game.slug == slug))
        cfg = copy.deepcopy(GAME_CONFIGS[slug])
        if not game:
            db.add(
                Game(
                    id=_seed_id("game", slug),
                    slug=slug,
                    title=title,
                    game_type=gtype,
                    subject_id=subject_map[subj_slug].id,
                    theme_id=theme_map[week_num].id,
                    instructions=instructions,
                    difficulty_level="easy",
                    config_json=cfg,
                    status="published",
                )
            )
        else:
            game.config_json = cfg
            game.instructions = instructions

    # 9. Sample Quiz + Questions + Worksheets
    quiz = db.scalar(select(Quiz).where(Quiz.title == "Week 1 Colors Mini Check-In"))
    if not quiz:
        quiz = Quiz(
            id=_seed_id("quiz", "week-1-colors-mini-check-in"),
            lesson_id=lesson_map["primary-colors-studio"].id,
            theme_id=theme_map[1].id,
            title="Week 1 Colors Mini Check-In",
            instructions="Tap the picture that matches each color question. Every try earns encouragement!",
            passing_stars=2,
        )
        db.add(quiz)
        db.flush()
        db.add_all(
            [
                QuizQuestion(
                    quiz_id=quiz.id,
                    prompt="Which fruit is bright yellow?",
                    options_json=["Red Strawberry", "Yellow Banana", "Blueberry"],
                    correct_option_index=1,
                    encouragement_text="Bananas are bright yellow like sunshine!",
                    sort_order=1,
                ),
                QuizQuestion(
                    quiz_id=quiz.id,
                    prompt="Which color can we see in a clear daytime sky?",
                    options_json=["Sky Blue", "Purple", "Brown"],
                    correct_option_index=0,
                    encouragement_text="Yes! The daytime sky shines bright blue!",
                    sort_order=2,
                ),
                QuizQuestion(
                    quiz_id=quiz.id,
                    prompt="Which color is a ripe fire truck or sweet strawberry?",
                    options_json=["Green", "Red", "White"],
                    correct_option_index=1,
                    encouragement_text="Wonderful effort! Strawberries are red!",
                    sort_order=3,
                ),
            ]
        )

    for w_week, w_title, w_desc, w_key in [
        (1, "Colors Scavenger Checklist", "Printable checklist for your Week 1 Color Hunt at home.", "worksheets/week1-colors-hunt.pdf"),
        (2, "Letter B Tracing & Coloring Sheet", "Large trace lines and Benny Bear illustration.", "worksheets/week2-letter-b.pdf"),
    ]:
        if not db.scalar(select(Worksheet).where(Worksheet.storage_key == w_key)):
            db.add(
                Worksheet(
                    theme_id=theme_map[w_week].id,
                    title=w_title,
                    description=w_desc,
                    storage_key=w_key,
                    age_group="4-6",
                )
            )

    # 10. Child Progress, Skills, Rewards, Parent Reflections, Observations & Announcements
    if not db.scalar(select(LessonProgress).where(LessonProgress.child_id == mia.id)):
        db.add_all(
            [
                LessonProgress(
                    child_id=mia.id,
                    lesson_id=lesson_map["primary-colors-studio"].id,
                    status="completed",
                    completion_pct=100,
                    stars_earned=5,
                    time_spent_seconds=720,
                    completed_at=now - timedelta(days=2),
                ),
                LessonProgress(
                    child_id=mia.id,
                    lesson_id=lesson_map["alphabet-letter-b"].id,
                    status="completed",
                    completion_pct=100,
                    stars_earned=5,
                    time_spent_seconds=640,
                    completed_at=now - timedelta(days=1),
                ),
                LessonProgress(
                    child_id=mia.id,
                    lesson_id=lesson_map["counting-fruits-1-10"].id,
                    status="in_progress",
                    completion_pct=60,
                    stars_earned=3,
                    time_spent_seconds=360,
                    completed_at=now,
                ),
            ]
        )

    if not db.scalar(select(LessonProgress).where(LessonProgress.child_id == leo.id)):
        db.add(
            LessonProgress(
                child_id=leo.id,
                lesson_id=lesson_map["counting-fruits-1-10"].id,
                status="completed",
                completion_pct=100,
                stars_earned=5,
                time_spent_seconds=540,
                completed_at=now,
            )
        )

    if not db.scalar(select(LessonProgress).where(LessonProgress.child_id == sofia.id)):
        db.add(
            LessonProgress(
                child_id=sofia.id,
                lesson_id=lesson_map["primary-colors-studio"].id,
                status="completed",
                completion_pct=100,
                stars_earned=4,
                time_spent_seconds=480,
                completed_at=now,
            )
        )

    first_game = db.scalar(select(Game).where(Game.slug == "color-recognition"))
    if first_game and not db.scalar(select(ActivityAttempt).where(ActivityAttempt.child_id == mia.id)):
        db.add(
            ActivityAttempt(
                child_id=mia.id,
                game_id=first_game.id,
                score_pct=100,
                stars_earned=3,
                attempts_count=1,
                duration_seconds=180,
                completed=True,
            )
        )

    skills_seed = [
        (mia, "alphabet-language", "Phonics & Initial Sounds", 85, 4),
        (mia, "arts-creativity", "Color Recognition", 95, 5),
        (mia, "mathematics", "Counting 1-10", 72, 3),
        (leo, "mathematics", "Number Sense & Patterns", 88, 4),
        (sofia, "arts-creativity", "Primary Colors", 80, 2),
    ]
    for child_obj, subj_slug, skill_name, mastery, count in skills_seed:
        subj = subject_map[subj_slug]
        if not db.scalar(
            select(SkillProgress).where(
                SkillProgress.child_id == child_obj.id,
                SkillProgress.subject_id == subj.id,
                SkillProgress.skill_name == skill_name,
            )
        ):
            db.add(
                SkillProgress(
                    child_id=child_obj.id,
                    subject_id=subj.id,
                    skill_name=skill_name,
                    mastery_pct=mastery,
                    practice_count=count,
                )
            )

    rewards_seed = [
        (mia, "color_explorer", "Color Explorer", "Completed the Week 1 Colors Around Us adventure!", 5),
        (mia, "letter_friend", "Letter Friend", "Found all the /b/ sound treasures with Benny Bear!", 5),
        (leo, "number_star", "Counting Champ", "Counted fruits 1–10 with Pip the Owl!", 5),
        (sofia, "bright_start", "Bright Start", "Finished your very first LittleSteps adventure!", 4),
    ]
    for child_obj, bkey, btitle, bdesc, bstars in rewards_seed:
        if not db.scalar(
            select(ChildReward).where(ChildReward.child_id == child_obj.id, ChildReward.badge_key == bkey)
        ):
            db.add(
                ChildReward(
                    child_id=child_obj.id,
                    badge_key=bkey,
                    title=btitle,
                    description=bdesc,
                    stars_value=bstars,
                    awarded_at=now,
                )
            )

    if first_home_activities and not db.scalar(
        select(HomeActivityProgress).where(
            HomeActivityProgress.child_id == mia.id,
            HomeActivityProgress.home_activity_id == first_home_activities[0].id,
        )
    ):
        db.add(
            HomeActivityProgress(
                child_id=mia.id,
                home_activity_id=first_home_activities[0].id,
                parent_user_id=parent1.id,
                completed=True,
                completed_at=now,
            )
        )

    if not db.scalar(
        select(ParentReflection).where(
            ParentReflection.parent_user_id == parent1.id,
            ParentReflection.child_id == mia.id,
            ParentReflection.theme_id == theme_map[1].id,
        )
    ):
        db.add(
            ParentReflection(
                parent_user_id=parent1.id,
                child_id=mia.id,
                theme_id=theme_map[1].id,
                enjoyed=True,
                easy_concepts="Spotting red and yellow toys around the living room.",
                challenging_concepts="Distinguishing orange from coral-red crayons.",
                discovery_notes="Mia proudly sorted her plushies by rainbow order!",
            )
        )

    if not db.scalar(select(LearningGoal).where(LearningGoal.child_id == mia.id)):
        db.add(
            LearningGoal(
                child_id=mia.id,
                parent_user_id=parent1.id,
                title="15 minutes of playful discovery 4 days a week",
                target_minutes_per_day=15,
                target_lessons_per_week=3,
                is_active=True,
            )
        )

    if not db.scalar(select(TeacherObservation).where(TeacherObservation.child_id == mia.id)):
        db.add(
            TeacherObservation(
                teacher_user_id=teacher_user.id,
                child_id=mia.id,
                class_id=sunshine.id,
                category="confidence",
                observation_text="Mia enthusiastically helped classmates spot yellow blocks during morning circle!",
                observed_at=now,
            )
        )

    if not db.scalar(
        select(Assignment).where(Assignment.title == "Week 1: Splash & Mix Primary Colors")
    ):
        db.add(
            Assignment(
                teacher_user_id=teacher_user.id,
                class_id=sunshine.id,
                child_id=mia.id,
                lesson_id=lesson_map["primary-colors-studio"].id,
                title="Week 1: Splash & Mix Primary Colors",
                due_date=(now + timedelta(days=3)).date(),
            )
        )

    if not db.scalar(
        select(TeacherFeedback).where(
            TeacherFeedback.teacher_user_id == teacher_user.id,
            TeacherFeedback.parent_user_id == parent1.id,
            TeacherFeedback.child_id == mia.id,
        )
    ):
        db.add(
            TeacherFeedback(
                teacher_user_id=teacher_user.id,
                parent_user_id=parent1.id,
                child_id=mia.id,
                message="Mia shared her red and yellow blocks kindly during circle time and loved naming colors!",
                is_read=False,
            )
        )

    if not db.scalar(select(Announcement).where(Announcement.title == "Welcome to Week 1: Colors Around Us!")):
        db.add(
            Announcement(
                author_user_id=teacher_user.id,
                class_id=sunshine.id,
                title="Welcome to Week 1: Colors Around Us!",
                body="Dear families, check out the Color Hunt activity in your Home Learning Hub—just 10 minutes at home builds wonderful observation skills!",
                published_at=now,
            )
        )

    if not db.scalar(select(Notification).where(Notification.user_id == parent1.id)):
        db.add_all(
            [
                Notification(
                    user_id=parent1.id,
                    title="New Weekly Theme: Colors Around Us",
                    message="Week 1 Home Learning Guide and Color Hunt activity are ready!",
                    category="theme",
                    is_read=False,
                ),
                Notification(
                    user_id=parent1.id,
                    title="Mia earned the Color Explorer badge!",
                    message="Celebrate Mia's playful effort on her first art adventure.",
                    category="milestone",
                    is_read=False,
                ),
            ]
        )

    for key, val, desc in [
        ("child_privacy_mode", {"strict": True, "ra_10173_compliant": True}, "Enforce child PII minimization and guardian consent"),
        ("max_upload_mb", {"limit": 10}, "Maximum size for uploaded media assets"),
    ]:
        if not db.scalar(select(PlatformSetting).where(PlatformSetting.key == key)):
            db.add(PlatformSetting(key=key, value_json=val, description=desc))

    if not db.scalar(select(AuditLog).where(AuditLog.action == "system.seed_initialized")):
        db.add(
            AuditLog(
                actor_user_id=admin_user.id,
                action="system.seed_initialized",
                resource_type="platform",
                resource_id="initial",
                details_json={"environment": "development"},
            )
        )

    db.commit()

    return {
        "users": db.query(User).count(),
        "children": db.query(Child).count(),
        "classes": db.query(SchoolClass).count(),
        "subjects": db.query(Subject).count(),
        "themes": db.query(Theme).count(),
        "lessons": db.query(Lesson).count(),
        "games": db.query(Game).count(),
    }


if __name__ == "__main__":
    sync_users = "--sync-users" in sys.argv
    with SessionLocal() as session:
        counts = seed_database(session, sync_existing_users=sync_users)
        print("LittleSteps seed complete:", counts)
