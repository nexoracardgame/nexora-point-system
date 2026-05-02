import type { ReactNode } from "react";

type ChatMessageTextProps = {
  text?: string | null;
  mine?: boolean;
};

const URL_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})(?:\/[^\s<>"'`]*)?)/gi;
const TRAILING_URL_PUNCTUATION = new Set([")", "]", "}", ".", ",", "!", "?", ":", ";"]);

function trimTrailingPunctuation(value: string) {
  let linkText = value;
  let trailing = "";

  while (linkText.length > 0) {
    const lastChar = linkText[linkText.length - 1];
    if (!TRAILING_URL_PUNCTUATION.has(lastChar)) {
      break;
    }

    linkText = linkText.slice(0, -1);
    trailing = `${lastChar}${trailing}`;
  }

  return { linkText, trailing };
}

function getSafeHttpHref(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export default function ChatMessageText({ text, mine = false }: ChatMessageTextProps) {
  const source = String(text || "");
  if (!source) {
    return null;
  }

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(URL_PATTERN)) {
    const rawMatch = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(source.slice(lastIndex, index));
    }

    if (index > 0 && source[index - 1] === "@") {
      parts.push(rawMatch);
      lastIndex = index + rawMatch.length;
      continue;
    }

    const { linkText, trailing } = trimTrailingPunctuation(rawMatch);
    const href = getSafeHttpHref(linkText);

    if (!href) {
      parts.push(rawMatch);
      lastIndex = index + rawMatch.length;
      continue;
    }

    parts.push(
      <a
        key={`${index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={`break-all font-bold underline underline-offset-2 ${
          mine
            ? "text-black decoration-black/45 hover:decoration-black"
            : "text-cyan-200 decoration-cyan-200/45 hover:decoration-cyan-100"
        }`}
      >
        {linkText}
      </a>
    );

    if (trailing) {
      parts.push(trailing);
    }

    lastIndex = index + rawMatch.length;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return <span className="whitespace-pre-wrap">{parts}</span>;
}
