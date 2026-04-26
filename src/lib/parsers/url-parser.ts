import { z } from "zod/v4";

export const ParsedRepoSchema = z.object({
  platform: z.enum(["github", "huggingface"]),
  owner: z.string().min(1),
  repo: z.string().min(1),
  type: z.enum(["model", "dataset", "repo"]).default("repo"),
});

export type ParsedRepo = z.infer<typeof ParsedRepoSchema>;

export function parseRepoUrl(input: string): ParsedRepo {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  let url: URL;
  try {
    const normalized = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(normalized);
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }

  const hostname = url.hostname.replace(/^www\./, "");
  const pathParts = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (hostname === "github.com") {
    if (pathParts.length < 2) {
      throw new Error(
        "GitHub URL must include owner and repository (e.g., github.com/org/repo)"
      );
    }
    return {
      platform: "github",
      owner: pathParts[0],
      repo: pathParts[1],
      type: "repo",
    };
  }

  if (hostname === "huggingface.co" || hostname === "hf.co") {
    if (pathParts[0] === "datasets") {
      if (pathParts.length < 3) {
        throw new Error(
          "HuggingFace dataset URL must include org and name (e.g., huggingface.co/datasets/org/name)"
        );
      }
      return {
        platform: "huggingface",
        owner: pathParts[1],
        repo: pathParts[2],
        type: "dataset",
      };
    }

    if (pathParts.length < 2) {
      throw new Error(
        "HuggingFace URL must include owner and model name (e.g., huggingface.co/org/model)"
      );
    }
    return {
      platform: "huggingface",
      owner: pathParts[0],
      repo: pathParts[1],
      type: "model",
    };
  }

  throw new Error(
    `Unsupported platform: ${hostname}. Only github.com and huggingface.co are supported.`
  );
}
