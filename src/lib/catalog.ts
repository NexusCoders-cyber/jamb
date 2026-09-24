export type Product = {
  slug: string;
  name: string;
  detail: string;
  href: string;
  tone: string;
};

export const productCatalog: Product[] = [
  { slug: "mock-exams", name: "Mock exams", detail: "Full timed CBT simulations", href: "/exam", tone: "bg-[#eeecff] text-[#5145b5]" },
  { slug: "practice", name: "Topic practice", detail: "Past questions by subject and topic", href: "/practice", tone: "bg-[#fff3d9] text-[#9a6814]" },
  { slug: "syllabus", name: "Syllabus hub", detail: "Master every topic in your subjects", href: "/knowledge-hub", tone: "bg-[#e8eef8] text-[#28527d]" },
  { slug: "smart-coach", name: "Smart Coach", detail: "Personal explanations when you get stuck", href: "/smart-coach", tone: "bg-[#f6e9e1] text-[#975334]" },
  { slug: "analytics", name: "Performance analytics", detail: "Find weaknesses and track score trends", href: "/analytics", tone: "bg-[#eee9f8] text-[#654b8d]" },
  { slug: "study-plan", name: "Study plan", detail: "A clear routine for your remaining weeks", href: "/study-plan", tone: "bg-[#e8f2f5] text-[#2d6875]" },
  { slug: "community", name: "Student community", detail: "Discuss difficult questions with peers", href: "/community", tone: "bg-[#f8e8ed] text-[#a24b67]" },
  { slug: "daily-challenge", name: "Daily challenge", detail: "Keep your streak alive with a quick drill", href: "/daily-challenge", tone: "bg-[#f5eee1] text-[#8a6325]" },
];
