import type { Difficulty, Word } from '../types.ts';

export const banks: Record<Difficulty, Word[]> = {
  basic: [
    ["apple", "사과", "I eat an apple every morning."],
    ["water", "물", "Please drink some water."],
    ["friend", "친구", "She is my best friend."],
    ["school", "학교", "We study at school."],
    ["happy", "행복한", "I feel happy when I play."],
    ["small", "작은", "The mouse is very small."],
    ["brave", "용감한", "The brave cat protects us."],
    ["quick", "빠른", "The quick rabbit wins the race."],
    ["sleep", "자다", "I sleep in my bed at night."],
    ["read", "읽다", "I read a book every day."],
    ["build", "짓다", "They build a house together."],
    ["help", "돕다", "Can you help me carry this?"],
    ["forest", "숲", "Many trees grow in the forest."],
    ["strong", "강한", "The strong bear lifts a rock."],
    ["light", "빛", "The sun gives us light."],
    ["dream", "꿈", "My dream is to become a pilot."],
    ["travel", "여행하다", "We travel to new places."],
    ["protect", "보호하다", "A shield can protect you."],
    ["quiet", "조용한", "The library is a quiet place."],
    ["answer", "대답하다", "Please answer my question."]
  ],
  intermediate: [
    ["achieve", "성취하다", "You can achieve your goal with practice."],
    ["improve", "향상시키다", "Reading can improve your vocabulary."],
    ["discover", "발견하다", "Explorers discover new places."],
    ["challenge", "도전", "This difficult puzzle is a challenge."],
    ["patient", "참을성 있는", "Be patient and wait your turn."],
    ["curious", "호기심 많은", "The curious child asks many questions."],
    ["prepare", "준비하다", "We prepare food before the party."],
    ["effort", "노력", "Success takes time and effort."],
    ["compare", "비교하다", "Compare these two pictures."],
    ["decide", "결정하다", "We must decide which road to take."],
    ["instead", "대신에", "I chose tea instead of coffee."],
    ["environment", "환경", "We recycle to protect the environment."],
    ["support", "지원하다", "Our friends support our team."],
    ["increase", "증가하다", "Prices increase when goods are scarce."],
    ["reduce", "줄이다", "Turn off lights to reduce energy use."],
    ["knowledge", "지식", "Books give us knowledge."],
    ["remember", "기억하다", "I remember your name."],
    ["opportunity", "기회", "This is an opportunity to learn."],
    ["confident", "자신감 있는", "She feels confident before the test."],
    ["cooperate", "협력하다", "We cooperate to finish the project."]
  ]
};
