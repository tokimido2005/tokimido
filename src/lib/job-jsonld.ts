import { bulletLines, normalizeJobDetails } from "@/lib/cv-shared";
import { isOficial } from "@/lib/job-kinds";
import type { Job } from "@/lib/jobs";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
}

function list(title: string, text: string) {
  const items = bulletLines(text);
  if (items.length === 0) return "";
  return `<p><strong>${esc(title)}</strong></p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

const EXPERIENCE_MONTHS: Record<string, number> = { "1": 12, "3": 36, "5": 60 };
const EDUCATION: Record<string, string> = {
  medii: "high school",
  profesional: "professional certificate",
  superior: "bachelor degree",
};

/**
 * schema.org JobPosting for Google for Jobs.
 * https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
export function jobPostingJsonLd(job: Job, url: string) {
  const official = isOficial(job);
  const details = normalizeJobDetails(job.details);
  const posted = new Date(job.created_at);
  const validThrough = !official && job.starts_at
    ? new Date(job.starts_at)
    : new Date(posted.getTime() + 30 * 24 * 3600 * 1000);

  const description =
    paragraphs(job.description) +
    (official
      ? list("Ce vei face", details.responsibilities) +
        list("Ce cerem", details.requirements) +
        list("Ce oferim", details.offer)
      : "");

  const salaryMax = official && details.salary_max > job.payment_mdl ? details.salary_max : 0;
  const unitText = official ? "MONTH" : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: description || esc(job.title),
    identifier: { "@type": "PropertyValue", name: "Rabotaem.md", value: String(job.id) },
    datePosted: posted.toISOString(),
    validThrough: validThrough.toISOString(),
    employmentType: !official
      ? "TEMPORARY"
      : job.contract_type === "intern"
        ? "INTERN"
        : job.contract_type === "prestari"
          ? "CONTRACTOR"
          : job.contract_type === "determinat"
            ? ["FULL_TIME", "TEMPORARY"]
            : job.schedule === "part"
              ? "PART_TIME"
              : "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: (official && job.company) || job.poster_name || "Rabotaem.md",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(details.address ? { streetAddress: details.address } : {}),
        addressLocality: job.locality || job.raion,
        addressRegion: job.raion,
        addressCountry: "MD",
      },
    },
    ...(job.payment_mdl > 0
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "MDL",
            value: {
              "@type": "QuantitativeValue",
              ...(salaryMax ? { minValue: job.payment_mdl, maxValue: salaryMax } : { value: job.payment_mdl }),
              ...(unitText ? { unitText } : {}),
            },
          },
        }
      : {}),
    ...(official && details.experience
      ? {
          experienceRequirements:
            details.experience === "none"
              ? "no requirements"
              : { "@type": "OccupationalExperienceRequirements", monthsOfExperience: EXPERIENCE_MONTHS[details.experience] },
        }
      : {}),
    ...(official && details.education && EDUCATION[details.education]
      ? { educationRequirements: { "@type": "EducationalOccupationalCredential", credentialCategory: EDUCATION[details.education] } }
      : official && details.education === "any"
        ? { educationRequirements: "no requirements" }
        : {}),
    ...(job.people_needed > 1 ? { totalJobOpenings: job.people_needed } : {}),
    directApply: true,
    url,
  };
}
